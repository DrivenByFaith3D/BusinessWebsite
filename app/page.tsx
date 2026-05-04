import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatOrderId } from '@/lib/constants'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  if (isAdmin) {
    // Purge expired trash
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await prisma.order.deleteMany({ where: { deletedAt: { not: null, lte: cutoff } } })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const [activeOrders, recentMessages, listingsCount, paidOrders] = await Promise.all([
      prisma.order.findMany({
        where: { archivedAt: null, deletedAt: null },
      }),
      prisma.message.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          sender: { select: { name: true, email: true, role: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.product.count(),
      prisma.order.findMany({
        where: { paymentStatus: 'paid', deletedAt: null, createdAt: { gte: sixMonthsAgo } },
        select: { quote: true, createdAt: true },
      }),
    ])

    const allTimePaid = await prisma.order.aggregate({
      where: { paymentStatus: 'paid', deletedAt: null },
      _sum: { quote: true },
      _count: true,
    })

    const revenueThisMonth = paidOrders
      .filter(o => new Date(o.createdAt) >= startOfMonth)
      .reduce((sum, o) => sum + (o.quote ?? 0), 0)
    const ordersThisMonth = paidOrders.filter(o => new Date(o.createdAt) >= startOfMonth).length
    const revenueAllTime = allTimePaid._sum.quote ?? 0
    const avgOrderValue = allTimePaid._count > 0 ? revenueAllTime / allTimePaid._count : 0

    const monthBuckets: { label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleString('en-US', { month: 'short' })
      const year = d.getFullYear()
      const month = d.getMonth()
      const count = paidOrders.filter(o => {
        const c = new Date(o.createdAt)
        return c.getFullYear() === year && c.getMonth() === month
      }).length
      monthBuckets.push({ label, count })
    }
    const maxBucketCount = Math.max(...monthBuckets.map(b => b.count), 1)

    const counts = {
      pending:     activeOrders.filter((o) => o.status === 'pending').length,
      in_progress: activeOrders.filter((o) => o.status === 'in_progress').length,
      in_transit:  activeOrders.filter((o) => ['label_created', 'in_transit', 'out_for_delivery'].includes(o.status)).length,
      delivered:   activeOrders.filter((o) => ['delivered', 'completed'].includes(o.status)).length,
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-warm-gray text-sm mt-1">Here&apos;s what&apos;s happening with your shop.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Pending',     value: counts.pending,     href: '/admin/orders' },
            { label: 'In Progress', value: counts.in_progress, href: '/admin/orders' },
            { label: 'In Transit',  value: counts.in_transit,  href: '/admin/orders' },
            { label: 'Delivered',   value: counts.delivered,   href: '/admin/orders' },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="card p-5 hover:border-taupe transition-colors">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm font-medium mt-1 text-warm-gray">{stat.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Revenue This Month', value: `$${revenueThisMonth.toFixed(2)}` },
            { label: 'Revenue All Time',   value: `$${revenueAllTime.toFixed(2)}` },
            { label: 'Avg Order Value',    value: avgOrderValue > 0 ? `$${avgOrderValue.toFixed(2)}` : '—' },
            { label: 'Paid This Month',    value: String(ordersThisMonth) },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium mt-1 text-warm-gray">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 mb-6">
          <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-4">Paid Orders — Last 6 Months</p>
          <div className="flex items-end gap-2 h-24">
            {monthBuckets.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs text-warm-gray">{b.count > 0 ? b.count : ''}</span>
                <div
                  className="w-full rounded-sm bg-taupe hover:bg-taupe-dark transition-colors"
                  style={{ height: `${Math.max(4, (b.count / maxBucketCount) * 72)}px` }}
                />
                <span className="text-[10px] text-warm-gray">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b border-taupe/30 flex items-center justify-between">
              <h2 className="font-semibold">Recent Messages</h2>
              <Link href="/admin/orders" className="text-xs text-warm-gray hover:text-charcoal transition-colors">View all orders →</Link>
            </div>
            <div className="divide-y divide-taupe/20">
              {recentMessages.length === 0 && (
                <p className="px-5 py-8 text-center text-warm-gray text-sm">No messages yet</p>
              )}
              {recentMessages.map((msg) => {
                const isAdminMsg = msg.sender.role === 'admin'
                const senderLabel = isAdminMsg ? 'You' : (msg.sender.name || msg.sender.email.split('@')[0])
                const time = new Date(msg.createdAt).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })
                return (
                  <Link key={msg.id} href={`/admin/orders/${msg.order.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-cream transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isAdminMsg ? 'bg-charcoal text-white' : 'bg-taupe text-charcoal'
                    }`}>
                      {senderLabel[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{senderLabel}</span>
                        <span className="text-xs text-warm-gray">on</span>
                        <span className="text-xs font-mono text-warm-gray">
                          {formatOrderId(msg.order)}
                        </span>
                      </div>
                      <p className="text-sm text-warm-gray truncate">{msg.content}</p>
                    </div>
                    <span className="text-xs text-warm-gray shrink-0 mt-0.5">{time}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-taupe/30 flex items-center justify-between">
                <h2 className="font-semibold">Listings</h2>
                <span className="text-xs text-warm-gray">{listingsCount} products</span>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <p className="text-sm text-warm-gray">Manage your shop products and pre-made items.</p>
                <Link href="/listings" className="btn-secondary text-sm text-center">
                  View Listings
                </Link>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold mb-3">Quick Links</h2>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'All Orders',  href: '/admin/orders' },
                  { label: 'All Users',   href: '/admin/users' },
                  { label: 'Admin Panel', href: '/admin' },
                ].map((link) => (
                  <Link key={link.href} href={link.href}
                    className="text-sm text-warm-gray hover:text-charcoal transition-colors flex items-center justify-between py-1.5 border-b border-taupe/20 last:border-0">
                    {link.label}
                    <span className="text-taupe-dark">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Everyone else (logged in or not) sees the same marketing homepage
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[450px] bg-taupe/30">
        <Image
          src="/hero-living-room.jpg"
          alt="Cozy living space"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cream/20 to-cream/60" />
      </section>

      {/* Value prop */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display leading-tight mb-6">
          Precision Prints,<br />Made to Order
        </h1>
        <p className="text-charcoal/70 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
          We specialize in high-quality 3D printed desk organizers. Every print is crafted with care, priced per print hour, so you only pay for exactly what&apos;s made.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/services-store" className="btn-primary px-8 py-3 text-base">
            View Services
          </Link>
          <Link href="/listings" className="btn-secondary px-8 py-3 text-base">
            Our Shop
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-taupe/30 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { title: 'Made to Order', desc: 'Every piece is printed specifically for you — no mass production.' },
              { title: 'Pay Per Hour', desc: 'Transparent pricing based on actual print time. No hidden fees.' },
              { title: 'Premium Quality', desc: 'High-resolution layers for a smooth, professional finish every time.' },
            ].map((f) => (
              <div key={f.title}>
                <h3 className="text-xl font-display mb-2">{f.title}</h3>
                <p className="text-charcoal/60 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
