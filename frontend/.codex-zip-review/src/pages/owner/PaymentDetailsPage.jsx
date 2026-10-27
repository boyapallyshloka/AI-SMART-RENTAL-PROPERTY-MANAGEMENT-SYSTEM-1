import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getInvoiceById,
  INVOICE_STATUSES,
} from '../../api/invoiceApi'
import {
  getPaymentsByInvoice,
  getReceiptsByInvoice,
  downloadInvoiceReceipt,
} from '../../api/paymentApi'
import { getAgreements } from '../../api/agreementApi'
import { getOwnerApplications, getAllApplications } from '../../api/applicationApi'
import { formatCurrency } from '../../utils/currency'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  PrintableReceiptVoucher,
  IsolatedPrintReceiptPortal,
} from '../../components/common/PrintableReceiptVoucher'
import {
  ArrowLeft,
  User,
  Building2,
  Calendar,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  Info,
  RefreshCw,
  FileText,
  Receipt,
  History,
  Printer,
  Eye,
  ShieldCheck,
  Check,
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

// DateTime formatter for transactions
const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(dateStr)
  }
}

// Month name helper
const formatMonthYear = (month, year) => {
  if (!month || !year) return '—'
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

// Standardized error extractor
const extractErrorMessage = (err, fallback = 'An unexpected error occurred.') => {
  if (!err) return fallback
  if (err.response) {
    const status = err.response.status
    const serverMsg =
      err.response.data?.message ||
      err.response.data?.error ||
      (typeof err.response.data === 'string' ? err.response.data : null)
    if (serverMsg && typeof serverMsg === 'string' && serverMsg.trim()) {
      return serverMsg
    }
    if (status === 400) return 'Invalid invoice request details.'
    if (status === 401) return 'Session expired. Please log in again.'
    if (status === 403) return 'You are not authorized to view this invoice.'
    if (status === 404) return 'The requested invoice was not found.'
    if (status === 409) return 'Conflict with invoice records.'
    return `Server returned error (${status}). Please try again.`
  }
  if (err.request) {
    return 'Unable to reach the server. Please check your network connection.'
  }
  return err.message || fallback
}

export default function PaymentDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()

  // Role & Path awareness
  const isManager =
    location.pathname.startsWith('/manager') ||
    user?.role === 'PROPERTY_MANAGER'
  const portalRole = isManager ? 'manager' : 'owner'
  const basePath = isManager ? '/manager' : '/owner'

  const [invoice, setInvoice] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [error, setError] = useState(null)
  const [noticeMessage, setNoticeMessage] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // Receipt Records & Print Modal State
  const [receipts, setReceipts] = useState([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [receiptsError, setReceiptsError] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  const loadInvoiceData = useCallback(async () => {
    setLoading(true)
    setLoadingReceipts(true)
    setError(null)
    setReceiptsError(null)

    try {
      // 1. Fetch real invoice, payment transactions, receipts, agreements, and applications
      const [invoiceRes, txnsRes, receiptsRes, agreementsRes, appsRes] = await Promise.allSettled([
        getInvoiceById(id),
        getPaymentsByInvoice(id),
        getReceiptsByInvoice(id),
        getAgreements(),
        user?.role === 'SUPER_ADMIN'
          ? getAllApplications()
          : getOwnerApplications(),
      ])

      if (invoiceRes.status === 'rejected') {
        throw invoiceRes.reason
      }

      const rawInvoice = invoiceRes.value?.data || invoiceRes.value

      if (!rawInvoice) {
        setInvoice(null)
        return
      }

      // Process Transactions
      if (txnsRes.status === 'fulfilled') {
        const rawTxns = Array.isArray(txnsRes.value)
          ? txnsRes.value
          : txnsRes.value?.data || []
        setTransactions(rawTxns)
      } else {
        setTransactions([])
      }

      // Process Receipts (backend filters access by role/property)
      if (receiptsRes.status === 'fulfilled') {
        const rawReceipts = Array.isArray(receiptsRes.value)
          ? receiptsRes.value
          : receiptsRes.value?.data || []
        setReceipts(rawReceipts)
        setReceiptsError(null)
      } else {
        setReceipts([])
        setReceiptsError(
          extractErrorMessage(
            receiptsRes.reason,
            'Failed to load official receipt records for this invoice.'
          )
        )
      }

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

      // Build lookups
      const agr = rawAgreements.find(
        (a) => Number(a.agreementId) === Number(rawInvoice.agreementId)
      )
      const app = agr?.applicationId
        ? rawApps.find((a) => Number(a.applicationId) === Number(agr.applicationId))
        : null

      // Combine real details
      const enriched = {
        ...rawInvoice,
        id: rawInvoice.invoiceId,
        agreementNumber: agr
          ? `AGR-${String(agr.agreementId).padStart(4, '0')}`
          : `AGR-${rawInvoice.agreementId}`,
        tenantName:
          app?.tenantName ||
          (rawInvoice.tenantId ? `Tenant #${rawInvoice.tenantId}` : null),
        tenantEmail: app?.tenantEmail || null,
        propertyName: app?.propertyName || null,
        buildingName: app?.buildingName || null,
        unitNumber: app?.unitNumber
          ? `Unit #${app.unitNumber}`
          : rawInvoice.unitId
          ? `Unit #${rawInvoice.unitId}`
          : '—',
        rentAmount: rawInvoice.rentAmount == null ? null : Number(rawInvoice.rentAmount),
        lateFee: rawInvoice.lateFee == null ? null : Number(rawInvoice.lateFee),
        totalAmount: rawInvoice.totalAmount == null ? null : Number(rawInvoice.totalAmount),
        totalPaid: rawInvoice.totalPaid == null ? null : Number(rawInvoice.totalPaid),
        remainingAmount:
          rawInvoice.remainingAmount != null
            ? Number(rawInvoice.remainingAmount)
            : rawInvoice.totalAmount != null && rawInvoice.totalPaid != null
            ? Math.max(0, Number(rawInvoice.totalAmount) - Number(rawInvoice.totalPaid))
            : null,
        status: rawInvoice.status ?? null,
      }

      setInvoice(enriched)
    } catch (err) {
      console.error('Failed to load invoice details:', err)
      setError(extractErrorMessage(err, 'Failed to load invoice details from the server.'))
    } finally {
      setLoading(false)
      setLoadingReceipts(false)
    }
  }, [id, user?.role])

  // Dedicated receipt refresh callback
  const loadReceipts = useCallback(async () => {
    if (!id) return
    setLoadingReceipts(true)
    setReceiptsError(null)
    try {
      const res = await getReceiptsByInvoice(id)
      const list = Array.isArray(res) ? res : res?.data || []
      setReceipts(list)
    } catch (err) {
      console.error('Failed to load receipts for invoice:', err)
      setReceipts([])
      setReceiptsError(
        extractErrorMessage(err, 'Failed to load official receipt records for this invoice.')
      )
    } finally {
      setLoadingReceipts(false)
    }
  }, [id])

  useEffect(() => {
    loadInvoiceData()
  }, [loadInvoiceData])

  // Authenticated PDF Download
  const handleDownloadInvoice = async () => {
    if (!invoice?.invoiceDocument) {
      setNoticeMessage('No PDF statement has been generated for this invoice.')
      setTimeout(() => setNoticeMessage(''), 3500)
      return
    }

    setIsDownloading(true)
    try {
      await downloadInvoiceReceipt(
        invoice.invoiceDocument,
        `Invoice-${invoice.invoiceNumber || invoice.invoiceId}.pdf`
      )
    } catch (err) {
      console.error('Authenticated download failed:', err)
      setNoticeMessage(err?.message || 'Failed to download invoice PDF. Please try again.')
      setTimeout(() => setNoticeMessage(''), 3500)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole={portalRole}
      activeItem="payments"
      pageTitle={invoice ? `Invoice: ${invoice.invoiceNumber}` : 'Payment Details'}
    >
      <div className="space-y-6">
        {/* Back Button */}
        <div>
          <Link to={`${basePath}/payments`}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Payments
            </Button>
          </Link>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading payment invoice details..." size="md" center />
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
              title="Error Loading Invoice"
              message={error}
              action={{
                label: 'Retry',
                onClick: loadInvoiceData,
                variant: 'primary',
              }}
            />
          </div>
        ) : !invoice ? (
          /* Not Found State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileCheck className="w-8 h-8" />}
              title="Invoice Not Found"
              message={`No payment invoice record matching ID "${id}" could be located.`}
              action={
                <Link to={`${basePath}/payments`}>
                  <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back to Payments
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/* Notice Banner */}
            {noticeMessage && (
              <div className="p-4 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] text-[#315A7D] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#315A7D] shrink-0" />
                  <span>{noticeMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNoticeMessage('')}
                  className="text-[#315A7D] hover:text-[#274B68] font-bold px-1"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447] font-mono">
                      {invoice.invoiceNumber}
                    </h1>
                    <StatusBadge status={invoice.status} size="md" />
                  </div>
                  <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
                    Billing Period: <strong className="text-[#243447]">{formatMonthYear(invoice.billingMonth, invoice.billingYear)}</strong> &bull; Agreement {invoice.agreementNumber}
                  </p>
                </div>

                {/* Actions: Download Invoice PDF */}
                {invoice.invoiceDocument && (
                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isDownloading}
                      leftIcon={
                        isDownloading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )
                      }
                      onClick={handleDownloadInvoice}
                    >
                      {isDownloading ? 'Downloading...' : 'Download Invoice PDF'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Timeline */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <Clock className="w-4 h-4 text-[#315A7D]" />
                Invoice Timeline &amp; Status
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Step 1: Invoice Created */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1.5 relative">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#3F7D58] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-[#243447]">
                      Invoice Date
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6875] pl-8">
                    {formatDate(invoice.invoiceDate)}
                  </p>
                </div>

                {/* Step 2: Due Date */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1.5 relative">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#315A7D] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-[#243447]">
                      Payment Due Date
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6875] pl-8">
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>

                {/* Step 3: Paid, Overdue, or Pending */}
                <div
                  className={`p-4 rounded-xl border space-y-1.5 relative ${
                    String(invoice.status).toUpperCase() === 'PAID'
                      ? 'bg-[#EDF7EE] border-[#C6DEC8]'
                      : String(invoice.status).toUpperCase() === 'OVERDUE'
                      ? 'bg-[#FDF2F2] border-[#F4B4B4]'
                      : 'bg-[#FEF7EC] border-[#F4E2B6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 ${
                        String(invoice.status).toUpperCase() === 'PAID'
                          ? 'bg-[#3F7D58]'
                          : String(invoice.status).toUpperCase() === 'OVERDUE'
                          ? 'bg-[#B94A48]'
                          : 'bg-[#B7791F]'
                      }`}
                    >
                      {String(invoice.status).toUpperCase() === 'PAID' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : String(invoice.status).toUpperCase() === 'OVERDUE' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        String(invoice.status).toUpperCase() === 'PAID'
                          ? 'text-[#2A583B]'
                          : String(invoice.status).toUpperCase() === 'OVERDUE'
                          ? 'text-[#8A2E2C]'
                          : 'text-[#8A5B16]'
                      }`}
                    >
                      {String(invoice.status).toUpperCase() === 'PAID'
                        ? 'Payment Received'
                        : String(invoice.status).toUpperCase() === 'OVERDUE'
                        ? 'Payment Overdue'
                        : String(invoice.status).toUpperCase() === 'PARTIALLY_PAID'
                        ? 'Partially Paid'
                        : 'Awaiting Settlement'}
                    </span>
                  </div>
                  <p
                    className={`text-xs pl-8 ${
                      String(invoice.status).toUpperCase() === 'PAID'
                        ? 'text-[#2A583B]'
                        : String(invoice.status).toUpperCase() === 'OVERDUE'
                        ? 'text-[#8A2E2C]'
                        : 'text-[#8A5B16]'
                    }`}
                  >
                    {String(invoice.status).toUpperCase() === 'PAID'
                      ? 'Fully settled'
                      : String(invoice.status).toUpperCase() === 'OVERDUE'
                      ? `Past due since ${formatDate(invoice.dueDate)}`
                      : `Due on ${formatDate(invoice.dueDate)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tenant & Lease Premise Information */}
              <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                  <User className="w-4 h-4 text-[#315A7D]" />
                  Tenant &amp; Lease Premise
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Tenant Name</span>
                    <span className="font-semibold text-[#243447]">
                      {invoice.tenantName}
                    </span>
                  </div>

                  {invoice.tenantEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875]">Email</span>
                      <span className="text-xs text-[#243447]">
                        {invoice.tenantEmail}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#5B6875]" /> Property
                    </span>
                    <span className="font-medium text-[#243447] text-right">
                      {invoice.propertyName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Unit</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#F7F8FA] text-[#243447] border border-[#D9E0E6]">
                      {invoice.unitNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#5B6875]" /> Agreement Reference
                    </span>
                    <Link
                      to={`${basePath}/agreements`}
                      className="font-medium text-[#315A7D] hover:underline"
                    >
                      {invoice.agreementNumber}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Financial & Fee Breakdown */}
              <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                  <IndianRupee className="w-4 h-4 text-[#3F7D58]" />
                  Financial Breakdown
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Monthly Rent</span>
                    <span className="font-medium text-[#243447]">
                      {formatCurrency(invoice.rentAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Late Fee</span>
                    <span
                      className={`font-medium ${
                        Number(invoice.lateFee || 0) > 0
                          ? 'text-[#B94A48] font-semibold'
                          : 'text-[#243447]'
                      }`}
                    >
                      {formatCurrency(invoice.lateFee)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#D9E0E6]">
                    <span className="text-xs font-semibold text-[#243447]">
                      Total Invoiced Amount
                    </span>
                    <span className="text-lg font-bold text-[#243447]">
                      {formatCurrency(invoice.totalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Total Paid</span>
                    <span className="font-semibold text-[#2A583B]">
                      {formatCurrency(invoice.totalPaid)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-[#D9E0E6]">
                    <span className="text-xs font-semibold text-[#B94A48]">
                      Remaining Balance Due
                    </span>
                    <span className="text-base font-bold text-[#B94A48]">
                      {formatCurrency(invoice.remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Transactions History Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#315A7D]" />
                  Recorded Payment Transactions
                </h2>
                <span className="text-xs text-[#5B6875]">
                  {transactions.length} recorded {transactions.length === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center bg-[#F7F8FA] rounded-xl border border-dashed border-[#D9E0E6]">
                  <Receipt className="w-8 h-8 text-[#5B6875] mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-[#243447]">
                    No Payment Transactions Recorded
                  </p>
                  <p className="text-[11px] text-[#5B6875] mt-1">
                    No transactions have been submitted or confirmed by the tenant for this invoice yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#D9E0E6] rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D9E0E6] text-[11px] font-bold uppercase text-[#5B6875]">
                        <th className="py-3 px-4">Transaction ID</th>
                        <th className="py-3 px-4">Date &amp; Time</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4 text-right">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E0E6]">
                      {transactions.map((txn) => (
                        <tr key={txn.paymentId} className="hover:bg-[#F7F8FA]">
                          <td className="py-3 px-4 font-mono font-semibold text-[#315A7D]">
                            #{txn.paymentId}
                          </td>
                          <td className="py-3 px-4 text-[#5B6875]">
                            {formatDateTime(txn.paymentDate || txn.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#243447]">
                            {txn.paymentMethod || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#243447]">
                            {formatCurrency(txn.amount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <StatusBadge
                              status={txn.paymentStatus}
                              size="sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Official Payment Receipts Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#315A7D]" />
                  <h2 className="text-base font-semibold text-[#243447]">
                    Official Payment Receipts
                  </h2>
                  <span className="text-xs font-semibold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                    {receipts.length} {receipts.length === 1 ? 'receipt record' : 'receipt records'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadReceipts}
                  disabled={loadingReceipts}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingReceipts ? 'animate-spin text-[#315A7D]' : ''}`} />}
                >
                  Refresh Receipts
                </Button>
              </div>

              {/* Loading State */}
              {loadingReceipts ? (
                <div className="p-8 flex justify-center">
                  <Loader text="Loading receipt records..." size="sm" center />
                </div>
              ) : receiptsError ? (
                /* Error State */
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{receiptsError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadReceipts}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Retry
                  </Button>
                </div>
              ) : receipts.length === 0 ? (
                /* Empty State */
                <div className="p-8 text-center bg-[#F7F8FA] rounded-xl border border-dashed border-[#D9E0E6]">
                  <Receipt className="w-8 h-8 text-[#5B6875] mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-[#243447]">
                    No Payment Receipts Found
                  </p>
                  <p className="text-[11px] text-[#5B6875] mt-1 max-w-sm mx-auto">
                    No official payment receipts have been generated for this invoice yet. Receipts are generated automatically upon successful payment settlement.
                  </p>
                </div>
              ) : (
                /* Populated Receipts Table */
                <div className="overflow-x-auto border border-[#D9E0E6] rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-[#D9E0E6] text-[11px] font-bold uppercase text-[#5B6875]">
                        <th className="py-3 px-3">Receipt #</th>
                        <th className="py-3 px-3">Invoice #</th>
                        <th className="py-3 px-3">Tenant ID</th>
                        <th className="py-3 px-3">Unit ID</th>
                        <th className="py-3 px-3">Payment Date</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3">Amount Paid</th>
                        <th className="py-3 px-3">Remaining Balance</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E0E6]">
                      {receipts.map((rcp) => (
                        <tr key={rcp.receiptId} className="hover:bg-[#F7F8FA]">
                          {/* Receipt Number */}
                          <td className="py-3 px-3 font-mono font-semibold text-[#315A7D] whitespace-nowrap">
                            {rcp.receiptNumber || `REC-${rcp.receiptId}`}
                          </td>

                          {/* Invoice Number */}
                          <td className="py-3 px-3 font-mono text-[#243447] whitespace-nowrap">
                            {rcp.invoiceNumber || invoice.invoiceNumber || `#${rcp.invoiceId}`}
                          </td>

                          {/* Tenant ID */}
                          <td className="py-3 px-3 font-mono text-[#5B6875] whitespace-nowrap">
                            #{rcp.tenantId || invoice.tenantId || '—'}
                          </td>

                          {/* Unit ID */}
                          <td className="py-3 px-3 font-mono text-[#5B6875] whitespace-nowrap">
                            #{rcp.unitId || invoice.unitId || '—'}
                          </td>

                          {/* Payment Date */}
                          <td className="py-3 px-3 text-[#5B6875] whitespace-nowrap">
                            {formatDateTime(rcp.paymentDate || rcp.createdAt)}
                          </td>

                          {/* Method */}
                          <td className="py-3 px-3 font-medium text-[#243447] whitespace-nowrap">
                            {rcp.paymentMethod || '—'}
                          </td>

                          {/* Amount Paid */}
                          <td className="py-3 px-3 font-bold text-[#2A583B] whitespace-nowrap">
                            {formatCurrency(rcp.amountPaid)}
                          </td>

                          {/* Remaining Balance */}
                          <td className="py-3 px-3 font-semibold text-[#B94A48] whitespace-nowrap">
                            {formatCurrency(rcp.remainingAmount)}
                          </td>

                          {/* View & Print Action */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReceipt(rcp)}
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              View / Print
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* PRINTABLE RECEIPT VOUCHER MODAL                           */}
        {/* ========================================================= */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#D9E0E6] overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA] no-print">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#EAF2F7] text-[#315A7D]">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#243447]">
                      Official Payment Receipt
                    </h2>
                    <p className="text-xs text-[#5B6875]">
                      Receipt {selectedReceipt.receiptNumber || `REC-${selectedReceipt.receiptId}`} &bull; Invoice {selectedReceipt.invoiceNumber || invoice?.invoiceNumber || `#${selectedReceipt.invoiceId}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="text-[#5B6875] hover:text-[#243447] p-1.5 rounded-lg hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Print Toolbar */}
                <div className="flex items-center justify-end no-print pb-2 border-b border-[#D9E0E6]">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => window.print()}
                    leftIcon={<Printer className="w-4 h-4" />}
                  >
                    Print Receipt / Save PDF
                  </Button>
                </div>

                {/* The On-Screen Receipt Document */}
                <PrintableReceiptVoucher
                  receipt={selectedReceipt}
                  invoice={invoice}
                  tenantName={invoice?.tenantName}
                  tenantEmail={invoice?.tenantEmail}
                  tenantId={selectedReceipt.tenantId || invoice?.tenantId}
                  unitId={selectedReceipt.unitId || invoice?.unitId}
                  propertyName={invoice?.propertyName}
                  unitNumber={invoice?.unitNumber}
                  billingMonth={invoice?.billingMonth}
                  billingYear={invoice?.billingYear}
                  formatDateTime={formatDateTime}
                  formatMonthYear={formatMonthYear}
                  showIds={true}
                />

                {/* Isolated Print-Only Portal */}
                <IsolatedPrintReceiptPortal
                  receipt={selectedReceipt}
                  invoice={invoice}
                  tenantName={invoice?.tenantName}
                  tenantEmail={invoice?.tenantEmail}
                  tenantId={selectedReceipt.tenantId || invoice?.tenantId}
                  unitId={selectedReceipt.unitId || invoice?.unitId}
                  propertyName={invoice?.propertyName}
                  unitNumber={invoice?.unitNumber}
                  billingMonth={invoice?.billingMonth}
                  billingYear={invoice?.billingYear}
                  formatDateTime={formatDateTime}
                  formatMonthYear={formatMonthYear}
                  showIds={true}
                />
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA] no-print">
                <span className="text-[11px] text-[#5B6875]">
                  Use the Print button above to print or save this receipt as a PDF.
                </span>
                <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
