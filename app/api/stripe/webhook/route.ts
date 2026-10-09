import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { applyCheckoutSession, notifyShopPurchase } from '@/lib/shop-payments'
import { paymentHealth } from '@/lib/integration-health'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY)
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim())
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET.trim())
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  if (
    [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.expired',
      'checkout.session.async_payment_failed',
    ].includes(event.type)
  ) {
    try {
      const changed = await applyCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        event.id,
        event.type === 'checkout.session.async_payment_failed',
      )
      await paymentHealth('ok')
      if (changed) {
        try {
          await notifyShopPurchase(changed)
        } catch {
          await paymentHealth(
            'failed',
            'Payment is recorded, but a receipt email failed. Open the order inbox to follow up.',
          )
        }
      }
    } catch {
      console.error('Stripe payment processing failed; delivery will be retried')
      await paymentHealth(
        'failed',
        'Stripe payment processing failed. Stripe will retry; check the order inbox.',
      ).catch(() => {})
      return NextResponse.json({ error: 'Payment processing failed; retry delivery' }, { status: 500 })
    }
  }
  return NextResponse.json({ received: true })
}
