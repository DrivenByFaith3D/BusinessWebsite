'use client'

import { useState } from 'react'
import { fileProxy } from '@/lib/files'

interface Photo {
  id: string
  url: string
  createdAt: Date | string
}

export default function OrderPhotos({ photos }: { photos: Photo[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (photos.length === 0) return null

  return (
    <>
      <div className="card p-5 mb-6">
        <h2 className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">Your Print</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-lg overflow-hidden border border-taupe/30 cursor-zoom-in"
              onClick={() => setExpanded(photo.url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileProxy(photo.url)} alt="Order photo" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      {expanded && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setExpanded(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileProxy(expanded)} alt="Order photo" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
