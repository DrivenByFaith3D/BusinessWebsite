import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ProductCard from '@/components/ProductCard'

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const { purchase } = await searchParams
  const session = await getServerSession(authOptions)
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      reviews: { select: { rating: true } },
      etsyReviews: { select: { rating: true } },
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {purchase === 'success' && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-800">Purchase successful! We&apos;ll be in touch about your order soon.</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-display">Our Shop</h1>
        <p className="text-charcoal/85 mt-2">Browse our catalog of ready-made 3D printed products.</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 mx-auto mb-4 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-lg font-medium text-charcoal">No products yet</p>
          <p className="text-sm mt-1 text-warm-gray">Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            // Etsy reviews count the same as site reviews here, so the grid and the
            // detail page agree on the rating.
            const ratings = [
              ...product.reviews.map((r) => r.rating),
              ...product.etsyReviews.map((r) => r.rating),
            ]
            const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null
            return <ProductCard key={product.id} product={product} avgRating={avg} reviewCount={ratings.length} isLoggedIn={!!session} />
          })}
        </div>
      )}
    </div>
  )
}
