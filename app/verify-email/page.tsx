import { prisma } from '@/lib/prisma'
import VerifyEmailClient from './VerifyEmailClient'
import VerifyResult from './VerifyResult'

// Read-only: the actual verification happens on an explicit POST from the
// confirm button, so link scanners that pre-fetch the URL can't burn the token.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return <VerifyResult state="error" title="Verification Failed" message="No verification token provided." />
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } })

  if (!user) {
    return (
      <VerifyResult
        state="error"
        title="Verification Failed"
        message="This verification link is invalid or has already been used. If you already verified, just sign in."
      />
    )
  }

  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    return (
      <VerifyResult
        state="error"
        title="Link Expired"
        message="This verification link has expired. You can request a new one from the sign in page."
        showResend
      />
    )
  }

  return <VerifyEmailClient token={token} email={user.email} />
}
