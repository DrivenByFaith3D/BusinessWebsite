import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'About Us' }

// Minimalist line-art icons, dark charcoal tone
const icons = {
  faith: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8.5 8h7" />
    </svg>
  ),
  precision: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  service: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m11 17 2 2a1 1 0 0 0 3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m14 14 2.5 2.5a1 1 0 0 0 3-3l-3.9-3.9a3 3 0 0 0-4.24 0l-.87.87a1 1 0 0 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h8M3 4 2 14l6.5 6.5a1 1 0 0 0 3-3" />
    </svg>
  ),
}

export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* 1, Hero split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center mb-28">
        {/* Left: text */}
        <div>
          <p className="text-xs font-semibold tracking-widest text-warm-gray uppercase mb-3">Our Story</p>
          <h1 className="text-4xl sm:text-5xl font-display text-charcoal mb-6 leading-tight">Driven by Faith, Built by Hand</h1>
          <p className="text-warm-gray leading-relaxed mb-4">
            DrivenByFaith3D started with a simple belief, that anyone should be able to bring their ideas to life, no matter how big or small. What began as a passion project turned into a custom 3D printing service dedicated to quality, honesty, and fast turnaround.
          </p>
          <p className="text-warm-gray leading-relaxed">
            Every print is made with care. Whether you have an STL file ready to go, a reference image, or just an idea in your head, we work with you from concept to delivery.
          </p>
        </div>
        {/* Right: framed lifestyle photo with overlapping logo badge */}
        <div className="relative">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(44,44,44,0.18)] bg-taupe/30 ring-1 ring-taupe/40">
            <Image
              src="/businesshomepage.jpeg"
              alt="Our desk setup with the Bambu Lab A1 at work"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          {/* logo badge, clean white circle, overlapping corner */}
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white shadow-xl ring-1 ring-taupe/40 flex items-center justify-center p-4">
            <div className="relative w-full h-full">
              <Image src="/logo.png" alt="DrivenByFaith3D logo" fill className="object-contain" unoptimized />
            </div>
          </div>
        </div>
      </div>

      {/* 3, What We Stand For (floating value cards) */}
      <div className="mb-28">
        <h2 className="text-2xl sm:text-3xl font-display text-charcoal mb-10 text-center">What We Stand For</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: icons.faith, title: 'Faith', desc: 'Our name says it all. We operate with integrity, honesty, and a commitment to doing right by every customer.' },
            { icon: icons.precision, title: 'Precision', desc: "We take printing seriously. Every layer matters, and we don't ship until we're proud of what came off the bed." },
            { icon: icons.service, title: 'Service', desc: "You're not a ticket number. Every order gets personal attention and direct communication through your order chat." },
          ].map(v => (
            <div
              key={v.title}
              className="bg-white rounded-2xl p-8 text-center border border-taupe/30 shadow-[0_18px_40px_rgba(44,44,44,0.08)] hover:-translate-y-1 hover:shadow-[0_26px_55px_rgba(44,44,44,0.12)] transition-all duration-300"
            >
              <div className="flex justify-center mb-5 text-charcoal">{v.icon}</div>
              <h3 className="font-display text-xl text-charcoal mb-2">{v.title}</h3>
              <p className="text-sm text-warm-gray leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2, How It Works (horizontal timeline) */}
      <div className="mb-28">
        <h2 className="text-2xl sm:text-3xl font-display text-charcoal mb-12 text-center">How It Works</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
          {[
            { step: '01', title: 'Submit Your Order', desc: 'Upload a file, share an image, or describe your idea.' },
            { step: '02', title: 'Get a Quote', desc: 'We reply with personalized pricing within 24 hours.' },
            { step: '03', title: 'We Print', desc: 'Pay, and we get to work, track it from your order page.' },
            { step: '04', title: 'We Ship', desc: 'Packed carefully and shipped with full tracking.' },
          ].map(s => (
            <div key={s.step} className="relative">
              <span className="block font-display text-6xl sm:text-7xl leading-none text-[#9CAF88] mb-3 select-none">{s.step}</span>
              <h3 className="font-semibold text-charcoal mb-1">{s.title}</h3>
              <p className="text-sm text-warm-gray leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5, CTA */}
      <div className="bg-white rounded-3xl p-10 text-center border border-taupe/30 shadow-[0_18px_40px_rgba(44,44,44,0.08)]">
        <h2 className="text-2xl font-display text-charcoal mb-2">Ready to print something?</h2>
        <p className="text-warm-gray text-sm mb-6">Create an account and submit your first order today.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/orders/new" className="btn-primary">Start Custom Order</Link>
          <Link href="/listings" className="btn-secondary">Browse Listings</Link>
        </div>
      </div>
    </div>
  )
}
