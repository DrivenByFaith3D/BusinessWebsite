'use client'

import { useEffect, useState, useCallback } from 'react'

interface Order {
  id: string
  trackingNumber: string | null
  carrier: string | null
  trackingUrl: string | null
}

interface TrackingEvent {
  status: string
  status_date: string
  location: string
  description: string
}

interface TrackingInfo {
  carrier: string
  tracking_number: string
  status: string
  eta: string | null
  tracking_url: string | null
  tracking_history: TrackingEvent[]
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return (
    <button onClick={copy} title="Copy tracking number" className="ml-1 text-warm-gray hover:text-charcoal transition-colors">
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012-2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

export default function ShippingStatus({ order }: { order: Order }) {
  const [tracking, setTracking] = useState<TrackingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchTracking() {
      if (!order.trackingNumber || !order.carrier) { setLoading(false); return }
      try {
        const res = await fetch(
          `/api/shippo/track?carrier=${encodeURIComponent(order.carrier)}&tracking_number=${encodeURIComponent(order.trackingNumber)}&order_id=${encodeURIComponent(order.id)}`
        )
        const data = await res.json()
        if (res.ok) setTracking(data)
        else setError(data.error || 'Unable to fetch tracking')
      } catch { setError('Failed to load tracking') }
      finally { setLoading(false) }
    }
    fetchTracking()
  }, [order.id, order.trackingNumber, order.carrier])

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-4">Shipping Status</h2>
      {loading && <p className="text-sm text-warm-gray">Loading tracking…</p>}
      {!loading && error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !tracking && !error && (
        <div className="text-sm text-warm-gray space-y-1">
          <p><span className="text-charcoal font-medium">Carrier:</span> {order.carrier}</p>
          <p className="flex items-center gap-1"><span className="text-charcoal font-medium">Tracking #:</span> {order.trackingNumber}<CopyButton text={order.trackingNumber!} /></p>
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-charcoal font-medium hover:underline inline-block mt-2">
              Track on carrier site →
            </a>
          )}
        </div>
      )}
      {tracking && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-taupe/10 rounded-lg p-3">
              <p className="text-xs text-warm-gray">Carrier</p>
              <p className="font-medium text-sm text-charcoal capitalize">{tracking.carrier}</p>
            </div>
            <div className="bg-taupe/10 rounded-lg p-3">
              <p className="text-xs text-warm-gray">Tracking #</p>
              <div className="flex items-center">
                <p className="font-medium text-sm text-charcoal font-mono truncate">{tracking.tracking_number}</p>
                <CopyButton text={tracking.tracking_number} />
              </div>
            </div>
            <div className="bg-taupe/10 rounded-lg p-3">
              <p className="text-xs text-warm-gray">Status</p>
              <p className="font-medium text-sm text-charcoal capitalize">{tracking.status?.replace(/_/g, ' ')}</p>
            </div>
            {tracking.eta && (
              <div className="bg-taupe/10 rounded-lg p-3">
                <p className="text-xs text-warm-gray">Est. Delivery</p>
                <p className="font-medium text-sm text-charcoal">{new Date(tracking.eta).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            )}
          </div>
          {tracking.tracking_history?.length > 0 && (
            <div className="space-y-3">
              {tracking.tracking_history.slice(0, 5).map((event, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${i === 0 ? 'bg-charcoal' : 'bg-taupe'}`} />
                    {i < tracking.tracking_history.length - 1 && <div className="w-0.5 bg-taupe/30 flex-1 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="font-medium text-charcoal">{event.description}</p>
                    {event.location && <p className="text-warm-gray text-xs">{event.location}</p>}
                    <p className="text-warm-gray/70 text-xs">{new Date(event.status_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
