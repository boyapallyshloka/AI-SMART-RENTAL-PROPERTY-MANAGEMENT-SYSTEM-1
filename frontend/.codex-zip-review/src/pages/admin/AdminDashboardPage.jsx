import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Loader, StatusBadge } from '../../components/ui'
import {
  Users,
  Building2,
  UserCheck,
  ShieldCheck,
  Wrench,
  Sparkles,
  History,
  LogOut,
  Shield,
  RotateCcw,
  AlertCircle,
  Briefcase,
  FileBarChart,
  Settings,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { getAllUsers } from '../../api/userApi'
import { getMaintenanceRequests } from '../../api/maintenanceApi'
import { getInvoices } from '../../api/invoiceApi'

const unwrapList = (result) => {
  if (!result || result.status !== 'fulfilled') return []
  const val = result.value?.data ?? result.value
  if (Array.isArray(val)) return val
  if (Array.isArray(val?.content)) return val.content
  if (Array.isArray(val?.users)) return val.users
  if (Array.isArray(val?.invoices)) return val.invoices
  return []
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [users, setUsers] = useState([])
  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  const [invoices, setInvoices] = useState([])
  const [dataAvailability, setDataAvailability] = useState({ users: false, maintenance: false, invoices: false })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loadAdminData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [usersRes, maintRes, invoicesRes] = await Promise.allSettled([
        getAllUsers(),
        getMaintenanceRequests(),
        getInvoices(),
      ])

      const failedSources = [
        usersRes.status === 'rejected' ? 'user accounts' : null,
        maintRes.status === 'rejected' ? 'maintenance requests' : null,
        invoicesRes.status === 'rejected' ? 'rent invoices' : null,
      ].filter(Boolean)

      setDataAvailability({
        users: usersRes.status === 'fulfilled',
        maintenance: maintRes.status === 'fulfilled',
        invoices: invoicesRes.status === 'fulfilled',
      })

      if (failedSources.length > 0) {
        setErrorMessage(
          `Could not connect to backend for: ${failedSources.join(
            ', '
          )}. Metrics for those records may be incomplete.`
        )
      }

      setUsers(unwrapList(usersRes))
      setMaintenanceRequests(unwrapList(maintRes))
      setInvoices(unwrapList(invoicesRes))
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err)
      setDataAvailability({ users: false, maintenance: false, invoices: false })
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load admin dashboard metrics. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  // Derived user statistics from real backend database
  const totalUsers = users.length
  const propertyOwners = users.filter((u) => {
    const role = String(u.role || '').toUpperCase()
    return role === 'PROPERTY_OWNER' || role === 'ROLE_PROPERTY_OWNER'
  }).length

  const pendingOwners = users.filter((u) => {
    const role = String(u.role || '').toUpperCase()
    const isOwner = role === 'PROPERTY_OWNER' || role === 'ROLE_PROPERTY_OWNER'
    const isPending = String(u.status || '').toUpperCase() === 'PENDING'
    return isOwner && isPending
  }).length

  const tenants = users.filter((u) => {
    const role = String(u.role || '').toUpperCase()
    return role === 'TENANT' || role === 'ROLE_TENANT'
  }).length

  const propertyManagers = users.filter((u) => {
    const role = String(u.role || '').toUpperCase()
    return role === 'PROPERTY_MANAGER' || role === 'ROLE_PROPERTY_MANAGER'
  }).length

  const openMaintenance = maintenanceRequests.filter((m) =>
    ['OPEN', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS'].includes(
      String(m.status || '').toUpperCase()
    )
  ).length
  const displayMetric = (value, source) =>
    dataAvailability[source] ? value.toLocaleString('en-IN') : '—'

  // Real summary metric cards
  const summaryMetrics = [
    {
      id: 'total-users',
      label: 'Total Registered Users',
      value: displayMetric(totalUsers, 'users'),
      subtext: dataAvailability.users ? `${totalUsers} platform accounts in database` : 'User data unavailable',
      icon: <Users className="w-5 h-5 text-[#315A7D]" />,
      bg: 'bg-[#EAF2F7] border-[#D9E0E6]',
      link: '/admin/users',
    },
    {
      id: 'property-owners',
      label: 'Property Owners',
      value: displayMetric(propertyOwners, 'users'),
      subtext: dataAvailability.users ? 'Registered property & building owners' : 'User data unavailable',
      icon: <Building2 className="w-5 h-5 text-[#3F7D58]" />,
      bg: 'bg-[#EDF7EE] border-[#C6DEC8]',
      link: '/admin/users',
    },
    {
      id: 'pending-owners',
      label: 'Pending Owner Approvals',
      value: displayMetric(pendingOwners, 'users'),
      subtext: !dataAvailability.users
        ? 'Owner approval data unavailable'
        :
        pendingOwners > 0
          ? 'Requires administrator review'
          : 'All owner accounts reviewed',
      icon: <ShieldCheck className="w-5 h-5 text-[#B7791F]" />,
      bg: pendingOwners > 0 ? 'bg-[#FEF7EC] border-[#F4E2B6]' : 'bg-[#EDF7EE] border-[#C6DEC8]',
      link: '/admin/owner-verification',
    },
    {
      id: 'tenants',
      label: 'Registered Tenants',
      value: displayMetric(tenants, 'users'),
      subtext: dataAvailability.users ? 'Tenant and resident accounts' : 'User data unavailable',
      icon: <UserCheck className="w-5 h-5 text-[#315A7D]" />,
      bg: 'bg-[#EAF2F7] border-[#D9E0E6]',
      link: '/admin/users',
    },
    {
      id: 'open-maintenance',
      label: 'Active Maintenance Tickets',
      value: displayMetric(openMaintenance, 'maintenance'),
      subtext: dataAvailability.maintenance ? `${maintenanceRequests.length} total tickets recorded` : 'Maintenance data unavailable',
      icon: <Wrench className="w-5 h-5 text-[#5B6875]" />,
      bg: 'bg-[#F0F4F7] border-[#D9E0E6]',
    },
    {
      id: 'total-invoices',
      label: 'Platform Rent Invoices',
      value: displayMetric(invoices.length, 'invoices'),
      subtext: dataAvailability.invoices ? 'Rent invoice transaction records' : 'Invoice data unavailable',
      icon: <FileBarChart className="w-5 h-5 text-[#315A7D]" />,
      bg: 'bg-[#EAF2F7] border-[#D9E0E6]',
      link: '/admin/reports',
    },
  ]

  // Administrative Module Status Overview
  const moduleStatuses = [
    {
      name: 'User Directory & Management',
      route: '/admin/users',
      status: 'LIVE',
      description: 'Full CRUD operations for accounts via /api/users',
      endpoints: 'GET, PUT, DELETE /api/users/*',
    },
    {
      name: 'Owner Account Approvals',
      route: '/admin/owner-verification',
      status: 'LIVE',
      description: 'Account activation & suspension via /api/users/filter and status update',
      endpoints: 'GET /api/users/filter, PUT /api/users/{id}/status',
    },
    {
      name: 'Platform Billing & Reports',
      route: '/admin/reports',
      status: 'LIVE',
      description: 'Real invoice totals via /api/rent-invoices',
      endpoints: 'GET /api/rent-invoices',
    },
    {
      name: 'Owner Document Verification',
      route: '/admin/owner-verification',
      status: 'API_REQUIRED',
      description: 'Deed and identity document review pipeline',
      endpoints: 'GET /api/owner-documents, PUT verify',
    },
    {
      name: 'Platform Audit Logs',
      route: '/admin/audit-logs',
      status: 'API_REQUIRED',
      description: 'Administrative mutation logging and security event stream',
      endpoints: 'GET /api/admin/audit-logs',
    },
    {
      name: 'AI Model Observability',
      route: '/admin/ai-monitoring',
      status: 'API_REQUIRED',
      description: 'Telemetry, latency tracking, and drift detection for M1/M2/M5',
      endpoints: 'GET /api/admin/ai/metrics',
    },
    {
      name: 'Global System Settings',
      route: '/admin/system-settings',
      status: 'API_REQUIRED',
      description: 'Persistent platform configuration and integration settings',
      endpoints: 'GET, PUT /api/admin/settings',
    },
  ]

  return (
    <DashboardLayout
      defaultRole="admin"
      activeItem="dashboard"
      pageTitle="Super Admin Dashboard"
      topbarActions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-[#B94A48]" />}
          >
            Logout
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F4B4B4] text-[#8A2E2C] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#8A2E2C] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadAdminData}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader text="Loading live administration data from backend..." size="md" center />
          </div>
        ) : (
          <>
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                    Super Admin Control Center
                  </h1>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                    Platform Root
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
                  Live user directory statistics, maintenance telemetry, and administrative services status.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadAdminData}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Refresh Data
              </Button>
            </div>

            {/* 6 Summary Cards Grid with real backend counts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summaryMetrics.map((card) => {
                const cardContent = (
                  <div
                    className={`rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-2xs transition-all flex items-start justify-between h-full ${
                      card.link
                        ? 'hover:border-[#315A7D] hover:shadow-xs cursor-pointer group'
                        : ''
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] block group-hover:text-[#315A7D] transition-colors">
                        {card.label}
                      </span>
                      <div className="text-2xl font-bold tracking-tight text-[#243447] mt-1">
                        {card.value}
                      </div>
                      <span className="text-xs text-[#5B6875] block mt-1">
                        {card.subtext}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-md border ${card.bg} shrink-0 ml-3`}>
                      {card.icon}
                    </div>
                  </div>
                )

                return card.link ? (
                  <Link key={card.id} to={card.link} className="block">
                    {cardContent}
                  </Link>
                ) : (
                  <div key={card.id}>{cardContent}</div>
                )
              })}
            </div>

            {/* Platform Registered Users Overview */}
            <div className="bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#D9E0E6] bg-[#F7F8FA] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#315A7D]" />
                  <h2 className="text-xs sm:text-sm font-semibold text-[#243447]">
                    Recent Registered Platform Users
                  </h2>
                </div>
                <Link to="/admin/users">
                  <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Manage All Users
                  </Button>
                </Link>
              </div>

              {users.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5B6875]">
                  No user records returned from the backend.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#5B6875]">
                        <th className="py-2.5 pl-4 pr-3">User ID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 pl-3 pr-4 text-right">Account Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E0E6]">
                      {users.slice(0, 8).map((u) => {
                        const uid = u.id || u.userId || '—'
                        const displayName =
                          u.name ||
                          [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                          'Unnamed'
                        const roleStr = String(u.role || '').replace(/^ROLE_/i, '')
                        const statusStr = u.status

                        return (
                          <tr
                            key={uid}
                            className="hover:bg-[#F7F8FA]/60 transition-colors"
                          >
                            <td className="py-2.5 pl-4 pr-3 font-mono font-medium text-[#315A7D]">
                              #{uid}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#243447]">
                              {displayName}
                            </td>
                            <td className="py-2.5 px-3 text-[#5B6875]">
                              {u.email}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                                {roleStr}
                              </span>
                            </td>
                            <td className="py-2.5 pl-3 pr-4 text-right">
                              <StatusBadge status={statusStr} size="sm" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Administrative Modules & API Status Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#243447]">
                    Administrative Subsystems & API Integration Status
                  </h2>
                  <p className="text-xs text-[#5B6875]">
                    Overview of active Spring Boot endpoints vs modules requiring backend REST implementations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moduleStatuses.map((mod) => (
                  <Link
                    key={mod.name}
                    to={mod.route}
                    className="block rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-2xs hover:border-[#315A7D] hover:shadow-xs transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#243447] group-hover:text-[#315A7D] transition-colors">
                            {mod.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-[#5B6875]">
                          {mod.description}
                        </p>
                        <div className="mt-2 text-[11px] font-mono text-[#5B6875] bg-[#F7F8FA] px-2 py-0.5 rounded border border-[#D9E0E6] inline-block">
                          {mod.endpoints}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {mod.status === 'LIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                            <CheckCircle2 className="w-3 h-3" />
                            Live Backend API
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]">
                            <AlertTriangle className="w-3 h-3" />
                            API Required
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
