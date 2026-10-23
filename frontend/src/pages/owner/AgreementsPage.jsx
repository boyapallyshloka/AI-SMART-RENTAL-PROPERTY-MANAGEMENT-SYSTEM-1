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
import { createInvoice } from '../../api/invoiceApi'
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
  Receipt,
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
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState(null)

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
      const [agreementsRes, appsRes] = await Promise.allSettled([
        getAgreements(),
        user?.role === 'SUPER_ADMIN'
          ? getAllApplications()
          : getOwnerApplications(),
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
          unit: app?.unitNumber
            ? `Unit #${app.unitNumber}`
            : agr.unitId
            ? `Unit #${agr.unitId}`
            : 'Entire property',
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

  // Generate monthly rent invoice for an ACTIVE agreement
  const handleGenerateInvoiceForAgreement = async (agr) => {
    if (!agr || !agr.agreementId) return
    setGeneratingInvoiceId(agr.agreementId)

    try {
      const res = await createInvoice({ agreementId: agr.agreementId })
      const newInv = res?.data || res
      setSuccessMessage(
        `Rent invoice ${newInv?.invoiceNumber || ''} generated successfully for Agreement #${agr.agreementId}! You can view and manage it under Payments.`
      )
    } catch (err) {
      console.error('Failed to generate rent invoice:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to generate rent invoice for this agreement.'
      alert(msg)
    } finally {
      setGeneratingInvoiceId(null)
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
              Lease Agreements
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
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
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 sm:p-5 shadow-xs space-y-4">
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
                  className="p-2.5 rounded-lg border border-[#D9E0E6] text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#5B6875] pt-1 border-t border-[#D9E0E6]">
            <span>
              Showing{' '}
              <strong className="text-[#243447]">
                {filteredAgreements.length}
              </strong>{' '}
              of {agreements.length} lease agreements
            </span>
            {hasActiveFilters && (
              <span className="text-[#315A7D] font-medium">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading lease agreements..." size="md" center />
          </div>
        ) : filteredAgreements.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-[#315A7D]" />}
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
          <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">Agreement #</th>
                    <th className="py-3.5 px-4">Tenant</th>
                    <th className="py-3.5 px-4">Property &amp; Unit</th>
                    <th className="py-3.5 px-4">Term Dates</th>
                    <th className="py-3.5 px-4">Monthly Rent</th>
                    <th className="py-3.5 px-4">Deposit</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {filteredAgreements.map((agr) => {
                    const statusUpper = String(agr.status || '').toUpperCase()
                    const isDraft = statusUpper === 'DRAFT'
                    const isActive = statusUpper === 'ACTIVE'
                    const isUpdating = actionLoadingId === agr.agreementId

                    return (
                      <tr
                        key={agr.agreementId}
                        className="hover:bg-[#F7F8FA] transition-colors"
                      >
                        {/* Agreement Number */}
                        <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#315A7D] text-xs whitespace-nowrap">
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
                        <td className="py-4 px-4 whitespace-nowrap font-medium text-[#243447]">
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
                          <p className="font-semibold text-[#243447] text-xs truncate">
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

                        {/* Monthly Rent */}
                        <td className="py-4 px-4 whitespace-nowrap font-bold text-[#243447]">
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
                              className="p-1.5 rounded-md text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors cursor-pointer"
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
                                className="p-1.5 rounded-md text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors cursor-pointer"
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
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    isUpdating ||
                                    generatingInvoiceId === agr.agreementId
                                  }
                                  onClick={() =>
                                    handleGenerateInvoiceForAgreement(agr)
                                  }
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#C2D8E8] hover:bg-[#d6e7f4] transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                  title="Generate monthly rent invoice for this active agreement"
                                >
                                  {generatingInvoiceId === agr.agreementId ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-[#315A7D]" />
                                  ) : (
                                    <Receipt className="w-3 h-3 text-[#315A7D]" />
                                  )}
                                  <span>Generate Invoice</span>
                                </button>

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
                              </>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243447]/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#D9E0E6] bg-[#F7F8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#315A7D] text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[#243447]">
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
                  className="p-1.5 rounded-lg text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] transition-colors"
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
                  <div className="p-4 rounded-xl border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#315A7D]" />
                      Tenant Information
                    </span>
                    <p className="font-semibold text-base text-[#243447]">
                      {selectedDetails.tenantName || `Tenant #${selectedDetails.tenantId}`}
                    </p>
                    {selectedDetails.tenantEmail && (
                      <p className="text-xs text-[#5B6875]">{selectedDetails.tenantEmail}</p>
                    )}
                    <p className="text-xs text-[#5B6875]">
                      Tenant ID: #{selectedDetails.tenantId || '—'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#315A7D]" />
                      Rented Unit &amp; Property
                    </span>
                    <p className="font-semibold text-base text-[#243447]">
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
                <div className="rounded-xl border border-[#D9E0E6] p-4 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#315A7D]" />
                    Lease Schedule &amp; Term
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[#5B6875] block">Start Date</span>
                      <strong className="text-[#243447] text-sm font-semibold">
                        {formatDate(selectedDetails.startDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">End Date</span>
                      <strong className="text-[#243447] text-sm font-semibold">
                        {formatDate(selectedDetails.endDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Move-In Date</span>
                      <strong className="text-[#243447] text-sm font-semibold">
                        {formatDate(selectedDetails.moveInDate || selectedDetails.startDate)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Move-Out Date</span>
                      <strong className="text-[#243447] text-sm font-semibold">
                        {selectedDetails.moveOutDate
                          ? formatDate(selectedDetails.moveOutDate)
                          : 'Not recorded'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Section: Financials & Policy */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-[#D9E0E6] bg-white">
                    <span className="text-xs text-[#5B6875] block">Monthly Rent</span>
                    <p className="text-base font-bold text-[#243447] mt-0.5">
                      {formatCurrency(selectedDetails.monthlyRent)}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Due on day {selectedDetails.dueDay ?? '—'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#D9E0E6] bg-white">
                    <span className="text-xs text-[#5B6875] block">Security Deposit</span>
                    <p className="text-base font-bold text-[#243447] mt-0.5">
                      {formatCurrency(selectedDetails.securityDeposit)}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Refundable</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#D9E0E6] bg-white">
                    <span className="text-xs text-[#5B6875] block">Rent Due Day</span>
                    <p className="text-base font-bold text-[#243447] mt-0.5">
                      {selectedDetails.dueDay == null ? '—' : `Day ${selectedDetails.dueDay}`}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Of each month</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#D9E0E6] bg-white">
                    <span className="text-xs text-[#5B6875] block">Notice Period</span>
                    <p className="text-base font-bold text-[#243447] mt-0.5">
                      {selectedDetails.noticePeriodDays != null ? `${selectedDetails.noticePeriodDays} Days` : '30 Days'}
                    </p>
                    <span className="text-[10px] text-[#5B6875]">Before vacancy</span>
                  </div>
                </div>

                {/* Section: Terms and Conditions */}
                <div className="rounded-xl border border-[#D9E0E6] p-4 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    Terms &amp; Conditions / Special Provisions
                  </span>
                  <p className="text-xs text-[#243447] whitespace-pre-wrap leading-relaxed">
                    {selectedDetails.termsAndConditions ||
                      'Standard residential lease terms apply. Tenant agrees to comply with community guidelines and local rental ordinances.'}
                  </p>
                </div>

                {/* Section: Official Document */}
                <div className="rounded-xl border border-[#D9E0E6] bg-[#F7F8FA] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EAF2F7] text-[#315A7D] flex items-center justify-center border border-[#D9E0E6] shrink-0">
                      <FileCheck className="w-5 h-5 text-[#315A7D]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#243447]">
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
              <div className="p-4 border-t border-[#D9E0E6] bg-[#F7F8FA] flex items-center justify-between">
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
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={
                          generatingInvoiceId === selectedDetails.agreementId
                        }
                        onClick={() =>
                          handleGenerateInvoiceForAgreement(selectedDetails)
                        }
                        leftIcon={
                          generatingInvoiceId === selectedDetails.agreementId ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Receipt className="w-4 h-4" />
                          )
                        }
                      >
                        {generatingInvoiceId === selectedDetails.agreementId
                          ? 'Generating Invoice...'
                          : 'Generate Rent Invoice'}
                      </Button>

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
                    </>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243447]/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#D9E0E6] bg-[#F7F8FA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#243447] text-base">
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
                  className="p-1 rounded-lg text-[#5B6875] hover:text-[#243447]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmMoveOut} className="p-5 space-y-4">
                <p className="text-xs text-[#5B6875] leading-relaxed">
                  Recording the move-out will terminate this active lease agreement and automatically release{' '}
                  <strong className="text-[#243447]">{moveOutTarget.unit}</strong> back to vacant status.
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
