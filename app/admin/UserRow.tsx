'use client'

import { useState } from 'react'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date
}

export default function UserRow({ user, inlineActions }: { user: User; inlineActions?: boolean }) {
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    if (!confirm(`Reset password for ${user.email}? They will need to log in with "drivenbyfaith3d".`)) return
    setLoading(true)
    setSuccess('')
    setError('')

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess('Reset to "drivenbyfaith3d"')
    }
    setLoading(false)
  }

  const actions = (
    <>
      <button onClick={handleReset} disabled={loading} className="btn-secondary text-xs px-3 py-1.5">
        {loading ? '…' : 'Reset Password'}
      </button>
      {success && <p className="text-xs text-green-600 mt-1">{success}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </>
  )

  if (inlineActions) return <>{actions}</>

  return (
    <tr className="hover:bg-taupe/5 transition-colors">
      <td className="px-5 py-4 text-charcoal">{user.name || '-'}</td>
      <td className="px-5 py-4 text-warm-gray">{user.email}</td>
      <td className="px-5 py-4">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${user.role === 'admin' ? 'bg-charcoal text-white' : 'bg-taupe/20 text-warm-gray'}`}>
          {user.role}
        </span>
      </td>
      <td className="px-5 py-4 font-mono text-warm-gray/40 tracking-widest text-sm">••••••••</td>
      <td className="px-5 py-4 text-warm-gray text-xs">
        {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
      </td>
      <td className="px-5 py-4">{actions}</td>
    </tr>
  )
}
