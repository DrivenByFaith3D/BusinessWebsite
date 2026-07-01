'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Photo {
  id: string
  url: string
  caption: string | null
  category: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  desk_organizer: 'Desk Organizer',
  phone_stand: 'Phone Stand',
  figurine: 'Figurine',
  home_decor: 'Home Decor',
  other: 'Other',
}

const CATEGORIES = Object.entries(CATEGORY_LABELS)

export default function GalleryClient({ photos: initialPhotos, isAdmin }: { photos: Photo[]; isAdmin: boolean }) {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Photo | null>(null)
  const [inquiryPhoto, setInquiryPhoto] = useState<Photo | null>(null)
  const [inquiryText, setInquiryText] = useState('')

  // Admin upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const presentCategories = Array.from(
    new Set(photos.map(p => p.category).filter(Boolean) as string[])
  )

  const filtered = activeCategory
    ? photos.filter(p => p.category === activeCategory)
    : photos

  function openInquiry(photo: Photo) {
    const label = photo.category ? CATEGORY_LABELS[photo.category] ?? photo.category : 'this item'
    setInquiryText(`Hi! I saw a ${label} in your gallery and I'd love something similar. ${photo.caption ? `(Reference: "${photo.caption}") ` : ''}`)
    setInquiryPhoto(photo)
    setExpanded(null)
  }

  function startOrder() {
    if (!inquiryPhoto) return
    router.push(`/orders/new?type=scratch&description=${encodeURIComponent(inquiryText.trim())}`)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setShowUploadForm(true)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (uploadCaption.trim()) formData.append('caption', uploadCaption.trim())
      if (uploadCategory) formData.append('category', uploadCategory)

      const res = await fetch('/api/gallery', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const newPhoto = await res.json()
      setPhotos(prev => [newPhoto, ...prev])
      setShowUploadForm(false)
      setSelectedFile(null)
      setPreviewUrl(null)
      setUploadCaption('')
      setUploadCategory('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this photo from the gallery?')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/gallery', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error('Delete failed')
      setPhotos(prev => prev.filter(p => p.id !== id))
      if (expanded?.id === id) setExpanded(null)
    } catch {
      alert('Failed to delete. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-warm-gray uppercase mb-2">Our Work</p>
          <h1 className="text-3xl font-bold text-charcoal">Gallery</h1>
          <p className="text-warm-gray mt-2">A showcase of prints we've made for our customers.</p>
        </div>
        {isAdmin && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Photo
            </button>
          </div>
        )}
      </div>

      {/* Category filters */}
      {presentCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !activeCategory
                ? 'border-charcoal text-charcoal bg-charcoal/5'
                : 'border-taupe/30 text-warm-gray hover:border-charcoal/30 hover:text-charcoal'
            }`}
          >
            All
          </button>
          {presentCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeCategory === cat
                  ? 'border-charcoal text-charcoal bg-charcoal/5'
                  : 'border-taupe/30 text-warm-gray hover:border-charcoal/30 hover:text-charcoal'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-14 h-14 rounded-full bg-taupe/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-warm-gray font-medium mb-1">Gallery coming soon</p>
          <p className="text-warm-gray text-sm">
            {isAdmin ? 'Click "Add Photo" to upload your first gallery image.' : 'We\'re just getting started, check back soon to see our work.'}
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {filtered.map(photo => (
            <div key={photo.id} className="break-inside-avoid overflow-hidden rounded-lg border border-taupe/30 bg-white group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? '3D print'}
                className="w-full object-cover cursor-zoom-in group-hover:brightness-75 transition-all duration-200"
                onClick={() => !isAdmin && setExpanded(photo)}
              />

              {/* Admin overlay */}
              {isAdmin ? (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(photo.id)}
                    disabled={deletingId === photo.id}
                    className="pointer-events-auto bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === photo.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button
                    className="pointer-events-auto w-full text-xs font-semibold bg-white text-black rounded-lg py-2 hover:bg-zinc-200 transition-colors"
                    onClick={(e) => { e.stopPropagation(); openInquiry(photo) }}
                  >
                    I want this
                  </button>
                </div>
              )}

              {/* Category badge */}
              {photo.category && (
                <div className="absolute top-2 left-2 pointer-events-none">
                  <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[photo.category] ?? photo.category}
                  </span>
                </div>
              )}
              {photo.caption && (
                <div className="px-2 py-1.5">
                  <p className="text-xs text-warm-gray truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CTA for non-admin users */}
      {!isAdmin && (
        <div className="card p-8 text-center mt-12">
          <h2 className="text-xl font-bold text-charcoal mb-2">Want something like this?</h2>
          <p className="text-warm-gray text-sm mb-5">Submit a custom order and we'll bring your idea to life.</p>
          <Link href="/orders/new" className="btn-primary">Start Custom Order</Link>
        </div>
      )}

      {/* Upload form modal */}
      {showUploadForm && previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { setShowUploadForm(false); setSelectedFile(null); setPreviewUrl(null) }}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-charcoal font-semibold text-base">Add to Gallery</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-lg border border-taupe/30 bg-cream" />
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Caption <span className="text-warm-gray">(optional)</span></label>
              <input
                type="text"
                value={uploadCaption}
                onChange={e => setUploadCaption(e.target.value)}
                className="input w-full"
                placeholder="e.g. Custom phone stand in galaxy blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Category <span className="text-warm-gray">(optional)</span></label>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                className="input w-full"
              >
                <option value="">None</option>
                {CATEGORIES.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowUploadForm(false); setSelectedFile(null); setPreviewUrl(null) }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1">
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox (non-admin) */}
      {!isAdmin && expanded && !inquiryPhoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4" onClick={() => setExpanded(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expanded.url} alt={expanded.caption ?? '3D print'} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
          {(expanded.caption || expanded.category) && (
            <div className="mt-4 text-center" onClick={e => e.stopPropagation()}>
              {expanded.category && <p className="text-warm-gray text-xs">{CATEGORY_LABELS[expanded.category] ?? expanded.category}</p>}
              {expanded.caption && <p className="text-white text-sm mt-1">{expanded.caption}</p>}
            </div>
          )}
          <button
            className="mt-5 text-sm font-semibold bg-white text-black rounded-lg px-6 py-2.5 hover:bg-zinc-200 transition-colors"
            onClick={(e) => { e.stopPropagation(); openInquiry(expanded) }}
          >
            I want this
          </button>
          <button className="mt-3 text-xs text-warm-gray hover:text-white" onClick={() => setExpanded(null)}>Close</button>
        </div>
      )}

      {/* Inquiry modal (non-admin) */}
      {!isAdmin && inquiryPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setInquiryPhoto(null)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inquiryPhoto.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-taupe/30 shrink-0" />
              <div>
                <h2 className="text-charcoal font-semibold text-base">Request something like this</h2>
                <p className="text-warm-gray text-xs mt-1">We'll review your request and send you a quote.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tell me more</label>
              <textarea
                value={inquiryText}
                onChange={e => setInquiryText(e.target.value)}
                className="input resize-none w-full"
                rows={4}
                placeholder="Describe what you're looking for, size, color, any tweaks…"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setInquiryPhoto(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={startOrder} disabled={!inquiryText.trim()} className="btn-primary flex-1">Start Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
