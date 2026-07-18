'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { EtsyOrderView } from './EtsyOrdersClient'

// Shop's return address, matching the custom-order shipping flow.
const FROM = { name: 'DrivenByFaith3D', street: '82 Fieldstone Dr', city: 'Springfield', state: 'NJ', zip: '07081', country: 'US' }

interface Rate {
  id: string
  carrier: string
  service: string
  amount: string
  estimatedDays: number
}

export default function ShipEtsyModal({
  order,
  onClose,
  onShipped,
}: {
  order: EtsyOrderView
  onClose: () => void
  onShipped: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [mode, setMode] = useState<'label' | 'manual'>('label')
  const [dims, setDims] = useState({ length: '6', width: '6', height: '4', weightLb: '1', weightOz: '0' })
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)
  const [manualTracking, setManualTracking] = useState('')
  const [manualCarrier, setManualCarrier] = useState('usps')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const to = {
    name: order.buyerName || 'Buyer',
    street: [order.addrLine1, order.addrLine2].filter(Boolean).join(', '),
    city: order.addrCity || '',
    state: order.addrState || '',
    zip: order.addrZip || '',
    country: order.addrCountry || 'US',
  }
  const hasAddress = to.street && to.city && to.zip

  async function getRates() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/shippo/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: FROM.name, fromStreet: FROM.street, fromCity: FROM.city, fromState: FROM.state, fromZip: FROM.zip, fromCountry: FROM.country,
          toName: to.name, toStreet: to.street, toCity: to.city, toState: to.state, toZip: to.zip, toCountry: to.country,
          length: dims.length, width: dims.width, height: dims.height,
          weight: (parseFloat(dims.weightLb || '0') + parseFloat(dims.weightOz || '0') / 16).toFixed(4),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not fetch rates.'); setLoading(false); return }
      setRates(data.rates); setSelectedRate(data.rates[0] ?? null)
    } catch { setError('Network error fetching rates.') }
    setLoading(false)
  }

  async function buyAndPush() {
    if (!selectedRate) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/etsy/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etsyOrderId: order.id, rateId: selectedRate.id, carrier: selectedRate.carrier }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Shipping failed.'); setLoading(false); return }
      if (data.labelUrl) window.open(data.labelUrl, '_blank')
      onShipped()
    } catch { setError('Network error.'); setLoading(false) }
  }

  async function pushManual() {
    if (!manualTracking.trim()) { setError('Enter a tracking number.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/etsy/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etsyOrderId: order.id, trackingCode: manualTracking.trim(), carrier: manualCarrier }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to push tracking.'); setLoading(false); return }
      onShipped()
    } catch { setError('Network error.'); setLoading(false) }
  }

  const dimField = (label: string, key: keyof typeof dims) => (
    <div>
      <label className="block text-xs font-medium text-warm-gray mb-1">{label}</label>
      <input className="input w-full text-sm" value={dims[key]} onChange={(e) => setDims((d) => ({ ...d, [key]: e.target.value }))} type="number" min="0" step="0.1" />
    </div>
  )

  const modal = (
    <div className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="card p-6 w-full max-w-md my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-display text-charcoal">Ship order</h2>
            <button onClick={onClose} className="text-warm-gray hover:text-charcoal">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-xs text-warm-gray mb-4">Marking shipped pushes tracking to Etsy and emails the buyer.</p>

          {/* Ship-to */}
          <div className="rounded-lg border border-taupe/30 bg-taupe/10 p-3 text-sm mb-4">
            <p className="text-xs text-warm-gray mb-0.5">Ship to</p>
            {hasAddress ? (
              <p className="text-charcoal/85 whitespace-pre-line">{order.formattedAddress ?? `${to.name}\n${to.street}\n${to.city}, ${to.state} ${to.zip}`}</p>
            ) : (
              <p className="text-amber-600 text-xs">No usable address on this order.</p>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => { setMode('label'); setError('') }} className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${mode === 'label' ? 'bg-charcoal text-white border-charcoal' : 'border-taupe/50 text-charcoal'}`}>Buy label</button>
            <button onClick={() => { setMode('manual'); setError('') }} className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${mode === 'manual' ? 'bg-charcoal text-white border-charcoal' : 'border-taupe/50 text-charcoal'}`}>I have tracking</button>
          </div>

          {mode === 'label' ? (
            rates.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-warm-gray">Parcel</p>
                <div className="grid grid-cols-3 gap-2">
                  {dimField('Length (in)', 'length')}
                  {dimField('Width (in)', 'width')}
                  {dimField('Height (in)', 'height')}
                  {dimField('Weight (lb)', 'weightLb')}
                  {dimField('+ oz', 'weightOz')}
                </div>
                <button onClick={getRates} disabled={loading || !hasAddress} className="btn-primary w-full disabled:opacity-40">
                  {loading ? 'Fetching rates…' : 'Get rates'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {rates.map((r, i) => (
                  <button key={r.id} onClick={() => setSelectedRate(r)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-sm ${selectedRate?.id === r.id ? 'border-charcoal bg-taupe/20' : 'border-taupe/30'}`}>
                    <span>
                      <span className="font-medium">{r.carrier}</span> {r.service}
                      {i === 0 && <span className="ml-1 text-[10px] text-green-700">cheapest</span>}
                      {r.estimatedDays > 0 && <span className="block text-xs text-warm-gray">{r.estimatedDays} day{r.estimatedDays !== 1 ? 's' : ''}</span>}
                    </span>
                    <span className="font-bold">${parseFloat(r.amount).toFixed(2)}</span>
                  </button>
                ))}
                <button onClick={buyAndPush} disabled={loading || !selectedRate} className="btn-primary w-full mt-2 disabled:opacity-40">
                  {loading ? 'Buying label…' : 'Buy label & mark shipped'}
                </button>
                <button onClick={() => { setRates([]); setError('') }} className="w-full text-center text-xs text-warm-gray hover:text-charcoal">← Back to parcel</button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-warm-gray mb-1">Tracking number</label>
                <input className="input w-full text-sm" value={manualTracking} onChange={(e) => setManualTracking(e.target.value)} placeholder="e.g. 9400 1000 0000 0000 0000 00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-gray mb-1">Carrier</label>
                <select className="input w-full text-sm" value={manualCarrier} onChange={(e) => setManualCarrier(e.target.value)}>
                  <option value="usps">USPS</option>
                  <option value="ups">UPS</option>
                  <option value="fedex">FedEx</option>
                  <option value="dhl">DHL</option>
                </select>
              </div>
              <button onClick={pushManual} disabled={loading} className="btn-primary w-full disabled:opacity-40">
                {loading ? 'Sending to Etsy…' : 'Mark shipped on Etsy'}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
