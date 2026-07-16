import { prisma } from './prisma'

// Where the site's own alerts (new order, contact message, booking, purchase) are
// delivered. Deliberately separate from the admin login: the account you sign in
// with and the inbox you want alerts in are different concerns.
//
// Falls back to the admin accounts when ADMIN_NOTIFY_EMAIL is unset, so a missing
// setting can never silently drop order notifications.
export async function adminNotifyEmails(): Promise<string[]> {
  const configured = process.env.ADMIN_NOTIFY_EMAIL?.trim()
  if (configured) return [configured]

  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  })
  return admins.map((a) => a.email)
}
