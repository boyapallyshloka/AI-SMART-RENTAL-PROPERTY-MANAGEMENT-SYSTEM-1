import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import { getManagerAssignedProperties } from '../../api/propertyApi'
import { getApplicationsForProperty, APPLICATION_STATUSES } from '../../api/applicationApi'
import { formatCurrency } from '../../utils/currency'
import {
  Button,
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  Search,
  RotateCcw,
  FileCheck,
  Building2,
  Calendar,
  Eye,
  RefreshCw,
  User,
  Mail,
  AlertCircle,
  Clock,
  ArrowLeft,
  X,
  SlidersHorizontal,
} from 'lucide-react'

// Date Formatter
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

export default function ManagerApplicationsPage() {
  const [assignedProperties, setAssignedProperties] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null) // '401' | '403' | 'network' | 'server'

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [propertyFilter, setPropertyFilter] = useState('ALL')

  // Load all applications across all assigned properties
  const loadApplications = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    setErrorType(null)

    try {
      // 1. Fetch properties assigned to the manager
      const propRes = await getManagerAssignedProperties()
      const propList = Array.isArray(propRes?.data)
        ? propRes.data
        : Array.isArray(propRes)
          ? propRes
          : []

      setAssignedProperties(propList)

      if (propList.length === 0) {
        setApplications([])
        return
      }

      // 2. Fetch applications for each assigned property concurrently
      const applicationPromises = propList.map(async (prop) => {
        const propId = prop.propertyId || prop.id
        try {
          const appRes = await getApplicationsForProperty(propId)
          const appList = Array.isArray(appRes?.data)
            ? appRes.data
            : Array.isArray(appRes)
              ? appRes
              : []

          // Enrich application with property details if missing
          return appList.map((app) => ({
            ...app,
            propertyId: app.propertyId || propId,
            propertyName: app.propertyName || prop.propertyName || `Property #${propId}`,
          }))
        } catch (appErr) {
          console.warn(`Could not load applications for property #${propId}:`, appErr)
          return []
        }
      })

      const results = await Promise.allSettled(applicationPromises)
      const allFetched = []

      results.forEach((res) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allFetched.push(...res.value)
        }
      })

      // 3. Deduplicate by applicationId safely
      const uniqueAppsMap = new Map()
      allFetched.forEach((app) => {
        if (app && app.applicationId != null) {
          uniqueAppsMap.set(app.applicationId, app)
        }
      })

      // Sort applications newest first (by applicationDate or createdAt)
      const sorted = Array.from(uniqueAppsMap.values()).sort((a, b) => {
        const dateA = new Date(a.applicationDate || a.createdAt || 0).getTime()
        const dateB = new Date(b.applicationDate || b.createdAt || 0).getTime()
        return dateB - dateA
      })

      setApplications(sorted)
    } catch (err) {
      console.error('[Manager] Failed to load applications:', err)
      const status = err?.response?.status || err?.status

      if (err?.isAuthError || status === 401) {
        setErrorType('401')
        setError('Your session has expired. Please sign in again to access rental applications.')
      } else if (err?.isForbidden || status === 403) {
        setErrorType('403')
        setError('Access restricted: You do not have permission to view manager application records.')
      } else if (err?.isNetworkError) {
        setErrorType('network')
        setError('Network error: Unable to connect to the server. Please check your internet connection.')
      } else {
        setErrorType('server')
        setError(err?.response?.data?.message || err?.message || 'Unable to load rental applications from the server.')
      }
      setApplications([])
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  // Filter Options
  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: APPLICATION_STATUSES.PENDING, label: 'Pending' },
    { value: APPLICATION_STATUSES.APPROVED, label: 'Approved' },
    { value: APPLICATION_STATUSES.REJECTED, label: 'Rejected' },
    { value: APPLICATION_STATUSES.WITHDRAWN, label: 'Withdrawn' },
    { value: APPLICATION_STATUSES.CANCELLED, label: 'Cancelled' },
  ]

  const propertyOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Assigned Properties' },
      ...assignedProperties.map((p) => ({
        value: String(p.propertyId || p.id),
        label: p.propertyName || `Property #${p.propertyId || p.id}`,
      })),
    ]
  }, [assignedProperties])

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return applications.filter((app) => {
      // Search Match
      const matchesSearch =
        !q ||
        (app.tenantName && app.tenantName.toLowerCase().includes(q)) ||
        (app.tenantEmail && app.tenantEmail.toLowerCase().includes(q)) ||
        (app.propertyName && app.propertyName.toLowerCase().includes(q)) ||
        (app.buildingName && app.buildingName.toLowerCase().includes(q)) ||
        (app.unitNumber && app.unitNumber.toLowerCase().includes(q)) ||
        (app.applicationId != null && String(app.applicationId).includes(q))

      // Status Match
      const matchesStatus =
        statusFilter === 'ALL' ||
        (app.status && String(app.status).toUpperCase() === statusFilter)

      // Property Match
      const matchesProperty =
        propertyFilter === 'ALL' ||
        String(app.propertyId) === propertyFilter

      return matchesSearch && matchesStatus && matchesProperty
    })
  }, [applications, searchQuery, statusFilter, propertyFilter])

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || propertyFilter !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setPropertyFilter('ALL')
  }

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="applications"
      pageTitle="Applications"
    >
      <div className="space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">

            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
                Applications
              </h1>

            </div>
            <p className="text-xs sm:text-sm text-[#5B6875]">
              Rental applications submitted for your assigned property .
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadApplications(true)}
              disabled={loading || isRefreshing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        {!loading && !error && applications.length > 0 && (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-4 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              {/* Search Field */}
              <div className="sm:col-span-2 lg:col-span-6 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B6875]">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by applicant name, email, property, unit, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-md text-xs sm:text-sm border border-[#D9E0E6] bg-white text-[#243447] placeholder:text-[#98A2B3] pl-9 pr-8 py-2 focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#5B6875] hover:text-[#243447]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="lg:col-span-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full rounded-md text-xs sm:text-sm border border-[#D9E0E6] bg-white text-[#243447] px-3 py-2 focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Filter */}
              <div className="lg:col-span-3">
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="block w-full rounded-md text-xs sm:text-sm border border-[#D9E0E6] bg-white text-[#243447] px-3 py-2 focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] truncate"
                >
                  {propertyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Status Summary & Reset Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6875] pt-2 border-t border-[#D9E0E6]/80">
              <div className="flex items-center gap-2">
                <span>
                  Showing{' '}
                  <strong className="text-[#243447]">
                    {filteredApplications.length}
                  </strong>{' '}
                  of {applications.length} applications
                </span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Filters active</span>
                  </span>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#315A7D] hover:text-[#243447] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset filters</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-16 shadow-2xs flex justify-center">
            <Loader text="Loading rental applications..." size="md" center />
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-white rounded-lg border border-[#F8B4B4] p-6 shadow-2xs space-y-4 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#243447]">
                  {errorType === '403'
                    ? 'Access Restricted'
                    : errorType === '401'
                      ? 'Session Expired'
                      : errorType === 'network'
                        ? 'Network Connection Issue'
                        : 'Failed to Load Applications'}
                </h2>
                <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => loadApplications()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
              <Link to="/manager/dashboard">
                <Button variant="secondary" size="sm">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : assignedProperties.length === 0 ? (
          /* Empty Case A: No Assigned Properties */
          <EmptyState
            icon={<Building2 className="w-8 h-8 text-[#315A7D]" />}
            title="No properties assigned"
            message="You do not currently have any properties assigned to your management portfolio. Rental applications will appear here once properties are assigned."
            action={{
              label: 'Return to Dashboard',
              onClick: () => { },
              variant: 'primary',
            }}
          />
        ) : applications.length === 0 ? (
          /* Empty Case B: Assigned properties have no applications */
          <EmptyState
            icon={<FileCheck className="w-8 h-8 text-[#315A7D]" />}
            title="No rental applications"
            message="There are currently no rental applications submitted for your assigned properties."
            action={{
              label: 'Refresh List',
              onClick: () => loadApplications(true),
              variant: 'outline',
            }}
          />
        ) : filteredApplications.length === 0 ? (
          /* Empty Case C: Search / Filter returns no matches */
          <EmptyState
            icon={<Search className="w-8 h-8 text-[#5B6875]" />}
            title="No matching applications"
            message="No rental applications match your current search query or filter criteria."
            action={{
              label: 'Reset Filters',
              onClick: resetFilters,
              variant: 'secondary',
            }}
          />
        ) : (
          /* Application Results */
          <div className="space-y-4">
            {/* Desktop / Tablet Table View (Hidden on mobile) */}
            <div className="hidden md:block bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                      <th className="py-3.5 pl-6 pr-4 text-[#243447]">Applicant</th>
                      <th className="py-3.5 px-4 text-[#243447]">Property / Unit</th>
                      <th className="py-3.5 px-4 text-[#243447]">Application Date</th>
                      <th className="py-3.5 px-4 text-[#243447]">Preferred Move-In</th>
                      <th className="py-3.5 px-4 text-[#243447]">Monthly Rent</th>
                      <th className="py-3.5 px-4 text-[#243447]">Status</th>
                      <th className="py-3.5 pl-4 pr-6 text-right text-[#243447]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E6] text-sm">
                    {filteredApplications.map((app) => (
                      <tr
                        key={app.applicationId}
                        className="hover:bg-[#F7F8FA]/60 transition-colors"
                      >
                        {/* 1. Applicant (Prominent) */}
                        <td className="py-4 pl-6 pr-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[#243447]">
                                {app.tenantName || 'Applicant'}
                              </p>
                              <span className="font-mono text-[10px] text-[#5B6875] bg-[#F0F4F7] px-1.5 py-0.2 rounded border border-[#D9E0E6]">
                                #{app.applicationId}
                              </span>
                            </div>
                            {app.tenantEmail && (
                              <p className="text-xs text-[#5B6875] flex items-center gap-1">
                                <Mail className="w-3 h-3 text-[#98A2B3] shrink-0" />
                                <span>{app.tenantEmail}</span>
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 2. Property / Unit */}
                        <td className="py-4 px-4 min-w-[200px]">
                          <div className="space-y-0.5">
                            <p className="font-medium text-[#243447] flex items-center gap-1.5 truncate">
                              <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                              <span className="truncate">
                                {app.propertyName || `Property #${app.propertyId}`}
                              </span>
                            </p>
                            <p className="text-xs text-[#5B6875] pl-5">
                              Unit {app.unitNumber || (app.unitId ? `#${app.unitId}` : '—')}
                              {app.buildingName ? ` · ${app.buildingName}` : ''}
                            </p>
                          </div>
                        </td>

                        {/* 3. Application Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#98A2B3] shrink-0" />
                            <span className="font-medium text-[#243447]">
                              {formatDate(app.applicationDate || app.createdAt)}
                            </span>
                          </div>
                        </td>

                        {/* 4. Preferred Move-In */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#98A2B3] shrink-0" />
                            <span>
                              {app.preferredMoveInDate ? formatDate(app.preferredMoveInDate) : 'Flexible'}
                            </span>
                          </div>
                        </td>

                        {/* 5. Monthly Rent */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {app.monthlyRent != null ? (
                            <span className="font-semibold text-[#243447] text-xs sm:text-sm">
                              {formatCurrency(app.monthlyRent)}
                              <span className="text-xs text-[#5B6875] font-normal"> / mo</span>
                            </span>
                          ) : (
                            <span className="text-[#5B6875] text-xs">—</span>
                          )}
                        </td>

                        {/* 6. Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <StatusBadge status={app.status} size="sm" />
                        </td>

                        {/* 7. Action */}
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                          <Link to={`/manager/applications/${app.applicationId}`}>
                            <Button
                              size="sm"
                              variant="secondary"
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View (Visible only on mobile screens < md) */}
            <div className="md:hidden space-y-3">
              {filteredApplications.map((app) => (
                <div
                  key={app.applicationId}
                  className="bg-white rounded-lg border border-[#D9E0E6] p-4 shadow-2xs space-y-3"
                >
                  {/* Card Header: Applicant & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-[#D9E0E6] pb-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[#243447] text-sm">
                          {app.tenantName || 'Applicant'}
                        </p>
                        <span className="font-mono text-[10px] text-[#5B6875] bg-[#F0F4F7] px-1.5 py-0.2 rounded border border-[#D9E0E6]">
                          #{app.applicationId}
                        </span>
                      </div>
                      {app.tenantEmail && (
                        <p className="text-xs text-[#5B6875] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#98A2B3] shrink-0" />
                          <span className="truncate max-w-[200px]">{app.tenantEmail}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={app.status} size="sm" />
                  </div>

                  {/* Card Body: Property, Unit, Dates & Rent */}
                  <div className="space-y-2 text-xs">
                    {/* Property & Unit */}
                    <div className="flex items-start gap-1.5 text-[#243447]">
                      <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {app.propertyName || `Property #${app.propertyId}`}
                        </p>
                        <p className="text-[#5B6875]">
                          Unit {app.unitNumber || (app.unitId ? `#${app.unitId}` : '—')}
                          {app.buildingName ? ` · ${app.buildingName}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9E0E6]/60">
                      <div>
                        <span className="text-[#5B6875] block text-[11px]">Applied</span>
                        <span className="font-medium text-[#243447]">
                          {formatDate(app.applicationDate || app.createdAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#5B6875] block text-[11px]">Move-In</span>
                        <span className="font-medium text-[#243447]">
                          {app.preferredMoveInDate ? formatDate(app.preferredMoveInDate) : 'Flexible'}
                        </span>
                      </div>
                    </div>

                    {/* Monthly Rent */}
                    <div className="pt-1 flex items-center justify-between border-t border-[#D9E0E6]/60">
                      <span className="text-[#5B6875] text-[11px]">Monthly Rent</span>
                      <span className="font-semibold text-[#243447]">
                        {app.monthlyRent != null ? formatCurrency(app.monthlyRent) + ' / mo' : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: View Details Action */}
                  <div className="pt-1">
                    <Link to={`/manager/applications/${app.applicationId}`} className="block">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
