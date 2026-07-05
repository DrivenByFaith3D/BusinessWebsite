import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AdminOrdersTable from '../AdminOrdersTable'

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  // Purge trash older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await prisma.order.deleteMany({ where: { deletedAt: { not: null, lte: cutoff } } })

  const orders = await prisma.order.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
          addresses: { where: { isDefault: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Get unread counts for admin: messages from non-admins since admin last viewed
  // each order. One query for views + one for messages, tallied in memory (avoids
  // an N+1 count() per order).
  const orderIds = orders.map(o => o.id)
  const [adminViews, nonAdminMessages] = await Promise.all([
    prisma.orderView.findMany({
      where: { userId: session.user.id, orderId: { in: orderIds } },
    }),
    prisma.message.findMany({
      where: { orderId: { in: orderIds }, sender: { role: { not: 'admin' } } },
      select: { orderId: true, createdAt: true },
    }),
  ])
  const adminViewMap = new Map(adminViews.map(v => [v.orderId, v.viewedAt]))

  const unreadMap: Record<string, number> = {}
  for (const m of nonAdminMessages) {
    const lastViewed = adminViewMap.get(m.orderId)
    if (!lastViewed || m.createdAt > lastViewed) {
      unreadMap[m.orderId] = (unreadMap[m.orderId] ?? 0) + 1
    }
  }

  const tableOrders = orders.map((o) => {
    const defaultAddr = o.user.addresses[0] ?? null
    return {
      ...o,
      userEmail: o.user.email,
      userName: o.user.name ?? '',
      userDefaultAddress: defaultAddr ? {
        street: defaultAddr.street,
        city: defaultAddr.city,
        state: defaultAddr.state,
        zip: defaultAddr.zip,
        country: defaultAddr.country,
      } : null,
    }
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-charcoal mb-8">Orders</h1>
      <AdminOrdersTable initialOrders={tableOrders} unreadMap={unreadMap} />
    </div>
  )
}
