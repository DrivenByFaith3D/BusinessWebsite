import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BookClient from './BookClient'

export const metadata: Metadata = { title: 'Book a Consultation' }

// Always render fresh so a just-booked slot never shows as available
export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const session = await getServerSession(authOptions)

  const slots = await prisma.availabilitySlot.findMany({
    where: { startsAt: { gte: new Date() }, booking: { is: null } },
    orderBy: { startsAt: 'asc' },
  })

  const open = slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), duration: s.duration }))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold tracking-widest text-warm-gray uppercase mb-3">Book a Consultation</p>
        <h1 className="text-3xl sm:text-4xl font-display text-charcoal mb-3">Pick a time that works</h1>
        <p className="text-warm-gray max-w-xl mx-auto">Choose an open time below and we&apos;ll meet to plan your project. Free, and no pressure.</p>
      </div>
      <BookClient slots={open} defaultName={session?.user?.name || ''} />
    </div>
  )
}
