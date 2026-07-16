'use client'

import { useState } from 'react'
import Link from 'next/link'
import VerifyResult from './VerifyResult'

export default function VerifyEmailClient({ token, email }: { token: string; email: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')

  async function confirm() {
    setStatus('loading'); setError('')
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'EXPIRED'
          ? 'This verification link has expired. Request a new one from the sign in page.'
          : 'This verification link is invalid or has already been used.')
        setStatus('idle')
        return
      }
      setStatus('done')
    } catch {
      setError('Network error. Please try again.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <VerifyResult
        state="success"
        title="Email Verified"
        message="Your email has been verified. You can now sign in."
      />
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-taupe/20 border border-taupe/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-charcoal mb-2">Confirm your email</h1>
        <p className="text-warm-gray text-sm mb-6">
          Click below to verify <strong className="text-charcoal">{email}</strong> and activate your account.
        </p>
        <button onClick={confirm} disabled={status === 'loading'} className="btn-primary w-full disabled:opacity-50">
          {status === 'loading' ? 'Verifying…' : 'Verify my email'}
        </button>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <Link href="/login" className="block text-xs text-warm-gray hover:text-charcoal mt-4 transition-colors">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
