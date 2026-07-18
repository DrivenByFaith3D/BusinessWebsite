import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import NavbarClient from './NavbarClient'

export default async function Navbar() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  const isCustomer = !!session?.user && !isAdmin

  const navLinks = [
    ...(!isAdmin ? [
      { label: 'Services', href: '/services-store' },
      { label: 'Shop', href: '/listings' },
      // Signed-in customers get their orders straight from the nav rather than
      // buried in the account dropdown.
      ...(isCustomer ? [{ label: 'My Orders', href: '/orders' }] : []),
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ] : []),
    ...(isAdmin ? [
      { label: 'Dashboard', href: '/' },
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Etsy Orders', href: '/admin/etsy-orders' },
      { label: 'Availability', href: '/admin/availability' },
      { label: 'Products', href: '/admin/products' },
      { label: 'Users', href: '/admin/users' },
      { label: 'Coupons', href: '/admin/coupons' },
    ] : []),
  ]

  return (
    <nav className="bg-cream/90 backdrop-blur-md border-b border-taupe/30 sticky top-0 z-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center">
            <span className="font-display text-xl text-charcoal">DrivenByFaith3D</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className="text-warm-gray hover:text-charcoal text-sm font-medium transition-colors">
                {link.label}
              </Link>
            ))}
          </div>

          <NavbarClient user={session?.user ?? null} navLinks={navLinks} />
        </div>
      </div>
    </nav>
  )
}
