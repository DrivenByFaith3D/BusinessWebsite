import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getConnection } from '@/lib/etsy-oauth'
import IntegrationHealth from './IntegrationHealth'

export default async function AdminActionCenter({ userId }: { userId: string }) {
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const [
    unread,
    olderCustom,
    olderShop,
    olderEtsy,
    paymentIssues,
    needsQuote,
    readyPrint,
    readyShip,
    health,
    etsyConnection,
  ] = await Promise.all([
    // Compare each order's messages with this owner's last view in one DB query.
    prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*)::bigint AS count FROM "Message" m JOIN "User" u ON u.id = m."senderId" JOIN "Order" o ON o.id = m."orderId" LEFT JOIN "OrderView" v ON v."orderId" = o.id AND v."userId" = ${userId} WHERE u.role <> 'admin' AND o."deletedAt" IS NULL AND o."archivedAt" IS NULL AND (v."viewedAt" IS NULL OR m."createdAt" > v."viewedAt")`,
    prisma.order.count({
      where: {
        deletedAt: null,
        archivedAt: null,
        status: { notIn: ['delivered', 'completed', 'cancelled'] },
        createdAt: { lt: weekAgo },
      },
    }),
    prisma.shopOrder.count({ where: { status: { in: ['paid', 'printing'] }, createdAt: { lt: weekAgo } } }),
    prisma.etsyOrder.count({
      where: {
        isPaid: true,
        isShipped: false,
        OR: [{ status: null }, { NOT: { status: { contains: 'cancel', mode: 'insensitive' } } }],
        orderedAt: { lt: weekAgo },
      },
    }),
    prisma.shopOrder.count({ where: { status: 'payment_failed' } }),
    prisma.order.count({
      where: {
        deletedAt: null,
        archivedAt: null,
        quote: null,
        status: { notIn: ['delivered', 'completed', 'cancelled'] },
      },
    }),
    prisma.shopOrder.count({ where: { status: 'paid' } }),
    prisma.order.count({
      where: { deletedAt: null, archivedAt: null, status: 'in_progress', paymentStatus: 'paid' },
    }),
    prisma.integrationSync.findMany(),
    getConnection(),
  ])
  const cards = [
    { title: 'Unread messages', count: Number(unread[0]?.count ?? 0), href: '/admin/inbox?unread=1' },
    { title: 'Needs quote', count: needsQuote, href: '/admin/inbox?action=Needs+quote' },
    { title: 'Ready to print', count: readyPrint, href: '/admin/inbox?action=Ready+to+print' },
    {
      title: 'Waiting over 7 days',
      count: olderCustom + olderShop + olderEtsy,
      href: '/admin/inbox?older=1',
    },
    { title: 'Payment issues', count: paymentIssues, href: '/admin/inbox?action=Payment+issue' },
  ]
  const entries = ['etsy-products', 'etsy-orders', 'stripe-payments'].map((key) => {
    const e = health.find((e) => e.key === key)
    const stale = e?.status === 'running' && Date.now() - e.lastAttemptAt.getTime() > 15 * 60000
    return {
      key,
      status: stale ? 'failed' : (e?.status ?? 'unknown'),
      lastAttemptAt: e?.lastAttemptAt.toISOString() ?? null,
      lastSuccessAt: e?.lastSuccessAt?.toISOString() ?? null,
      message:
        key === 'etsy-products' &&
        (!etsyConnection?.scope?.split(' ').includes('listings_r') ||
          !etsyConnection?.scope?.split(' ').includes('shops_r'))
          ? 'Etsy now requires inventory and shipping read permissions. Reconnect Etsy once, then retry sync. Saved options and photos are retained.'
          : stale
            ? 'The sync did not finish. Retry to recover.'
            : (e?.message ?? null),
    }
  })
  return (
    <div className="space-y-5 mb-8">
      <div className="flex justify-between items-center gap-3">
        <h2 className="font-display text-xl">Needs your attention</h2>
        <Link href="/admin/inbox" className="btn-primary text-sm">
          Open Order Inbox
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className="card p-4 hover:border-charcoal transition-colors">
            <p className="text-2xl font-display">{c.count}</p>
            <p className="text-xs text-warm-gray mt-1">{c.title}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-warm-gray">
        {readyShip} paid custom order{readyShip === 1 ? '' : 's'} in progress. The inbox shows the next step
        for every channel.
      </p>
      <IntegrationHealth entries={entries} />
    </div>
  )
}
