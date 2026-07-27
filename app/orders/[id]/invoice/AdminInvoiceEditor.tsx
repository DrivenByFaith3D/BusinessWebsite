'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  orderId: string
  itemLabel: string
  quote: number | null
  quantity: number
  taxExempt: boolean
  notes: string
}

export default function AdminInvoiceEditor(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [itemLabel, setItemLabel] = useState(props.itemLabel)
  const [quote, setQuote] = useState(props.quote != null ? String(props.quote) : '')
  const [quantity, setQuantity] = useState(String(props.quantity))
  const [taxExempt, setTaxExempt] = useState(props.taxExempt)
  const [notes, setNotes] = useState(props.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/orders/invoice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: props.orderId,
          invoiceItemLabel: itemLabel,
          invoiceNotes: notes,
          taxExempt,
          quote: quote === '' ? undefined : Number(quote),
          quantity: Number(quantity),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save.'); setSaving(false); return }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error.')
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm no-print">
        Edit invoice
      </button>
    )
  }

  return (
    <div className="no-print card p-5 w-full max-w-md text-left space-y-3">
      <p className="text-sm font-semibold text-charcoal">Edit invoice</p>
      <div>
        <label className="block text-xs font-medium text-warm-gray mb-1">Item description</label>
        <input className="input w-full text-sm" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder="What they ordered" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-warm-gray mb-1">Price ($)</label>
          <input type="number" min="0" step="0.01" className="input w-full text-sm" value={quote} onChange={(e) => setQuote(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-gray mb-1">Quantity</label>
          <input type="number" min="1" step="1" className="input w-full text-sm" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} />
        Tax exempt (certificate on file)
      </label>
      <div>
        <label className="block text-xs font-medium text-warm-gray mb-1">Notes / terms (optional)</label>
        <textarea className="input w-full text-sm resize-none" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Thank you for your business" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  )
}
