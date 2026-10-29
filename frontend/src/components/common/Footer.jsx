import React from 'react'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'

/**
 * Reusable Footer Component for SmartEstate
 * Designed to sit naturally at the bottom of scrollable views.
 * Subtle, professional, and matching the SmartEstate design language (#3F7D58, #5B6875, #E3E8DF).
 *
 * @param {Object} props
 * @param {string} [props.className='']
 * @param {'default' | 'dashboard' | 'compact'} [props.variant='default']
 */
export default function Footer({ className = '', variant = 'default' }) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={`border-t text-[#5B6875] text-xs transition-colors ${
        variant === 'dashboard'
          ? 'mt-auto border-[#D8C6A8]/70 bg-[#F5E8D6]/70 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8'
          : 'mt-auto border-[#E3E8DF] bg-white px-4 py-6 sm:px-6 lg:px-8'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* Brand & Copyright */}
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-[#3F7D58] shrink-0" />
          <span>
            &copy; {currentYear} <strong className="text-[#243447] font-medium">SmartEstate Property Management</strong>. All rights reserved.
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link
            to="/privacy-policy"
            className="hover:text-[#3F7D58] hover:underline transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-[#E3E8DF] select-none" aria-hidden="true">&bull;</span>
          <Link
            to="/terms-and-conditions"
            className="hover:text-[#3F7D58] hover:underline transition-colors"
          >
            Terms &amp; Conditions
          </Link>
          <span className="text-[#E3E8DF] select-none" aria-hidden="true">&bull;</span>
          <Link
            to="/contact"
            className="hover:text-[#3F7D58] hover:underline transition-colors"
          >
            Contact &amp; Support
          </Link>
        </nav>
      </div>
    </footer>
  )
}
