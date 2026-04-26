import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import NavbarClient from './NavbarClient'

export default async function Navbar() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  const navLinks = [
    ...(!isAdmin ? [{ label: 'Listings', href: '/listings' }] : []),
    { label: 'Gallery', href: '/gallery' },
    ...(!isAdmin && session ? [{ label: 'My Orders', href: '/orders' }] : []),
    ...(!isAdmin ? [{ label: 'About', href: '/about' }, { label: 'FAQ', href: '/faq' }] : []),
    ...(isAdmin ? [
      { label: 'Dashboard', href: '/' },
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Products', href: '/admin/products' },
      { label: 'Users', href: '/admin/users' },
      { label: 'Coupons', href: '/admin/coupons' },
    ] : []),
  ]

  return (
    <nav className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-700/60 sticky top-0 z-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="DrivenByFaith3D Logo" width={40} height={40} className="object-contain" />
            <span className="font-bold text-lg text-white hidden sm:block">DrivenByFaith3D</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
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
