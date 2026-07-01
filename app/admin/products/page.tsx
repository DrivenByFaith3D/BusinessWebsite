import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AdminProductsClient from './AdminProductsClient'

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const [products, reviewStats] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.review.groupBy({
      by: ['productId'],
      _count: { id: true },
      _avg: { rating: true },
    }),
  ])

  const reviewMap = new Map(reviewStats.map(r => [r.productId, {
    count: r._count.id,
    avg: r._avg.rating ?? 0,
  }]))

  const productsWithStats = products.map(p => ({
    ...p,
    reviewCount: reviewMap.get(p.id)?.count ?? 0,
    avgRating: reviewMap.get(p.id)?.avg ?? 0,
  }))

  const totalReviews = reviewStats.reduce((s, r) => s + r._count.id, 0)
  const overallAvg = reviewStats.length
    ? reviewStats.reduce((s, r) => s + (r._avg.rating ?? 0), 0) / reviewStats.length
    : null
  const mostReviewed = [...productsWithStats].sort((a, b) => b.reviewCount - a.reviewCount)[0]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-charcoal">Products</h1>
      </div>

      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Listings', value: products.length },
            { label: 'Total Reviews', value: totalReviews },
            { label: 'Avg Rating', value: overallAvg ? `${overallAvg.toFixed(1)} ★` : '-' },
            { label: 'Most Reviewed', value: mostReviewed ? mostReviewed.name.slice(0, 14) : '-' },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <p className="text-lg font-bold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-gray mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <AdminProductsClient initialProducts={productsWithStats} />
    </div>
  )
}
