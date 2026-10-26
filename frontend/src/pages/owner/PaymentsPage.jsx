import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getInvoices,
  createInvoice,
  INVOICE_STATUSES,
} from '../../api/invoiceApi'
import { downloadInvoiceReceipt } from '../../api/paymentApi'
import { getAgreements } from '../../api/agreementApi'
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
  Search,
  RotateCcw,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Building2,
  Calendar,
  Info,
  RefreshCw,
  Plus,
  FileText,
  User,
  ExternalLink,
  Download,
  AlertCircle,
  X,
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

// Month name helper
const formatMonthYear = (month, year) => {
  if (!month || !year) return '—'
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function PaymentsPage() {
  const location = useLocation()
  const { user } = useAuth()

  // Role & Path awareness
  const isManager =
    location.pathname.startsWith('/manager') ||
    user?.role === 'PROPERTY_MANAGER'
  const portalRole = isManager ? 'manager' : 'owner'
  const basePath = isManager ? '/manager' : '/owner'

  const [invoices, setInvoices] = useState([])
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ''
  )

  // Generate Invoice Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedAgreementId, setSelectedAgreementId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null)

  // Load real backend invoices and metadata
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Fetch invoices, agreements, and applications concurrently
      const [invoicesRes, agreementsRes, appsRes] = await Promise.allSettled([
        getInvoices(),
        getAgreements(),
        user?.role === 'SUPER_ADMIN'
          ? getAllApplications()
          : getOwnerApplications(),
      ])

      if (invoicesRes.status === 'rejected') {
        throw invoicesRes.reason
      }

      const rawInvoices = Array.isArray(invoicesRes.value)
        ? invoicesRes.value
        : invoicesRes.value?.data || []

      const rawAgreements =
        agreementsRes.status === 'fulfilled'
          ? Array.isArray(agreementsRes.value)
            ? agreementsRes.value
            : agreementsRes.value?.data || []
          : []

      const rawApps =
        appsRes.status === 'fulfilled'
          ? Array.isArray(appsRes.value)
            ? appsRes.value
            : appsRes.value?.data || []
          : []

      // Build agreement & application lookup maps
      const agrMap = new Map()
      rawAgreements.forEach((agr) => {
        if (agr && agr.agreementId) {
          agrMap.set(Number(agr.agreementId), agr)
        }
      })

      const appMap = new Map()
      rawApps.forEach((app) => {
        if (app && app.applicationId) {
          appMap.set(Number(app.applicationId), app)
        }
      })

      const tenantMap = new Map()
      rawApps.forEach((app) => {
        if (app?.tenantId != null && app.tenantName) {
          tenantMap.set(Number(app.tenantId), app)
        }
      })

      // Store agreements for modal dropdown
      setAgreements(
        rawAgreements.map((agr) => {
          const app = agr.applicationId ? appMap.get(Number(agr.applicationId)) : null
          return {
            ...agr,
            tenantName: app?.tenantName || (agr.tenantId ? `Tenant #${agr.tenantId}` : null),
            propertyName: app?.propertyName || null,
            unitNumber: app?.unitNumber || agr.unitId || '',
          }
        })
      )

      // Enrich invoices with real display data
      const enriched = rawInvoices.map((inv) => {
        const agr = inv.agreementId ? agrMap.get(Number(inv.agreementId)) : null
        const app = agr?.applicationId ? appMap.get(Number(agr.applicationId)) : null

        return {
          ...inv,
          id: inv.invoiceId,
          agreementNumber: agr ? `AGR-${String(agr.agreementId).padStart(4, '0')}` : `AGR-${inv.agreementId}`,
          tenantName:
            inv.tenantName ||
            app?.tenantName ||
            tenantMap.get(Number(inv.tenantId))?.tenantName ||
            null,
          tenantEmail:
            inv.tenantEmail ||
            app?.tenantEmail ||
            tenantMap.get(Number(inv.tenantId))?.tenantEmail ||
            null,
          propertyName: app?.propertyName || null,
          unitNumber: app?.unitNumber
            ? `Unit #${app.unitNumber}`
            : inv.unitId
            ? `Unit #${inv.unitId}`
            : '—',
          amount: inv.totalAmount == null ? null : Number(inv.totalAmount),
          totalPaid: inv.totalPaid == null ? null : Number(inv.totalPaid),
          remainingAmount:
            inv.remainingAmount != null
              ? Number(inv.remainingAmount)
              : inv.totalAmount != null && inv.totalPaid != null
              ? Number(inv.totalAmount) - Number(inv.totalPaid)
              : null,
          status: inv.status ?? null,
        }
      })

      setInvoices(enriched)
    } catch (err) {
      console.error('Failed to load rent invoices:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load rent invoices from server.'
      )
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [user?.role])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Active agreements eligible for monthly invoicing
  const activeAgreements = useMemo(() => {
    return agreements.filter(
      (a) => String(a.status).toUpperCase() === 'ACTIVE'
    )
  }, [agreements])

  // Open Generate Invoice Modal
  const handleOpenCreateModal = () => {
    if (activeAgreements.length > 0) {
      setSelectedAgreementId(String(activeAgreements[0].agreementId))
    } else {
      setSelectedAgreementId('')
    }
    setGenerateError(null)
    setIsCreateModalOpen(true)
  }

  // Handle invoice creation via POST /api/rent-invoices
  const handleGenerateInvoice = async (e) => {
    e.preventDefault()
    if (!selectedAgreementId) {
      setGenerateError('Please select an active rental agreement')
      return
    }

    setIsGenerating(true)
    setGenerateError(null)

    try {
      const res = await createInvoice({ agreementId: selectedAgreementId })
      const newInv = res?.data || res
      setSuccessMessage(
        `Rent invoice ${newInv?.invoiceNumber || ''} generated successfully for Agreement #${selectedAgreementId}!`
      )
      setIsCreateModalOpen(false)
      await loadData(true)
    } catch (err) {
      console.error('Failed to generate invoice:', err)
      setGenerateError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to generate invoice for this agreement.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle authenticated invoice PDF download
  const handleDownloadInvoice = async (inv) => {
    if (!inv?.invoiceDocument) return
    setDownloadingInvoiceId(inv.invoiceId)
    try {
      await downloadInvoiceReceipt(
        inv.invoiceDocument,
        `Invoice-${inv.invoiceNumber || inv.invoiceId}.pdf`
      )
    } catch (err) {
      console.error('Authenticated download failed:', err)
      setError(err?.message || 'Failed to download invoice statement. Please try again.')
      setTimeout(() => setError(null), 5000)
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  // Calculate real summary metrics
  const sumKnownAmounts = (rows, getAmount) => {
    if (rows.length === 0) return 0
    const amounts = rows.map(getAmount)
    if (amounts.some((amount) => amount == null || !Number.isFinite(Number(amount)))) return null
    return amounts.reduce((sum, amount) => sum + Number(amount), 0)
  }
  const totalCollected = sumKnownAmounts(invoices, (inv) => inv.totalPaid)
  const pendingInvoices = invoices.filter((inv) =>
    ['PENDING', 'PARTIALLY_PAID'].includes(String(inv.status || '').toUpperCase())
  )
  const pendingRent = sumKnownAmounts(pendingInvoices, (inv) =>
    inv.remainingAmount ?? (String(inv.status).toUpperCase() === 'PENDING' ? inv.amount : null)
  )
  const overdueInvoices = invoices.filter((inv) => String(inv.status || '').toUpperCase() === 'OVERDUE')
  const overdueRent = sumKnownAmounts(overdueInvoices, (inv) =>
    inv.remainingAmount ?? inv.amount
  )

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: INVOICE_STATUSES.PENDING, label: 'Pending' },
    { value: INVOICE_STATUSES.PARTIALLY_PAID, label: 'Partially Paid' },
    { value: INVOICE_STATUSES.PAID, label: 'Paid' },
    { value: INVOICE_STATUSES.OVERDUE, label: 'Overdue' },
    { value: INVOICE_STATUSES.CANCELLED, label: 'Cancelled' },
  ]

  // Filter invoices by search and status
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        query === '' ||
        String(inv.invoiceNumber || '').toLowerCase().includes(query) ||
        String(inv.tenantName || '').toLowerCase().includes(query) ||
        String(inv.tenantEmail || '').toLowerCase().includes(query) ||
        String(inv.propertyName || '').toLowerCase().includes(query) ||
        String(inv.unitNumber || '').toLowerCase().includes(query) ||
        String(inv.agreementNumber || '').toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        String(inv.status).toUpperCase() === statusFilter.toUpperCase()

      return matchesSearch && matchesStatus
    })
  }, [invoices, searchQuery, statusFilter])

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <DashboardLayout
      defaultRole={portalRole}
      activeItem="payments"
      pageTitle="Payments"
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
              Rent Invoices &amp; Payments
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Track collected rent, generate monthly billing, and review balances across leased units
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

            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Generate Invoice
            </Button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {/* Total Collected Rent */}
          <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                Total Collected Rent
              </span>
              <div className="p-2.5 rounded-xl bg-[#EDF7EE] text-[#3F7D58]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#243447] tracking-tight">
                {formatCurrency(totalCollected)}
              </p>
              <p className="text-xs text-[#5B6875] mt-0.5">
                Total settlements recorded
              </p>
            </div>
          </div>

          {/* Pending Rent */}
          <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                Pending Rent
              </span>
              <div className="p-2.5 rounded-xl bg-[#FEF7EC] text-[#B7791F]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#B7791F] tracking-tight">
                {formatCurrency(pendingRent)}
              </p>
              <p className="text-xs text-[#5B6875] mt-0.5">
                Outstanding tenant dues
              </p>
            </div>
          </div>

          {/* Overdue Rent */}
          <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                Overdue Rent
              </span>
              <div className="p-2.5 rounded-xl bg-[#FDF2F2] text-[#B94A48]">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#B94A48] tracking-tight">
                {formatCurrency(overdueRent)}
              </p>
              <p className="text-xs text-[#5B6875] mt-0.5">
                Past due date
              </p>
            </div>
          </div>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search by invoice #, tenant, property, or agreement #..."
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
                {filteredInvoices.length}
              </strong>{' '}
              of {invoices.length} rent invoices
            </span>
            {hasActiveFilters && (
              <span className="text-[#315A7D] font-medium">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading payment invoices..." size="md" center />
          </div>
        ) : filteredInvoices.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<Receipt className="w-8 h-8 text-[#315A7D]" />}
              title="No invoices found"
              message={
                hasActiveFilters
                  ? 'No rent invoices match your current search query or status filter.'
                  : 'No rent invoices have been created yet. Generate monthly invoices for active rental agreements.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleOpenCreateModal}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Generate First Invoice
                  </Button>
                )
              }
            />
          </div>
        ) : (
          /* Invoices Table */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">Invoice #</th>
                    <th className="py-3.5 px-4">Billing Period</th>
                    <th className="py-3.5 px-4">Tenant</th>
                    <th className="py-3.5 px-4">Property &amp; Unit</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.invoiceId}
                      className="hover:bg-[#F7F8FA] transition-colors"
                    >
                      {/* Invoice Number */}
                      <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#315A7D] text-xs whitespace-nowrap">
                        <Link
                          to={`${basePath}/payments/${inv.invoiceId}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>

                      {/* Billing Period */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                        <span className="font-semibold text-[#243447]">
                          {formatMonthYear(inv.billingMonth, inv.billingYear)}
                        </span>
                      </td>

                      {/* Tenant Name */}
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-[#243447]">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <div>
                            <span>{inv.tenantName || '—'}</span>
                            {inv.tenantEmail && (
                              <p className="text-[11px] text-[#5B6875] font-normal truncate max-w-[150px]">
                                {inv.tenantEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Property & Unit */}
                      <td className="py-4 px-4 min-w-[180px]">
                        <p className="font-semibold text-[#243447] text-xs truncate">
                          {inv.propertyName}
                        </p>
                        <span className="text-xs text-[#5B6875]">
                          {inv.unitNumber}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span>{formatDate(inv.dueDate)}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 whitespace-nowrap font-bold text-[#243447]">
                        {formatCurrency(inv.amount)}
                        {inv.remainingAmount > 0 && inv.remainingAmount < inv.amount && (
                          <span className="block text-[11px] text-amber-700 font-normal">
                            Due: ₹{inv.remainingAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={inv.status} size="sm" />
                      </td>

                      {/* Actions */}
                      <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`${basePath}/payments/${inv.invoiceId}`}>
                            <Button size="sm" variant="outline">
                              Details
                            </Button>
                          </Link>

                          {inv.invoiceDocument && (
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(inv)}
                              disabled={downloadingInvoiceId === inv.invoiceId}
                              className="p-1.5 rounded-md text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors disabled:opacity-50"
                              title="Download official Invoice PDF"
                            >
                              {downloadingInvoiceId === inv.invoiceId ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-[#315A7D]" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generate Invoice Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243447]/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#D9E0E6] bg-[#F7F8FA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#315A7D] text-white flex items-center justify-center shadow-xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#243447] text-base">
                      Generate Monthly Rent Invoice
                    </h3>
                    <p className="text-xs text-[#5B6875]">
                      Create next billing statement for an active rental agreement
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isGenerating}
                  className="p-1 rounded-lg text-[#5B6875] hover:text-[#243447]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateInvoice} className="p-6 space-y-4">
                <p className="text-xs text-[#5B6875] leading-relaxed">
                  The backend automatically computes the next billing period, sets the due date matching the agreement schedule, and generates an official PDF invoice statement.
                </p>

                {generateError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{generateError}</span>
                  </div>
                )}

                {activeAgreements.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      No Active Agreements Available
                    </p>
                    <p>
                      Invoices can only be generated for ACTIVE rental agreements. Activate a drafted agreement first in Lease Agreements.
                    </p>
                    <Link
                      to={`${basePath}/agreements`}
                      className="inline-block text-xs font-semibold text-[#315A7D] hover:underline"
                    >
                      Go to Agreements &rarr;
                    </Link>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#243447] mb-1.5">
                      Select Active Rental Agreement <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={activeAgreements.map((a) => ({
                        value: String(a.agreementId),
                        label: `Agreement #${a.agreementId} — ${a.tenantName} (${a.propertyName} · Unit #${a.unitNumber || a.unitId})`,
                      }))}
                      value={selectedAgreementId}
                      onChange={(e) => setSelectedAgreementId(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D9E0E6]">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    isLoading={isGenerating}
                    disabled={isGenerating || activeAgreements.length === 0}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Generate Invoice
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
