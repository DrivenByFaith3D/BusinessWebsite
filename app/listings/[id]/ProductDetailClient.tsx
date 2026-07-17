'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import StarRating from '@/components/StarRating'
import { useCart, MAX_QTY } from '@/components/CartProvider'

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
  tags: string[]
  materials: string[]
  whoMade: string | null
  whenMade: string | null
  itemWeight: number | null
  itemWeightUnit: string | null
  itemLength: number | null
  itemWidth: number | null
  itemHeight: number | null
  itemDimensionsUnit: string | null
  isPersonalizable: boolean
  personalizationInstructions: string | null
  numFavorers: number | null
}

interface Variation {
  id: string
  label: string
  price: number | null
  quantity: number
  isEnabled: boolean
  options: { name: string; value: string }[]
}

interface Review {
  id: string
  rating: number
  comment: string | null
  author: string
  createdAt: string
  source: 'site' | 'etsy'
  imageUrl: string | null
}

const REGION: Record<string, string> = { US: 'the United States', GB: 'the United Kingdom', CA: 'Canada', AU: 'Australia' }

// Etsy sends these as enum-ish slugs.
const WHO_MADE: Record<string, string> = {
  i_did: 'Handmade by the shop owner',
  someone_else: 'Made by another company',
  collective: 'Made by a design partnership',
}
const WHEN_MADE: Record<string, string> = {
  made_to_order: 'Made to order',
  '2020_2025': 'Made 2020-2025',
  '2010_2019': 'Made 2010-2019',
}

function dayRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? `${min} day${min === 1 ? '' : 's'}` : `${min}-${max} days`
  const only = (min ?? max) as number
  return `${only} day${only === 1 ? '' : 's'}`
}

