import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PAID_SHOP = ['paid', 'shipped', 'delivered']
const LOW_STOCK_THRESHOLD = 3
const money = (n: number) => `$${n.toFixed(2)}`

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const [orders, etsyOrders, etsyItems, shopItems, products] = await Promise.all([
    prisma.order.findMany({ where: { archivedAt: null, deletedAt: null }, select: { status: true } }),
    prisma.etsyOrder.findMany({
      select: { grandTotal: true, etsyFees: true, salesTax: true, labelCost: true, etsyLabelCost: true },
    }),
    prisma.etsyOrderItem.findMany({
      where: { productId: { not: null } },
      select: { productId: true, quantity: true, price: true },
    }),
    prisma.shopOrderItem.findMany({
      where: { productId: { not: null }, shopOrder: { status: { in: PAID_SHOP } } },
      select: { productId: true, quantity: true, price: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, inStock: true, variations: { select: { label: true, quantity: true, isEnabled: true } } },
    }),
  ])

  const counts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    in_progress: orders.filter((o) => o.status === 'in_progress').length,
    out_for_delivery: orders.filter((o) => ['label_created', 'in_transit', 'out_for_delivery'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }

  // Etsy economics (we have exact fees + shipping for these orders).
  let grossSales = 0
  let fees = 0
  let shipping = 0
  let salesTax = 0
  for (const o of etsyOrders) {
    grossSales += o.grandTotal ?? 0
    fees += o.etsyFees ?? 0
    shipping += o.labelCost ?? o.etsyLabelCost ?? 0
    salesTax += o.salesTax ?? 0
  }
  const netProfit = grossSales - salesTax - fees - shipping

  // Best sellers across Etsy + website.
  const nameById = new Map(products.map((p) => [p.id, p.name]))
  const bestMap = new Map<string, { units: number; revenue: number }>()
  for (const i of [...etsyItems, ...shopItems]) {
    if (!i.productId) continue
    const cur = bestMap.get(i.productId) ?? { units: 0, revenue: 0 }
    cur.units += i.quantity
    cur.revenue += (i.price ?? 0) * i.quantity
    bestMap.set(i.productId, cur)
  }
  const bestSellers = Array.from(bestMap.entries())
    .map(([id, s]) => ({ id, name: nameById.get(id) ?? 'Unknown', ...s }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-charcoal mb-8">Admin Dashboard</h1>

      {/* Profit summary (Etsy) */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Etsy profit</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
        {[
          { label: 'Gross sales', value: money(grossSales), sub: `${etsyOrders.length} orders` },
          { label: 'Etsy fees', value: `−${money(fees)}`, red: true },
          { label: 'Shipping labels', value: `−${money(shipping)}`, red: true },
          { label: 'Net profit', value: money(netProfit), green: netProfit >= 0 },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className={`text-2xl font-bold ${s.green ? 'text-green-700' : s.red ? 'text-red-600' : 'text-charcoal'}`}>{s.value}</p>
            <p className="text-sm font-medium mt-1 text-warm-gray">{s.label}</p>
            {s.sub && <p className="text-xs text-warm-gray/60 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-warm-gray/70 mb-8">
        Sales tax of {money(salesTax)} is collected and remitted by Etsy, so it&apos;s excluded from profit.
      </p>

      {/* Best sellers + Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Best sellers</h2>
          {bestSellers.length === 0 ? (
            <p className="text-sm text-warm-gray">No sales recorded yet.</p>
          ) : (
            <div className="divide-y divide-taupe/15">
              {bestSellers.map((b, i) => (
                <Link key={b.id} href={`/admin/products/${b.id}`} className="flex items-center justify-between py-2.5 group">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-warm-gray/50 w-4">{i + 1}</span>
                    <span className="text-sm text-charcoal truncate group-hover:underline">{b.name}</span>
                  </span>
                  <span className="text-sm text-warm-gray shrink-0">{b.units} sold · {money(b.revenue)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Stock alerts</h2>
          <StockAlerts products={products} />
        </div>
      </div>

      {/* Custom-order pipeline */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Custom-order pipeline</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: counts.pending },
          { label: 'In Progress', value: counts.in_progress },
          { label: 'Shipped', value: counts.out_for_delivery },
          { label: 'Delivered', value: counts.delivered },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-3xl font-bold text-charcoal">{stat.value}</p>
            <p className="text-sm font-medium mt-1 text-warm-gray">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Flags out-of-stock and low-stock (per enabled variation) products.
function StockAlerts({
  products,
}: {
  products: { id: string; name: string; inStock: boolean; variations: { label: string; quantity: number; isEnabled: boolean }[] }[]
}) {
  const alerts: { id: string; name: string; detail: string; tone: 'out' | 'low' }[] = []
  for (const p of products) {
    if (!p.inStock) {
      alerts.push({ id: p.id, name: p.name, detail: 'Out of stock', tone: 'out' })
      continue
    }
    const low = p.variations.filter((v) => v.isEnabled && v.quantity > 0 && v.quantity <= LOW_STOCK_THRESHOLD)
    if (low.length > 0) {
      alerts.push({
        id: p.id,
        name: p.name,
        detail: low.map((v) => `${v.label}: ${v.quantity} left`).join(' · '),
        tone: 'low',
      })
    }
  }

  if (alerts.length === 0) return <p className="text-sm text-warm-gray">Everything&apos;s well stocked. 👍</p>

  return (
    <div className="divide-y divide-taupe/15">
      {alerts.map((a) => (
        <Link key={a.id + a.detail} href={`/admin/products/${a.id}`} className="flex items-center justify-between py-2.5 gap-3 group">
          <span className="text-sm text-charcoal truncate group-hover:underline">{a.name}</span>
          <span className={`text-xs shrink-0 px-2 py-0.5 rounded-full ${a.tone === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {a.detail}
          </span>
        </Link>
      ))}
    </div>
  )
}
