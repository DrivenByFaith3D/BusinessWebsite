'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function ShopFulfillmentForm({
  order,
}: {
  order: {
    id: string
    status: string
    carrier: string | null
    trackingNumber: string | null
    trackingUrl: string | null
  }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const fields = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const res = await fetch(`/api/admin/shop-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage('Shipping details saved. The customer’s tracking page is updated.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <h2 className="font-semibold">Fulfill order</h2>
      <label className="block text-sm">
        Status
        <select
          name="status"
          defaultValue={order.status}
          className="block w-full border border-taupe rounded-lg p-2 mt-1"
        >
          <option value="paid">Ready to print</option>
          <option value="printing">Printing / ready to ship</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
        </select>
      </label>
      {(['carrier', 'trackingNumber', 'trackingUrl'] as const).map((name) => (
        <label className="block text-sm" key={name}>
          {
            { carrier: 'Carrier', trackingNumber: 'Tracking number', trackingUrl: 'Tracking link (HTTPS)' }[
              name
            ]
          }
          <input
            name={name}
            defaultValue={order[name] ?? ''}
            maxLength={500}
            type={name === 'trackingUrl' ? 'url' : 'text'}
            className="block w-full border border-taupe rounded-lg p-2 mt-1"
          />
        </label>
      ))}
      <button disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? 'Saving…' : 'Save shipping details'}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  )
}
