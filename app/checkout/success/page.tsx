import Stripe from 'stripe'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { applyCheckoutSession, notifyShopPurchase } from '@/lib/shop-payments'
import { paymentHealth } from '@/lib/integration-health'
import CompletePurchase from '@/components/CompletePurchase'
import PurchaseReceipt from '@/components/PurchaseReceipt'
import PaymentWaiting from '@/components/PaymentWaiting'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Purchase confirmation', robots: { index: false, follow: false } }
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  if (!session_id || !/^cs_[A-Za-z0-9_]+$/.test(session_id))
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="font-display text-2xl">Purchase confirmation</h1>
        <p className="mt-3">Use the private link in your purchase confirmation email.</p>
        <Link href="/listings" className="btn-secondary mt-4 inline-block">
          Shop Products
        </Link>
      </div>
    )
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim())
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (!session.metadata?.shopOrderId) throw new Error('Not a shop purchase')
    if (session.payment_status !== 'paid')
      return (
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="font-display text-2xl">Waiting for payment confirmation</h1>
          <p className="mt-3">Your cart is saved. We’ll show your receipt when Stripe confirms payment.</p>
          <PaymentWaiting />
        </div>
      )
    const changed = await applyCheckoutSession(session)
    if (changed) {
      try {
        await notifyShopPurchase(changed)
      } catch {
        await paymentHealth(
          'failed',
          'Payment is recorded, but a receipt email failed. Follow up from the order inbox.',
        ).catch(() => {})
      }
    }
    const order = await prisma.shopOrder.findUniqueOrThrow({
      where: { id: session.metadata.shopOrderId },
      include: { items: true },
    })
    if (!order.paidAt) throw new Error('Payment not recorded')
    return (
      <>
        <CompletePurchase
          sessionId={session.id}
          items={order.items.map((i) => ({ cartKey: i.cartKey, quantity: i.quantity }))}
        />
        <PurchaseReceipt order={order} />
        <div className="max-w-2xl mx-auto px-4 pb-10">
          <Link className="text-sm underline" href={`/purchases/${order.confirmationToken}`}>
            Save your receipt and tracking link
          </Link>
        </div>
      </>
    )
  } catch {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="font-display text-2xl">Checking your purchase</h1>
        <p className="mt-3">
          We couldn’t confirm the purchase yet. Your cart is saved. Check again or contact us before making
          another payment.
        </p>
        <PaymentWaiting />
        <Link className="block underline mt-4" href="/contact">
          Contact us
        </Link>
      </div>
    )
  }
}
