'use client'

import { useState } from 'react'

export default function BackInStockForm({ productId }: { productId: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setState('idle')
        return
      }
      setState('done')
    } catch {
      setError('Network error. Please try again.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        You&apos;re on the list — we&apos;ll email you the moment it&apos;s back.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-taupe/40 bg-taupe/5 p-4">
      <p className="text-sm font-medium text-charcoal mb-2">Notify me when it&apos;s back</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="input flex-1 text-sm"
        />
        <button type="submit" disabled={state === 'sending'} className="btn-primary text-sm shrink-0 disabled:opacity-50">
          {state === 'sending' ? 'Adding…' : 'Notify me'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </form>
  )
}
