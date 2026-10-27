import React, { useState, useEffect } from 'react'
import Sidebar from '../components/common/Sidebar'
import Topbar from '../components/common/Topbar'
import Footer from '../components/common/Footer'
import ScoutAssistant from '../components/scout/ScoutAssistant'
import { ROLES, normalizeRole } from '../utils/roles'

/**
 * DashboardLayout Component for SmartEstate
 * Canvas background: #F7F8FA, Main Text: #243447
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
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
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA] text-[#243447] font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        role={currentRole}
        activeItem={currentNav}
        onSelect={handleNavSelect}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-[#F7F8FA]">
        {/* Top Header Bar */}
        <Topbar
          role={currentRole}
          title={displayTitle}
          onMenuClick={() => setMobileSidebarOpen(true)}
          actions={topbarActions}
        />

        {/* Dynamic Route Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Reusable Application Footer */}
        <Footer variant="dashboard" />
      </div>

      {/* SCOUT Assistant Interface */}
      <ScoutAssistant />
    </div>
  )
}
