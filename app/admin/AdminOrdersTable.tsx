'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STATUS_STYLES, STATUS_LABELS, formatOrderId } from '@/lib/constants'

type OrderStatus = 'pending' | 'in_progress' | 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
const STATUSES: OrderStatus[] = ['pending', 'in_progress', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled']
// "completed" was a legacy status, "delivered" is now the final state

interface Order {
  id: string
  orderNumber?: string | null
  status: string
  description: string
  createdAt: Date
  archivedAt?: Date | null
  deletedAt?: Date | null
  quote?: number | null
  paymentStatus?: string | null
  userEmail: string
  userName?: string
  userDefaultAddress?: { street: string; city: string; state: string; zip: string; country: string } | null
}

interface Rate {
  id: string
  carrier: string
  service: string
  amount: string
  currency: string
  estimatedDays: number
}

interface ToAddress { name: string; street: string; city: string; state: string; zip: string; country: string }

function ShipModal({ orderId, toAddress, onClose, onShipped }: { orderId: string; toAddress: ToAddress; onClose: () => void; onShipped: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const FROM = { name: 'DrivenByFaith3D', street: '82 Fieldstone Dr', city: 'Springfield', state: 'NJ', zip: '07081', country: 'US' }

  const [dims, setDims] = useState({ length: '6', width: '4', height: '3', weightLb: '1', weightOz: '0' })
  const [step, setStep] = useState<'form' | 'rates' | 'done'>('form')
  const [labelUrl, setLabelUrl] = useState<string | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setDim(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setDims((d) => ({ ...d, [field]: e.target.value }))
  }

  async function fetchRates(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/shippo/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromName: FROM.name, fromStreet: FROM.street, fromCity: FROM.city, fromState: FROM.state, fromZip: FROM.zip, fromCountry: FROM.country,
        toName: toAddress.name, toStreet: toAddress.street, toCity: toAddress.city, toState: toAddress.state, toZip: toAddress.zip, toCountry: toAddress.country || 'US',
        length: dims.length, width: dims.width, height: dims.height,
        weight: (parseFloat(dims.weightLb || '0') + parseFloat(dims.weightOz || '0') / 16).toFixed(4),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to fetch rates'); setLoading(false); return }
    setRates(data.rates)
    setSelectedRate(data.rates[0] ?? null)
    setStep('rates')
    setLoading(false)
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
    onShipped()
    setLabelUrl(data.label_url || null)
    setStep('done')
    setLoading(false)
    // Auto-open label PDF in new tab
    if (data.label_url) window.open(data.label_url, '_blank')
  }

  const dimField = (label: string, key: keyof typeof dims, opts?: { min?: string; step?: string }) => (
    <div>
      <label className="block text-sm font-medium text-warm-gray mb-1">{label}</label>
      <input className="input w-full" value={dims[key]} onChange={setDim(key)} type="number" min={opts?.min ?? '0'} step={opts?.step ?? '1'} required />
    </div>
  )

  const hasToAddress = toAddress.street && toAddress.city && toAddress.state && toAddress.zip

  const modal = (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="card p-8 w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-taupe/20 border border-taupe/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-charcoal">
              {step === 'form' ? 'Create Shipping Label' : step === 'rates' ? 'Choose a Carrier' : 'Label Ready'}
            </h1>
            <p className="text-warm-gray mt-1 text-sm">
              {step === 'form' ? 'Enter the package dimensions' : step === 'rates' ? 'Select the rate that works best for you' : 'Your label has been purchased'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'form' ? 'bg-charcoal' : 'bg-charcoal/20'}`} />
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'rates' ? 'bg-charcoal' : 'bg-charcoal/20'}`} />
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'done' ? 'bg-green-600' : 'bg-charcoal/20'}`} />
            </div>
          </div>

          {step === 'form' && (
            <form onSubmit={fetchRates} className="space-y-5">

              {/* Address summary */}
              <div className="rounded-lg border border-taupe/30 bg-taupe/10 p-4 space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-warm-gray w-10 shrink-0">From</span>
                  <span className="text-charcoal/85">{FROM.street}, {FROM.city}, {FROM.state} {FROM.zip}</span>
                </div>
                <div className="border-t border-taupe/30" />
                <div className="flex gap-3">
                  <span className="text-warm-gray w-10 shrink-0">To</span>
                  {hasToAddress ? (
                    <span className="text-charcoal/85">
                      {toAddress.street}, {toAddress.city}, {toAddress.state} {toAddress.zip}
                    </span>
                  ) : (
                    <span className="text-amber-600 text-xs">No address on file for this customer</span>
                  )}
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-warm-gray mb-3">Package Dimensions</p>
                <div className="grid grid-cols-2 gap-3">
                  {dimField('Length (in)', 'length', { min: '0.1', step: '0.1' })}
                  {dimField('Width (in)', 'width', { min: '0.1', step: '0.1' })}
                  {dimField('Height (in)', 'height', { min: '0.1', step: '0.1' })}
                  <div>
                    <label className="block text-sm font-medium text-warm-gray mb-1">Weight</label>
                    <div className="flex rounded-lg overflow-hidden border border-taupe/30 bg-cream focus-within:border-charcoal/50">
                      <div className="relative flex-1">
                        <input className="w-full bg-transparent px-3 py-2 text-sm text-charcoal focus:outline-none" value={dims.weightLb} onChange={setDim('weightLb')} type="number" min="0" step="1" placeholder="0" required />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-warm-gray pointer-events-none">lb</span>
                      </div>
                      <div className="w-px bg-taupe/30" />
                      <div className="relative flex-1">
                        <input className="w-full bg-transparent px-3 py-2 text-sm text-charcoal focus:outline-none" value={dims.weightOz} onChange={setDim('weightOz')} type="number" min="0" max="15" step="1" placeholder="0" required />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-warm-gray pointer-events-none">oz</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <button type="submit" disabled={loading || !hasToAddress} className="btn-primary w-full">
                {loading ? 'Fetching rates…' : 'Get Shipping Rates'}
              </button>
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">
                Cancel
              </button>
            </form>
          )}

          {step === 'rates' && (
            <div className="space-y-3">
              {rates.map((rate, i) => (
                <button
                  key={rate.id}
                  type="button"
                  onClick={() => setSelectedRate(rate)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-lg border text-left transition-all ${
                    selectedRate?.id === rate.id
                      ? 'border-charcoal bg-taupe/20 text-charcoal'
                      : 'border-taupe/30 bg-taupe/5 text-warm-gray hover:border-taupe/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      selectedRate?.id === rate.id ? 'border-charcoal bg-charcoal' : 'border-taupe/50'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rate.carrier}</span>
                        {i === 0 && <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full">Best price</span>}
                      </div>
                      <p className="text-warm-gray text-xs mt-0.5">
                        {rate.service}{rate.estimatedDays > 0 ? ` · ${rate.estimatedDays} day${rate.estimatedDays !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-lg">${parseFloat(rate.amount).toFixed(2)}</span>
                </button>
              ))}

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>}

              <button type="button" onClick={purchaseLabel} disabled={loading || !selectedRate} className="btn-primary w-full mt-4">
                {loading ? 'Purchasing label…' : 'Buy Label & Mark Shipped'}
              </button>
              <button type="button" onClick={() => { setStep('form'); setError('') }} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">
                ← Back to details
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-charcoal font-semibold">Label Created</p>
                <p className="text-warm-gray text-sm mt-1">The label PDF should have opened in a new tab.</p>
              </div>
              {labelUrl && (
                <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Label
                </a>
              )}
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors">
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}

