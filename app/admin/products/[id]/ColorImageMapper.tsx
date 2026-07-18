'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ColorRow {
  value: string
  etsyImageId: string | null
}
interface Img {
  etsyImageId: string
  url: string
}

export default function ColorImageMapper({
  productId,
  colors,
  images,
}: {
  productId: string
  colors: ColorRow[]
  images: Img[]
}) {
  const [map, setMap] = useState<Record<string, string | null>>(
    Object.fromEntries(colors.map((c) => [c.value, c.etsyImageId])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function choose(value: string, etsyImageId: string | null) {
    // Toggle off if the same photo is tapped again.
    const next = map[value] === etsyImageId ? null : etsyImageId
    setSaving(value)
    setError('')
    const prev = map[value] ?? null
    setMap((m) => ({ ...m, [value]: next }))
    try {
      const res = await fetch('/api/products/color-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, value, etsyImageId: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not save.')
        setMap((m) => ({ ...m, [value]: prev })) // revert
      }
    } catch {
      setError('Network error.')
      setMap((m) => ({ ...m, [value]: prev }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {colors.map((c) => (
        <div key={c.value}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-charcoal">{c.value}</span>
            {map[c.value] ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">photo set</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-taupe/20 text-warm-gray">no photo</span>
            )}
            {saving === c.value && <span className="text-xs text-warm-gray">saving…</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((img) => {
              const selected = map[c.value] === img.etsyImageId
              return (
                <button
                  key={img.etsyImageId}
                  type="button"
                  onClick={() => choose(c.value, img.etsyImageId)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    selected ? 'border-charcoal ring-2 ring-charcoal/20' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title={selected ? 'Selected — click to clear' : 'Use this photo'}
                >
                  <Image src={img.url} alt="" fill className="object-cover" unoptimized />
                  {selected && (
                    <span className="absolute inset-0 bg-charcoal/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4l2.3 2.29 6.3-6.29a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
