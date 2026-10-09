import Link from 'next/link'
import type { ShopOrder, ShopOrderItem } from '@prisma/client'

export default function PurchaseReceipt({ order }: { order: ShopOrder & { items: ShopOrderItem[] } }) {
  const paid = !!order.paidAt
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <p className="text-sm text-warm-gray">{paid ? 'Payment confirmed' : 'Payment pending'}</p>
        <h1 className="font-display text-3xl mt-2">Order {order.orderNumber ?? order.id.slice(0, 8)}</h1>
      </div>
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold">
          {order.status === 'delivered'
            ? 'Your order has been delivered'
            : order.status === 'shipped'
              ? 'Your order is on its way'
              : paid
                ? 'We’re preparing your order'
                : 'Waiting for payment confirmation'}
        </h2>
        <p className="text-sm text-warm-gray">
          {paid
            ? 'Keep this private link to see your receipt and shipping updates. Once your order ships, tracking will appear here.'
            : 'Your cart is still saved. Please wait for payment confirmation before trying again.'}
        </p>
        {order.carrier && <p className="text-sm">Carrier: {order.carrier}</p>}
        {order.trackingNumber && <p className="text-sm">Tracking: {order.trackingNumber}</p>}
        {order.trackingUrl && (
          <a
            className="btn-secondary inline-block"
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Track shipment
          </a>
        )}
      </div>
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Your items</h2>
        <ul className="divide-y divide-taupe/30">
          {order.items.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex justify-between gap-4">
                <p>
                  {i.quantity} × {i.name}
                </p>
                <p className="shrink-0">${(i.price * i.quantity).toFixed(2)}</p>
              </div>
              {i.variation && <p className="text-sm text-warm-gray mt-1">{i.variation}</p>}
              {i.personalization && (
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                  Personalization: {i.personalization}
                </p>
              )}
            </li>
          ))}
        </ul>
        <dl className="border-t border-taupe/30 mt-4 pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd>${order.total.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>${(order.shippingCharged ?? 0).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>${(order.taxCollected ?? 0).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{paid ? 'Amount paid' : 'Subtotal'}</dt>
            <dd>${(order.amountPaid ?? order.total).toFixed(2)}</dd>
          </div>
        </dl>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Link href="/listings" className="btn-primary">
          Shop Products
        </Link>
        <Link href="/contact" className="btn-secondary">
          Questions about your order?
        </Link>
      </div>
    </div>
  )
}
