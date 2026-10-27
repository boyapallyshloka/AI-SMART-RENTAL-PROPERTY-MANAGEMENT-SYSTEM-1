import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui'
import Footer from '../common/Footer'
import {
  getDashboardPath,
  isSuperAdmin,
  isPropertyOwner,
  isPropertyManager,
} from '../../utils/roles'
import {
  Home,
  ArrowLeft,
  LogIn,
  Printer,
  Shield,
  FileText,
  Clock,
  Calendar,
  AlertCircle,
  Mail,
  Building2,
  ChevronRight,
} from 'lucide-react'

/**
 * Reusable Legal Page Layout for SmartEstate
 * Provides standardized navigation, table of contents, and reading container
 *
 * @param {Object} props
 * @param {string} props.title - Document Title (e.g. "Privacy Policy")
 * @param {string} props.subtitle - Brief introductory description
 * @param {string} props.lastUpdated - e.g. "September 2026"
 * @param {string} props.effectiveDate - e.g. "September 1, 2026"
 * @param {'privacy' | 'terms'} props.activeDoc - Active document identifier
 * @param {Array<{id: string, title: string, icon?: React.ReactNode}>} props.tableOfContents - Sections list
 * @param {React.ReactNode} props.children - Section content nodes
 */
export default function LegalPageLayout({
  title,
  subtitle,
  lastUpdated = 'September 2026',
  effectiveDate = 'September 1, 2026',
  activeDoc = 'privacy',
  tableOfContents = [],
  children,
}) {
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.title = `${title} | SmartEstate Property Management`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [title, location.pathname])

  // Determine back destination based on authentication status
  const getDashboardDestination = () => {
    if (!user) return '/login'
    return getDashboardPath(user.role)
  }

  const getDashboardLabel = () => {
    if (!user) return 'Sign In'
    if (isSuperAdmin(user.role)) return 'Back to Admin Dashboard'
    if (isPropertyOwner(user.role)) return 'Back to Owner Dashboard'
    if (isPropertyManager(user.role)) return 'Back to Manager Dashboard'
    return 'Back to Tenant Dashboard'
  }

  const handleScrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -90 // Account for sticky header
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#243447] font-sans antialiased flex flex-col">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#D9E0E6] shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="p-2 rounded-md bg-[#315A7D] text-white group-hover:bg-[#274B68] transition-colors shadow-2xs">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-[#243447] block leading-none">
                  SmartEstate
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#5B6875] mt-1 block">
                  Property Management
                </span>
              </div>
            </Link>

            <span className="hidden sm:inline-block text-[#D9E0E6] font-light">|</span>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
              <Shield className="w-3.5 h-3.5" />
              <span>Platform Documentation</span>
            </span>
          </div>

          {/* Center Navigation Tabs (Privacy vs Terms vs Contact) */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F7F8FA] p-1 rounded-lg border border-[#D9E0E6]">
            <Link
              to="/privacy-policy"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeDoc === 'privacy'
                  ? 'bg-white text-[#315A7D] font-semibold shadow-2xs border border-[#D9E0E6]'
                  : 'text-[#5B6875] hover:text-[#243447]'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeDoc === 'terms'
                  ? 'bg-white text-[#315A7D] font-semibold shadow-2xs border border-[#D9E0E6]'
                  : 'text-[#5B6875] hover:text-[#243447]'
              }`}
            >
              Terms &amp; Conditions
            </Link>
            <Link
              to="/contact"
              className="px-3 py-1.5 text-xs font-medium rounded-md text-[#5B6875] hover:text-[#243447] transition-colors"
            >
              Contact Support
            </Link>
          </nav>

          {/* Action Button (Back to Dashboard or Sign In) */}
          <div className="flex items-center gap-2">
            <Link to={getDashboardDestination()}>
              <Button
                size="sm"
                variant="outline"
                leftIcon={user ? <ArrowLeft className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              >
                {getDashboardLabel()}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="flex md:hidden border-t border-[#D9E0E6] bg-[#F7F8FA] px-4 py-2 gap-2 text-xs">
          <Link
            to="/privacy-policy"
            className={`flex-1 text-center py-1.5 rounded-md font-medium ${
              activeDoc === 'privacy'
                ? 'bg-white text-[#315A7D] font-semibold shadow-2xs border border-[#D9E0E6]'
                : 'text-[#5B6875]'
            }`}
          >
            Privacy
          </Link>
          <Link
            to="/terms-and-conditions"
            className={`flex-1 text-center py-1.5 rounded-md font-medium ${
              activeDoc === 'terms'
                ? 'bg-white text-[#315A7D] font-semibold shadow-2xs border border-[#D9E0E6]'
                : 'text-[#5B6875]'
            }`}
          >
            Terms
          </Link>
          <Link
            to="/contact"
            className="flex-1 text-center py-1.5 rounded-md font-medium text-[#5B6875]"
          >
            Contact
          </Link>
        </div>
      </header>

      {/* Hero / Header Section */}
      <section className="bg-white border-b border-[#D9E0E6] py-10 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
              {activeDoc === 'privacy' ? (
                <Shield className="w-3.5 h-3.5" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>Legal Documentation</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#243447]">
              {title}
            </h1>

            <p className="text-sm sm:text-base text-[#5B6875] leading-relaxed">
              {subtitle}
            </p>

            {/* Metadata Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#5B6875] border-t border-[#D9E0E6]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#315A7D]" />
                <span>
                  Last Updated: <strong className="text-[#243447] font-medium">{lastUpdated}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#315A7D]" />
                <span>
                  Effective Date: <strong className="text-[#243447] font-medium">{effectiveDate}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 text-[#315A7D] hover:text-[#274B68] hover:underline cursor-pointer ml-auto"
                title="Print this document"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* Left Sticky Sidebar: Table of Contents & Quick Contact */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-6">
            <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                Table of Contents
              </h2>
              <nav className="space-y-1 text-xs">
                {tableOfContents.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => handleScrollToSection(item.id)}
                    className="w-full text-left py-1.5 px-2 rounded text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">
                      <span className="font-mono text-[10px] text-[#315A7D] mr-1.5">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                      {item.title}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#315A7D] shrink-0" />
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Contact & Assistance Box */}
            <div className="bg-[#EAF2F7] rounded-lg border border-[#D9E0E6] p-5 text-xs space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-[#243447]">
                <Mail className="w-4 h-4 text-[#315A7D]" />
                <span>Legal & Support Inquiries</span>
              </div>
              <p className="text-[#5B6875] leading-relaxed">
                Have questions regarding our platform policies, lease management data, or security practices?
              </p>
              <div className="pt-1">
                <Link
                  to="/contact"
                  className="inline-block font-semibold text-[#315A7D] hover:text-[#274B68] hover:underline"
                >
                  View support contact status
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Main Column: Reading Container */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8 max-w-3xl">
            {/* General Template Disclaimer Banner */}
            <div className="rounded-lg bg-white border border-[#D9E0E6] p-4 sm:p-5 shadow-2xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#315A7D] shrink-0 mt-0.5" />
              <div className="text-xs text-[#5B6875] space-y-1">
                <p className="font-semibold text-[#243447]">
                  Standard Platform Documentation Notice
                </p>
                <p className="leading-relaxed">
                  This document serves as an operational policy template for the SmartEstate Property Management application. It outlines standard operational handling for accounts, property listings, lease agreements, maintenance requests, and payment logging, and is structured for formal customization by your organization's legal counsel.
                </p>
              </div>
            </div>

            {/* Rendered Document Sections */}
            <div className="space-y-6 sm:space-y-8">
              {children}
            </div>

            {/* Bottom Return Action */}
            <div className="pt-6 border-t border-[#D9E0E6] flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link to={getDashboardDestination()}>
                <Button
                  size="md"
                  variant="primary"
                  leftIcon={user ? <ArrowLeft className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                >
                  {getDashboardLabel()}
                </Button>
              </Link>

              <div className="text-xs text-[#5B6875]">
                Switch to{' '}
                <Link
                  to={activeDoc === 'privacy' ? '/terms-and-conditions' : '/privacy-policy'}
                  className="font-semibold text-[#315A7D] hover:underline"
                >
                  {activeDoc === 'privacy' ? 'Terms & Conditions' : 'Privacy Policy'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reusable Application Footer */}
      <Footer />
    </div>
  )
}
