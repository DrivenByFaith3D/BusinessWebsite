'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PasswordInput from '@/components/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/orders'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [unverified, setUnverified] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [resendError, setResendError] = useState('')

  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleResendVerification() {
    setResendState('loading')
    setResendError('')
    try {
      const res = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResendError(data.error || 'Could not send the email. Please try again.')
        setResendState('idle')
        return
      }
      setResendState('sent')
    } catch {
      setResendError('Network error. Please try again.')
      setResendState('idle')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUnverified(false)
    setResendState('idle')
    setResendError('')
    setLoading(true)

    const res = await signIn('credentials', { email, password, redirect: false })

    if (res?.error) {
      if (res.error === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email before signing in. Check your inbox for the verification link.')
        setUnverified(true)
      } else {
        setError('Invalid email or password')
      }
      setLoading(false)
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    const res = await fetch('/api/password-reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail }),
    })

    if (!res.ok) {
      const data = await res.json()
      setResetError(data.error)
      setResetLoading(false)
      return
    }

    setResetDone(true)
    setResetLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="DrivenByFaith3D" width={64} height={64} className="mx-auto mb-4 object-contain" />
          {showForgot ? (
            <>
              <h1 className="text-2xl font-bold text-charcoal">Forgot password?</h1>
              <p className="text-warm-gray mt-1 text-sm">Enter the email and name on your account</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-charcoal">Welcome back</h1>
              <p className="text-warm-gray mt-1 text-sm">Sign in to your account</p>
            </>
          )}
        </div>

        {!showForgot ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input" placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Password</label>
                <PasswordInput value={password} onChange={setPassword} required />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p>{error}</p>
                  {unverified && resendState !== 'sent' && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendState === 'loading'}
                      className="mt-2 text-charcoal font-medium underline hover:no-underline disabled:opacity-50"
                    >
                      {resendState === 'loading' ? 'Sending…' : 'Resend verification email'}
                    </button>
                  )}
                  {resendError && <p className="mt-2 text-red-600">{resendError}</p>}
                </div>
              )}

              {unverified && resendState === 'sent' && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Verification email sent to <strong>{email}</strong>. Check your inbox and spam folder.
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => { setShowForgot(true); setResetEmail(email) }}
              className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors mt-4"
            >
              Forgot your password?
            </button>

            <p className="text-center text-sm text-warm-gray mt-4">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-charcoal font-medium hover:underline">Sign up</Link>
            </p>
          </>
        ) : resetDone ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-taupe/10 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-charcoal font-medium">Check your email</p>
            <p className="text-sm text-warm-gray">
              If an account exists for <strong className="text-charcoal">{resetEmail}</strong>, we've sent a password reset link. Check your inbox, it expires in 1 hour.
            </p>
            <button onClick={() => { setShowForgot(false); setResetDone(false) }}
              className="btn-secondary w-full mt-2">
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  className="input" placeholder="you@example.com" required />
              </div>

              {resetError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</p>
              )}

              <button type="submit" disabled={resetLoading} className="btn-primary w-full">
                {resetLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <button onClick={() => setShowForgot(false)}
              className="w-full text-center text-sm text-warm-gray hover:text-charcoal transition-colors mt-4">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
