import React from 'react'
import { Menu } from 'lucide-react'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import { ROLES } from '../../utils/roles'

/**
 * Enterprise Topbar Component for SmartEstate Dashboard
 * High contrast with #243447 headings and #5B6875 secondary text
 *
 * @param {Object} props
 * @param {() => void} props.onMenuClick
 * @param {string} [props.role]
 * @param {string} [props.title='Dashboard']
 * @param {React.ReactNode} [props.actions]
 */
export default function Topbar({
  onMenuClick,
  role = ROLES.PROPERTY_OWNER,
  title = 'Dashboard',
  actions,
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-[#D9E0E6] transition-colors">
      {/* Left section: Hamburger button & page title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open sidebar menu"
          className="p-2 -ml-1 text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] rounded-md lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315A7D]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] hidden sm:inline">
            SmartEstate /
          </span>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-[#243447] capitalize tracking-normal">
            {title}
          </h2>
        </div>
      </div>

      {/* Right section: Notifications, User Profile, Custom Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {actions}

        {/* Notification Bell */}
        <NotificationBell />

        <div className="h-5 w-px bg-[#D9E0E6] mx-0.5" />

        {/* User Profile & Logout */}
        <UserMenu role={role} />
      </div>
    </header>
  )
}
