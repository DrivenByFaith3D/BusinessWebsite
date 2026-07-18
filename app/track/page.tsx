'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function TrackLookupPage() {
  const router = useRouter()
  const [value, setValue] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = value.trim().toUpperCase()
    if (n) router.push(`/track/${encodeURIComponent(n)}`)
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-block mb-6">
          <Image src="/logo.png" alt="DrivenByFaith3D" width={56} height={56} className="mx-auto object-contain" />
        </Link>
        <h1 className="text-2xl font-bold text-charcoal mb-1">Track your order</h1>
        <p className="text-sm text-warm-gray mb-6">Enter the order number from your confirmation email.</p>

        <form onSubmit={submit} className="card p-6 space-y-3 text-left">
          <label className="block text-xs font-medium text-warm-gray">Order number</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. DBF-0123"
            className="input w-full"
            autoFocus
          />
          <button type="submit" className="btn-primary w-full">Track order</button>
        </form>

        <p className="text-xs text-warm-gray/70 mt-4">
          Have an account? <Link href="/orders" className="underline hover:text-charcoal">See all your orders</Link>.
        </p>
      </div>
    </div>
  )
}
