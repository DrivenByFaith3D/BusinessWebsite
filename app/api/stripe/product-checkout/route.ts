import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY.trim())
}

const MAX_QTY = 99

interface CartLine {
  productId?: unknown
  quantity?: unknown
}

// Shop checkout. Guests are allowed: no sign-in required.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const rawItems: CartLine[] = Array.isArray(body.cartItems) ? body.cartItems : []
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
  }

  // Collapse duplicates and sanitise quantities before touching the database.
  const wanted = new Map<string, number>()
  for (const item of rawItems) {
    if (typeof item.productId !== 'string' || !item.productId) continue
    const qty = Math.floor(Number(item.quantity))
    if (!Number.isFinite(qty) || qty < 1) continue
    wanted.set(item.productId, Math.min(MAX_QTY, (wanted.get(item.productId) ?? 0) + qty))
  }
  if (wanted.size === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
  }

  // Prices always come from the database, never from the client.
  const products = await prisma.product.findMany({ where: { id: { in: Array.from(wanted.keys()) } } })
  if (products.length === 0) {
    return NextResponse.json({ error: 'These items are no longer available.' }, { status: 400 })
  }

  const outOfStock = products.filter((p) => !p.inStock)
  if (outOfStock.length > 0) {
    return NextResponse.json(
      { error: `Sorry, ${outOfStock.map((p) => p.name).join(', ')} is out of stock.` },
      { status: 400 },
    )
  }

  const lineItems = products.map((product) => {
    const quantity = wanted.get(product.id) ?? 1
    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: product.name,
          description: product.description ?? undefined,
          ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
        },
        unit_amount: Math.round(product.price * 100),
      },
      quantity,
    }
  })

  const totalItems = Array.from(wanted.values()).reduce((sum, q) => sum + q, 0)
  const summary =
    products.length === 1
      ? `${products[0].name}${totalItems > 1 ? ` x${totalItems}` : ''}`
      : `${products[0].name} and ${products.length - 1} more`

  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail : undefined
  const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      mode: 'payment',
      success_url: `${appUrl}/listings?purchase=success`,
      cancel_url: `${appUrl}/listings`,
      metadata: {
        // productId keeps the existing webhook branch working; productName is what
        // the confirmation emails read.
        productId: products[0].id,
        productName: summary,
        itemCount: String(totalItems),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    console.error('Product checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
