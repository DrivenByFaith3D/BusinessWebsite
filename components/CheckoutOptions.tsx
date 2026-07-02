'use client'

import { useState } from 'react'

interface Props {
  orderId: string
  quote: number
  paymentMethod: string | null
}

const money = (n: number) => `$${n.toFixed(2)}`

export default function CheckoutOptions({ orderId, quote, paymentMethod }: Props) {
  const [tab, setTab] = useState<'card' | 'check'>(paymentMethod === 'check' ? 'check' : 'card')
  const [checkChosen, setCheckChosen] = useState(paymentMethod === 'check')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function payByCard() {
    setLoading('full'); setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setError(data.error || 'Could not start checkout.'); setLoading(null); return }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.'); setLoading(null)
    }
  }

  async function chooseMailCheck() {
    setLoading('select'); setError('')
    try {
      const res = await fetch('/api/orders/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'select_check' }),
      })
      const data = await res.json()
      setLoading(null)
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setCheckChosen(true)
    } catch {
      setError('Network error. Please try again.'); setLoading(null)
    }
  }

  return (
    <div className="card p-5 mb-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-charcoal">Quote Ready — {money(quote)}</h2>
        <p className="text-warm-gray text-sm mt-0.5">Choose how you&apos;d like to pay to get your order started.</p>
      </div>

      {/* Method tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('card')}
          className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
            tab === 'card' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal border-taupe/50 hover:border-charcoal'
          }`}
        >
          Pay by card
        </button>
        <button
          onClick={() => setTab('check')}
          className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
            tab === 'check' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal border-taupe/50 hover:border-charcoal'
          }`}
        >
          Pay by check
        </button>
      </div>

      {tab === 'card' ? (
        <div>
          <p className="text-warm-gray text-sm mb-4">Pay the full {money(quote)} securely by card and we&apos;ll begin right away.</p>
          <button onClick={payByCard} disabled={loading !== null} className="btn-primary">
            {loading === 'full' ? 'Redirecting…' : `Pay ${money(quote)} by card`}
          </button>
        </div>
      ) : (
        <div>
          {/* Full-payment-before-printing notice */}
          <div className="rounded-xl bg-taupe/15 border border-taupe/40 p-4 mb-4">
            <p className="text-sm text-charcoal font-medium mb-1">Full payment is required before we print.</p>
            <p className="text-sm text-warm-gray leading-relaxed">
              Mail a check for the full <span className="text-charcoal font-semibold">{money(quote)}</span>.
              <span className="block mt-1">Printing starts as soon as your check is received and cleared.</span>
            </p>
          </div>

          <button onClick={chooseMailCheck} disabled={loading !== null} className="btn-secondary">
            {loading === 'select' ? 'Saving…' : 'I’ll pay by check'}
          </button>

          {checkChosen && (
            <p className="text-sm text-charcoal mt-4 rounded-lg bg-green-950/10 border border-green-800/30 px-3 py-2.5">
              Got it — we&apos;ll begin printing once your <span className="font-semibold">{money(quote)}</span> check is received.
              You can still pay by card above to start sooner.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
