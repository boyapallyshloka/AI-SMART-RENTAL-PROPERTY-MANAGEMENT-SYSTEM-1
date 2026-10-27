import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { getOwnerApplications, APPLICATION_STATUSES } from '../../api/applicationApi'
import { getMyProperties } from '../../api/propertyApi'
import {
  ROLES,
  normalizeRole,
  isPropertyManager,
  isPropertyOwner,
  isSuperAdmin,
  getDashboardPath,
} from '../../utils/roles'
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
  ShieldAlert,
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

// INR Currency Formatter
const formatInr = (amount) => {
  if (amount == null || isNaN(Number(amount))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ApplicationsPage() {
  const { user } = useAuth()
  const canonicalRole = normalizeRole(user?.role)

  // Route Guard: If a PROPERTY_MANAGER reaches this component, immediately redirect to /manager/applications
  // This prevents any call to GET /api/owner/properties from a manager session.
  if (canonicalRole === ROLES.PROPERTY_MANAGER) {
    return <Navigate to="/manager/applications" replace />
  }

  // If user is not an authorized Owner or Super Admin, redirect to their role dashboard
  if (user && canonicalRole !== ROLES.PROPERTY_OWNER && canonicalRole !== ROLES.SUPER_ADMIN) {
    return <Navigate to={getDashboardPath(canonicalRole)} replace />
  }

  const [properties, setProperties] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [propertyFilter, setPropertyFilter] = useState('ALL')

  // Load applications and properties from real backend
  const loadData = useCallback(async (isManualRefresh = false) => {
    // Only proceed if authenticated role is PROPERTY_OWNER or SUPER_ADMIN
    const role = normalizeRole(user?.role)
    if (role === ROLES.PROPERTY_MANAGER) {
      return
    }

    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    setErrorStatus(null)

    try {
      // 1. Fetch owner's properties for property filter
      const propRes = await getMyProperties()
      const propList = Array.isArray(propRes?.data)
        ? propRes.data
        : Array.isArray(propRes)
          ? propRes
          : []
      setProperties(propList)

      // 2. Fetch real applications for owner, passing known properties to avoid duplicate requests
      const appList = await getOwnerApplications(propList)
      const list = Array.isArray(appList) ? appList : []

      // Sort newest first by applicationId
      list.sort((a, b) => (b.applicationId || 0) - (a.applicationId || 0))
      setApplications(list)
    } catch (err) {
      console.error('Failed to load owner rental applications:', err)
      const status = err?.status || err?.response?.status
      setErrorStatus(status)

      if (status === 403) {
        setError(
          'Access restricted (403 Forbidden): Only registered Property Owners can access this view.'
        )
      } else if (status === 401) {
        setError('Your session has expired. Please sign in again.')
      } else {
        setError(
          err?.message ||
          'Unable to load rental applications from the server. Please check your connection and try again.'
        )
      }
      setApplications([])
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.role])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Status Filter Options
  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: APPLICATION_STATUSES.PENDING, label: 'Pending Review' },
    { value: APPLICATION_STATUSES.APPROVED, label: 'Approved' },
    { value: APPLICATION_STATUSES.REJECTED, label: 'Rejected' },
    { value: APPLICATION_STATUSES.WITHDRAWN, label: 'Withdrawn' },
    { value: APPLICATION_STATUSES.CANCELLED, label: 'Cancelled' },
  ]

  // Property Filter Options
  const propertyOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'All Properties' }]
    properties.forEach((p) => {
      const pId = p.propertyId || p.id
      if (pId) {
        opts.push({
          value: String(pId),
          label: p.name || p.title || `Property #${pId}`,
        })
      }
    })
    return opts
  }, [properties])

  // Filtered Applications List
  const filteredApplications = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return applications.filter((app) => {
      // Status Filter
      if (statusFilter !== 'ALL' && app.status !== statusFilter) {
        return false
      }

      // Property Filter
      if (
        propertyFilter !== 'ALL' &&
        String(app.propertyId) !== String(propertyFilter)
      ) {
        return false
      }

      // Search Query
      if (q !== '') {
        const matchesName = (app.tenantName || '').toLowerCase().includes(q)
        const matchesEmail = (app.tenantEmail || '').toLowerCase().includes(q)
        const matchesProp = (app.propertyName || '').toLowerCase().includes(q)
        const matchesBuilding = (app.buildingName || '')
          .toLowerCase()
          .includes(q)
        const matchesUnit = (app.unitNumber || '').toLowerCase().includes(q)
        const matchesId = String(app.applicationId || '').includes(q)

        if (
          !matchesName &&
          !matchesEmail &&
          !matchesProp &&
          !matchesBuilding &&
          !matchesUnit &&
          !matchesId
        ) {
          return false
        }
      }

      return true
    })
  }, [applications, searchQuery, statusFilter, propertyFilter])

  const hasActiveFilters =
    searchQuery !== '' || statusFilter !== 'ALL' || propertyFilter !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setPropertyFilter('ALL')
  }

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="applications"
      pageTitle="Applications"
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                Rental Applications
              </h1>
              {/* Only show Total Count badge if NO error occurred and not loading */}
              {!loading && !error && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                  {applications.length} Total
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Review and manage prospective tenant applications across your properties
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={loading || isRefreshing}
              leftIcon={
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              }
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-[#5B6875] mb-1.5 uppercase tracking-wide">
                Search Applications
              </label>
              <Input
                placeholder="Search by tenant name, email, property, unit, or #ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
                disabled={loading || !!error}
              />
            </div>

            <div>

              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={loading || !!error}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">

                <Select
                  options={propertyOptions}
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  disabled={loading || !!error}
                />
              </div>

              {hasActiveFilters && !error && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset all filters"
                  aria-label="Reset all filters"
                  className="p-2.5 mb-0.5 rounded-xl border border-[#D9E0E6] text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#5B6875] pt-2 border-t border-[#D9E0E6]">
            <span>
              {!error && !loading ? (
                <>
                  Showing{' '}
                  <strong className="text-[#243447]">
                    {filteredApplications.length}
                  </strong>{' '}
                  of {applications.length} applications
                </>
              ) : (
                'Applications list status'
              )}
            </span>
            {hasActiveFilters && !error && !loading && (
              <span className="text-[#315A7D] font-medium">
                Filters active &bull;{' '}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="underline hover:text-[#274B68]"
                >
                  Reset
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Main Content: Loading vs Error vs Empty vs Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading rental applications..." size="md" center />
          </div>
        ) : error ? (
          /* Dedicated Error State - NEVER display EmptyState when an API request fails! */
          <div className="bg-white rounded-2xl border border-[#F4B4B4] bg-[#FFF8F8] p-8 sm:p-12 shadow-xs text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FDF2F2] text-[#B94A48] mb-1">
              {errorStatus === 403 ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <AlertCircle className="w-8 h-8" />
              )}
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-[#243447]">
                {errorStatus === 403 ? 'Access Forbidden' : 'Failed to Load Applications'}
              </h3>
              <p className="text-sm text-[#8A2E2C] leading-relaxed">{error}</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => loadData(false)}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Retry Request
              </Button>
            </div>
          </div>
        ) : filteredApplications.length === 0 ? (
          /* Empty State - ONLY displayed when the API successfully returned zero records */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileCheck className="w-8 h-8 text-[#315A7D]" />}
              title={
                applications.length === 0
                  ? 'No rental applications'
                  : 'No matching applications'
              }
              message={
                applications.length === 0
                  ? 'You do not have any submitted rental applications for your properties yet.'
                  : 'No applications match your current search query or filter selection.'
              }
              action={
                hasActiveFilters
                  ? {
                    label: 'Reset Filters',
                    onClick: resetFilters,
                    variant: 'outline',
                  }
                  : undefined
              }
            />
          </div>
        ) : (
          /* Responsive Applications Table */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">Applicant</th>
                    <th className="py-3.5 px-4">Property / Unit</th>
                    <th className="py-3.5 px-4">Application Date</th>
                    <th className="py-3.5 px-4">Preferred Move-In</th>
                    <th className="py-3.5 px-4">Monthly Rent</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {filteredApplications.map((app) => (
                    <tr
                      key={app.applicationId}
                      className="hover:bg-[#F7F8FA] transition-colors"
                    >
                      {/* Applicant Name & Email */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#243447]">
                              {app.tenantName || 'Applicant'}
                            </span>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F0F4F8] text-[#5B6875] border border-[#D9E0E6]">
                              #{app.applicationId}
                            </span>
                          </div>
                          {app.tenantEmail && (
                            <div className="flex items-center gap-1 text-xs text-[#5B6875] mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{app.tenantEmail}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Property & Unit */}
                      <td className="py-4 px-4 min-w-[180px]">
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-[#243447] truncate">
                            <Building2 className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span className="truncate">{app.propertyName || 'Property'}</span>
                          </div>
                          <div className="text-xs text-[#5B6875] mt-0.5 flex items-center gap-1.5">
                            {app.buildingName && <span>{app.buildingName} &bull;</span>}
                            <span className="font-medium text-[#243447]">
                              Unit {app.unitNumber || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Application Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span>{formatDate(app.applicationDate || app.createdAt)}</span>
                        </div>
                      </td>

                      {/* Preferred Move-In */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                        {app.preferredMoveInDate ? formatDate(app.preferredMoveInDate) : 'Flexible'}
                      </td>

                      {/* Monthly Rent */}
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-[#243447]">
                        {formatInr(app.monthlyRent)}
                        <span className="text-xs text-[#5B6875] font-normal"> / mo</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge status={app.status} size="sm" />
                      </td>

                      {/* Actions: View Details */}
                      <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                        <Link to={`/owner/applications/${app.applicationId}`}>
                          <Button
                            size="sm"
                            variant="outline"
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
        )}
      </div>
    </DashboardLayout>
  )
}
