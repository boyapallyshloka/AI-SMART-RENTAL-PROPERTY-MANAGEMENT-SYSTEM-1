import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Building2,
  FileCheck,
  FileText,
  CreditCard,
  HardHat,
  Wrench,
  BarChart3,
  Search,
  Users,
  ShieldCheck,
  History,
  Activity,
  Settings,
  User,
} from 'lucide-react'
import NavItem from './NavItem'
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
  { id: 'profile', label: 'My Account', icon: <User className="w-4 h-4" /> },
]

const OWNER_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'properties', label: 'Properties', icon: <Building2 className="w-4 h-4" /> },
  { id: 'applications', label: 'Applications', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'agreements', label: 'Agreements', icon: <FileText className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'profile', label: 'My Account', icon: <User className="w-4 h-4" /> },
]

const TENANT_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'account', label: 'My Account', icon: <User className="w-4 h-4" /> },
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
  { id: 'ai-monitoring', label: 'AI Monitoring', icon: <Activity className="w-4 h-4 text-[#3F7D58]" /> },
  { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
]

/**
 * Responsive horizontal role navigation for SmartEstate.
 * @param {Object} props
 * @param {string} props.role
 * @param {string} props.activeItem
 * @param {(item: string) => void} props.onSelect
 */
export default function Sidebar({
  role = ROLES.PROPERTY_OWNER,
  activeItem = 'dashboard',
  onSelect,
}) {
  const navigate = useNavigate()
  const location = useLocation()
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
        navigate('/manager/account')
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
      else if (id === 'profile') navigate('/owner/account')
      else if (id === 'reports') navigate('/owner/reports')
    } else if (isTenant(role)) {
      if (id === 'dashboard') navigate('/tenant/dashboard')
      else if (id === 'account') navigate('/tenant/account')
      else if (id === 'buildings' || id === 'my-rental') navigate('/tenant/buildings')
      else if (id === 'find-properties' || id === 'browse') navigate('/tenant/find-properties')
      else if (id === 'my-applications') navigate('/tenant/applications')
      else if (id === 'agreement') navigate('/tenant/agreement')
      else if (id === 'payments') navigate('/tenant/payments')
      else if (id === 'maintenance') navigate('/tenant/maintenance')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#D8C6A8]/70 bg-[#F5E8D6]/75 px-3 py-3 backdrop-blur-md sm:px-5 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111820] text-white shadow-sm">
              <Home className="h-5 w-5" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-[#111820]">SmartEstate</span>
          </div>
        </div>

        <nav aria-label={`${getPortalName(role)} navigation`} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin] lg:justify-center">
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
                location.pathname === '/manager/maintenance') ||
              (isPropertyManager(role) &&
                item.id === 'technicians' &&
                location.pathname.startsWith('/manager/maintenance/technicians')) ||
              (isPropertyManager(role) &&
                item.id === 'inspections' &&
                location.pathname === '/manager/inspections') ||
              (isPropertyManager(role) &&
                item.id === 'profile' &&
                location.pathname === '/manager/account') ||
              (isPropertyOwner(role) &&
                item.id === 'profile' &&
                location.pathname === '/owner/account') ||
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

      </div>
    </header>
  )
}
