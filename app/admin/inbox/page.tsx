import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { customAction, shopAction, etsyAction, type InboxAction } from '@/lib/order-inbox'
export const dynamic = 'force-dynamic'
const actions: InboxAction[] = [
  'Needs quote',
  'Awaiting payment',
  'Ready to print',
  'Ready to ship',
  'Shipped',
  'Completed',
  'Payment issue',
  'Cancelled',
]
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    channel?: string
    action?: string
    page?: string
    older?: string
    unread?: string
  }>
}) {
  const auth = await getServerSession(authOptions)
  if (auth?.user?.role !== 'admin') redirect('/login')
  const filters = await searchParams
  const q = (filters.q ?? '').trim().toLowerCase().slice(0, 200)
  const page = Math.max(1, Math.min(10000, Number(filters.page) || 1))
  const [custom, shop, etsy, views, messages] = await Promise.all([
    prisma.order.findMany({
      where: { deletedAt: null, archivedAt: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        quote: true,
        paymentStatus: true,
        createdAt: true,
        description: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shopOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        total: true,
        createdAt: true,
        expiresAt: true,
        items: { select: { name: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.etsyOrder.findMany({
      select: {
        id: true,
        receiptId: true,
        buyerName: true,
        isPaid: true,
        isShipped: true,
        status: true,
        grandTotal: true,
        orderedAt: true,
        items: { select: { title: true, quantity: true } },
      },
      orderBy: { orderedAt: 'desc' },
    }),
    prisma.orderView.findMany({ where: { userId: auth.user.id }, select: { orderId: true, viewedAt: true } }),
    prisma.message.groupBy({
      by: ['orderId'],
      where: { sender: { role: { not: 'admin' } }, order: { deletedAt: null, archivedAt: null } },
      _max: { createdAt: true },
    }),
  ])
  const seen = new Map(views.map((v) => [v.orderId, v.viewedAt]))
  const latest = new Map(messages.map((m) => [m.orderId, m._max.createdAt]))
  const rows = [
    ...custom.map((o) => ({
      key: `custom:${o.id}`,
      channel: 'custom',
      number: o.orderNumber ?? o.id.slice(0, 8),
      buyer: o.user.name ?? o.user.email,
      description: o.description,
      amount: o.quote,
      createdAt: o.createdAt,
      action: customAction(o),
      href: `/admin/orders/${o.id}`,
      unread: !!latest.get(o.id) && (!seen.get(o.id) || latest.get(o.id)! > seen.get(o.id)!),
    })),
    ...shop.map((o) => ({
      key: `website:${o.id}`,
      channel: 'website',
      number: o.orderNumber ?? o.id.slice(0, 8),
      buyer: o.email ?? 'Guest',
      description: o.items.map((i) => `${i.quantity} × ${i.name}`).join(', '),
      amount: o.total,
      createdAt: o.createdAt,
      action: shopAction(
        o.status === 'pending' && o.expiresAt && o.expiresAt < new Date() ? 'expired' : o.status,
      ),
      href: `/admin/shop-orders/${o.id}`,
      unread: false,
    })),
    ...etsy.map((o) => ({
      key: `etsy:${o.id}`,
      channel: 'etsy',
      number: o.receiptId,
      buyer: o.buyerName ?? 'Etsy buyer',
      description: o.items.map((i) => `${i.quantity} × ${i.title}`).join(', '),
      amount: o.grandTotal,
      createdAt: o.orderedAt,
      action: etsyAction(o),
      href: `/admin/etsy-orders?receipt=${encodeURIComponent(o.receiptId)}`,
      unread: false,
    })),
  ]
    .filter(
      (o) =>
        (!filters.channel || o.channel === filters.channel) &&
        (!filters.action || o.action === filters.action) &&
        (!q || `${o.number} ${o.buyer} ${o.description}`.toLowerCase().includes(q)) &&
        (filters.unread !== '1' || o.unread) &&
        (filters.older !== '1' ||
          (o.createdAt.getTime() < Date.now() - 7 * 86400000 &&
            !['Completed', 'Cancelled', 'Payment issue'].includes(o.action))),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const pages = Math.max(1, Math.ceil(rows.length / 30))
  const current = Math.min(Math.floor(page), pages)
  function pageLink(n: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v && k !== 'page') params.set(k, v)
    params.set('page', String(n))
    return `/admin/inbox?${params}`
  }
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl">Order Inbox</h1>
      <p className="text-sm text-warm-gray mt-2">
        Website purchases, Etsy orders, and custom print requests in one place.
      </p>
      <form className="card p-4 my-6 grid sm:grid-cols-4 gap-3">
        <label className="text-sm">
          Search
          <input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Order, customer, or item"
            className="block w-full border border-taupe rounded-lg p-2 mt-1"
          />
        </label>
        <label className="text-sm">
          Channel
          <select
            name="channel"
            defaultValue={filters.channel ?? ''}
            className="block w-full border border-taupe rounded-lg p-2 mt-1"
          >
            <option value="">All channels</option>
            <option value="website">Website shop</option>
            <option value="etsy">Etsy</option>
            <option value="custom">Custom print</option>
          </select>
        </label>
        <label className="text-sm">
          Next step
          <select
            name="action"
            defaultValue={filters.action ?? ''}
            className="block w-full border border-taupe rounded-lg p-2 mt-1"
          >
            <option value="">All steps</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary self-end">Filter orders</button>
        <label className="text-xs flex items-center gap-2">
          <input name="older" type="checkbox" value="1" defaultChecked={filters.older === '1'} />
          Waiting over 7 days
        </label>
        <label className="text-xs flex items-center gap-2">
          <input name="unread" type="checkbox" value="1" defaultChecked={filters.unread === '1'} />
          Unread messages
        </label>
        <Link className="text-xs underline" href="/admin/inbox">
          Clear filters
        </Link>
      </form>
      <p className="text-xs text-warm-gray mb-3">
        {rows.length} matching order{rows.length === 1 ? '' : 's'}
      </p>
      <div className="space-y-3">
        {rows.slice((current - 1) * 30, current * 30).map((o) => (
          <Link key={o.key} href={o.href} className="card p-5 block hover:border-charcoal transition-colors">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase text-warm-gray">
                  {o.channel === 'website'
                    ? 'Website shop'
                    : o.channel === 'custom'
                      ? 'Custom print'
                      : 'Etsy'}{' '}
                  · {o.number}
                </p>
                <h2 className="font-medium mt-1 break-words">
                  {o.buyer}
                  {o.unread && <span className="ml-2 text-xs text-blue-700">Unread message</span>}
                </h2>
                <p className="text-sm text-warm-gray line-clamp-2 mt-1">{o.description}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs rounded-full bg-taupe/20 px-3 py-1 inline-block">{o.action}</span>
                <p className="text-sm mt-2">
                  {o.amount == null ? 'Quote needed' : `$${o.amount.toFixed(2)}`}
                </p>
                <p className="text-xs text-warm-gray mt-1">{o.createdAt.toLocaleDateString('en-US')}</p>
              </div>
            </div>
          </Link>
        ))}
        {!rows.length && (
          <div className="card p-10 text-center text-warm-gray">No orders match these filters.</div>
        )}
      </div>
      {pages > 1 && (
        <div className="flex justify-between items-center mt-6">
          {current > 1 ? (
            <Link className="btn-secondary" href={pageLink(current - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs">
            Page {current} of {pages}
          </span>
          {current < pages ? (
            <Link className="btn-secondary" href={pageLink(current + 1)}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-sm underline mt-8">
        <Link href="/admin/orders">Custom order tools and archive</Link>
        <Link href="/admin/etsy-orders">Etsy shipping tools</Link>
        <Link href="/admin">Business overview</Link>
      </div>
    </div>
  )
}
