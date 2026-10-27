import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Building,
  Building2,
  FileCheck,
  FileText,
  CreditCard,
  Wrench,
  HardHat,
  BarChart3,
  Sparkles,
  Search,
  X,
  Users,
  ShieldCheck,
  History,
  Activity,
  Settings,
  Bot,
  User,
} from 'lucide-react'
import NavItem from './NavItem'
import { useScout } from '../../context/ScoutContext'
import { getMyProperties } from '../../api/propertyApi'
import {
  ROLES,
  isSuperAdmin,
  isTenant,
  isPropertyManager,
  isPropertyOwner,
  getPortalName,
} from '../../utils/roles'

export const MANAGER_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'properties', label: 'Assigned Properties', icon: <Building2 className="w-4 h-4" /> },
  { id: 'applications', label: 'Applications', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
  { id: 'technicians', label: 'Technicians', icon: <HardHat className="w-4 h-4" /> },
  { id: 'agreements', label: 'Agreements', icon: <FileText className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'inspections', label: 'Inspections', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
]

const OWNER_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'properties', label: 'Properties', icon: <Building2 className="w-4 h-4" /> },
  { id: 'applications', label: 'Applications', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'agreements', label: 'Agreements', icon: <FileText className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'ai-insights', label: 'AI Insights', icon: <Sparkles className="w-4 h-4 text-[#315A7D]" /> },
  { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
]

const TENANT_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'buildings', label: 'My Rental Property', icon: <Building2 className="w-4 h-4" /> },
  { id: 'find-properties', label: 'Find Properties', icon: <Search className="w-4 h-4" /> },
  { id: 'my-applications', label: 'My Applications', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
  { id: 'agreement', label: 'Agreement', icon: <FileText className="w-4 h-4" /> },
]

const ADMIN_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { id: 'owner-verification', label: 'Owner Verification', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'tenant-document-review', label: 'Tenant Document Review', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'audit-logs', label: 'Audit Logs', icon: <History className="w-4 h-4" /> },
  { id: 'ai-monitoring', label: 'AI Monitoring', icon: <Activity className="w-4 h-4 text-[#315A7D]" /> },
  { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
]

