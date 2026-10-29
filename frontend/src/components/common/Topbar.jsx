import React from 'react'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import { ROLES } from '../../utils/roles'

/**
 * Enterprise Topbar Component for SmartEstate Dashboard
 * High contrast with #243447 headings and #5B6875 secondary text
 *
 * @param {Object} props
 * @param {string} [props.role]
 * @param {string} [props.title='Dashboard']
 * @param {React.ReactNode} [props.actions]
 */
export default function Topbar({
  role = ROLES.PROPERTY_OWNER,
  title = 'Dashboard',
  actions,
}) {
  return (
    <header className="flex min-h-[4.5rem] items-center justify-between border-b border-[#E3E8DF]/50 bg-transparent px-4 py-3 transition-colors sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-serif text-xl font-semibold tracking-tight text-[#243447] sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>

      {/* Right section: Notifications, User Profile, Custom Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {actions}

        {/* Notification Bell */}
        <NotificationBell />

        <div className="h-5 w-px bg-[#E3E8DF] mx-0.5" />

        {/* User Profile & Logout */}
        <UserMenu role={role} />
      </div>
    </header>
  )
}