function OrderRow({ order, tab, unread, selected, onToggle, onAction }: { order: Order; tab: string; unread: number; selected: boolean; onToggle: () => void; onAction: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus>(order.status as OrderStatus)
  const [showShipModal, setShowShipModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showQuoteInput, setShowQuoteInput] = useState(false)
  const [quoteValue, setQuoteValue] = useState(order.quote ? String(order.quote) : '')
  const [quote, setQuote] = useState<number | null | undefined>(order.quote)
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus)

  async function saveQuote() {
    const amount = parseFloat(quoteValue)
    if (isNaN(amount) || amount <= 0) return
    setBusy(true)
    await fetch('/api/orders/quote', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, quote: amount }),
    })
    setQuote(amount)
    setPaymentStatus('unpaid')
    setShowQuoteInput(false)
    setBusy(false)
  }

  async function updateStatus(newStatus: OrderStatus) {
    setBusy(true)
    await fetch('/api/orders/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: newStatus }),
    })
    setStatus(newStatus)
    setBusy(false)
  }

  async function doAction(action: 'archive' | 'delete' | 'restore') {
    if (action === 'delete' && !confirm('Move this order to trash? It will be permanently deleted after 30 days.')) return
    if (action === 'archive' && !confirm('Archive this order? You can restore it at any time.')) return
    setBusy(true)
    await fetch('/api/orders/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, action }),
    })
    onAction()
  }

  const daysLeft = order.deletedAt
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(order.deletedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      <tr className={`hover:bg-taupe/5 transition-colors ${selected ? 'bg-taupe/10' : ''}`}>
        <td className="pl-5 pr-2 py-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="accent-charcoal cursor-pointer"
          />
        </td>
        <td className="px-3 py-4">
          <div className="flex items-center gap-2">
            <Link href={`/admin/orders/${order.id}`} className="text-charcoal/80 hover:text-charcoal font-mono">
              {formatOrderId(order)}
            </Link>
            {unread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                {unread}
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4 text-warm-gray">{order.userEmail}</td>
        <td className="px-5 py-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status] ?? 'bg-taupe/20 text-warm-gray'}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        </td>
        <td className="px-5 py-4 text-warm-gray">
          {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </td>
        <td className="px-5 py-4">
          {tab === 'active' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select value={status} onChange={(e) => updateStatus(e.target.value as OrderStatus)}
                  disabled={busy}
                  className="text-xs bg-white border border-taupe/30 text-charcoal rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50">
                  {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
                </select>
                <button onClick={() => setShowShipModal(true)} disabled={busy}
                  className="text-xs text-warm-gray hover:text-blue-600 transition-colors px-1.5 py-1 rounded hover:bg-blue-50 disabled:opacity-40"
                  title="Create shipping label">
                  Ship Label
                </button>
                <button onClick={() => doAction('archive')} disabled={busy}
                  className="text-xs text-warm-gray hover:text-amber-600 transition-colors px-1.5 py-1 rounded hover:bg-amber-50 disabled:opacity-40"
                  title="Archive">
                  Archive
                </button>
                <button onClick={() => doAction('delete')} disabled={busy}
                  className="text-xs text-warm-gray hover:text-red-600 transition-colors px-1.5 py-1 rounded hover:bg-red-50 disabled:opacity-40"
                  title="Move to trash">
                  Delete
                </button>
              </div>
              {/* Quote row */}
              {showQuoteInput ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-warm-gray">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quoteValue}
                    onChange={(e) => setQuoteValue(e.target.value)}
                    className="text-xs bg-white border border-taupe/30 text-charcoal rounded px-2 py-1 w-20 focus:outline-none focus:border-charcoal/50"
                    placeholder="0.00"
                    autoFocus
                  />
                  <button onClick={saveQuote} disabled={busy}
                    className="text-xs text-green-600 hover:text-green-700 px-1.5 py-1 rounded hover:bg-green-50 disabled:opacity-40">
                    Save
                  </button>
                  <button onClick={() => setShowQuoteInput(false)}
                    className="text-xs text-warm-gray hover:text-charcoal px-1.5 py-1 rounded hover:bg-taupe/10">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {quote ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {paymentStatus === 'paid' ? `Paid $${quote.toFixed(2)}` : `Quote: $${quote.toFixed(2)}, Unpaid`}
                    </span>
                  ) : null}
                  <button onClick={() => setShowQuoteInput(true)} disabled={busy}
                    className="text-xs text-warm-gray hover:text-green-600 transition-colors px-1.5 py-1 rounded hover:bg-green-50 disabled:opacity-40">
                    {quote ? 'Edit Quote' : 'Set Quote'}
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'delivered' && (
            <div className="flex items-center gap-2">
              <button onClick={() => doAction('archive')} disabled={busy}
                className="text-xs text-warm-gray hover:text-amber-600 transition-colors px-1.5 py-1 rounded hover:bg-amber-50 disabled:opacity-40">
                Archive
              </button>
              <button onClick={() => doAction('delete')} disabled={busy}
                className="text-xs text-warm-gray hover:text-red-600 transition-colors px-1.5 py-1 rounded hover:bg-red-50 disabled:opacity-40">
                Delete
              </button>
            </div>
          )}
          {tab === 'archived' && (
            <button onClick={() => doAction('restore')} disabled={busy}
              className="text-xs text-warm-gray hover:text-charcoal transition-colors px-2 py-1 rounded border border-taupe/30 hover:border-taupe/50 disabled:opacity-40">
              Restore
            </button>
          )}
          {tab === 'trash' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-warm-gray/60">
                {daysLeft === 0 ? 'Deletes today' : `${daysLeft}d left`}
              </span>
              <button onClick={() => doAction('restore')} disabled={busy}
                className="text-xs text-warm-gray hover:text-charcoal transition-colors px-2 py-1 rounded border border-taupe/30 hover:border-taupe/50 disabled:opacity-40">
                Restore
              </button>
            </div>
          )}
        </td>
      </tr>
      {showShipModal && (
        <ShipModal
          orderId={order.id}
          toAddress={{
            name: order.userName || '',
            street: order.userDefaultAddress?.street || '',
            city: order.userDefaultAddress?.city || '',
            state: order.userDefaultAddress?.state || '',
            zip: order.userDefaultAddress?.zip || '',
            country: order.userDefaultAddress?.country || 'US',
          }}
          onClose={() => setShowShipModal(false)}
          onShipped={() => { setStatus('label_created'); router.refresh() }}
        />
      )}
    </>
  )
}

const PAGE_SIZE = 20

type Tab = 'active' | 'delivered' | 'archived' | 'trash'

export default function AdminOrdersTable({ initialOrders, unreadMap = {} }: { initialOrders: Order[]; unreadMap?: Record<string, number> }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [page, setPage] = useState(1)

  const active    = initialOrders.filter(o => !o.archivedAt && !o.deletedAt && !['delivered', 'completed'].includes(o.status))
  const delivered = initialOrders.filter(o => !o.archivedAt && !o.deletedAt && ['delivered', 'completed'].includes(o.status))
  const archived  = initialOrders.filter(o => !!o.archivedAt && !o.deletedAt)
  const trash     = initialOrders.filter(o => !!o.deletedAt)

  const activeUnread = active.filter(o => (unreadMap[o.id] ?? 0) > 0).length

  const tabs: { id: Tab; label: string; count: number; unread?: number }[] = [
    { id: 'active',    label: 'Active',    count: active.length,    unread: activeUnread },
    { id: 'delivered', label: 'Delivered', count: delivered.length },
    { id: 'archived',  label: 'Archived',  count: archived.length },
    { id: 'trash',     label: 'Trash',     count: trash.length },
  ]

  const baseRows = tab === 'active' ? active : tab === 'delivered' ? delivered : tab === 'archived' ? archived : trash

  const filteredRows = search.trim()
    ? baseRows.filter(o => {
        const q = search.toLowerCase()
        return (
          formatOrderId(o).toLowerCase().includes(q) ||
          o.userEmail.toLowerCase().includes(q) ||
          (o.userName ?? '').toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q)
        )
      })
    : baseRows

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  const allSelected = filteredRows.length > 0 && filteredRows.every(o => selected.has(o.id))
  const someSelected = filteredRows.some(o => selected.has(o.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); filteredRows.forEach(o => next.delete(o.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); filteredRows.forEach(o => next.add(o.id)); return next })
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  // Clear selection and reset page when tab changes
  function switchTab(t: Tab) {
    setTab(t)
    setSelected(new Set())
    setPage(1)
  }

  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('in_progress')

  async function bulkStatusUpdate() {
    const ids = Array.from(selected).filter(id => filteredRows.some(o => o.id === id))
    if (ids.length === 0) return
    setBulkBusy(true)
    await fetch('/api/orders/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids, status: bulkStatus }),
    })
    setSelected(new Set())
    setBulkBusy(false)
    router.refresh()
  }

  async function bulkAction(action: 'archive' | 'delete' | 'restore') {
    const ids = Array.from(selected).filter(id => rows.some(o => o.id === id))
    if (ids.length === 0) return
    if (action === 'delete' && !confirm(`Move ${ids.length} order${ids.length > 1 ? 's' : ''} to trash? They will be permanently deleted after 30 days.`)) return
    if (action === 'archive' && !confirm(`Archive ${ids.length} order${ids.length > 1 ? 's' : ''}? You can restore them at any time.`)) return
    setBulkBusy(true)
    await fetch('/api/orders/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids, action }),
    })
    setSelected(new Set())
    setBulkBusy(false)
    router.refresh()
  }

  const selectedInView = filteredRows.filter(o => selected.has(o.id)).length

  // Determine which bulk actions are available per tab
  const bulkActions: { label: string; action: 'archive' | 'delete' | 'restore'; className: string }[] =
    tab === 'active' || tab === 'delivered'
      ? [
          { label: 'Archive', action: 'archive', className: 'text-amber-600 hover:bg-amber-600/10' },
          { label: 'Move to Trash', action: 'delete', className: 'text-red-600 hover:bg-red-600/10' },
        ]
      : tab === 'archived'
      ? [
          { label: 'Restore', action: 'restore', className: 'bg-charcoal text-white hover:bg-charcoal/90' },
          { label: 'Move to Trash', action: 'delete', className: 'text-red-600 hover:bg-red-600/10' },
        ]
      : [
          { label: 'Restore', action: 'restore', className: 'bg-charcoal text-white hover:bg-charcoal/90' },
        ]

  return (
    <div className="card overflow-hidden">
      {/* Header with tabs and search */}
      <div className="px-5 py-4 border-b border-taupe/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'bg-charcoal text-white' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              {t.label}
              {(t.unread ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                  {t.unread}
                </span>
              )}
              {t.count > 0 && (t.unread ?? 0) === 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-charcoal/80 text-white' : 'bg-taupe/20 text-warm-gray'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-gray pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs bg-white border border-taupe/30 text-charcoal rounded-lg pl-7 pr-3 py-1.5 w-48 focus:outline-none focus:border-charcoal/50 placeholder-warm-gray/50"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="px-5 py-2.5 bg-taupe/10 border-b border-taupe/20 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-charcoal/85 font-medium">{selectedInView} selected</span>
          <div className="flex items-center gap-1 flex-wrap">
            {tab === 'active' && (
              <div className="flex items-center gap-1 border-r border-taupe/30 pr-2 mr-1">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                  disabled={bulkBusy}
                  className="text-xs bg-white border border-taupe/30 text-charcoal rounded px-1.5 py-1 focus:outline-none disabled:opacity-50"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
                <button
                  onClick={bulkStatusUpdate}
                  disabled={bulkBusy}
                  className="text-xs px-2.5 py-1 rounded bg-charcoal text-white hover:bg-charcoal/90 transition-colors disabled:opacity-40"
                >
                  Set Status
                </button>
              </div>
            )}
            {bulkActions.map((a) => (
              <button
                key={a.action}
                onClick={() => bulkAction(a.action)}
                disabled={bulkBusy}
                className={`text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-40 ${a.className}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-warm-gray hover:text-charcoal transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {tab === 'trash' && trash.length > 0 && !someSelected && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600">
          Orders in trash are permanently deleted after 30 days.
        </div>
      )}

      {tab === 'delivered' && !someSelected && (
        <div className="px-5 py-2.5 bg-green-50 border-b border-green-100 text-xs text-green-600">
          Orders that have been delivered to the customer.
        </div>
      )}

      {tab === 'archived' && !someSelected && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-600">
          Archived orders are kept permanently and can be restored at any time.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-taupe/10 text-warm-gray text-xs uppercase tracking-wide">
            <tr>
              <th className="pl-5 pr-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected }}
                  onChange={toggleAll}
                  className="accent-charcoal cursor-pointer"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                />
              </th>
              <th className="px-3 py-3 text-left">Order ID</th>
              <th className="px-5 py-3 text-left">Customer</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Created</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/10">
            {rows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                tab={tab}
                unread={unreadMap[order.id] ?? 0}
                selected={selected.has(order.id)}
                onToggle={() => toggleOne(order.id)}
                onAction={() => router.refresh()}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-warm-gray">
                  {tab === 'active' ? 'No active orders' : tab === 'delivered' ? 'No delivered orders' : tab === 'archived' ? 'No archived orders' : 'Trash is empty'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-taupe/20 flex items-center justify-between text-xs text-warm-gray">
          <span>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2 py-1 rounded hover:bg-taupe/10 disabled:opacity-30 transition-colors"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded transition-colors ${safePage === p ? 'bg-charcoal text-white' : 'hover:bg-taupe/10'}`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2 py-1 rounded hover:bg-taupe/10 disabled:opacity-30 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
