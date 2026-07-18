'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ShipEtsyModal from './ShipEtsyModal'

interface Item {
  id: string
  title: string
  quantity: number
  price: number | null
  variations: string | null
  productId: string | null
}

export interface EtsyOrderView {
  id: string
  receiptId: string
  buyerName: string | null
  status: string | null
  isPaid: boolean
  isShipped: boolean
  grandTotal: number | null
  currency: string | null
  formattedAddress: string | null
  addrLine1: string | null
  addrLine2: string | null
  addrCity: string | null
  addrState: string | null
  addrZip: string | null
  addrCountry: string | null
  messageFromBuyer: string | null
  trackingCode: string | null
  carrier: string | null
  labelCost: number | null
  etsyLabelCost: number | null
  etsyFees: number | null
  salesTax: number | null
  orderedAt: string
  items: Item[]
}

// Etsy's standard US seller fees, estimated from the order total:
//   6.5% transaction fee + 3% + $0.25 payment processing + $0.20 per item listing fee.
// It's an estimate — real fees vary with offsite ads, taxes, and international rates.
function estimateEtsyFees(grandTotal: number | null, itemCount: number): number {
  if (!grandTotal) return 0
  const transaction = grandTotal * 0.065
  const processing = grandTotal * 0.03 + 0.25
  const listing = itemCount * 0.2
  return transaction + processing + listing
}

