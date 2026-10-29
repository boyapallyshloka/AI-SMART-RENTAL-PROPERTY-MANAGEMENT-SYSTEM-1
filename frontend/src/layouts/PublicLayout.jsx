import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Building2, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDashboardPath } from '../utils/roles'

export default function PublicLayout({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const isWelcomePage = location.pathname === '/'

  // Public listing details should start at the top even when opened from a
  // listing far down the welcome page. The welcome page handles its own hash
  // scrolling to the listings section.
  useEffect(() => {
    if (location.pathname.startsWith('/properties/')) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [location.pathname])

  return (
    <div className="relative min-h-screen bg-[#F7F7F1] text-[#243447]">
      <header className={isWelcomePage
        ? 'absolute inset-x-0 top-0 z-40 border-b border-white/15 bg-gradient-to-b from-[#30251F]/65 to-transparent'
        : 'sticky top-0 z-40 border-b border-[#E3E8DF]/80 bg-white/95 shadow-[0_4px_24px_rgba(36,52,71,0.06)] backdrop-blur-xl'}>
        <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <Link to="/" className="group inline-flex min-w-0 items-center gap-3" aria-label="SmartEstate home">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#5F966D] via-[#3F7D58] to-[#244C38] text-white shadow-lg shadow-black/20 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
              <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/15" />
              <Building2 className="relative h-5 w-5" strokeWidth={2.1} />
            </span>
            <span className="min-w-0">
              <span className={`block font-serif text-xl font-bold leading-tight tracking-tight sm:text-[1.35rem] ${isWelcomePage ? 'text-white' : 'text-[#243447]'}`}>SmartEstate</span>
              <span className={`mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.19em] sm:block ${isWelcomePage ? 'text-white/75' : 'text-[#718092]'}`}>Find a place to belong</span>
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Main navigation">
            <Link
              to="/#property-listings"
              className={`group inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-all sm:px-4 ${isWelcomePage ? 'text-white hover:bg-white/15 hover:text-white' : 'text-[#536579] hover:bg-[#EDF4ED] hover:text-[#3F7D58]'}`}
            >
              <Search className={`h-4 w-4 transition-transform group-hover:scale-110 ${isWelcomePage ? 'text-[#D7E8C8]' : 'text-[#3F7D58]'}`} />
              <span className="hidden sm:inline">Find a home</span>
              <span className="sm:hidden">Explore</span>
            </Link>
            {user ? (
              <Link
                to={getDashboardPath(user.role)}
                className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-[#3F7D58] px-5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-[#315F46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#315F46] sm:px-6"
              >
                <span>Dashboard</span><ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-6 ${isWelcomePage ? 'border border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20' : 'bg-[#3F7D58] text-white shadow-md shadow-[#3F7D58]/20 hover:-translate-y-0.5 hover:bg-[#315F46] focus-visible:ring-offset-2'}`}
              >
                <span>Sign in</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
