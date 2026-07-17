'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  inStock: boolean
  createdAt: Date
  reviewCount?: number
  avgRating?: number
}

const EMPTY_FORM = { name: '', description: '', price: '', imageUrl: '' }

export default function AdminProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  async function syncEtsy() {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetch('/api/sync/etsy', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMessage(data.error || 'Sync failed.')
      } else {
        setSyncMessage(
          `Synced ${data.total} listing${data.total === 1 ? '' : 's'}: ${data.created} new, ${data.updated} updated, ${data.deactivated} hidden.`,
        )
        // Reload so the grid reflects what the sync just wrote.
        window.location.reload()
      }
    } catch {
      setSyncMessage('Network error. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  function openEdit(p: Product) {
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), imageUrl: p.imageUrl ?? '' })
    setEditingId(p.id)
    setShowForm(true)
    setError('')
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.price) { setError('Name and price are required'); return }
    setLoading(true)
    setError('')

    const method = editingId ? 'PATCH' : 'POST'
    const body = editingId
      ? { id: editingId, ...form }
      : form

    const res = await fetch('/api/products', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error || 'Something went wrong'); return }

    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? { ...p, ...data } : p))
    } else {
      setProducts([data, ...products])
    }
    cancelForm()
  }

  async function toggleStock(id: string, inStock: boolean) {
    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, inStock }),
    })
    const data = await res.json()
    if (res.ok) setProducts(products.map(p => p.id === id ? { ...p, ...data } : p))
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setLoading(true)
    await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setProducts(products.filter(p => p.id !== id))
    setLoading(false)
  }

  return (
    <div>
      {/* Form */}
      {showForm && (
        <div className="card p-6 mb-8">
          <h2 className="text-base font-semibold text-charcoal mb-5">{editingId ? 'Edit Product' : 'New Product'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-warm-gray mb-1">Name <span className="text-warm-gray/60">*</span></label>
                <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Custom Phone Stand" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-gray mb-1">Price (USD) <span className="text-warm-gray/60">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray/50 text-sm">$</span>
                  <input className="input w-full pl-7" type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" required />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-gray mb-1">Description</label>
              <textarea className="input resize-none w-full" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the product…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-gray mb-1">Image URL</label>
              <input className="input w-full" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" />
              {form.imageUrl && (
                <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-taupe/30 bg-taupe/10">
                  <Image src={form.imageUrl} alt="Preview" width={96} height={96} className="object-cover w-full h-full" unoptimized />
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={cancelForm} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving…' : editingId ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar */}
      {!showForm && (
        <div className="flex justify-end items-center gap-3 mb-4">
          {syncMessage && (
            <p className={`text-xs ${syncMessage.startsWith('Synced') ? 'text-green-700' : 'text-red-600'}`}>
              {syncMessage}
            </p>
          )}
          <button
            onClick={syncEtsy}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            title="Pull the latest active listings from Etsy"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync from Etsy'}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Product
          </button>
        </div>
      )}

      {/* Products grid */}
      {products.length === 0 ? (
        <div className="card p-12 text-center text-warm-gray">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-charcoal font-medium">No products yet</p>
          <p className="text-sm mt-1">Create your first product to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <div key={product.id} className="card overflow-hidden flex flex-col">
              {product.imageUrl ? (
                <div className="aspect-video bg-taupe/5 overflow-hidden">
                  <Image src={product.imageUrl} alt={product.name} width={400} height={225} className="object-cover w-full h-full" unoptimized />
                </div>
              ) : (
                <div className="aspect-video bg-taupe/5 flex items-center justify-center">
                  <svg className="w-10 h-10 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-charcoal text-sm leading-snug">{product.name}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-taupe/20 text-warm-gray'}`}>
                      {product.inStock ? 'In stock' : 'Out of stock'}
                    </span>
                    <span className="text-charcoal font-bold text-sm">${product.price.toFixed(2)}</span>
                  </div>
                </div>
                {product.description && (
                  <p className="text-warm-gray text-xs leading-relaxed mb-3 flex-1">{product.description}</p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-taupe/10">
                  <button onClick={() => openEdit(product)} disabled={loading}
                    className="text-xs text-warm-gray hover:text-charcoal transition-colors px-2 py-1 rounded hover:bg-taupe/10 disabled:opacity-40">
                    Edit
                  </button>
                  <button onClick={() => toggleStock(product.id, !product.inStock)} disabled={loading}
                    className="text-xs text-warm-gray hover:text-charcoal transition-colors px-2 py-1 rounded hover:bg-taupe/10 disabled:opacity-40">
                    {product.inStock ? 'Mark out of stock' : 'Mark in stock'}
                  </button>
                  <button onClick={() => handleDelete(product.id, product.name)} disabled={loading}
                    className="text-xs text-warm-gray hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40">
                    Delete
                  </button>
                  <span className="ml-auto text-xs text-warm-gray/50">
                    {new Date(product.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