export default function EtsyOrdersClient({
  connected,
  initialOrders,
  unshipped,
}: {
  connected: boolean
  initialOrders: EtsyOrderView[]
  unshipped: number
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'unshipped' | 'shipped'>('unshipped')
  const [shipping, setShipping] = useState<EtsyOrderView | null>(null)

  async function syncOrders() {
    setSyncing(true)
    setMessage('')
    try {
      const res = await fetch('/api/sync/etsy-orders', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Sync failed.')
      } else {
        setMessage(`Synced ${data.orders} order${data.orders === 1 ? '' : 's'}.`)
        router.refresh()
      }
    } catch {
      setMessage('Network error. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  if (!connected) {
    return (
      <div className="card p-8 text-center">
        <p className="text-charcoal font-medium">Etsy isn&apos;t connected yet</p>
        <p className="text-sm text-warm-gray mt-1 mb-4">Connect your Etsy account to sync orders in.</p>
        <Link href="/admin/products" className="btn-primary inline-block">Go to Connect</Link>
      </div>
    )
  }

  const shown = initialOrders.filter((o) => (tab === 'unshipped' ? !o.isShipped : o.isShipped))
  const money = (n: number | null, cur: string | null) => (n == null ? '-' : `$${n.toFixed(2)}${cur && cur !== 'USD' ? ` ${cur}` : ''}`)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          {(['unshipped', 'shipped'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                tab === t ? 'bg-charcoal text-white' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              {t === 'unshipped' ? 'To ship' : 'Shipped'}
              {t === 'unshipped' && unshipped > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/20' : 'bg-taupe/20'}`}>{unshipped}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {message && <span className={`text-xs ${message.startsWith('Synced') ? 'text-green-700' : 'text-red-600'}`}>{message}</span>}
          <button onClick={syncOrders} disabled={syncing} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync orders'}
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-warm-gray">
          <p className="text-charcoal font-medium">{tab === 'unshipped' ? 'Nothing to ship' : 'No shipped orders'}</p>
          <p className="text-sm mt-1">
            {initialOrders.length === 0 ? 'Hit “Sync orders” to pull your Etsy orders in.' : 'Switch tabs to see the rest.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-charcoal">{o.buyerName ?? 'Etsy order'}</p>
                    <span className="text-xs text-warm-gray/60">#{o.receiptId}</span>
                    {o.isPaid && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>}
                    {o.isShipped && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Shipped</span>}
                  </div>
                  <p className="text-xs text-warm-gray mt-0.5">
                    {new Date(o.orderedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-lg font-display text-charcoal">{money(o.grandTotal, o.currency)}</span>
              </div>

              {/* Items */}
              <div className="mt-3 pt-3 border-t border-taupe/20 space-y-1.5">
                {o.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-charcoal/85 min-w-0">
                      {i.productId ? (
                        <Link href={`/listings/${i.productId}`} className="hover:underline">{i.title}</Link>
                      ) : (
                        i.title
                      )}
                      {i.quantity > 1 && <span className="text-warm-gray"> ×{i.quantity}</span>}
                      {i.variations && <span className="block text-xs text-warm-gray">{i.variations}</span>}
                    </span>
                    <span className="text-warm-gray shrink-0">{i.price != null ? `$${(i.price * i.quantity).toFixed(2)}` : ''}</span>
                  </div>
                ))}
              </div>

              {/* Address + tracking */}
              <div className="mt-3 pt-3 border-t border-taupe/20 flex items-start justify-between gap-4 flex-wrap text-sm">
                <div className="text-warm-gray">
                  <p className="text-xs font-semibold uppercase tracking-wide text-warm-gray/70 mb-0.5">Ship to</p>
                  <p className="text-charcoal/85 whitespace-pre-line">
                    {o.formattedAddress ??
                      [o.addrLine1, o.addrLine2, [o.addrCity, o.addrState, o.addrZip].filter(Boolean).join(', '), o.addrCountry]
                        .filter(Boolean)
                        .join('\n')}
                  </p>
                </div>
                {o.trackingCode ? (
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-warm-gray/70 mb-0.5">Tracking</p>
                    <p className="text-charcoal/85">{o.carrier ? `${o.carrier.toUpperCase()} ` : ''}{o.trackingCode}</p>
                  </div>
                ) : (
                  !o.isShipped && (
                    <button onClick={() => setShipping(o)} className="btn-primary text-sm py-1.5 px-4 shrink-0">
                      Ship
                    </button>
                  )
                )}
              </div>

              {/* Cost breakdown */}
              {(() => {
                const itemCount = o.items.reduce((s, i) => s + i.quantity, 0)
                // Prefer exact fees from Etsy's ledger; fall back to an estimate until they post.
                const exact = o.etsyFees != null
                const fees = exact ? (o.etsyFees as number) : estimateEtsyFees(o.grandTotal, itemCount)
                const tax = o.salesTax ?? 0
                // In-app (Shippo) label cost wins; else the Etsy-bought label cost from the ledger.
                const label = o.labelCost ?? o.etsyLabelCost
                const net = o.grandTotal != null ? o.grandTotal - fees - tax - (label ?? 0) : null
                return (
                  <div className="mt-3 pt-3 border-t border-taupe/20 text-sm space-y-1">
                    <div className="flex items-center justify-between text-warm-gray">
                      <span>Buyer paid</span>
                      <span className="text-charcoal/85">{money(o.grandTotal, o.currency)}</span>
                    </div>
                    {tax > 0 && (
                      <div className="flex items-center justify-between text-warm-gray">
                        <span>Sales tax <span className="text-warm-gray/60">(Etsy remits)</span></span>
                        <span className="text-warm-gray">−{money(tax, o.currency)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-warm-gray">
                      <span>Etsy fees {exact ? '' : <span className="text-amber-600">(est.)</span>}</span>
                      <span className="text-red-600">−{money(fees, o.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-warm-gray">
                      <span>Shipping label</span>
                      <span className={label != null ? 'text-red-600' : 'text-warm-gray/50'}>
                        {label != null ? `−${money(label, o.currency)}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 mt-1 border-t border-taupe/20 font-medium">
                      <span className="text-charcoal">Net {label == null ? <span className="text-warm-gray/60 font-normal">(before shipping)</span> : ''}</span>
                      <span className={net != null && net < 0 ? 'text-red-600' : 'text-green-700'}>{money(net, o.currency)}</span>
                    </div>
                  </div>
                )
              })()}

              {o.messageFromBuyer && (
                <p className="mt-3 text-xs text-warm-gray bg-taupe/10 rounded-lg px-3 py-2">
                  <span className="font-medium">Note from buyer:</span> {o.messageFromBuyer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {shipping && (
        <ShipEtsyModal
          order={shipping}
          onClose={() => setShipping(null)}
          onShipped={() => { setShipping(null); router.refresh() }}
        />
      )}
    </div>
  )
}
