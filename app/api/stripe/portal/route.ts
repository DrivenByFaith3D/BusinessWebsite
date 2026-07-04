import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY.trim())
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true },
  })

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing history found. Complete a payment first to access the billing portal.' }, { status: 404 })
  }

  const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()

  try {
    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    })
    return NextResponse.json({ url: portalSession.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    console.error('Stripe portal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
