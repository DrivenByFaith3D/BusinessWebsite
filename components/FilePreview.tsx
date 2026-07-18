'use client'

import { useState } from 'react'
import Script from 'next/script'
import { fileProxy } from '@/lib/files'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const STL_EXTS = ['stl']

function getExt(name: string, url: string): string {
  const src = name || url
  return src.split('.').pop()?.toLowerCase() ?? ''
}

function ModelViewer({ url, name }: { url: string; name: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <Script
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        type="module"
        onLoad={() => setLoaded(true)}
      />
      <div className="rounded-lg overflow-hidden bg-zinc-900 border border-taupe/30">
        {/* @ts-expect-error model-viewer is a custom element */}
        <model-viewer
          src={url}
          alt={name}
          camera-controls
          auto-rotate
          shadow-intensity="1"
          style={{ width: '100%', height: '280px', display: 'block', background: '#18181b' }}
        />
      </div>
    </>
  )
}

function ImagePreview({ url, name }: { url: string; name: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div
        className="rounded-lg overflow-hidden border border-taupe/30 cursor-zoom-in"
        onClick={() => setExpanded(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="w-full max-h-64 object-contain bg-zinc-900" />
      </div>
      {expanded && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setExpanded(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}

export default function FilePreview({ url, name }: { url: string; name: string }) {
  // Extension comes from the original url/name; the loadable src goes through
  // the authorized proxy (the proxy path itself has no file extension).
  const ext = getExt(name, url)
  const displayName = name || 'Uploaded file'
  const src = fileProxy(url)

  if (IMAGE_EXTS.includes(ext)) {
    return (
      <div className="space-y-1.5">
        <ImagePreview url={src} name={displayName} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-warm-gray truncate">{displayName}</span>
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-warm-gray hover:text-charcoal transition-colors shrink-0 ml-2">
            Download ↓
          </a>
        </div>
      </div>
    )
  }

  if (STL_EXTS.includes(ext)) {
    return (
      <div className="space-y-1.5">
        <ModelViewer url={src} name={displayName} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-warm-gray truncate">{displayName}</span>
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-warm-gray hover:text-charcoal transition-colors shrink-0 ml-2">
            Download ↓
          </a>
        </div>
      </div>
    )
  }

  // Fallback: download link
  return (
    <a href={src} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm">
      <svg className="w-5 h-5 text-warm-gray shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="text-warm-gray hover:text-charcoal truncate">{displayName}</span>
    </a>
  )
}
