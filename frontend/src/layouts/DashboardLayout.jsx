import React, { useState, useEffect } from 'react'
import Sidebar from '../components/common/Sidebar'
import Topbar from '../components/common/Topbar'
import Footer from '../components/common/Footer'
import ScoutAssistant from '../components/scout/ScoutAssistant'
import { ROLES, normalizeRole } from '../utils/roles'
import dashboardCityBackground from '../assets/dashboard-city-golden-hour.png'

/**
 * DashboardLayout Component for SmartEstate
 * Canvas background: #F7F7F1, Main Text: #243447
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.defaultRole=ROLES.PROPERTY_OWNER]
 * @param {string} [props.activeItem='dashboard']
 * @param {(item: string) => void} [props.onSelectNav]
 * @param {string} [props.pageTitle]
 * @param {React.ReactNode} [props.topbarActions]
 */
export default function DashboardLayout({
  children,
  defaultRole = ROLES.PROPERTY_OWNER,
  activeItem = 'dashboard',
  onSelectNav,
  pageTitle,
  topbarActions,
}) {
  const [currentRole, setCurrentRole] = useState(() => normalizeRole(defaultRole))
  const [currentNav, setCurrentNav] = useState(activeItem)

  useEffect(() => {
    setCurrentRole(normalizeRole(defaultRole))
  }, [defaultRole])

  const handleNavSelect = (item) => {
    setCurrentNav(item)
    if (onSelectNav) onSelectNav(item)
  }

  // Determine friendly title from current nav or pageTitle prop
  const displayTitle =
    pageTitle ||
    currentNav
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  React.useEffect(() => {
    if (displayTitle) {
      document.title = `${displayTitle} | SmartEstate`
    }
  }, [displayTitle])

  return (
    <div className="relative isolate min-h-screen text-[#243447] font-sans antialiased">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={dashboardCityBackground}
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover blur-[2px]"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Role navigation sits across the top of the dashboard. */}
        <Sidebar
          role={currentRole}
          activeItem={currentNav}
          onSelect={handleNavSelect}
        />

        {/* Main Content Area */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
          {/* Top Header Bar */}
          <Topbar
            role={currentRole}
            title={displayTitle}
            actions={topbarActions}
          />

          {/* Dynamic Route Content */}
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 pb-8 sm:px-6 lg:px-10">
            {children}
          </main>

          {/* Reusable Application Footer */}
          <Footer variant="dashboard" />
        </div>
      </div>

      {/* SCOUT Assistant Interface */}
      <ScoutAssistant />
    </div>
  )
}
