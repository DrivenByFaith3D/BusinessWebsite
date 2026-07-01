'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS } from '@/lib/constants'
import ShipModalWrapper from './ShipModalWrapper'

type OrderStatus = 'pending' | 'in_progress' | 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
const STATUSES: OrderStatus[] = ['pending', 'in_progress', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled']

interface DefaultAddress {
  street: string; city: string; state: string; zip: string; country: string
}

export default function AdminOrderActions({
  orderId,
  currentStatus,
  customerName,
  defaultAddress,
  quote: initialQuote,
  paymentStatus: initialPaymentStatus,
  labelUrl,
}: {
  orderId: string
  currentStatus: string
  customerName: string
  defaultAddress: DefaultAddress | null
  quote: number | null
  paymentStatus: string | null
  labelUrl: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus>(currentStatus as OrderStatus)
  const [quote, setQuote] = useState<number | null>(initialQuote)
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus)
  const [quoteInput, setQuoteInput] = useState(initialQuote ? String(initialQuote) : '')
  const [showQuoteInput, setShowQuoteInput] = useState(false)
  const [showShipModal, setShowShipModal] = useState(false)
  const [busy, setBusy] = useState(false)

  async function updateStatus(newStatus: OrderStatus) {
    setBusy(true)
    await fetch('/api/orders/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: newStatus }),
    })
    setStatus(newStatus)
    setBusy(false)
    router.refresh()
  }

  async function saveQuote() {
    const amount = parseFloat(quoteInput)
    if (isNaN(amount) || amount <= 0) return
    setBusy(true)
    await fetch('/api/orders/quote', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, quote: amount }),
    })
    setQuote(amount)
    setPaymentStatus('unpaid')
    setShowQuoteInput(false)
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Status</h2>
        <select
          value={status}
          onChange={(e) => updateStatus(e.target.value as OrderStatus)}
          disabled={busy}
          className="input w-full text-sm disabled:opacity-50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>

      {/* Quote */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Quote</h2>
        {quote ? (
          <div className="mb-3">
            <p className={`text-sm font-medium ${paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
              ${quote.toFixed(2)}, {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-warm-gray mb-3">No quote set yet.</p>
        )}
        {showQuoteInput ? (
          <div className="flex items-center gap-2">
            <span className="text-warm-gray text-sm">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
              className="input text-sm flex-1"
              placeholder="0.00"
              autoFocus
            />
            <button onClick={saveQuote} disabled={busy} className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40">
              Save
            </button>
            <button onClick={() => setShowQuoteInput(false)} className="btn-secondary text-sm py-1.5 px-3">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowQuoteInput(true)}
            disabled={busy}
            className="btn-secondary text-sm w-full"
          >
            {quote ? 'Edit Quote' : 'Set Quote'}
          </button>
        )}
      </div>

      {/* Shipping */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Shipping</h2>
        <div className="mb-3 text-sm">
          {defaultAddress ? (
            <div className="bg-taupe/10 rounded-lg px-3 py-2.5 text-charcoal/85 leading-relaxed">
              <p>{defaultAddress.street}</p>
              <p>{defaultAddress.city}, {defaultAddress.state} {defaultAddress.zip}</p>
              <p className="text-warm-gray text-xs mt-0.5">{defaultAddress.country}</p>
            </div>
          ) : (
            <p className="text-warm-gray text-xs">No address on file for this customer.</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowShipModal(true)}
            disabled={busy}
            className="btn-secondary text-sm w-full"
          >
            Create Shipping Label
          </button>
          {labelUrl && (
            <a href={labelUrl} target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-sm text-center w-full flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Label
            </a>
          )}
        </div>
      </div>

      {showShipModal && (
        <ShipModalWrapper
          orderId={orderId}
          customerName={customerName}
          defaultAddress={defaultAddress}
          onClose={() => setShowShipModal(false)}
          onShipped={() => { setStatus('label_created'); router.refresh() }}
        />
      )}
    </div>
  )
}
