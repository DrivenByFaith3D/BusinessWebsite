import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = { title: 'Contact Us' }

// Clean line-art icons in place of emoji
const mailIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
  </svg>
)
const supportIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.542-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)
const printerIcon = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
)

const contacts = [
  {
    icon: mailIcon,
    label: 'General Inquiries',
    email: 'info@drivenbyfaith3d.com',
    desc: 'Questions about our business, partnerships, or anything else.',
  },
  {
    icon: supportIcon,
    label: 'Customer Support',
    email: 'support@drivenbyfaith3d.com',
    desc: 'Help with an existing order or shipping. For the fastest reply on an active order, use the built-in chat on your order page, we monitor it throughout the day.',
  },
  {
    icon: printerIcon,
    label: 'Custom Orders',
    email: 'orders@drivenbyfaith3d.com',
    desc: 'Have a specific project in mind? Reach out before placing an order.',
  },
]

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold tracking-widest text-warm-gray uppercase mb-3">Get In Touch</p>
        <h1 className="text-3xl sm:text-4xl font-display text-charcoal mb-4">Contact Us</h1>
        <p className="text-warm-gray leading-relaxed max-w-xl">
          We&apos;re a small team and we read every message. Whether you have a question, a project idea, or need help with an order, we&apos;ll get back to you within 24 hours.
        </p>
      </div>

      {/* Contact form */}
      <div className="mb-12">
        <ContactForm />
      </div>

      {/* FAQ quick link */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-taupe/40 bg-white px-5 py-4 mb-12">
        <p className="text-sm text-warm-gray">
          Have a quick question? A lot of answers are already on our FAQ.
        </p>
        <Link href="/faq" className="text-sm font-medium text-charcoal underline underline-offset-2 hover:text-taupe-dark transition-colors shrink-0">
          Visit the FAQ →
        </Link>
      </div>

      {/* Direct contact cards */}
      <h2 className="font-display text-2xl text-charcoal mb-5">Prefer email?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {contacts.map((c) => (
          <div key={c.email} className="card p-6 flex flex-col gap-3">
            <div className="w-11 h-11 rounded-xl bg-taupe/15 border border-taupe/40 flex items-center justify-center text-charcoal">{c.icon}</div>
            <div>
              <h3 className="font-semibold text-charcoal mb-1">{c.label}</h3>
              <p className="text-xs text-warm-gray leading-relaxed mb-3">{c.desc}</p>
              <a
                href={`mailto:${c.email}`}
                className="text-sm font-medium text-charcoal underline underline-offset-2 hover:text-taupe-dark transition-colors break-all"
              >
                {c.email}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="card p-8 text-center">
        <h2 className="text-xl font-display text-charcoal mb-2">Ready to start a project?</h2>
        <p className="text-warm-gray text-sm mb-5">Book your print and we&apos;ll be in touch to work out the details.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/orders/new" className="btn-primary">Book Now</Link>
          <Link href="/listings" className="btn-secondary">Browse Shop</Link>
        </div>
      </div>
    </div>
  )
}
