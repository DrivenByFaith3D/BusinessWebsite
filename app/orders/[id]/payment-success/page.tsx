import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { applyCheckoutSession } from '@/lib/shop-payments'
import PaymentWaiting from '@/components/PaymentWaiting'

export default async function PaymentSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions)
  if (!auth) redirect('/login')
  const { id } = await params
  let order = await prisma.order.findUnique({ where: { id } })
  if (!order || (order.userId !== auth.user.id && auth.user.role !== 'admin')) notFound()
  if (order.paymentStatus !== 'paid' && order.stripeSessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim())
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
      if (session.metadata?.orderId === id && session.payment_status === 'paid') {
        await applyCheckoutSession(session)
        order = await prisma.order.findUniqueOrThrow({ where: { id } })
      }
    } catch {} // Retain a pending state rather than falsely claiming payment succeeded.
  }
  const paid = order.paymentStatus === 'paid'
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-display mb-3">
        {paid ? 'Payment confirmed' : 'Waiting for payment confirmation'}
      </h1>
      <p className="text-warm-gray mb-8">
        {paid
          ? 'Thank you! Your payment is recorded. We’ll keep you updated through your order’s chat.'
          : 'We haven’t confirmed payment yet. Check again before making another payment.'}
      </p>
      {!paid && <PaymentWaiting />}
      <Link href={`/orders/${id}`} className="btn-primary mt-4 inline-block">
        Back to Order
      </Link>
    </div>
  )
}