export default function ProductDetailClient({
  product,
  images,
  variations,
  avgRating,
  reviewCount,
  reviews,
}: {
  product: Product
  images: { id: string; url: string; fullUrl?: string | null }[]
  variations: Variation[]
  avgRating: number | null
  reviewCount: number
  isLoggedIn: boolean
  reviews: Review[]
}) {
  const gallery = images.length > 0 ? images : product.imageUrl ? [{ id: 'main', url: product.imageUrl, fullUrl: null }] : []
  const buyable = variations.filter((v) => v.isEnabled && v.quantity > 0)

  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [variationId, setVariationId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState('')
  const { addItem } = useCart()

  const step = useCallback((delta: number) => {
    setActive((i) => (i + delta + gallery.length) % gallery.length)
  }, [gallery.length])

  // Drive the lightbox from the keyboard, and stop the page scrolling behind it.
  useEffect(() => {
    if (!zoomed) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoomed(false)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [zoomed, step])

  const selected = variations.find((v) => v.id === variationId) ?? null
  // Variations can carry their own price, so the headline follows the selection.
  const price = selected?.price ?? product.price
  const needsChoice = variations.length > 0 && !selected
  // Etsy groups by property name ("Primary color"); use it as the picker label.
  const optionName = variations[0]?.options?.[0]?.name ?? 'Option'

  // Cap at what's actually in stock for the chosen option, so the cart can't hold
  // more than can be bought.
  const stockLimit = Math.min(MAX_QTY, selected ? selected.quantity : Infinity)

  function handleAddToCart() {
    if (needsChoice) {
      setError(`Please choose a ${optionName.toLowerCase()}.`)
      return
    }
    setError('')
    addItem({
      productId: product.id,
      name: product.name,
      price,
      imageUrl: product.imageUrl,
      variationId: selected?.id ?? null,
      variationLabel: selected?.label ?? null,
      quantity: qty,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const processing = dayRange(product.processingMin, product.processingMax)
  const delivery = dayRange(product.shippingMinDays, product.shippingMaxDays)
  const hasShipping = processing || delivery || product.shippingCost != null || product.shipsFrom

  const dims =
    product.itemLength && product.itemWidth && product.itemHeight
      ? `${product.itemLength} × ${product.itemWidth} × ${product.itemHeight} ${product.itemDimensionsUnit ?? ''}`.trim()
      : null
  const weight =
    product.itemWeight != null ? `${product.itemWeight} ${product.itemWeightUnit ?? ''}`.trim() : null

  const details: [string, string][] = []
  if (product.whoMade) details.push(['Made by', WHO_MADE[product.whoMade] ?? product.whoMade])
  if (product.whenMade) details.push(['Availability', WHEN_MADE[product.whenMade] ?? product.whenMade.replace(/_/g, ' ')])
  if (dims) details.push(['Dimensions', dims])
  if (weight) details.push(['Weight', weight])
  if (product.materials.length > 0) details.push(['Materials', product.materials.join(', ')])

  const soldOut = !product.inStock || (variations.length > 0 && buyable.length === 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Gallery */}
      <div>
        {gallery.length > 0 ? (
          <button
            onClick={() => setZoomed(true)}
            aria-label="Enlarge image"
            className="aspect-square bg-taupe/20 relative rounded-xl overflow-hidden border border-taupe/30 w-full block group cursor-zoom-in"
          >
            <Image src={gallery[active].url} alt={product.name} fill className="object-cover" priority />
            <span className="absolute bottom-3 right-3 bg-white/85 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="aspect-square bg-taupe/20 relative rounded-xl overflow-hidden border border-taupe/30">
            <div className="flex items-center justify-center h-full text-warm-gray">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        )}

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

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-2xl font-display text-charcoal">${price.toFixed(2)}</span>
          {soldOut ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600">Sold out</span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">In stock</span>
          )}
          {product.numFavorers ? (
            <span className="text-xs text-warm-gray">♥ {product.numFavorers} favorites on Etsy</span>
          ) : null}
        </div>

        {avgRating != null && reviewCount > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <StarRating value={Math.round(avgRating)} size="sm" />
            <span className="text-xs text-warm-gray">{avgRating.toFixed(1)} ({reviewCount} review{reviewCount === 1 ? '' : 's'})</span>
          </div>
        )}

        {/* Variations */}
        {variations.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-charcoal mb-2">
              {optionName}
              {selected && <span className="text-warm-gray font-normal">: {selected.label}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {variations.map((v) => {
                const disabled = !v.isEnabled || v.quantity < 1
                return (
                  <button
                    key={v.id}
                    onClick={() => { setVariationId(v.id); setError('') }}
                    disabled={disabled}
                    className={`px-3.5 py-2 rounded-full border text-sm transition-all ${
                      v.id === variationId
                        ? 'bg-charcoal text-white border-charcoal'
                        : disabled
                        ? 'border-taupe/30 text-warm-gray/50 line-through cursor-not-allowed'
                        : 'bg-white text-charcoal border-taupe/50 hover:border-charcoal'
                    }`}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {product.isPersonalizable && (
          <div className="mt-4 rounded-lg bg-taupe/15 border border-taupe/40 px-3 py-2.5">
            <p className="text-sm text-charcoal font-medium">Personalization available</p>
            {product.personalizationInstructions && (
              <p className="text-xs text-warm-gray mt-1">{product.personalizationInstructions}</p>
            )}
            <p className="text-xs text-warm-gray mt-1">
              Add your details in the order notes, or message us after checkout.
            </p>
          </div>
        )}

        {!soldOut && (
          <div className="flex items-center gap-3 mt-6">
            <span className="text-sm font-medium text-charcoal">Quantity</span>
            <div className="flex items-center border border-taupe/50 rounded-full overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="w-9 h-9 flex items-center justify-center text-charcoal hover:bg-taupe/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={stockLimit}
                value={qty}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value))
                  if (!Number.isFinite(n)) return
                  setQty(Math.min(stockLimit, Math.max(1, n)))
                }}
                aria-label="Quantity"
                className="w-12 text-center text-sm font-medium text-charcoal bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQty((q) => Math.min(stockLimit, q + 1))}
                disabled={qty >= stockLimit}
                aria-label="Increase quantity"
                className="w-9 h-9 flex items-center justify-center text-charcoal hover:bg-taupe/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                +
              </button>
            </div>
            {qty > 1 && (
              <span className="text-sm text-warm-gray">${(price * qty).toFixed(2)} total</span>
            )}
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={soldOut}
          className="btn-primary w-full mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {soldOut ? 'Sold out' : added ? 'Added to cart ✓' : `Add ${qty > 1 ? `${qty} ` : ''}to Cart`}
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

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

        {/* Item details */}
        {details.length > 0 && (
          <div className="card p-5 mt-4">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Item Details</h2>
            <dl className="space-y-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-warm-gray shrink-0">{label}</dt>
                  <dd className="text-charcoal font-medium text-right">{value}</dd>
                </div>
              ))}
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

        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-2">Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-taupe/20 text-warm-gray">{t}</span>
              ))}
            </div>
          </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating value={r.rating} size="sm" />
                    <span className="text-xs text-charcoal font-medium">{r.author}</span>
                    {r.source === 'etsy' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-taupe/20 text-warm-gray">
                        via Etsy
                      </span>
                    )}
                    <span className="text-xs text-warm-gray/60">
                      {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-charcoal/85 mt-1.5 whitespace-pre-wrap">{r.comment}</p>}
                  {r.imageUrl && (
                    <div className="relative w-20 h-20 mt-2 rounded-lg overflow-hidden border border-taupe/30">
                      <Image src={r.imageUrl} alt="" fill className="object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {zoomed && gallery.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name}, image ${active + 1} of ${gallery.length}`}
        >
          <button
            onClick={() => setZoomed(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {gallery.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); step(-1) }}
                aria-label="Previous image"
                className="absolute left-2 sm:left-6 text-white/70 hover:text-white p-3 z-10"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); step(1) }}
                aria-label="Next image"
                className="absolute right-2 sm:right-6 text-white/70 hover:text-white p-3 z-10"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Stop the click here so tapping the photo itself doesn't close it. */}
          <div className="relative w-full h-full max-w-4xl cursor-default" onClick={(e) => e.stopPropagation()}>
            <Image
              // Prefer the full-resolution file; the gallery URL is only 570px wide.
              src={gallery[active].fullUrl ?? gallery[active].url}
              alt={`${product.name}, image ${active + 1} of ${gallery.length}`}
              fill
              className="object-contain"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          </div>

          {gallery.length > 1 && (
            <p className="absolute bottom-5 text-white/70 text-sm">
              {active + 1} / {gallery.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
