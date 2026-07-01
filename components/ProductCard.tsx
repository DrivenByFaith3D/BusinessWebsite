'use client'

import Image from 'next/image'
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
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="card overflow-hidden hover:border-taupe transition-colors flex flex-col">
      <div className="aspect-square bg-taupe/20 relative">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-warm-gray">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-charcoal">{product.name}</h3>
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
          <button
            onClick={handleAddToCart}
            className="btn-primary text-sm py-1.5 px-4 shrink-0"
          >
            {added ? 'Added!' : 'Add to Cart'}
          </button>
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
