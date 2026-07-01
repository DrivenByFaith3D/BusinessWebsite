import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { STATUS_STYLES, formatOrderId } from '@/lib/constants'

export default async function CustomerDashboard({ userId }: { userId: string }) {
  const [orders, orderViews] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.orderView.findMany({ where: { userId } }),
  ])

  const viewMap = new Map(orderViews.map(v => [v.orderId, v.viewedAt]))

  const unreadCounts = await Promise.all(
    orders.map(async (order) => {
      const lastViewed = viewMap.get(order.id)
      const count = await prisma.message.count({
        where: {
          orderId: order.id,
          senderId: { not: userId },
          ...(lastViewed ? { createdAt: { gt: lastViewed } } : {}),
        },
      })
      return { orderId: order.id, count }
    })
  )
  const unreadMap = new Map(unreadCounts.map(u => [u.orderId, u.count]))

  const openOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const pendingPayments = orders.filter(o => o.quote && o.paymentStatus !== 'paid' && !['delivered', 'cancelled'].includes(o.status))
  const totalUnread = unreadCounts.reduce((sum, u) => sum + u.count, 0)
  const recentOrders = orders.slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-charcoal">My Dashboard</h1>
        <p className="text-warm-gray text-sm mt-1">Overview of your orders and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        <Link href="/orders" className="card p-5 hover:border-zinc-300 transition-colors">
          <p className="text-3xl font-bold text-charcoal">{openOrders.length}</p>
          <p className="text-sm font-medium mt-1 text-warm-gray">Open Orders</p>
        </Link>
        <Link href="/orders" className="card p-5 hover:border-zinc-300 transition-colors">
          <p className={`text-3xl font-bold ${pendingPayments.length > 0 ? 'text-yellow-600' : 'text-charcoal'}`}>
            {pendingPayments.length}
          </p>
          <p className="text-sm font-medium mt-1 text-warm-gray">Awaiting Payment</p>
        </Link>
        <Link href="/orders" className="card p-5 hover:border-zinc-300 transition-colors col-span-2 sm:col-span-1">
          <p className={`text-3xl font-bold ${totalUnread > 0 ? 'text-blue-600' : 'text-charcoal'}`}>
            {totalUnread}
          </p>
          <p className="text-sm font-medium mt-1 text-warm-gray">Unread Messages</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="font-semibold text-charcoal">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-warm-gray hover:text-charcoal transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-zinc-200">
            {recentOrders.length === 0 && (
              <p className="px-5 py-8 text-center text-warm-gray text-sm">No orders yet.</p>
            )}
            {recentOrders.map((order) => {
              const unread = unreadMap.get(order.id) ?? 0
              return (
                <Link key={order.id} href={`/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-cream transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-charcoal font-mono">{formatOrderId(order)}</span>
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-gray truncate">{order.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {order.quote && order.paymentStatus !== 'paid' && (
                      <span className="text-xs text-yellow-600 font-medium">${order.quote.toFixed(2)} due</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[order.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="font-semibold text-charcoal mb-3">Quick Links</h2>
            <div className="flex flex-col gap-2">
              {[
                { label: 'New Order', href: '/orders/new' },
                { label: 'My Orders', href: '/orders' },
                { label: 'Browse Products', href: '/listings' },
                { label: 'Account Settings', href: '/settings' },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="text-sm text-warm-gray hover:text-charcoal transition-colors flex items-center justify-between py-1.5 border-b border-zinc-200 last:border-0">
                  {link.label}
                  <span className="text-warm-gray">→</span>
                </Link>
              ))}
            </div>
          </div>

          {pendingPayments.length > 0 && (
            <div className="card p-5 border border-yellow-200 bg-yellow-50">
              <h2 className="font-semibold text-yellow-700 mb-2 text-sm">Action Required</h2>
              <p className="text-xs text-warm-gray mb-3">
                {pendingPayments.length === 1 ? 'You have 1 order waiting for payment.' : `You have ${pendingPayments.length} orders waiting for payment.`}
              </p>
              {pendingPayments.slice(0, 2).map(o => (
                <Link key={o.id} href={`/orders/${o.id}`}
                  className="block text-xs font-medium text-yellow-600 hover:text-yellow-700 mb-1 transition-colors">
                  {formatOrderId(o)}, ${o.quote?.toFixed(2)} →
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
