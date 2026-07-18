'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const CONNECT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'Etsy connected. Your orders can now sync.', ok: true },
  denied: { text: 'Etsy connection was cancelled.', ok: false },
  expired: { text: 'That connection attempt expired. Please try again.', ok: false },
  noshop: { text: 'No Etsy shop was found for that account.', ok: false },
  error: { text: 'Something went wrong connecting to Etsy. Please try again.', ok: false },
}

interface Product {
  id: string
  name: string
  price: number
  imageUrl: string | null
  inStock: boolean
  isEtsy: boolean
  imageCount: number
  variationLabels: string[]
  reviewCount: number
  avgRating: number
}

export default function AdminProductsClient({
  initialProducts,
  etsyConnected,
}: {
  initialProducts: Product[]
  etsyConnected: boolean
}) {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // Surface the ?etsy= status the OAuth callback redirects back with.
  const searchParams = useSearchParams()
  const [connectNotice, setConnectNotice] = useState<{ text: string; ok: boolean } | null>(null)
  useEffect(() => {
    const status = searchParams.get('etsy')
    if (status && CONNECT_MESSAGES[status]) setConnectNotice(CONNECT_MESSAGES[status])
  }, [searchParams])

  async function syncEtsy() {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetch('/api/sync/etsy', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMessage(data.error || 'Sync failed.')
      } else {
        setSyncMessage(
          `Synced ${data.total} listing${data.total === 1 ? '' : 's'}: ${data.created} new, ${data.updated} updated, ${data.deactivated} hidden.`,
        )
        // Reload so the catalog reflects what the sync just wrote.
        window.location.reload()
      }
    } catch {
      setSyncMessage('Network error. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      {connectNotice && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm border ${
          connectNotice.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {connectNotice.text}
        </div>
      )}

      {/* Etsy connection */}
      <div className="card p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${etsyConnected ? 'bg-green-500' : 'bg-taupe/50'}`} />
          <div>
            <p className="text-sm font-medium text-charcoal">
              {etsyConnected ? 'Etsy account connected' : 'Etsy account not connected'}
            </p>
            <p className="text-xs text-warm-gray">
              {etsyConnected
                ? 'Your Etsy orders can sync in, and shipping labels can push tracking back.'
                : 'Connect to sync your Etsy orders and push shipping tracking back to Etsy.'}
            </p>
          </div>
        </div>
        <a
          href="/api/etsy/connect"
          className={`text-sm shrink-0 text-center ${etsyConnected ? 'btn-secondary' : 'btn-primary'}`}
        >
          {etsyConnected ? 'Reconnect' : 'Connect Etsy'}
        </a>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <p className="text-sm text-warm-gray">
          Pick an item to see its sales and reviews. Products are managed on Etsy — edit them there, then sync.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {syncMessage && (
            <p className={`text-xs ${syncMessage.startsWith('Synced') ? 'text-green-700' : 'text-red-600'}`}>
              {syncMessage}
            </p>
          )}
          <button
            onClick={syncEtsy}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            title="Pull the latest active listings from Etsy"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync from Etsy'}
          </button>
        </div>
      </div>

      {initialProducts.length === 0 ? (
        <div className="card p-12 text-center text-warm-gray">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-charcoal font-medium">No products yet</p>
          <p className="text-sm mt-1">Add a listing on Etsy, then hit “Sync from Etsy”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialProducts.map(product => (
            <Link
              key={product.id}
              href={`/admin/products/${product.id}`}
              className="card overflow-hidden flex flex-col group hover:border-taupe transition-colors"
            >
              <div className="aspect-video bg-taupe/5 overflow-hidden relative">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} width={400} height={225} className="object-cover w-full h-full group-hover:scale-[1.02] transition-transform" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                {product.imageCount > 1 && (
                  <span className="absolute bottom-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {product.imageCount}
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-charcoal text-sm leading-snug line-clamp-2">{product.name}</h3>
                  <span className="text-charcoal font-bold text-sm shrink-0">${product.price.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-taupe/20 text-warm-gray'}`}>
                    {product.inStock ? 'In stock' : 'Out of stock'}
                  </span>
                  {product.reviewCount > 0 && (
                    <span className="text-xs text-warm-gray">{product.avgRating.toFixed(1)} ★ ({product.reviewCount})</span>
                  )}
                </div>

                {product.variationLabels.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[11px] text-warm-gray mb-1">{product.variationLabels.length} options</p>
                    <div className="flex flex-wrap gap-1">
                      {product.variationLabels.slice(0, 6).map(label => (
                        <span key={label} className="text-[11px] px-1.5 py-0.5 rounded-full border border-taupe/40 text-charcoal/80">
                          {label}
                        </span>
                      ))}
                      {product.variationLabels.length > 6 && (
                        <span className="text-[11px] px-1.5 py-0.5 text-warm-gray">+{product.variationLabels.length - 6}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-taupe/10 flex items-center justify-between">
                  <span className="text-xs text-warm-gray group-hover:text-charcoal transition-colors flex items-center gap-1">
                    Sales &amp; reviews
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  {product.isEtsy && <span className="text-[10px] text-warm-gray/60">from Etsy</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
