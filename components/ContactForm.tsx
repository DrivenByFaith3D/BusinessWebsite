'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

const MESSAGE_TYPES = ['General Inquiry', 'Customer Support', 'Custom Order']

export default function ContactForm() {
  const { data: session, status } = useSession()
  const authed = status === 'authenticated'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [messageType, setMessageType] = useState(MESSAGE_TYPES[0])
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Prefill from the signed-in account
  useEffect(() => {
    if (session?.user) {
      setName((n) => n || session.user.name || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authed || !message.trim()) return
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, messageType, message }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setState('sent')
      setMessage('')
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="card p-8 text-center">
        <div className="flex justify-center mb-4 text-charcoal">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-charcoal mb-2">Message sent!</h3>
        <p className="text-warm-gray text-sm mb-6 max-w-md mx-auto">
          Thanks for reaching out, we&apos;ll reply within 24 hours. You can follow the conversation from your orders page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/orders" className="btn-primary">View My Messages</Link>
          <button onClick={() => setState('idle')} className="btn-secondary">Send Another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="font-display text-2xl text-charcoal mb-1">Send us a message</h2>
      <p className="text-warm-gray text-sm mb-6">Fill this out and we&apos;ll get right back to you.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" disabled={!authed} />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" disabled />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">What&apos;s this about?</label>
          <select className="input" value={messageType} onChange={(e) => setMessageType(e.target.value)} disabled={!authed}>
            {MESSAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">Message</label>
          <textarea
            className="input-textarea min-h-[140px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you need, a question, a project idea, or help with an order."
            disabled={!authed}
            required
          />
        </div>

        {/* Why we ask for sign-in, only shown to signed-out visitors */}
        {!authed && (
          <div className="flex items-start gap-3 rounded-xl bg-taupe/15 border border-taupe/40 p-4">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-taupe-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25 12 15m0-9h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-warm-gray leading-relaxed">
              We ask you to sign in or create a quick account before sending, so your message lands in a private thread
              where we can reply directly and keep you updated. It&apos;s how we stay in contact with you.
            </p>
          </div>
        )}

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        {authed ? (
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?callbackUrl=/contact" className="btn-primary text-center">
              {status === 'loading' ? 'Loading…' : 'Sign in to send'}
            </Link>
            <Link href="/signup?callbackUrl=/contact" className="btn-secondary text-center">Create an account</Link>
          </div>
        )}
      </form>
    </div>
  )
}
