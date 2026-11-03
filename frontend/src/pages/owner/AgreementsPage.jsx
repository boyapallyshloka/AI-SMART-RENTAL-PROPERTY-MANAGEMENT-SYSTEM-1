import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getAgreements,
  getAgreementById,
  getAgreementDocument,
  downloadAgreementDocument,
  updateAgreementStatus,
  updateAgreementMoveOut,
  AGREEMENT_STATUSES,
} from '../../api/agreementApi'
import { getInvoices } from '../../api/invoiceApi'
import { getOwnerApplications, getAllApplications } from '../../api/applicationApi'
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
  FileText,
  Plus,
  Search,
  RotateCcw,
  Building2,
  Calendar,
  IndianRupee,
  User,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  Clock,
  Shield,
  Eye,
  LogOut,
  X,
  FileCheck,
} from 'lucide-react'

// Date formatter
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

const getIndiaDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    year: Number(values.year),
    month: Number(values.month),
    hour: Number(values.hour),
  }
}

const addDays = (date, days) => {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

const formatDateOnly = (date) => {
  if (!date) return '—'
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const getNextInvoiceGenerationDate = (agreement, invoices, indiaNow) => {
  if (String(agreement.status || '').toUpperCase() !== 'ACTIVE') return null

  const startDate = agreement.startDate
  const endDate = agreement.endDate
  const dueDay = Number(agreement.dueDay)
  if (!startDate || !endDate || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return 'unavailable'
  }
  if (endDate < startDate) return null

  const [startYear, startMonth] = startDate.split('-').map(Number)
  const [endYear, endMonth] = endDate.split('-').map(Number)
  const currentPeriod = indiaNow.year * 12 + indiaNow.month - 1
  const startPeriod = startYear * 12 + startMonth - 1
  const endPeriod = endYear * 12 + endMonth - 1
  const scheduledDates = []

  for (let period = Math.max(currentPeriod, startPeriod); period <= endPeriod; period += 1) {
    if (period < startPeriod || period > endPeriod) continue

    const year = Math.floor(period / 12)
    const monthIndex = period % 12
    const month = monthIndex + 1
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    let dueDate = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(dueDay, daysInMonth)).padStart(2, '0')}`
    const billingPeriod = `${year}-${String(month).padStart(2, '0')}`

    if (billingPeriod === startDate.slice(0, 7) && dueDate < startDate) {
      dueDate = startDate
    }

    let generationDate = addDays(dueDate, -5)
    if (billingPeriod === startDate.slice(0, 7) && generationDate < startDate) {
      generationDate = startDate
    }

    const invoiceExists = invoices.some((invoice) =>
      Number(invoice.agreementId) === Number(agreement.agreementId)
      && Number(invoice.billingMonth) === month
      && Number(invoice.billingYear) === year
    )
    if (invoiceExists) continue

    // The backend checks eligible periods every day at 1:00 a.m. India time.
    const nextRunDate = generationDate > indiaNow.date
      ? generationDate
      : indiaNow.hour < 1
        ? indiaNow.date
        : addDays(indiaNow.date, 1)
    scheduledDates.push(nextRunDate)
  }

  return scheduledDates.sort()[0] || null
}

export default function AgreementsPage() {
  const location = useLocation()
  const { user } = useAuth()

  // Detect whether current view is within Manager Portal or Owner Portal
  const isManager =
    location.pathname.startsWith('/manager') ||
    user?.role === 'PROPERTY_MANAGER'
  const portalRole = isManager ? 'manager' : 'owner'
  const basePath = isManager ? '/manager' : '/owner'

  const [agreements, setAgreements] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceDataAvailable, setInvoiceDataAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ''
  )
  const [errorMessage, setErrorMessage] = useState(
    location.state?.errorMessage || ''
  )
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // Details Modal State
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Move-Out Modal State
  const [moveOutTarget, setMoveOutTarget] = useState(null)
  const [moveOutDateInput, setMoveOutDateInput] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [moveOutLoading, setMoveOutLoading] = useState(false)
  const [moveOutError, setMoveOutError] = useState(null)

  // Load real agreements and enrich with application metadata
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // 1. Fetch real agreements and applications concurrently
      const [agreementsRes, appsRes, invoicesRes] = await Promise.allSettled([
        getAgreements(),
        user?.role === 'SUPER_ADMIN'
          ? getAllApplications()
          : getOwnerApplications(),
        getInvoices(),
      ])

      if (agreementsRes.status === 'rejected') {
        throw agreementsRes.reason
      }

      const rawAgreements = Array.isArray(agreementsRes.value)
        ? agreementsRes.value
        : agreementsRes.value?.data || []

      const rawApps =
        appsRes.status === 'fulfilled'
          ? Array.isArray(appsRes.value)
            ? appsRes.value
            : appsRes.value?.data || []
          : []

      const rawInvoices = invoicesRes.status === 'fulfilled'
        ? Array.isArray(invoicesRes.value)
          ? invoicesRes.value
          : invoicesRes.value?.data || []
        : []
      setInvoices(rawInvoices)
      setInvoiceDataAvailable(invoicesRes.status === 'fulfilled')

      // 2. Build lookup map for application details (tenant name, property, unit)
      const appMap = new Map()
      rawApps.forEach((a) => {
        if (a && a.applicationId) {
          appMap.set(Number(a.applicationId), a)
        }
      })

      // 3. Enrich agreements with real display data
      const enriched = rawAgreements.map((agr) => {
        const app = agr.applicationId ? appMap.get(Number(agr.applicationId)) : null
        return {
          ...agr,
          id: agr.agreementId,
          agreementNumber: `AGR-${String(agr.agreementId).padStart(4, '0')}`,
          tenantName:
            app?.tenantName ||
            (agr.tenantId ? `Tenant #${agr.tenantId}` : null),
          tenantEmail: app?.tenantEmail || '',
          propertyName: app?.propertyName || agr.propertyName || null,
          buildingName: app?.buildingName || null,
          unit: ['HOUSE', 'VILLA'].includes(String(app?.propertyType || agr.propertyType || '').toUpperCase()) || (agr.unitId == null && agr.propertyId != null)
            ? 'Whole property'
            : app?.unitNumber
            ? `Unit #${app.unitNumber}`
            : agr.unitId
            ? `Unit #${agr.unitId}`
            : '—',
          status: agr.status ?? null,
        }
      })

      setAgreements(enriched)
    } catch (err) {
      console.error('Failed to load lease agreements:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load lease agreements from server.'
      )
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.role])

  const indiaNow = useMemo(() => getIndiaDateParts(), [agreements, invoices])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Open Details Modal with fresh GET /api/rental-agreements/{id} call
  const handleOpenDetails = async (agr) => {
    setSelectedDetails(agr)
    setDetailsLoading(true)
    try {
      const res = await getAgreementById(agr.agreementId)
      const fresh = res?.data || res
      if (fresh) {
        setSelectedDetails((prev) => ({
          ...prev,
          ...fresh,
          agreementNumber: `AGR-${String(fresh.agreementId || agr.agreementId).padStart(4, '0')}`,
        }))
      }
    } catch (err) {
      console.warn('Could not refresh full agreement details:', err)
    } finally {
      setDetailsLoading(false)
    }
  }

  // Handle document download via GET /api/rental-agreements/{agreementId}/document
  const handleDownloadDocument = async (agreementId) => {
    try {
      setActionLoadingId(agreementId)
      const blob = await getAgreementDocument(agreementId)
      if (!blob || blob.size === 0) {
        alert('Agreement document is currently unavailable.')
        return
      }
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/pdf' })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `rental-agreement-${agreementId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download agreement document:', err)
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to download agreement document.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  // Handle status update (e.g. Activate draft agreement)
  const handleStatusChange = async (agreementId, newStatus) => {
    try {
      setActionLoadingId(agreementId)
      await updateAgreementStatus(agreementId, newStatus)
      setSuccessMessage(
        `Agreement #${agreementId} status successfully changed to ${newStatus}.`
      )
      if (selectedDetails?.agreementId === agreementId) {
        setSelectedDetails((prev) => ({ ...prev, status: newStatus }))
      }
      await loadData(true)
    } catch (err) {
      console.error('Failed to update agreement status:', err)
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to update agreement status.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  // Open Move-Out modal
  const handleOpenMoveOutModal = (agr) => {
    setMoveOutTarget(agr)
    setMoveOutDateInput(new Date().toISOString().split('T')[0])
    setMoveOutError(null)
  }

  // Submit Move-Out date via PATCH /api/rental-agreements/{agreementId}/move-out
  const handleConfirmMoveOut = async (e) => {
    e.preventDefault()
    if (!moveOutTarget || !moveOutDateInput) return

    setMoveOutLoading(true)
    setMoveOutError(null)

    try {
      await updateAgreementMoveOut(moveOutTarget.agreementId, moveOutDateInput)
      setSuccessMessage(
        `Move-out date recorded for Agreement #${moveOutTarget.agreementId}. Status changed to TERMINATED and unit released.`
      )
      setMoveOutTarget(null)
      if (selectedDetails?.agreementId === moveOutTarget.agreementId) {
        setSelectedDetails(null)
      }
      await loadData(true)
    } catch (err) {
      console.error('Failed to record move-out:', err)
      setMoveOutError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to record move-out date.'
      )
    } finally {
      setMoveOutLoading(false)
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: AGREEMENT_STATUSES.DRAFT, label: 'Draft' },
    { value: AGREEMENT_STATUSES.ACTIVE, label: 'Active' },
    { value: AGREEMENT_STATUSES.EXPIRED, label: 'Expired' },
    { value: AGREEMENT_STATUSES.TERMINATED, label: 'Terminated' },
  ]

  const filteredAgreements = useMemo(() => {
    return agreements.filter((agr) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        query === '' ||
        String(agr.agreementNumber || '').toLowerCase().includes(query) ||
        String(agr.tenantName || '').toLowerCase().includes(query) ||
        String(agr.tenantEmail || '').toLowerCase().includes(query) ||
        String(agr.propertyName || '').toLowerCase().includes(query) ||
        String(agr.unit || '').toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        String(agr.status || '').toUpperCase() === statusFilter.toUpperCase()

      return matchesSearch && matchesStatus
    })
  }, [agreements, searchQuery, statusFilter])

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <DashboardLayout
      defaultRole={portalRole}
      activeItem="agreements"
      pageTitle="Agreements"
    >
      <div className="space-y-6">
        {/* Success Banner */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              className="text-[#2A583B] hover:text-[#1d3d29] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Message Banner from Navigation State */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-amber-800 hover:text-amber-950 font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111820]">
              Lease Agreements
            </h1>
            <p className="text-xs sm:text-sm text-[#111820] mt-1">
              Manage residential contracts, lease terms, rent schedules, and official documents
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => loadData(true)}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>

            <Link to={`${basePath}/agreements/new`}>
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                Create Agreement
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#E3E8DF] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search by agreement #, tenant, property, or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset filters"
                  aria-label="Reset filters"
                  className="p-2.5 rounded-lg border border-[#E3E8DF] text-[#5B6875] hover:text-[#111820] hover:bg-[#F7F7F1] transition-colors shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#5B6875] pt-1 border-t border-[#E3E8DF]">
            <span>
              Showing{' '}
              <strong className="text-[#111820]">
                {filteredAgreements.length}
              </strong>{' '}
              of {agreements.length} lease agreements
            </span>
            {hasActiveFilters && (
              <span className="text-[#3F7D58] font-medium">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E3E8DF] p-12 shadow-xs flex justify-center">
            <Loader text="Loading lease agreements..." size="md" center />
          </div>
        ) : filteredAgreements.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#E3E8DF] p-8 shadow-xs">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-[#3F7D58]" />}
              title="No lease agreements found"
              message={
                hasActiveFilters
                  ? 'No agreements match your search or filter criteria. Try clearing filters.'
                  : 'No lease agreements have been created yet. Generate an agreement from an approved rental application.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Link to={`${basePath}/agreements/new`}>
                    <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                      Create Agreement
                    </Button>
                  </Link>
                )
              }
            />
          </div>
        ) : (
          /* Agreements Table */
          <div className="bg-white rounded-2xl border border-[#E3E8DF] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E8DF] bg-[#F7F7F1] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">Agreement #</th>
                    <th className="py-3.5 px-4">Tenant</th>
                    <th className="py-3.5 px-4">Property &amp; Unit</th>
                    <th className="py-3.5 px-4">Term Dates</th>
                    <th className="py-3.5 px-4">Next Invoice Generation</th>
                    <th className="py-3.5 px-4">Monthly Rent</th>
                    <th className="py-3.5 px-4">Deposit</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8DF] text-sm">
                  {filteredAgreements.map((agr) => {
                    const statusUpper = String(agr.status || '').toUpperCase()
                    const isDraft = statusUpper === 'DRAFT'
                    const isActive = statusUpper === 'ACTIVE'
                    const isUpdating = actionLoadingId === agr.agreementId
                    const nextGenerationDate = invoiceDataAvailable
                      ? getNextInvoiceGenerationDate(agr, invoices, indiaNow)
                      : undefined

                    return (
                      <tr
                        key={agr.agreementId}
                        className="hover:bg-[#F7F7F1] transition-colors"
                      >
                        {/* Agreement Number */}
                        <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#3F7D58] text-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(agr)}
                            className="hover:underline cursor-pointer focus:outline-none"
                            title="Click to view full agreement details"
                          >
                            {agr.agreementNumber}
                          </button>
                        </td>

                        {/* Tenant */}
                        <td className="py-4 px-4 whitespace-nowrap font-medium text-[#111820]">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <div>
                              <span>{agr.tenantName}</span>
                              {agr.tenantEmail && (
                                <p className="text-[11px] text-[#5B6875] font-normal truncate max-w-[150px]">
                                  {agr.tenantEmail}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Property & Unit */}
                        <td className="py-4 px-4 min-w-[180px]">
                          <p className="font-semibold text-[#111820] text-xs truncate">
                            {agr.propertyName}
                          </p>
                          <span className="text-xs text-[#5B6875]">
                            {agr.unit}
                          </span>
                        </td>

                        {/* Term Dates */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span>
                              {formatDate(agr.startDate)} &rarr;{' '}
                              {formatDate(agr.endDate)}
                            </span>
                          </div>
                        </td>

                        {/* Next Automatic Invoice Generation */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          {nextGenerationDate === undefined ? (
                            <span title="Invoice records could not be loaded">Unavailable</span>
                          ) : nextGenerationDate === 'unavailable' ? (
                            <span title="The agreement is missing a valid due day or lease dates">Schedule unavailable</span>
                          ) : nextGenerationDate ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                              <div>
                                <span className="font-medium text-[#111820]">
                                  {formatDateOnly(nextGenerationDate)}
                                </span>
                                <span className="block text-[10px] text-[#5B6875]">
                                  1:00 AM IST
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span>{isActive ? 'No future invoice' : '—'}</span>
                          )}
                        </td>

                        {/* Monthly Rent */}
                        <td className="py-4 px-4 whitespace-nowrap font-bold text-[#111820]">
                          {formatCurrency(agr.monthlyRent)}/mo
                        </td>

                        {/* Security Deposit */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          {formatCurrency(agr.securityDeposit)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <StatusBadge status={agr.status} size="sm" />
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap text-xs">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(agr)}
                              className="p-1.5 rounded-md text-[#5B6875] hover:text-[#3F7D58] hover:bg-[#EDF4ED] transition-colors cursor-pointer"
                              title="View Agreement Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download PDF */}
                            {agr.agreementDocument && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  handleDownloadDocument(agr.agreementId)
                                }
                                className="p-1.5 rounded-md text-[#5B6875] hover:text-[#3F7D58] hover:bg-[#EDF4ED] transition-colors cursor-pointer"
                                title="Download Agreement PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}

                            {/* Activate (DRAFT -> ACTIVE) */}
                            {isDraft && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  handleStatusChange(agr.agreementId, 'ACTIVE')
                                }
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8] hover:bg-[#d9eedb] transition-colors cursor-pointer"
                                title="Activate lease agreement and mark unit occupied"
                              >
                                Activate
                              </button>
                            )}

                            {/* Record Move-Out (ACTIVE -> TERMINATED) */}
                            {isActive && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleOpenMoveOutModal(agr)}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Record move-out and terminate lease"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>Move Out</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Agreement Details Modal */}
        {selectedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111820]/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#E3E8DF] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#E3E8DF] bg-[#F7F7F1]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#3F7D58] text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[#111820]">
                        Agreement {selectedDetails.agreementNumber}
                      </h2>
                      <StatusBadge status={selectedDetails.status} size="sm" />
                    </div>
                    <p className="text-xs text-[#5B6875]">
                      System ID: #{selectedDetails.agreementId} &bull; Created{' '}
                      {formatDate(selectedDetails.createdAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDetails(null)}
                  className="p-1.5 rounded-lg text-[#5B6875] hover:text-[#111820] hover:bg-[#EDF4ED] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 text-sm">
                {detailsLoading && (
                  <div className="py-2 flex justify-center">
                    <Loader text="Refreshing agreement details..." size="sm" center />
                  </div>
                )}

                {/* Section: Parties & Premise */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#E3E8DF] bg-[#F7F7F1] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#3F7D58]" />
                      Tenant Information
                    </span>
                    <p className="font-semibold text-base text-[#111820]">
                      {selectedDetails.tenantName || `Tenant #${selectedDetails.tenantId}`}
                    </p>
                    {selectedDetails.tenantEmail && (
                      <p className="text-xs text-[#5B6875]">{selectedDetails.tenantEmail}</p>
                    )}
                    <p className="text-xs text-[#5B6875]">
                      Tenant ID: #{selectedDetails.tenantId || '—'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E3E8DF] bg-[#F7F7F1] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                      Rented Unit &amp; Property
                    </span>
                    <p className="font-semibold text-base text-[#111820]">
                      {selectedDetails.propertyName}
                    </p>
                    <p className="text-xs text-[#5B6875]">
                      {selectedDetails.unit}
                      {selectedDetails.buildingName ? ` &bull; ${selectedDetails.buildingName}` : ''}
                    </p>
                    <p className="text-xs text-[#5B6875]">
                      Unit ID: #{selectedDetails.unitId || '—'}
                    </p>
                  </div>
                </div>

                {/* Section: Term Dates & Schedule */}
                <div className="rounded-xl border border-[#E3E8DF] p-4 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#3F7D58]" />
                    Lease Schedule &amp; Term
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[#5B6875] block">Start Date</span>
                      <strong className="text-[#111820] text-sm font-semibold">
                        {formatDate(selectedDetails.startDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">End Date</span>
                      <strong className="text-[#111820] text-sm font-semibold">
                        {formatDate(selectedDetails.endDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Move-In Date</span>
                      <strong className="text-[#111820] text-sm font-semibold">
                        {formatDate(selectedDetails.moveInDate || selectedDetails.startDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Move-Out Date</span>
                      <strong className="text-[#111820] text-sm font-semibold">
                        {selectedDetails.moveOutDate
                          ? formatDate(selectedDetails.moveOutDate)
                          : 'Not recorded'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Section: Financials & Policy */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-[#E3E8DF] bg-white">
                    <span className="text-xs text-[#5B6875] block">Monthly Rent</span>
                    <p className="text-base font-bold text-[#111820] mt-0.5">
                      {formatCurrency(selectedDetails.monthlyRent)}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Due on day {selectedDetails.dueDay ?? '—'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#E3E8DF] bg-white">
                    <span className="text-xs text-[#5B6875] block">Security Deposit</span>
                    <p className="text-base font-bold text-[#111820] mt-0.5">
                      {formatCurrency(selectedDetails.securityDeposit)}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Refundable</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#E3E8DF] bg-white">
                    <span className="text-xs text-[#5B6875] block">Rent Due Day</span>
                    <p className="text-base font-bold text-[#111820] mt-0.5">
                      {selectedDetails.dueDay == null ? '—' : `Day ${selectedDetails.dueDay}`}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Of each month</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#E3E8DF] bg-white">
                    <span className="text-xs text-[#5B6875] block">Notice Period</span>
                    <p className="text-base font-bold text-[#111820] mt-0.5">
                      {selectedDetails.noticePeriodDays != null ? `${selectedDetails.noticePeriodDays} Days` : '30 Days'}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Before vacancy</span>
                  </div>
                </div>

                {/* Section: Terms and Conditions */}
                <div className="rounded-xl border border-[#E3E8DF] p-4 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    Terms &amp; Conditions / Special Provisions
                  </span>
                  <p className="text-xs text-[#111820] whitespace-pre-wrap leading-relaxed">
                    {selectedDetails.termsAndConditions ||
                      'Standard residential lease terms apply. Tenant agrees to comply with community guidelines and local rental ordinances.'}
                  </p>
                </div>

                {/* Section: Official Document */}
                <div className="rounded-xl border border-[#E3E8DF] bg-[#F7F7F1] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EDF4ED] text-[#3F7D58] flex items-center justify-center border border-[#E3E8DF] shrink-0">
                      <FileCheck className="w-5 h-5 text-[#3F7D58]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#111820]">
                        Official Lease Agreement PDF
                      </p>
                      <p className="text-xs text-[#5B6875]">
                        {selectedDetails.agreementDocument
                          ? 'Generated and stored securely on server'
                          : 'Document record is active'}
                      </p>
                    </div>
                  </div>

                  {selectedDetails.agreementDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(selectedDetails.agreementId)}
                      leftIcon={<Download className="w-4 h-4" />}
                    >
                      Download PDF
                    </Button>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-[#E3E8DF] bg-[#F7F7F1] flex items-center justify-between">
                <div>
                  {String(selectedDetails.status).toUpperCase() === 'DRAFT' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedDetails.agreementId, 'ACTIVE')
                      }}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Activate Agreement
                    </Button>
                  )}

                  {String(selectedDetails.status).toUpperCase() === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = { ...selectedDetails }
                        setSelectedDetails(null)
                        handleOpenMoveOutModal(target)
                      }}
                      leftIcon={<LogOut className="w-4 h-4" />}
                    >
                      Record Move-Out
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDetails(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Record Move-Out Modal */}
        {moveOutTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111820]/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#E3E8DF] shadow-xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#E3E8DF] bg-[#F7F7F1]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#111820] text-base">
                      Record Tenant Move-Out
                    </h3>
                    <p className="text-xs text-[#5B6875]">
                      Agreement #{moveOutTarget.agreementId} ({moveOutTarget.agreementNumber})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMoveOutTarget(null)}
                  disabled={moveOutLoading}
                  className="p-1 rounded-lg text-[#5B6875] hover:text-[#111820]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmMoveOut} className="p-5 space-y-4">
                <p className="text-xs text-[#5B6875] leading-relaxed">
                  Recording the move-out will terminate this active lease agreement and automatically release{' '}
                  <strong className="text-[#111820]">{moveOutTarget.unit}</strong> back to vacant status.
                </p>

                {moveOutError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{moveOutError}</span>
                  </div>
                )}

                <div>
                  <Input
                    label="Official Move-Out Date"
                    type="date"
                    value={moveOutDateInput}
                    onChange={(e) => setMoveOutDateInput(e.target.value)}
                    required
                    helperText="Date tenant vacated the rental premise"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setMoveOutTarget(null)}
                    disabled={moveOutLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    isLoading={moveOutLoading}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Confirm Move-Out
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
