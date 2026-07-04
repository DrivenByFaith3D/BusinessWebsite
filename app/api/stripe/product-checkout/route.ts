import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY.trim())
}

export async function POST(req: NextRequest) {
  const { productId, customerEmail } = await req.json()
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description ?? undefined,
              ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: 1,
        },
      ],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      mode: 'payment',
      success_url: `${appUrl}/listings?purchase=success`,
      cancel_url: `${appUrl}/listings`,
      metadata: { productId: product.id, productName: product.name },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
