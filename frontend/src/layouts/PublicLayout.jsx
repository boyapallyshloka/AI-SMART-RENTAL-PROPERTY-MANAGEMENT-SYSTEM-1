import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDashboardPath } from '../utils/roles'

export default function PublicLayout({ children }) {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#243447]">
      <header className="relative z-20 flex min-h-16 items-center justify-between border-b border-[#D9E0E6] bg-white px-4 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5" aria-label="SmartEstate home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#315A7D] text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="font-serif text-lg font-bold tracking-normal text-[#243447]">SmartEstate</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6" aria-label="Main navigation">
          <Link to="/#property-listings" className="text-sm font-medium text-[#5B6875] transition-colors hover:text-[#315A7D]">
            Find a home
          </Link>
          {user ? (
            <Link
              to={getDashboardPath(user.role)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#315A7D] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#274B68]"
            >
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-md border border-[#D9E0E6] px-3.5 py-2 text-sm font-semibold text-[#243447] transition-colors hover:border-[#315A7D] hover:text-[#315A7D]"
            >
              Sign In
            </Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  )
}
