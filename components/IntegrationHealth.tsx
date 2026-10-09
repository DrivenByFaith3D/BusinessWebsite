'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function IntegrationHealth({
  entries,
}: {
  entries: {
    key: string
    status: string
    lastAttemptAt: string | null
    lastSuccessAt: string | null
    message: string | null
  }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function retry(key: string) {
    setBusy(key)
    setMessage('')
    try {
      const res = await fetch(key === 'etsy-products' ? '/api/sync/etsy' : '/api/sync/etsy-orders', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed.')
      setMessage(
        data.partial
          ? 'Sync completed partially. Saved details were retained; retry when Etsy is available.'
          : 'Sync completed.',
      )
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sync. Try again.')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }
  const names: Record<string, string> = {
    'etsy-products': 'Etsy products',
    'etsy-orders': 'Etsy orders',
    'stripe-payments': 'Stripe payments',
  }
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Integration health</h2>
      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.key} className="flex justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {names[e.key]}{' '}
                <span
                  className={`ml-2 text-xs ${['failed', 'partial'].includes(e.status) ? 'text-red-700' : 'text-warm-gray'}`}
                >
                  {e.status === 'unknown' ? 'Not recorded yet' : e.status}
                </span>
              </p>
              <p className="text-xs text-warm-gray mt-1">
                Last successful {e.key === 'stripe-payments' ? 'payment event' : 'sync'}:{' '}
                {e.lastSuccessAt ? new Date(e.lastSuccessAt).toLocaleString() : 'Not recorded yet'}
              </p>
              {e.message && <p className="text-xs mt-1">{e.message}</p>}
            </div>
            {e.key.startsWith('etsy-') && (
              <button
                disabled={!!busy}
                onClick={() => retry(e.key)}
                className="btn-secondary text-xs shrink-0 self-start disabled:opacity-50"
              >
                {busy === e.key ? 'Syncing…' : 'Retry sync'}
              </button>
            )}
          </div>
        ))}
      </div>
      <a href="/api/etsy/connect" className="inline-block text-sm underline mt-4">
        Reconnect Etsy permissions
      </a>
      {message && (
        <p role="status" className="text-sm mt-4">
          {message}
        </p>
      )}
    </section>
  )
}
