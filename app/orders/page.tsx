import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { STATUS_STYLES, formatOrderId } from '@/lib/constants'

const PER_PAGE = 10

const SHOP_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}

const SHOP_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { page: pageParam, q } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1') || 1)
  const search = q?.trim() ?? ''

  const where = {
    userId: session.user.id,
    ...(search ? {
      OR: [
        { orderNumber: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  const [total, orders, shopOrders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    // Match on account or email: a purchase made as a guest with this address
    // should still show up once they're signed in. Pending rows are abandoned
    // checkouts and are deliberately hidden.
    prisma.shopOrder.findMany({
      where: {
        status: { not: 'pending' },
        OR: [
          { userId: session.user.id },
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const totalPages = Math.ceil(total / PER_PAGE)

  // Get unread message counts per order (messages from others since last view).
  // One query for views + one for messages, then tally in memory (avoids an N+1
  // count() per order).
  const orderIds = orders.map(o => o.id)
  const [orderViews, unreadMessages] = await Promise.all([
    prisma.orderView.findMany({
      where: { userId: session.user.id, orderId: { in: orderIds } },
    }),
    prisma.message.findMany({
      where: { orderId: { in: orderIds }, senderId: { not: session.user.id } },
      select: { orderId: true, createdAt: true },
    }),
  ])
  const viewMap = new Map(orderViews.map(v => [v.orderId, v.viewedAt]))

  const unreadMap = new Map<string, number>()
  for (const m of unreadMessages) {
    const lastViewed = viewMap.get(m.orderId)
    if (!lastViewed || m.createdAt > lastViewed) {
      unreadMap.set(m.orderId, (unreadMap.get(m.orderId) ?? 0) + 1)
    }
  }

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">My Orders</h1>
          <p className="text-warm-gray text-sm mt-1">Your custom print orders and shop purchases</p>
        </div>
        <Link href="/orders/new" className="btn-primary whitespace-nowrap">+ New Order</Link>
      </div>

      {/* ---------- Custom orders ---------- */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-display text-charcoal">Custom Orders</h2>
          {total > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-taupe/20 text-warm-gray">{total}</span>
          )}
        </div>
        <p className="text-warm-gray text-xs mb-4">Made to order, priced by quote</p>

        <form method="GET" className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search custom orders…"
              className="input pl-9 w-full"
            />
          </div>
          {search && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-warm-gray">Results for <span className="text-charcoal">&ldquo;{search}&rdquo;</span></span>
              <Link href="/orders" className="text-xs text-warm-gray hover:text-charcoal underline transition-colors">Clear</Link>
            </div>
          )}
        </form>

        {orders.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium text-charcoal text-sm">
              {search ? 'No custom orders found' : 'No custom orders yet'}
            </p>
            <p className="text-sm mt-1 text-warm-gray">
              {search ? `Nothing matches “${search}”.` : 'Start a custom print and we’ll quote it for you.'}
            </p>
            {search ? (
              <Link href="/orders" className="text-sm text-warm-gray hover:text-charcoal underline mt-3 inline-block transition-colors">Clear search</Link>
            ) : (
              <Link href="/orders/new" className="btn-primary mt-4 inline-block">Create Order</Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map((order) => {
                const unread = unreadMap.get(order.id) ?? 0
                return (
                  <div key={order.id} className={`card p-5 flex items-center justify-between hover:border-taupe/30 transition-colors ${unread > 0 ? 'border-blue-400/60' : ''}`}>
                    <Link href={`/orders/${order.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-charcoal text-sm">Order {formatOrderId(order)}</p>
                        {unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-warm-gray mt-0.5 line-clamp-1">{order.description}</p>
                      <p className="text-xs text-warm-gray/60 mt-1">{fmtDate(order.createdAt)}</p>
                    </Link>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[order.status] || 'bg-taupe/20 text-warm-gray'}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      {['delivered', 'completed'].includes(order.status) && (
                        <Link
                          href={`/orders/new?type=${order.orderType ?? 'scratch'}&description=${encodeURIComponent(order.description.slice(0, 500))}`}
                          className="text-xs text-warm-gray hover:text-charcoal border border-taupe/30 px-2 py-1 rounded transition-colors"
                          title="Reorder"
                        >
                          Reorder
                        </Link>
                      )}
                      <Link href={`/orders/${order.id}`}>
                        <svg className="w-4 h-4 text-warm-gray/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-warm-gray">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 && (
                    <Link href={`/orders?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                      className="text-xs px-3 py-1.5 rounded-lg border border-taupe/30 text-warm-gray hover:text-charcoal transition-colors">
                      ← Previous
                    </Link>
                  )}
                  <span className="text-xs text-warm-gray">Page {page} of {totalPages}</span>
                  {page < totalPages && (
                    <Link href={`/orders?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                      className="text-xs px-3 py-1.5 rounded-lg border border-taupe/30 text-warm-gray hover:text-charcoal transition-colors">
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------- Shop orders ---------- */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-display text-charcoal">Shop Orders</h2>
          {shopOrders.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-taupe/20 text-warm-gray">{shopOrders.length}</span>
          )}
        </div>
        <p className="text-warm-gray text-xs mb-4">Items bought directly from the shop</p>

        {shopOrders.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium text-charcoal text-sm">No shop orders yet</p>
            <p className="text-sm mt-1 text-warm-gray">Anything you buy from the shop will appear here.</p>
            <Link href="/listings" className="btn-secondary mt-4 inline-block">Browse Shop</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {shopOrders.map((order) => {
              const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)
              return (
                <div key={order.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal text-sm">
                        Order {order.orderNumber ?? `#${order.id.slice(0, 8).toUpperCase()}`}
                      </p>
                      <p className="text-xs text-warm-gray/60 mt-1">
                        {fmtDate(order.createdAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-charcoal">${order.total.toFixed(2)}</span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${SHOP_STATUS_STYLES[order.status] ?? 'bg-taupe/20 text-warm-gray'}`}>
                        {SHOP_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-taupe/20 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-charcoal/85 truncate">
                          {item.name}
                          {item.quantity > 1 && <span className="text-warm-gray"> x{item.quantity}</span>}
                        </span>
                        <span className="text-warm-gray shrink-0 ml-3">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
