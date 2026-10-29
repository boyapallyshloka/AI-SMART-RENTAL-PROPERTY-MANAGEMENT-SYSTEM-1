import React from 'react'
import { Link } from 'react-router-dom'
import { Home, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react'
import loginCityBackdrop from '../assets/dashboard-city-golden-hour.png'

/**
 * Enterprise AuthLayout Component for SmartEstate
 * Standardized with Primary Blue #3F7D58 brand side and #F7F7F1 form side
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
  cityBackdrop = true,
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#F7F7F1] font-sans text-[#111820]">
      {cityBackdrop && (
        <>
          <img
            src={loginCityBackdrop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-[1.01] object-cover object-center blur-[2px]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[#261F19]/20" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(39,30,25,.62)_0%,rgba(58,42,31,.42)_42%,rgba(86,57,35,.08)_100%)]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(37,28,23,.42),rgba(49,36,27,.04)_48%,rgba(44,32,24,.08)_100%)]" />
        </>
      )}
      {/* Left Brand Visual Side (Desktop) */}
      <div className={`relative hidden flex-col justify-between p-12 lg:flex lg:w-1/2 ${cityBackdrop ? 'bg-transparent text-white' : 'border-r border-[#315F46] bg-[#3F7D58] text-white'}`}>
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#315F46] text-white border border-[#3F7D58]">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-white">
              SmartEstate
            </span>
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-white/80">
              Property Management System
            </span>
          </div>
        </div>

        {/* Central Value Proposition */}
        <div className="space-y-6 max-w-lg">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium ${cityBackdrop ? 'border border-white/25 bg-[#30251F]/35 text-white backdrop-blur-sm' : 'bg-[#315F46] text-[#EDF4ED] border border-[#3F7D58]'}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#D7E8C8]" />
            <span>Enterprise Property Infrastructure</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight leading-tight text-white">
            Reliable, data-driven rental property operations.
          </h2>

          <p className="text-sm leading-relaxed text-white/90">
            Real-time lease records, automated rent tracking, structured maintenance workflows, and predictive vacancy monitoring built for institutional clarity.
          </p>

          <div className={`grid grid-cols-2 gap-4 pt-4 border-t ${cityBackdrop ? 'border-white/25' : 'border-[#315F46]'}`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-white/15 text-[#D7E8C8] backdrop-blur-sm">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Portfolio Control</p>
                <p className="text-[11px] text-white/80">Owners & Managers</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-white/15 text-[#D7E8C8] backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Compliance & Security</p>
                <p className="text-[11px] text-white/80">Encrypted Records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[#EDF4ED]/80">
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
      <div className={`relative flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-16 xl:px-24 ${cityBackdrop ? 'bg-transparent' : 'bg-[#F7F7F1]'}`}>
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Header */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="p-2 rounded-md bg-[#3F7D58] text-white">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className={`font-serif text-lg font-bold ${cityBackdrop ? 'text-white' : 'text-[#111820]'}`}>SmartEstate</span>
              <span className={`block text-[10px] uppercase font-semibold ${cityBackdrop ? 'text-white/80' : 'text-[#5B6875]'}`}>
                Property Management
              </span>
            </div>
          </div>

          <div className={cityBackdrop ? 'rounded-3xl border border-white/70 bg-[#FBFAF4]/80 p-6 shadow-[0_24px_70px_rgba(25,55,38,0.18)] backdrop-blur-xl sm:p-8' : ''}>
            {/* Form Header */}
            <div className="mb-6">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#111820] sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-[#5B6875]">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Container */}
            <div className={cityBackdrop ? '' : 'rounded-lg border border-[#E3E8DF] bg-white p-6 shadow-xs sm:p-8'}>
              {children}
            </div>
          </div>

          {/* Mobile Footer Links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-[#5B6875] lg:hidden">
            <Link to="/privacy-policy" className="hover:text-[#111820] hover:underline">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms-and-conditions" className="hover:text-[#111820] hover:underline">
              Terms &amp; Conditions
            </Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:text-[#111820] hover:underline">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
