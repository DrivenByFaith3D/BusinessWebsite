'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import StarRating from './StarRating'
import ProductReviews from './ProductReviews'
import { useCart } from './CartProvider'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  hasVariations?: boolean
  inStock?: boolean
}

export default function ProductCard({ product, avgRating, reviewCount, isLoggedIn }: {
  product: Product
  avgRating?: number | null
  reviewCount?: number
  isLoggedIn?: boolean
}) {
  const [showReviews, setShowReviews] = useState(false)
  const [added, setAdded] = useState(false)
  const { addItem } = useCart()

  function handleAddToCart() {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="card overflow-hidden hover:border-taupe transition-colors flex flex-col">
      <Link href={`/listings/${product.id}`} className="aspect-square bg-taupe/20 relative block group">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <div className="flex items-center justify-center h-full text-warm-gray">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/listings/${product.id}`} className="font-semibold text-charcoal hover:underline">
          {product.name}
        </Link>
        {product.description && (
          <p className="text-sm text-charcoal/85 mt-1 line-clamp-2 flex-1">{product.description}</p>
        )}
        {avgRating != null && reviewCount ? (
          <div className="flex items-center gap-1.5 mt-2">
            <StarRating value={Math.round(avgRating)} size="sm" />
            <span className="text-xs text-warm-gray">{avgRating.toFixed(1)} ({reviewCount})</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between mt-3 gap-3">
          <p className="text-charcoal font-bold text-lg">${product.price.toFixed(2)}</p>
          {product.hasVariations ? (
            // Options must be chosen before this can go in the cart, so send the
            // buyer to the detail page rather than guessing a variation for them.
            <Link href={`/listings/${product.id}`} className="btn-primary text-sm py-1.5 px-4 shrink-0">
              Choose options
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={product.inStock === false}
              className="btn-primary text-sm py-1.5 px-4 shrink-0 disabled:opacity-40"
            >
              {product.inStock === false ? 'Sold out' : added ? 'Added!' : 'Add to Cart'}
            </button>
          )}
        </div>
        <button
          onClick={() => setShowReviews(v => !v)}
          className="text-xs text-warm-gray hover:text-charcoal transition-colors mt-2 text-left"
        >
          {showReviews ? 'Hide reviews' : `${reviewCount ? `${reviewCount} review${reviewCount !== 1 ? 's' : ''}` : 'No reviews yet'}, ${isLoggedIn ? 'write one' : 'view'}`}
        </button>
        {showReviews && (
          <div className="border-t border-taupe/30 mt-3 pt-3">
            <ProductReviews productId={product.id} isLoggedIn={!!isLoggedIn} />
          </div>
        )}
      </div>
    </div>
  )
}
