'use client'

import { useState } from 'react'

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  maxUses: number | null
  uses: number
  expiresAt: Date | string | null
  active: boolean
  createdAt: Date | string
  minQuantity: number | null
  minOrderValue: number | null
}

export default function CouponsClient({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons)
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [minOrderValue, setMinOrderValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, type, value, maxUses: maxUses || null, expiresAt: expiresAt || null, minQuantity: minQuantity || null, minOrderValue: minOrderValue || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setCoupons(c => [data, ...c])
    setCode(''); setValue(''); setMaxUses(''); setExpiresAt(''); setMinQuantity(''); setMinOrderValue(''); setShowForm(false)
  }

  async function toggle(id: string, active: boolean) {
    const res = await fetch('/api/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
    const data = await res.json()
    if (res.ok) setCoupons(c => c.map(x => x.id === id ? data : x))
  }

  async function remove(id: string) {
    if (!confirm('Delete this coupon?')) return
    await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' })
    setCoupons(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">
        {showForm ? 'Cancel' : '+ New Coupon'}
      </button>

      {showForm && (
        <form onSubmit={create} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-gray mb-1">Code</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SAVE10" className="input w-full" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-gray mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'percent' | 'fixed')} className="input w-full">
                <option value="percent">Percent off (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-gray mb-1">
                {type === 'percent' ? 'Discount (%)' : 'Discount ($)'}
              </label>
              <input type="number" value={value} onChange={e => setValue(e.target.value)} min="0.01" step="0.01" placeholder={type === 'percent' ? '10' : '5.00'} className="input w-full" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-gray mb-1">Max Uses (optional)</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-warm-gray mb-1">Expiry Date (optional)</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="input w-full" />
            </div>
            <div className="col-span-2 border-t border-taupe/20 pt-3">
              <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Conditions (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-warm-gray mb-1">Min. Quantity</label>
                  <input type="number" value={minQuantity} onChange={e => setMinQuantity(e.target.value)} min="1" step="1" placeholder="e.g. 2" className="input w-full" />
                  <p className="text-xs text-warm-gray/60 mt-1">Customer must order at least this many items</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-gray mb-1">Min. Order Value ($)</label>
                  <input type="number" value={minOrderValue} onChange={e => setMinOrderValue(e.target.value)} min="0.01" step="0.01" placeholder="e.g. 50.00" className="input w-full" />
                  <p className="text-xs text-warm-gray/60 mt-1">Order total must be at least this amount</p>
                </div>
              </div>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Creating…' : 'Create Coupon'}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-taupe/10 text-warm-gray text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th>
              <th className="px-5 py-3 text-left">Discount</th>
              <th className="px-5 py-3 text-left">Conditions</th>
              <th className="px-5 py-3 text-left">Uses</th>
              <th className="px-5 py-3 text-left">Expires</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/10">
            {coupons.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-warm-gray">No coupons yet</td></tr>
            )}
            {coupons.map(c => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-mono font-semibold text-charcoal">{c.code}</td>
                <td className="px-5 py-3 text-warm-gray">
                  {c.type === 'percent' ? `${c.value}% off` : `$${c.value.toFixed(2)} off`}
                </td>
                <td className="px-5 py-3 text-warm-gray text-xs">
                  {c.minQuantity || c.minOrderValue ? (
                    <div className="space-y-0.5">
                      {c.minQuantity && <div>Min qty: {c.minQuantity}</div>}
                      {c.minOrderValue && <div>Min order: ${c.minOrderValue.toFixed(2)}</div>}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-5 py-3 text-warm-gray">
                  {c.uses}{c.maxUses ? ` / ${c.maxUses}` : ''}
                </td>
                <td className="px-5 py-3 text-warm-gray">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-taupe/20 text-warm-gray'}`}>
                    {c.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(c.id, !c.active)} className="text-xs text-warm-gray hover:text-charcoal transition-colors">
                      {c.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(c.id)} className="text-xs text-red-600 hover:text-red-700 transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
