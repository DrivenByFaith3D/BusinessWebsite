import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProductDetailClient from './ProductDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { rank: 'asc' } },
      variations: { orderBy: { rank: 'asc' } },
      reviews: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
      etsyReviews: { orderBy: { reviewedAt: 'desc' } },
      colorImages: true,
    },
  })

  if (!product) notFound()

  // Site reviews and Etsy reviews both count toward the rating shown: a buyer
  // does not care which system a review came from.
  const allRatings = [
    ...product.reviews.map((r) => r.rating),
    ...product.etsyReviews.map((r) => r.rating),
  ]
  const reviewCount = allRatings.length
  const avgRating = reviewCount ? allRatings.reduce((sum, r) => sum + r, 0) / reviewCount : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-charcoal mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Shop
      </Link>

      <ProductDetailClient
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl,
          inStock: product.inStock,
          etsyUrl: product.etsyUrl,
          processingMin: product.processingMin,
          processingMax: product.processingMax,
          shipsFrom: product.shipsFrom,
          shippingCost: product.shippingCost,
          shippingMinDays: product.shippingMinDays,
          shippingMaxDays: product.shippingMaxDays,
          tags: product.tags,
          materials: product.materials,
          whoMade: product.whoMade,
          whenMade: product.whenMade,
          itemWeight: product.itemWeight,
          itemWeightUnit: product.itemWeightUnit,
          itemLength: product.itemLength,
          itemWidth: product.itemWidth,
          itemHeight: product.itemHeight,
          itemDimensionsUnit: product.itemDimensionsUnit,
          isPersonalizable: product.isPersonalizable,
          personalizationInstructions: product.personalizationInstructions,
          numFavorers: product.numFavorers,
        }}
        variations={product.variations.map((v) => ({
          id: v.id,
          label: v.label,
          price: v.price,
          quantity: v.quantity,
          isEnabled: v.isEnabled,
          options: v.options as { name: string; value: string }[],
        }))}
        images={product.images.map((i) => ({ id: i.id, url: i.url, fullUrl: i.fullUrl, etsyImageId: i.etsyImageId }))}
        colorImages={product.colorImages.map((c) => ({ value: c.value, etsyImageId: c.etsyImageId }))}
        avgRating={avgRating}
        reviewCount={reviewCount}
        isLoggedIn={!!session}
        reviews={[
          ...product.reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            author: r.user.name ?? r.user.email.split('@')[0],
            createdAt: r.createdAt.toISOString(),
            source: 'site' as const,
            imageUrl: r.imageUrl,
            verified: r.verified,
          })),
          ...product.etsyReviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.review,
            // Etsy exposes only a buyer id, never a name.
            author: 'Etsy buyer',
            createdAt: r.reviewedAt.toISOString(),
            source: 'etsy' as const,
            imageUrl: r.imageUrl,
            // Etsy only surfaces reviews from real purchasers, so they're verified too.
            verified: true,
          })),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
      />
    </div>
  )
}
