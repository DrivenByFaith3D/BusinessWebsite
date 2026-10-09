import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ShopFulfillmentForm from '@/components/ShopFulfillmentForm'
export const dynamic = 'force-dynamic'
export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions)
  if (auth?.user?.role !== 'admin') redirect('/login')
  const { id } = await params
  const order = await prisma.shopOrder.findUnique({ where: { id }, include: { items: true } })
  if (!order) notFound()
  const address = order.shippingAddress as {
    name?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postal_code?: string
      country?: string
    }
  } | null
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Link href="/admin/inbox" className="text-sm underline">
        ← Order Inbox
      </Link>
      <h1 className="font-display text-3xl">{order.orderNumber ?? order.id.slice(0, 8)}</h1>
      <div className="card p-6 space-y-2">
        <p>{order.email ?? 'Guest — email not yet available'}</p>
        <p className="text-sm">
          Status: {order.status.replaceAll('_', ' ')} · {order.paidAt ? 'Paid' : 'Not paid'} · $
          {(order.amountPaid ?? order.total).toFixed(2)}
        </p>
        {address ? (
          <div className="text-sm whitespace-pre-line">
            <h2 className="font-semibold mt-3">Ship to</h2>
            {[
              address.name,
              address.address?.line1,
              address.address?.line2,
              [address.address?.city, address.address?.state, address.address?.postal_code]
                .filter(Boolean)
                .join(' '),
              address.address?.country,
            ]
              .filter(Boolean)
              .join('\n')}
          </div>
        ) : (
          <p className="text-sm text-warm-gray">
            No shipping address recorded. Contact the buyer before shipping.
          </p>
        )}
        <ul className="divide-y divide-taupe/30">
          {order.items.map((i) => (
            <li key={i.id} className="py-3">
              <p>
                {i.quantity} × {i.name}
                {i.variation ? ` — ${i.variation}` : ''}
              </p>
              {i.personalization && (
                <p className="text-sm whitespace-pre-wrap">Personalization: {i.personalization}</p>
              )}
            </li>
          ))}
        </ul>
        {order.confirmationToken && order.paidAt && (
          <Link className="underline text-sm" href={`/purchases/${order.confirmationToken}`}>
            Customer receipt and tracking page
          </Link>
        )}
      </div>
      {order.paidAt && (
        <ShopFulfillmentForm
          order={{
            id: order.id,
            status: order.status,
            carrier: order.carrier,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
          }}
        />
      )}
    </div>
  )
}
