import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getConnection } from '@/lib/etsy-oauth'
import EtsyOrdersClient from './EtsyOrdersClient'

export const dynamic = 'force-dynamic'

export default async function AdminEtsyOrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const [connection, orders] = await Promise.all([
    getConnection(),
    prisma.etsyOrder.findMany({
      include: { items: { orderBy: { title: 'asc' } } },
      orderBy: { orderedAt: 'desc' },
    }),
  ])

  const unshipped = orders.filter((o) => !o.isShipped).length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-charcoal">Etsy Orders</h1>
      </div>
      <p className="text-sm text-warm-gray mb-6">Orders from your Etsy shop. Buy a label to mark one shipped on Etsy.</p>

      <EtsyOrdersClient
        connected={!!connection}
        initialOrders={orders.map((o) => ({
          id: o.id,
          receiptId: o.receiptId,
          buyerName: o.buyerName,
          status: o.status,
          isPaid: o.isPaid,
          isShipped: o.isShipped,
          grandTotal: o.grandTotal,
          currency: o.currency,
          formattedAddress: o.formattedAddress,
          addrLine1: o.addrLine1,
          addrLine2: o.addrLine2,
          addrCity: o.addrCity,
          addrState: o.addrState,
          addrZip: o.addrZip,
          addrCountry: o.addrCountry,
          messageFromBuyer: o.messageFromBuyer,
          trackingCode: o.trackingCode,
          carrier: o.carrier,
          orderedAt: o.orderedAt.toISOString(),
          items: o.items.map((i) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            price: i.price,
            variations: i.variations,
            productId: i.productId,
          })),
        }))}
        unshipped={unshipped}
      />
    </div>
  )
}
