'use client'

import { useState } from 'react'

export default function CustomerNotes({ orderId, initialNotes }: { orderId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/orders/customer-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, customerNotes: notes.trim() || null }),
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide">Customer Notes</h2>
          <p className="text-xs text-warm-gray mt-0.5">Visible to the customer in their order view.</p>
        </div>
        <div className="flex items-center gap-2">
          {!saved && (
            <span className="text-xs text-warm-gray">Unsaved changes</span>
          )}
          <button
            onClick={save}
            disabled={saving || saved}
            className="text-xs px-2.5 py-1 rounded bg-charcoal text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
        onBlur={save}
        rows={3}
        placeholder="Add a note for the customer (e.g. color choice needed, special instructions)…"
        className="w-full bg-cream border border-zinc-200 rounded-lg px-3 py-2 text-sm text-charcoal placeholder-warm-gray focus:outline-hidden focus:border-zinc-400 resize-none"
      />
    </div>
  )
}
