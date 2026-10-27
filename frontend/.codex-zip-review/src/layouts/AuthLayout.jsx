import React from 'react'
import { Link } from 'react-router-dom'
import { Home, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react'

/**
 * Enterprise AuthLayout Component for SmartEstate
 * Standardized with Primary Blue #315A7D brand side and #F7F8FA form side
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.title='Welcome back']
 * @param {string} [props.subtitle='Sign in to manage your rental properties and leases']
 */
export default function AuthLayout({
  children,
  title = 'Welcome back',
  subtitle = 'Sign in to manage your rental properties and leases',
}) {
  return (
    <div className="min-h-screen flex bg-[#F7F8FA] text-[#243447] font-sans">
      {/* Left Brand Visual Side (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-[#315A7D] text-white border-r border-[#274B68]">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#274B68] text-white border border-[#315A7D]">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-white">
              SmartEstate
            </span>
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-[#EAF2F7]">
              Property Management System
            </span>
          </div>
        </div>

        {/* Central Value Proposition */}
        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium bg-[#274B68] text-[#EAF2F7] border border-[#315A7D]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#EAF2F7]" />
            <span>Enterprise Property Infrastructure</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-white leading-tight">
            Reliable, data-driven rental property operations.
          </h2>

          <p className="text-sm text-[#EAF2F7]/90 leading-relaxed">
            Real-time lease records, automated rent tracking, structured maintenance workflows, and predictive vacancy monitoring built for institutional clarity.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#274B68]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[#274B68] text-[#EAF2F7]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Portfolio Control</p>
                <p className="text-[11px] text-[#EAF2F7]/80">Owners & Managers</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[#274B68] text-[#EAF2F7]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Compliance & Security</p>
                <p className="text-[11px] text-[#EAF2F7]/80">Encrypted Records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[#EAF2F7]/80">
          <span>&copy; {new Date().getFullYear()} SmartEstate SaaS Platform</span>
          <div className="flex items-center gap-3">
            <Link to="/privacy-policy" className="hover:text-white hover:underline transition-colors">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms-and-conditions" className="hover:text-white hover:underline transition-colors">
              Terms &amp; Conditions
            </Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:text-white hover:underline transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </div>

      {/* Right Content Side */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-16 xl:px-24 bg-[#F7F8FA]">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Header */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="p-2 rounded-md bg-[#315A7D] text-white">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif text-lg font-bold text-[#243447]">SmartEstate</span>
              <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                Property Management
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-[#5B6875]">
                {subtitle}
              </p>
            )}
          </div>

          {/* Form Container */}
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#D9E0E6] shadow-xs">
            {children}
          </div>

          {/* Mobile Footer Links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-[#5B6875] lg:hidden">
            <Link to="/privacy-policy" className="hover:text-[#243447] hover:underline">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms-and-conditions" className="hover:text-[#243447] hover:underline">
              Terms &amp; Conditions
            </Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:text-[#243447] hover:underline">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
