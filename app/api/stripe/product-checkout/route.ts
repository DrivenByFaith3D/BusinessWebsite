import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY.trim())
}

const MAX_QTY = 99

interface CartLine {
  productId?: unknown
  variationId?: unknown
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
  // Keyed by product+variation: two colours of one product are separate lines.
  const wanted = new Map<string, { productId: string; variationId: string | null; quantity: number }>()
  for (const item of rawItems) {
    if (typeof item.productId !== 'string' || !item.productId) continue
    const variationId = typeof item.variationId === 'string' && item.variationId ? item.variationId : null
    const qty = Math.floor(Number(item.quantity))
    if (!Number.isFinite(qty) || qty < 1) continue
    const key = `${item.productId}::${variationId ?? ''}`
    const prev = wanted.get(key)
    wanted.set(key, {
      productId: item.productId,
      variationId,
      quantity: Math.min(MAX_QTY, (prev?.quantity ?? 0) + qty),
    })
  }
  if (wanted.size === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
  }

  const lines = Array.from(wanted.values())

  // Prices always come from the database, never from the client.
  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
    include: { variations: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  const resolved: {
    product: (typeof products)[number]
    variationLabel: string | null
    unitPrice: number
    quantity: number
  }[] = []

  for (const line of lines) {
    const product = byId.get(line.productId)
    if (!product) {
      return NextResponse.json({ error: 'These items are no longer available.' }, { status: 400 })
    }
    if (!product.inStock) {
      return NextResponse.json({ error: `Sorry, ${product.name} is out of stock.` }, { status: 400 })
    }

    let variationLabel: string | null = null
    let unitPrice = product.price

    if (line.variationId) {
      const variation = product.variations.find((v) => v.id === line.variationId)
      if (!variation) {
        return NextResponse.json({ error: 'That option is no longer available.' }, { status: 400 })
      }
      if (!variation.isEnabled || variation.quantity < 1) {
        return NextResponse.json(
          { error: `Sorry, ${product.name} (${variation.label}) is out of stock.` },
          { status: 400 },
        )
      }
      variationLabel = variation.label
      unitPrice = variation.price ?? product.price
    } else if (product.variations.length > 0) {
      // Never guess a variation on the buyer's behalf.
      return NextResponse.json(
        { error: `Please choose an option for ${product.name}.` },
        { status: 400 },
      )
    }

    resolved.push({ product, variationLabel, unitPrice, quantity: line.quantity })
  }

  const lineItems = resolved.map(({ product, variationLabel, unitPrice, quantity }) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: variationLabel ? `${product.name} (${variationLabel})` : product.name,
        description: product.description?.slice(0, 500) ?? undefined,
        ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
      },
      unit_amount: Math.round(unitPrice * 100),
    },
    quantity,
  }))

  const totalItems = resolved.reduce((sum, r) => sum + r.quantity, 0)
  const summary =
    resolved.length === 1
      ? `${resolved[0].product.name}${totalItems > 1 ? ` x${totalItems}` : ''}`
      : `${resolved[0].product.name} and ${resolved.length - 1} more`

  const total = resolved.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0)

  // Signed in? Tie the purchase to the account so it shows in My Orders.
  // Guests still get a recorded order, just without a userId.
  const authSession = await getServerSession(authOptions)
  const userId = authSession?.user?.id ?? null
  const customerEmail =
    authSession?.user?.email ?? (typeof body.customerEmail === 'string' ? body.customerEmail : undefined)

  const count = await prisma.shopOrder.count()
  const orderNumber = `SHOP-${String(count + 1).padStart(4, '0')}`

  // Recorded up front so the webhook only has to flip it to paid. Keeps the exact
  // items and prices we charged, independent of Stripe metadata size limits.
  const shopOrder = await prisma.shopOrder.create({
    data: {
      orderNumber,
      userId,
      email: customerEmail ?? null,
      status: 'pending',
      total: Math.round(total * 100) / 100,
      items: {
        create: resolved.map(({ product, variationLabel, unitPrice, quantity }) => ({
          productId: product.id,
          name: product.name,
          variation: variationLabel,
          price: unitPrice,
          quantity,
        })),
      },
    },
  })

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
        shopOrderId: shopOrder.id,
        // productName is what the confirmation emails read.
        productName: summary,
        itemCount: String(totalItems),
      },
    })

    await prisma.shopOrder.update({
      where: { id: shopOrder.id },
      data: { stripeSessionId: session.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    // Don't leave an orphaned pending order behind if Stripe never opened.
    await prisma.shopOrder.delete({ where: { id: shopOrder.id } }).catch(() => {})
    const message = e instanceof Error ? e.message : 'Stripe error'
    console.error('Product checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
