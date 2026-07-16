import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { sendEmail, productPurchaseAdminEmailHtml, productPurchaseBuyerEmailHtml } from '@/lib/brevo'
import { logOrderEvent } from '@/lib/events'
import { adminNotifyEmails } from '@/lib/notify'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY.trim())
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { orderId, productId, productName } = session.metadata ?? {}

    if (orderId && session.payment_status === 'paid') {
      // Full custom order payment (paid in full by card)
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'paid', paymentMethod: 'card', status: 'in_progress' },
        select: { userId: true },
      })
      await logOrderEvent(orderId, 'payment_received', 'Payment received')
      // Save Stripe customer ID for portal access
      if (session.customer && typeof session.customer === 'string') {
        await prisma.user.update({
          where: { id: order.userId },
          data: { stripeCustomerId: session.customer },
        }).catch(() => {}) // ignore unique constraint if already set
      }
    } else if (productId && session.payment_status === 'paid') {
      // Product listing purchase, email admin
      try {
        const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
        const amount = (session.amount_total ?? 0) / 100
        const buyerEmail = session.customer_email ?? session.customer_details?.email ?? 'Unknown'
        for (const to of await adminNotifyEmails()) {
          await sendEmail({
            to,
            subject: `New product purchase: ${productName ?? 'Product'}`,
            htmlContent: productPurchaseAdminEmailHtml(productName ?? 'Product', amount, buyerEmail, appUrl),
          })
        }
        // Email the buyer
        if (buyerEmail && buyerEmail !== 'Unknown') {
          await sendEmail({
            to: buyerEmail,
            subject: `Order confirmed: ${productName ?? 'Your order'}`,
            htmlContent: productPurchaseBuyerEmailHtml(productName ?? 'Your order', amount, appUrl),
          })
        }
      } catch (e) {
        console.error('Product purchase email failed:', e)
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId
    if (orderId) {
      // Clear the stripe session so the customer can retry
      await prisma.order.update({
        where: { id: orderId },
        data: { stripeSessionId: null },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ received: true })
}
