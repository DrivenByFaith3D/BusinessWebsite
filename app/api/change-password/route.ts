import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/api'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { newPassword } = await req.json()
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  // This endpoint sets a password WITHOUT the current one, so it is only valid in
  // the forced-reset state (admin reset / password-reset link set mustChangePassword).
  // A normal password change must go through /api/account, which verifies the old one.
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.mustChangePassword) {
    return NextResponse.json(
      { error: 'Change your password from Settings, where your current password is required.' },
      { status: 403 },
    )
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
    },
  })

  return NextResponse.json({ ok: true })
}
