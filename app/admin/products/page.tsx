import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getConnection } from '@/lib/etsy-oauth'
import AdminProductsClient from './AdminProductsClient'

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect('/')

  const etsyConnection = await getConnection()

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      variations: { orderBy: { rank: 'asc' }, select: { label: true, quantity: true, isEnabled: true } },
      reviews: { select: { rating: true } },
      etsyReviews: { select: { rating: true } },
      _count: { select: { images: true } },
    },
  })

  // Etsy reviews and site reviews are counted together, matching the storefront.
  const productsWithStats = products.map(p => {
    const ratings = [...p.reviews.map(r => r.rating), ...p.etsyReviews.map(r => r.rating)]
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      inStock: p.inStock,
      isEtsy: p.etsyListingId != null,
      imageCount: p._count.images,
      variationLabels: p.variations.map(v => v.label),
      reviewCount: ratings.length,
      avgRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0,
    }
  })

  const totalReviews = productsWithStats.reduce((s, p) => s + p.reviewCount, 0)
  const rated = productsWithStats.filter(p => p.reviewCount > 0)
  const overallAvg = rated.length
    ? rated.reduce((s, p) => s + p.avgRating, 0) / rated.length
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

      <AdminProductsClient
        initialProducts={productsWithStats}
        etsyConnected={!!etsyConnection}
      />
    </div>
  )
}
