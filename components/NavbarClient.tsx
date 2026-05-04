'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'

interface User {
  id: string
  email: string
  role: string
  name?: string | null
}

interface NavLink {
  label: string
  href: string
}

export default function NavbarClient({ user, navLinks }: { user: User | null; navLinks: NavLink[] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg text-warm-gray hover:text-charcoal transition-colors"
          aria-label="Menu"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Desktop: Book now CTA + user menu */}
        <div className="hidden md:flex items-center gap-3">
          {!user && (
            <Link href="/services-store#contact" className="btn-primary text-sm">
              Book now
            </Link>
          )}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 text-sm text-warm-gray hover:text-charcoal transition-colors"
              >
                <span className="font-medium">
                  {user.name ? user.name.split(' ')[0] : user.email}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-taupe/50 rounded-xl shadow-lg z-50 overflow-hidden">
                  <Link href="/settings" onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-sm text-charcoal hover:bg-cream transition-colors">
                    Settings
                  </Link>
                  <Link href="/orders" onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-sm text-charcoal hover:bg-cream transition-colors">
                    My Orders
                  </Link>
                  <button onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-cream transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-secondary text-sm">Login</Link>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute top-16 left-0 right-0 bg-cream border-b border-taupe/30 z-40 md:hidden shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-charcoal hover:bg-taupe/20 transition-colors">
                {link.label}
              </Link>
            ))}
            <div className="border-t border-taupe/30 my-2" />
            {user ? (
              <>
                <Link href="/settings" onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm text-warm-gray hover:bg-taupe/20 hover:text-charcoal transition-colors">
                  Settings
                </Link>
                <Link href="/orders" onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm text-warm-gray hover:bg-taupe/20 hover:text-charcoal transition-colors">
                  My Orders
                </Link>
                <button onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-warm-gray hover:bg-taupe/20 hover:text-charcoal transition-colors">
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1 pb-1">
                <Link href="/services-store#contact" onClick={() => setMobileOpen(false)} className="btn-primary text-sm text-center">
                  Book now
                </Link>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-secondary text-sm text-center">
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
