import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { formatOrderId } from '@/lib/constants'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const [order, user] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true, email: true } }),
  ])
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!order.quote) return NextResponse.json({ error: 'No quote set for this order' }, { status: 400 })
  if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 400 })

  const unitAmount = Math.round(order.quote * 100)
  const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()

  try {
    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `3D Print Order ${formatOrderId(order)}`,
              description: order.description.slice(0, 200),
              images: [`${appUrl}/logo.png`],
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: session.user.email }),
      mode: 'payment',
      success_url: `${appUrl}/orders/${orderId}/payment-success`,
      cancel_url: `${appUrl}/orders/${orderId}/payment-cancel`,
      metadata: { orderId, kind: 'full' },
    })

    await prisma.order.update({
      where: { id: orderId },
      data: { stripeSessionId: checkoutSession.id, paymentMethod: 'card' },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    console.error('Stripe checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
