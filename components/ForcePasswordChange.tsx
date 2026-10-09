'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import PasswordInput from './PasswordInput'

export default function ForcePasswordChange({ email }: { email: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)

    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      setLoading(false)
      return
    }

    // Re-sign in to get a fresh session with mustChangePassword=false
    await signIn('credentials', { email, password, redirect: false })
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-charcoal">Set a new password</h2>
          <p className="text-warm-gray text-sm mt-1">
            Your password was reset. Please choose a new password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-gray mb-1">New Password</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="At least 6 characters" minLength={6} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-gray mb-1">Confirm Password</label>
            <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat your new password" minLength={6} required />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading || !password || !confirm} className="btn-primary w-full">
            {loading ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