/**
 * Enterprise Sidebar Component for SmartEstate
 * @param {Object} props
 * @param {string} props.role
 * @param {string} props.activeItem
 * @param {(item: string) => void} props.onSelect
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function Sidebar({
  role = ROLES.PROPERTY_OWNER,
  activeItem = 'dashboard',
  onSelect,
  isOpen = false,
  onClose,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { openScout } = useScout()
  const [propertyCount, setPropertyCount] = useState(null)

  useEffect(() => {
    let isMounted = true
    if (isPropertyOwner(role)) {
      getMyProperties()
        .then((res) => {
          if (!isMounted) return
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
            ? res.data
            : (res?.data?.content || [])
          setPropertyCount(list.length)
        })
        .catch(() => {
          if (isMounted) setPropertyCount(null)
        })
    } else {
      setPropertyCount(null)
    }
    return () => {
      isMounted = false
    }
  }, [role])

  const handleOpenScout = () => {
    if (onClose) onClose()
    openScout()
  }

  const dynamicOwnerMenu = OWNER_MENU.map((item) => {
    if (item.id === 'properties' && propertyCount !== null && propertyCount > 0) {
      return { ...item, badge: String(propertyCount) }
    }
    return item
  })

  const menuItems = isSuperAdmin(role)
    ? ADMIN_MENU
    : isTenant(role)
    ? TENANT_MENU
    : isPropertyManager(role)
    ? MANAGER_MENU
    : dynamicOwnerMenu

  const handleItemClick = (id) => {
    if (onSelect) onSelect(id)
    if (onClose) onClose()

    if (isSuperAdmin(role)) {
      if (id === 'dashboard') navigate('/admin/dashboard')
      else if (id === 'users') navigate('/admin/users')
      else if (id === 'owner-verification') navigate('/admin/owner-verification')
      else if (id === 'tenant-document-review') navigate('/admin/tenant-document-review')
      else if (id === 'reports') navigate('/admin/reports')
      else if (id === 'audit-logs') navigate('/admin/audit-logs')
      else if (id === 'ai-monitoring') navigate('/admin/ai-monitoring')
      else if (id === 'settings' || id === 'system-settings') navigate('/admin/system-settings')
    } else if (isPropertyManager(role)) {
      if (id === 'dashboard') {
        navigate('/manager/dashboard')
      } else if (id === 'properties') {
        navigate('/manager/properties')
      } else if (id === 'applications') {
        navigate('/manager/applications')
      } else if (id === 'agreements') {
        navigate('/manager/agreements')
      } else if (id === 'payments') {
        navigate('/manager/payments')
      } else if (id === 'maintenance') {
        navigate('/manager/maintenance')
      } else if (id === 'technicians') {
        navigate('/manager/maintenance/technicians')
      } else if (id === 'inspections') {
        navigate('/manager/inspections')
      } else if (id === 'profile') {
        navigate('/manager/profile')
      } else if (id === 'reports') {
        navigate('/manager/reports')
      } else {
        const itemLabels = {
          inspections: 'Property & Unit Inspections',
        }
        const label = itemLabels[id] || 'This feature'
        alert(`${label} will be available in an upcoming Manager Portal update.`)
      }
    } else if (isPropertyOwner(role)) {
      if (id === 'dashboard') navigate('/owner/dashboard')
      else if (id === 'properties') navigate('/owner/properties')
      else if (id === 'buildings') navigate('/owner/buildings')
      else if (id === 'applications') navigate('/owner/applications')
      else if (id === 'agreements') navigate('/owner/agreements')
      else if (id === 'payments') navigate('/owner/payments')
      else if (id === 'maintenance') navigate('/owner/maintenance')
      else if (id === 'profile') navigate('/owner/profile')
      else if (id === 'reports') navigate('/owner/reports')
      else if (id === 'ai-insights') navigate('/owner/ai-insights')
    } else if (isTenant(role)) {
      if (id === 'dashboard') navigate('/tenant/dashboard')
      else if (id === 'buildings' || id === 'my-rental') navigate('/tenant/buildings')
      else if (id === 'find-properties' || id === 'browse') navigate('/tenant/find-properties')
      else if (id === 'my-applications') navigate('/tenant/applications')
      else if (id === 'agreement') navigate('/tenant/agreement')
      else if (id === 'payments') navigate('/tenant/payments')
      else if (id === 'maintenance') navigate('/tenant/maintenance')
    }
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#243447]/50 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-[#D9E0E6] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
        }`}
      >
        {/* Branding Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#D9E0E6] shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#315A7D] text-white">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#243447]">
                SmartEstate
              </span>
              <span className="block text-[10px] uppercase font-semibold tracking-wider text-[#5B6875]">
                Property Management
              </span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Indicator Banner */}
        <div className="px-4 pt-3 pb-1">
          <div className="p-2.5 rounded-md bg-[#EAF2F7] border border-[#D9E0E6] text-xs">
            <span className="text-[10px] uppercase font-bold text-[#5B6875] block tracking-wider">
              Portal View
            </span>
            <span className="font-semibold text-[#243447]">
              {getPortalName(role)}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto min-h-0">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6875]">
            Navigation
          </p>
          {menuItems.map((item) => {
            const isActive =
              activeItem === item.id ||
              (isPropertyManager(role) &&
                item.id === 'properties' &&
                (location.pathname === '/manager/properties' ||
                  location.pathname.startsWith('/manager/properties/'))) ||
              (isPropertyManager(role) &&
                item.id === 'applications' &&
                (location.pathname === '/manager/applications' ||
                  location.pathname.startsWith('/manager/applications/'))) ||
              (isPropertyManager(role) &&
                item.id === 'maintenance' &&
                (location.pathname === '/manager/maintenance' ||
                  (location.pathname.startsWith('/manager/maintenance/') &&
                    location.pathname !== '/manager/maintenance/technicians'))) ||
              (isPropertyManager(role) &&
                item.id === 'technicians' &&
                location.pathname === '/manager/maintenance/technicians') ||
              (isPropertyManager(role) &&
                item.id === 'inspections' &&
                location.pathname.startsWith('/manager/inspections')) ||
              (isPropertyManager(role) &&
                item.id === 'profile' &&
                location.pathname === '/manager/profile') ||
              (isPropertyOwner(role) &&
                item.id === 'profile' &&
                location.pathname === '/owner/profile') ||
              (isPropertyManager(role) &&
                item.id === 'dashboard' &&
                location.pathname === '/manager/dashboard')

            return (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                isActive={isActive}
                onClick={() => handleItemClick(item.id)}
              />
            )
          })}
        </nav>

        {/* SCOUT Assistant Sidebar Section */}
        <div className="px-3 py-2.5 border-t border-[#D9E0E6] shrink-0 bg-[#F7F8FA]/60">
          <div className="p-3 rounded-xl bg-white border border-[#D9E0E6] shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D] shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#243447] leading-tight">
                    SCOUT
                  </span>
                  <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[#F7F8FA] text-[#5B6875] border border-[#D9E0E6]">
                    Unavailable
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#5B6875] leading-snug mb-2.5">
              Assistant service is not connected
            </p>
            <button
              type="button"
              onClick={handleOpenScout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#315A7D] hover:bg-[#274B68] text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Open SCOUT</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#D9E0E6] shrink-0 bg-white">
          <div className="flex items-center justify-between text-xs text-[#5B6875]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3F7D58]"></span>
              System Active
            </span>
            <span className="font-mono text-[11px] text-[#5B6875]">v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  )
}
