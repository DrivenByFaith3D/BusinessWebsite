'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

const DRAFT_KEY = 'order_draft'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

type ServiceType = 'customize' | 'design' | null

const SERVICES = {
  customize: {
    title: 'Customize Our Prints',
    description: 'Tell us which design you want customized and how you\'d like it changed.',
    rate: '$7/print hr',
    fileLabel: 'Upload a reference image (optional)',
    accept: '.png,.jpg,.jpeg,.gif,.webp',
    placeholder: 'Which product do you want customized? Describe the changes — size, color, material, personal touches…',
    fields: ['baseProduct', 'changes'],
  },
  design: {
    title: 'Design & Print',
    description: 'We\'ll design a completely custom piece from scratch based on your vision.',
    rate: '$12/print hr',
    fileLabel: 'Upload inspiration images or sketches (optional)',
    accept: '.png,.jpg,.jpeg,.gif,.webp,.pdf',
    placeholder: 'Describe what you want us to create — purpose, dimensions, style, any inspiration or references…',
    fields: ['idea'],
  },
}

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  const serviceParam = searchParams.get('service') as ServiceType
  const [serviceType, setServiceType] = useState<ServiceType>(
    serviceParam && SERVICES[serviceParam] ? serviceParam : null
  )
  const [description, setDescription] = useState('')
  const [baseProduct, setBaseProduct] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Restore draft
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}')
      if (draft.description) setDescription(draft.description)
      if (draft.quantity) setQuantity(draft.quantity)
      if (draft.baseProduct) setBaseProduct(draft.baseProduct)
    } catch {}
  }, [])

  // Autosave draft
  const saveDraft = useCallback(() => {
    if (description || baseProduct) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ serviceType, description, quantity, baseProduct }))
    }
  }, [serviceType, description, quantity, baseProduct])

  useEffect(() => { saveDraft() }, [saveDraft])

  function validateFile(f: File): string {
    if (f.size > MAX_FILE_SIZE) return 'File is too large (max 50MB)'
    return ''
  }

  const selectedService = serviceType ? SERVICES[serviceType] : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) { router.push('/login'); return }
    setError('')
    setLoading(true)

    const fullDescription = serviceType === 'customize'
      ? `[Customize Our Prints — ${selectedService?.rate}]\nBase product: ${baseProduct}\n\n${description}`
      : `[Design & Print — ${selectedService?.rate}]\n\n${description}`

    const orderType = serviceType === 'customize' ? 'image' : 'scratch'

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: fullDescription, orderType, quantity }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    if (file) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orderId', data.id)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}))
        setError(uploadData.error ?? 'File upload failed. Your order was created but the file was not attached.')
        setLoading(false)
        router.push(`/orders/${data.id}`)
        return
      }
    }

    localStorage.removeItem(DRAFT_KEY)
    router.push(`/orders/${data.id}`)
  }

  // Step 1 — choose service type
  if (!serviceType) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-display">Start a Custom Order</h1>
          <p className="text-charcoal/60 text-sm mt-2">What kind of service are you looking for?</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {(Object.entries(SERVICES) as [ServiceType & string, typeof SERVICES['customize']][]).map(([id, service]) => (
            <button
              key={id}
              onClick={() => setServiceType(id as ServiceType)}
              className="card p-6 text-left hover:border-taupe transition-all group flex flex-col gap-4"
            >
              <div>
                <h2 className="font-display text-xl mb-1">{service.title}</h2>
                <p className="text-charcoal/60 text-sm leading-relaxed">{service.description}</p>
              </div>
              <div className="border-t border-taupe/30 pt-3 mt-auto">
                <span className="text-sm font-medium text-charcoal">{service.rate}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 2 — service-specific form
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => { setServiceType(null); setFile(null); setFileError(''); setDescription(''); setBaseProduct('') }}
        className="flex items-center gap-2 text-sm text-warm-gray hover:text-charcoal transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-display">{selectedService?.title}</h1>
        <p className="text-charcoal/60 text-sm mt-1">{selectedService?.description}</p>
        <span className="inline-block mt-2 text-sm font-medium text-charcoal bg-taupe/30 px-3 py-1 rounded-full">
          {selectedService?.rate}
        </span>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Base product field — only for Customize */}
          {serviceType === 'customize' && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Which product do you want customized? <span className="text-warm-gray">*</span>
              </label>
              <input
                type="text"
                value={baseProduct}
                onChange={(e) => setBaseProduct(e.target.value)}
                className="input"
                placeholder="e.g. Minimal Desk Caddy, the large pen holder, etc."
                required
              />
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">
                {serviceType === 'customize' ? 'What changes do you want?' : 'Describe your idea'} <span className="text-warm-gray">*</span>
              </label>
              <span className={`text-xs ${description.length > 900 ? description.length >= 1000 ? 'text-red-500' : 'text-amber-600' : 'text-warm-gray'}`}>
                {description.length}/1000
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              className="input-textarea"
              rows={5}
              placeholder={selectedService?.placeholder}
              maxLength={1000}
              required
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">{selectedService?.fileLabel}</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-taupe bg-taupe/10' : 'border-taupe/50 hover:border-taupe'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 text-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-charcoal truncate max-w-xs">{file.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="text-warm-gray hover:text-charcoal text-xs ml-1">✕</button>
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 mx-auto mb-2 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-charcoal/60">Click to upload</p>
                  <p className="text-xs text-warm-gray mt-1">Images up to 50MB</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={selectedService?.accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f) {
                    const err = validateFile(f)
                    if (err) { setFileError(err); setFile(null); e.target.value = ''; return }
                  }
                  setFileError('')
                  setFile(f)
                }}
              />
            </div>
          </div>

          {fileError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fileError}</p>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-white border border-taupe text-charcoal hover:bg-taupe/20 transition-colors flex items-center justify-center text-lg font-medium"
              >−</button>
              <span className="text-charcoal font-semibold text-lg w-8 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 rounded-full bg-white border border-taupe text-charcoal hover:bg-taupe/20 transition-colors flex items-center justify-center text-lg font-medium"
              >+</button>
              {quantity > 1 && <span className="text-xs text-warm-gray">Ordering multiple of the same item</span>}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={loading || !description.trim() || (serviceType === 'customize' && !baseProduct.trim()) || !!fileError}
              className="btn-primary flex-1"
            >
              {loading ? 'Creating…' : 'Submit Order'}
            </button>
          </div>
          {description && <p className="text-xs text-warm-gray text-center">Draft saved automatically</p>}
        </form>
      </div>
    </div>
  )
}
