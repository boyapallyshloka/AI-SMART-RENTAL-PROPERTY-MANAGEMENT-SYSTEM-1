import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
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
  const navigationRef = useRef(null)
  const [propertyCount, setPropertyCount] = useState(null)
  const [navigationOverflow, setNavigationOverflow] = useState({ hasOverflow: false, canScrollLeft: false, canScrollRight: false })

  const updateNavigationOverflow = useCallback(() => {
    const navigation = navigationRef.current
    if (!navigation) return
    const canScrollLeft = navigation.scrollLeft > 2
    const canScrollRight = navigation.scrollWidth - navigation.clientWidth - navigation.scrollLeft > 2
    setNavigationOverflow((current) => {
      const hasOverflow = canScrollLeft || canScrollRight
      if (
        current.hasOverflow === hasOverflow &&
        current.canScrollLeft === canScrollLeft &&
        current.canScrollRight === canScrollRight
      ) return current
      return { hasOverflow, canScrollLeft, canScrollRight }
    })
  }, [])

  useEffect(() => {
    const navigation = navigationRef.current
    if (!navigation) return undefined
    updateNavigationOverflow()
    navigation.addEventListener('scroll', updateNavigationOverflow, { passive: true })
    window.addEventListener('resize', updateNavigationOverflow)
    return () => {
      navigation.removeEventListener('scroll', updateNavigationOverflow)
      window.removeEventListener('resize', updateNavigationOverflow)
    }
  }, [role, updateNavigationOverflow])

  useEffect(() => {
    const navigation = navigationRef.current
    const activeItemElement = navigation?.querySelector('[aria-current="page"]')
    if (!navigation || !activeItemElement || navigation.scrollWidth <= navigation.clientWidth) return

    const navigationBounds = navigation.getBoundingClientRect()
    const activeItemBounds = activeItemElement.getBoundingClientRect()
    const activeItemLeft = activeItemBounds.left - navigationBounds.left + navigation.scrollLeft
    const targetScrollLeft = activeItemLeft + activeItemBounds.width / 2 - navigation.clientWidth / 2
    navigation.scrollTo({
      left: Math.max(0, Math.min(targetScrollLeft, navigation.scrollWidth - navigation.clientWidth)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [activeItem, location.pathname, role])

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

        <div className="flex min-w-0 flex-1 items-center lg:justify-center">
          {navigationOverflow.hasOverflow && (
            <button
              type="button"
              onClick={() => navigationRef.current?.scrollBy({ left: -navigationRef.current.clientWidth * 0.7, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
              disabled={!navigationOverflow.canScrollLeft}
              aria-label={`Scroll ${getPortalName(role)} navigation left`}
              className="mr-1 inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-full border border-[#D8C6A8]/70 bg-[#F4EBDD] text-[#5B6875] transition hover:bg-white disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3F7D58]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <nav ref={navigationRef} aria-label={`${getPortalName(role)} navigation`} className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin] lg:justify-center">
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
          {navigationOverflow.hasOverflow && (
            <button
              type="button"
              onClick={() => navigationRef.current?.scrollBy({ left: navigationRef.current.clientWidth * 0.7, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
              disabled={!navigationOverflow.canScrollRight}
              aria-label={`Scroll ${getPortalName(role)} navigation right`}
              className="ml-1 inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-full border border-[#D8C6A8]/70 bg-[#F4EBDD] text-[#5B6875] transition hover:bg-white disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3F7D58]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  )
}
