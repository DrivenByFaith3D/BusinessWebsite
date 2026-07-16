'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PasswordInput from '@/components/PasswordInput'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [emailSent, setEmailSent] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, street, city, state, zip }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error === 'ACCOUNT_EXISTS' ? 'ACCOUNT_EXISTS' : data.error)
      setLoading(false)
      return
    }

    if (data.needsVerification) {
      setEmailSent(data.emailSent !== false)
      setNeedsVerification(true)
      setLoading(false)
      return
    }

    await signIn('credentials', { email, password, redirect: false })
    router.push('/orders')
    router.refresh()
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="card p-8 w-full max-w-md">
        {needsVerification ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-taupe/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {emailSent ? (
              <>
                <h1 className="text-xl font-bold text-charcoal">Check your email</h1>
                <p className="text-warm-gray text-sm">
                  We sent a verification link to <strong className="text-charcoal">{email}</strong>. Click it to activate your account before signing in.
                </p>
                <p className="text-warm-gray text-xs opacity-70">Didn&apos;t receive it? Check your spam folder, or resend it from the sign in page.</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-charcoal">Account created</h1>
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-left">
                  Your account was created, but we could not send the verification email just now. Go to the sign in page and choose &ldquo;Resend verification email&rdquo; to try again.
                </p>
              </>
            )}
            <Link href="/login" className="btn-secondary w-full inline-block text-center mt-2">Back to Sign In</Link>
          </div>
        ) : (
        <>
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="DrivenByFaith3D" width={64} height={64} className="mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-charcoal">Create account</h1>
          <p className="text-warm-gray mt-1 text-sm">Start printing your ideas today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="input" placeholder="First and last name" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Password</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="At least 6 characters" minLength={6} required />
          </div>

          {/* Optional address */}
          <div className="border-t border-taupe/30 pt-4">
            <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-1">Shipping Address <span className="normal-case font-normal opacity-70">(optional)</span></p>
            <p className="text-[10px] text-warm-gray mb-3 italic">This address will be used to calculate shipping for future orders.</p>
            <div className="space-y-3">
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)}
                className="input" placeholder="Street address" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                  className="input" placeholder="City" />
                <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                  className="input" placeholder="State" />
              </div>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value)}
                className="input" placeholder="ZIP code" />
            </div>
          </div>

          {/* Terms of service */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-taupe bg-white text-charcoal accent-charcoal cursor-pointer shrink-0"
            />
            <span className="text-xs text-warm-gray leading-relaxed">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-charcoal font-medium hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" className="text-charcoal font-medium hover:underline">Privacy Policy</Link>
            </span>
          </label>

          {error === 'ACCOUNT_EXISTS' ? (
            <div className="text-sm bg-taupe/10 border border-taupe/30 rounded-lg px-4 py-3 text-warm-gray">
              An account with this email already exists.{' '}
              <Link href="/login" className="text-charcoal font-medium hover:underline">Sign in instead</Link>
              <span className="block mt-1 opacity-70 text-xs">
                Forgot your password? Contact us and we'll reset it for you.
              </span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          ) : null}

          <button type="submit" disabled={loading || !agreedToTerms} className="btn-primary w-full">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-warm-gray mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-charcoal font-medium hover:underline">Sign in</Link>
        </p>
        </>
        )}
      </div>
    </div>
  )
}
