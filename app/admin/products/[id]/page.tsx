import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import ColorImageMapper from './ColorImageMapper'

export const dynamic = 'force-dynamic'

// Website orders only count as sales once they're actually paid.
const PAID_STATUSES = ['paid', 'shipped', 'delivered']

export default async function AdminProductDashboard({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: { rank: 'asc' } },
      variations: { orderBy: { rank: 'asc' } },
      colorImages: true,
    },
  })
  if (!product) notFound()

  // Distinct colour values (the picker property) and their current photo mapping.
  const optionName = product.variations[0]?.options
    ? ((product.variations[0].options as { name: string }[])[0]?.name ?? 'Colour')
    : 'Colour'
  const colorValues = Array.from(
    new Set(
      product.variations.flatMap((v) => {
        const opts = v.options as { name: string; value: string }[]
        const opt = opts.find((o) => o.name === optionName) ?? opts[0]
        return opt?.value ? [opt.value] : []
      }),
    ),
  )
  const colorMap = new Map(product.colorImages.map((c) => [c.value, c.etsyImageId]))

  const [etsyItems, shopItems, etsyReviews, siteReviews] = await Promise.all([
    prisma.etsyOrderItem.findMany({
      where: { productId: product.id },
      include: { order: true },
    }),
    prisma.shopOrderItem.findMany({
      where: { productId: product.id },
      include: { shopOrder: true },
    }),
    prisma.etsyReview.findMany({
      where: { productId: product.id },
      orderBy: { reviewedAt: 'desc' },
    }),
    prisma.review.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  // Unify both channels into one sales list.
  type Sale = {
    key: string
    channel: 'Etsy' | 'Website'
    date: Date
    buyer: string | null
    variation: string | null
    quantity: number
    lineTotal: number | null
    ref: string | null
    href: string | null
  }

  const sales: Sale[] = [
    ...etsyItems.map((i): Sale => ({
      key: i.id,
      channel: 'Etsy',
      date: i.order.orderedAt,
      buyer: i.order.buyerName,
      variation: i.variations,
      quantity: i.quantity,
      lineTotal: i.price != null ? Math.round(i.price * i.quantity * 100) / 100 : null,
      ref: i.order.receiptId,
      href: '/admin/etsy-orders',
    })),
    ...shopItems
      .filter((i) => PAID_STATUSES.includes(i.shopOrder.status))
      .map((i): Sale => ({
        key: i.id,
        channel: 'Website',
        date: i.shopOrder.paidAt ?? i.shopOrder.createdAt,
        buyer: i.shopOrder.email,
        variation: i.variation,
        quantity: i.quantity,
        lineTotal: Math.round(i.price * i.quantity * 100) / 100,
        ref: i.shopOrder.orderNumber,
        href: '/admin/orders',
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const unitsSold = sales.reduce((s, x) => s + x.quantity, 0)
  const revenue = sales.reduce((s, x) => s + (x.lineTotal ?? 0), 0)

  const ratings = [...etsyReviews.map((r) => r.rating), ...siteReviews.map((r) => r.rating)]
  const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null
  const reviewCount = ratings.length

  // Unify reviews with their comment text for the "comments" feed.
  type Comment = { key: string; source: string; rating: number; text: string | null; who: string | null; date: Date; imageUrl?: string | null }
  const comments: Comment[] = [
    ...etsyReviews.map((r): Comment => ({ key: r.id, source: 'Etsy', rating: r.rating, text: r.review, who: null, date: r.reviewedAt, imageUrl: r.imageUrl })),
    ...siteReviews.map((r): Comment => ({ key: r.id, source: 'Website', rating: r.rating, text: r.comment, who: r.user?.name ?? r.user?.email ?? null, date: r.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const money = (n: number) => `$${n.toFixed(2)}`
  const stars = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link href="/admin/products" className="text-sm text-warm-gray hover:text-charcoal inline-flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        All items
      </Link>

      {/* Header */}
      <div className="card p-5 mb-6 flex flex-col sm:flex-row gap-5">
        <div className="w-full sm:w-40 aspect-video sm:aspect-square shrink-0 bg-taupe/5 rounded-lg overflow-hidden relative">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-warm-gray text-xs">No image</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-charcoal leading-snug">{product.name}</h1>
          <p className="text-lg font-display text-charcoal mt-1">{money(product.price)}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-taupe/20 text-warm-gray'}`}>
              {product.inStock ? 'In stock' : 'Out of stock'}
            </span>
            {product.etsyListingId && <span className="text-[10px] text-warm-gray/70">from Etsy</span>}
          </div>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Link href={`/listings/${product.id}`} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              View retail page
            </Link>
            <span className="text-xs text-warm-gray">See this item as a customer does</span>
          </div>
        </div>
      </div>

      {/* Colour photos */}
      {colorValues.length > 0 && product.images.some((i) => i.etsyImageId) && (
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-1">Colour photos</h2>
          <p className="text-xs text-warm-gray mb-4">
            Pick which photo shows each {optionName.toLowerCase()}. Customers see it when they select that colour.
          </p>
          <ColorImageMapper
            productId={product.id}
            colors={colorValues.map((value) => ({ value, etsyImageId: colorMap.get(value) ?? null }))}
            images={product.images
              .filter((i) => i.etsyImageId)
              .map((i) => ({ etsyImageId: i.etsyImageId as string, url: i.url }))}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Units sold', value: unitsSold },
          { label: 'Revenue', value: money(revenue) },
          { label: 'Orders', value: sales.length },
          { label: 'Avg rating', value: avgRating != null ? `${avgRating.toFixed(1)} ★ (${reviewCount})` : '—' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-lg font-bold text-charcoal">{s.value}</p>
            <p className="text-xs text-warm-gray mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sales */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Sales</h2>
      {sales.length === 0 ? (
        <div className="card p-8 text-center text-warm-gray text-sm mb-8">No sales recorded for this item yet.</div>
      ) : (
        <div className="card divide-y divide-taupe/15 mb-8">
          {sales.map((s) => (
            <div key={s.key} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-charcoal text-sm">{s.buyer ?? 'Buyer'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.channel === 'Etsy' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{s.channel}</span>
                  {s.ref && <span className="text-[11px] text-warm-gray/60">#{s.ref}</span>}
                </div>
                <p className="text-xs text-warm-gray mt-0.5">
                  {fmtDate(s.date)}
                  {s.variation ? ` · ${s.variation}` : ''}
                  {s.quantity > 1 ? ` · ×${s.quantity}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-medium text-charcoal text-sm">{s.lineTotal != null ? money(s.lineTotal) : '—'}</p>
                {s.href && <Link href={s.href} className="text-[11px] text-warm-gray hover:text-charcoal">View order →</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comments / reviews */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-3">Reviews &amp; comments</h2>
      {comments.length === 0 ? (
        <div className="card p-8 text-center text-warm-gray text-sm">No reviews for this item yet.</div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.key} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-sm tracking-tight">{stars(c.rating)}</span>
                  <span className="text-xs text-warm-gray">{c.who ?? (c.source === 'Etsy' ? 'Etsy buyer' : 'Customer')}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.source === 'Etsy' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{c.source}</span>
                </div>
                <span className="text-xs text-warm-gray/70">{fmtDate(c.date)}</span>
              </div>
              {c.text ? (
                <p className="text-sm text-charcoal/85 whitespace-pre-line">{c.text}</p>
              ) : (
                <p className="text-sm text-warm-gray/60 italic">No written comment — rating only.</p>
              )}
              {c.imageUrl && (
                <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden relative bg-taupe/5">
                  <Image src={c.imageUrl} alt="Review photo" fill className="object-cover" unoptimized />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
