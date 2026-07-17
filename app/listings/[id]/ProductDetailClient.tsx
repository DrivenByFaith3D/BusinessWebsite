'use client'

import Image from 'next/image'
import { useState } from 'react'
import StarRating from '@/components/StarRating'
import { useCart } from '@/components/CartProvider'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  inStock: boolean
  etsyUrl: string | null
  processingMin: number | null
  processingMax: number | null
  shipsFrom: string | null
  shippingCost: number | null
  shippingMinDays: number | null
  shippingMaxDays: number | null
}

interface Review {
  id: string
  rating: number
  comment: string | null
  author: string
  createdAt: string
}

const REGION: Record<string, string> = { US: 'the United States', GB: 'the United Kingdom', CA: 'Canada', AU: 'Australia' }

function dayRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? `${min} day${min === 1 ? '' : 's'}` : `${min}-${max} days`
  const only = (min ?? max) as number
  return `${only} day${only === 1 ? '' : 's'}`
}

export default function ProductDetailClient({
  product,
  images,
  avgRating,
  reviewCount,
  reviews,
}: {
  product: Product
  images: { id: string; url: string }[]
  avgRating: number | null
  reviewCount: number
  isLoggedIn: boolean
  reviews: Review[]
}) {
  // Fall back to the thumbnail so hand-made products without a gallery still show.
  const gallery = images.length > 0 ? images : product.imageUrl ? [{ id: 'main', url: product.imageUrl }] : []
  const [active, setActive] = useState(0)
  const [added, setAdded] = useState(false)
  const { addItem } = useCart()

  function handleAddToCart() {
    addItem({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const processing = dayRange(product.processingMin, product.processingMax)
  const delivery = dayRange(product.shippingMinDays, product.shippingMaxDays)
  const hasShipping = processing || delivery || product.shippingCost != null || product.shipsFrom

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Gallery */}
      <div>
        <div className="aspect-square bg-taupe/20 relative rounded-xl overflow-hidden border border-taupe/30">
          {gallery.length > 0 ? (
            <Image src={gallery[active].url} alt={product.name} fill className="object-cover" priority />
          ) : (
            <div className="flex items-center justify-center h-full text-warm-gray">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>

        {gallery.length > 1 && (
          <div className="grid grid-cols-5 gap-2 mt-3">
            {gallery.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${gallery.length}`}
                className={`aspect-square relative rounded-lg overflow-hidden border-2 transition-all ${
                  i === active ? 'border-charcoal' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <Image src={img.url} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal leading-snug">{product.name}</h1>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-2xl font-display text-charcoal">${product.price.toFixed(2)}</span>
          {product.inStock ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">In stock</span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600">Sold out</span>
          )}
        </div>

        {avgRating != null && reviewCount > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <StarRating value={Math.round(avgRating)} size="sm" />
            <span className="text-xs text-warm-gray">{avgRating.toFixed(1)} ({reviewCount} review{reviewCount === 1 ? '' : 's'})</span>
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className="btn-primary w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {!product.inStock ? 'Sold out' : added ? 'Added to cart ✓' : 'Add to Cart'}
        </button>

        {/* Shipping */}
        {hasShipping && (
          <div className="card p-5 mt-6">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Shipping</h2>
            <dl className="space-y-2 text-sm">
              {product.shippingCost != null && (
                <div className="flex justify-between">
                  <dt className="text-warm-gray">Cost</dt>
                  <dd className="text-charcoal font-medium">
                    {product.shippingCost === 0 ? 'Free' : `$${product.shippingCost.toFixed(2)}`}
                  </dd>
                </div>
              )}
              {processing && (
                <div className="flex justify-between">
                  <dt className="text-warm-gray">Made in</dt>
                  <dd className="text-charcoal font-medium">{processing}</dd>
                </div>
              )}
              {delivery && (
                <div className="flex justify-between">
                  <dt className="text-warm-gray">Delivery</dt>
                  <dd className="text-charcoal font-medium">{delivery}</dd>
                </div>
              )}
              {product.shipsFrom && (
                <div className="flex justify-between">
                  <dt className="text-warm-gray">Ships from</dt>
                  <dd className="text-charcoal font-medium">{REGION[product.shipsFrom] ?? product.shipsFrom}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-2">Description</h2>
            <p className="text-sm text-charcoal/85 whitespace-pre-wrap leading-relaxed">{product.description}</p>
          </div>
        )}

        {product.etsyUrl && (
          <a
            href={product.etsyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-warm-gray hover:text-charcoal underline mt-5 transition-colors"
          >
            View this listing on Etsy
          </a>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">
              Reviews ({reviews.length})
            </h2>
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-taupe/20 pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <StarRating value={r.rating} size="sm" />
                    <span className="text-xs text-charcoal font-medium">{r.author}</span>
                    <span className="text-xs text-warm-gray/60">
                      {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-charcoal/85 mt-1.5">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
