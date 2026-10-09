'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Rate {
  id: string; carrier: string; service: string; amount: string; currency: string; estimatedDays: number
}

interface DefaultAddress {
  street: string; city: string; state: string; zip: string; country: string
}

export default function ShipModalWrapper({ orderId, customerName, defaultAddress, onClose, onShipped }: {
  orderId: string
  customerName: string
  defaultAddress: DefaultAddress | null
  onClose: () => void
  onShipped: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const FROM = { name: 'DrivenByFaith3D', street: '82 Fieldstone Dr', city: 'Springfield', state: 'NJ', zip: '07081', country: 'US' }
  const TO = {
    name: customerName,
    street: defaultAddress?.street || '',
    city: defaultAddress?.city || '',
    state: defaultAddress?.state || '',
    zip: defaultAddress?.zip || '',
    country: defaultAddress?.country || 'US',
  }
  const hasToAddress = !!(TO.street && TO.city && TO.state && TO.zip)

  const [dims, setDims] = useState({ length: '6', width: '4', height: '3', weightLb: '1', weightOz: '0' })
  const [step, setStep] = useState<'form' | 'rates' | 'done'>('form')
  const [labelUrl, setLabelUrl] = useState<string | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setDim(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setDims(d => ({ ...d, [field]: e.target.value }))
  }

  async function fetchRates(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/shippo/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromName: FROM.name, fromStreet: FROM.street, fromCity: FROM.city, fromState: FROM.state, fromZip: FROM.zip, fromCountry: FROM.country,
        toName: TO.name, toStreet: TO.street, toCity: TO.city, toState: TO.state, toZip: TO.zip, toCountry: TO.country,
        length: dims.length, width: dims.width, height: dims.height,
        weight: (parseFloat(dims.weightLb || '0') + parseFloat(dims.weightOz || '0') / 16).toFixed(4),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to fetch rates'); setLoading(false); return }
    setRates(data.rates); setSelectedRate(data.rates[0] ?? null); setStep('rates'); setLoading(false)
  }

  async function purchaseLabel() {
    if (!selectedRate) return
    setLoading(true); setError('')
    const res = await fetch('/api/shippo/create-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, rateId: selectedRate.id, carrier: selectedRate.carrier }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to purchase label'); setLoading(false); return }
    onShipped(); setLabelUrl(data.label_url || null); setStep('done'); setLoading(false)
    if (data.label_url) window.open(data.label_url, '_blank')
  }

  const modal = (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="card p-8 w-full max-w-md">
          <h1 className="text-xl font-bold text-charcoal mb-6 text-center">
            {step === 'form' ? 'Create Shipping Label' : step === 'rates' ? 'Choose a Carrier' : 'Label Ready'}
          </h1>

          {step === 'form' && (
            <form onSubmit={fetchRates} className="space-y-5">
              <div className="rounded-lg border border-taupe/30 bg-taupe/10 p-4 space-y-3 text-sm">
                <div className="flex gap-3"><span className="text-warm-gray w-10">From</span><span className="text-charcoal/85">{FROM.street}, {FROM.city}, {FROM.state} {FROM.zip}</span></div>
                <div className="border-t border-taupe/30" />
                <div className="flex gap-3">
                  <span className="text-warm-gray w-10">To</span>
                  {hasToAddress ? (
                    <span className="text-charcoal/85">{TO.street}, {TO.city}, {TO.state} {TO.zip}</span>
                  ) : (
                    <span className="text-amber-600 text-xs">No default address saved for this customer</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['length', 'width', 'height'] as const).map(k => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-warm-gray mb-1 capitalize">{k} (in)</label>
                    <input className="input w-full" value={dims[k]} onChange={setDim(k)} type="number" min="0.1" step="0.1" required />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-warm-gray mb-1">Weight</label>
                  <div className="flex rounded-lg overflow-hidden border border-taupe/30 bg-cream">
                    <div className="relative flex-1">
                      <input className="w-full bg-transparent px-3 py-2 text-sm text-charcoal focus:outline-hidden" value={dims.weightLb} onChange={setDim('weightLb')} type="number" min="0" required />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-warm-gray">lb</span>
                    </div>
                    <div className="w-px bg-taupe/30" />
                    <div className="relative flex-1">
                      <input className="w-full bg-transparent px-3 py-2 text-sm text-charcoal focus:outline-hidden" value={dims.weightOz} onChange={setDim('weightOz')} type="number" min="0" max="15" required />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-warm-gray">oz</span>
                    </div>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading || !hasToAddress} className="btn-primary w-full">{loading ? 'Fetching rates…' : 'Get Shipping Rates'}</button>
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">Cancel</button>
            </form>
          )}

          {step === 'rates' && (
            <div className="space-y-3">
              {rates.map((rate, i) => (
                <button key={rate.id} type="button" onClick={() => setSelectedRate(rate)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-lg border text-left transition-all ${selectedRate?.id === rate.id ? 'border-charcoal bg-taupe/20 text-charcoal' : 'border-taupe/30 bg-taupe/5 text-warm-gray hover:border-taupe/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${selectedRate?.id === rate.id ? 'border-charcoal bg-charcoal' : 'border-taupe/50'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rate.carrier}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full">Best price</span>}
                      </div>
                      <p className="text-warm-gray text-xs">{rate.service}{rate.estimatedDays > 0 ? ` · ${rate.estimatedDays}d` : ''}</p>
                    </div>
                  </div>
                  <span className="font-bold">${parseFloat(rate.amount).toFixed(2)}</span>
                </button>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" onClick={purchaseLabel} disabled={loading || !selectedRate} className="btn-primary w-full mt-4">{loading ? 'Purchasing…' : 'Buy Label & Mark Shipped'}</button>
              <button type="button" onClick={() => { setStep('form'); setError('') }} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">← Back</button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-charcoal font-semibold">Label Created</p>
              {labelUrl && <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full inline-block text-center">Download Label</a>}
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
