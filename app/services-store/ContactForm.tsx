'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = e.currentTarget
    const data = {
      firstName: (form.elements.namedItem('firstName') as HTMLInputElement).value,
      lastName: (form.elements.namedItem('lastName') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      newsletter: (form.elements.namedItem('newsletter') as HTMLInputElement).checked,
    }

    try {
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setSubmitted(true)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <h3 className="text-2xl font-display mb-2">Thank you!</h3>
        <p className="text-warm-gray">We&apos;ll be in touch soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          name="firstName"
          placeholder="First Name"
          required
          className="input"
        />
        <input
          type="text"
          name="lastName"
          placeholder="Last Name"
          required
          className="input"
        />
      </div>
      <input
        type="email"
        name="email"
        placeholder="Email"
        required
        className="input"
      />
      <label className="flex items-center gap-3 text-sm text-warm-gray cursor-pointer">
        <input
          type="checkbox"
          name="newsletter"
          className="w-4 h-4 rounded border-taupe accent-charcoal"
        />
        Sign up for news and updates
      </label>
      <textarea
        name="message"
        placeholder="Message"
        rows={5}
        required
        className="input-textarea"
      />
      <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
        {loading ? 'Sending...' : 'Submit'}
      </button>
    </form>
  )
}
