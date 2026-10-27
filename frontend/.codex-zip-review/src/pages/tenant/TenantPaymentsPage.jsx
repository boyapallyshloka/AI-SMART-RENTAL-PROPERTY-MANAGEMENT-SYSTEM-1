import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import {
  getMyInvoices,
  INVOICE_STATUSES,
} from '../../api/invoiceApi'
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentsByInvoice,
  getReceiptsByInvoice,
  downloadInvoiceReceipt,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../../api/paymentApi'
import { getMyAgreements } from '../../api/agreementApi'
import { getMyApplications } from '../../api/applicationApi'
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
  PrintableReceiptVoucher,
  IsolatedPrintReceiptPortal,
} from '../../components/common/PrintableReceiptVoucher'
import {
  CreditCard,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  Calendar,
  Info,
  Download,
  RefreshCw,
  AlertCircle,
  FileText,
  History,
  X,
  ShieldCheck,
  Check,
  Printer,
  Eye,
  ArrowLeft,
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

// DateTime formatter for transaction history
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
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// Dynamically load Razorpay Checkout script if not already present
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
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
    if (status === 400) return 'Invalid payment details. Please check the amount and try again.'
    if (status === 401) return 'Session expired. Please log in again to process your payment.'
    if (status === 403) return 'You are not authorized to make payments for this invoice.'
    if (status === 404) return 'The requested invoice could not be located on the server.'
    if (status === 409) return 'Payment conflict: This invoice has already been updated or paid.'
    return `Server returned error (${status}). Please try again.`
  }
  if (err.request) {
    return 'Unable to reach the server. Please check your network connection.'
  }
  return err.message || fallback
}

export default function TenantPaymentsPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bannerNotice, setBannerNotice] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null)

  // Payment Settlement Modal State
  const [activePaymentInvoice, setActivePaymentInvoice] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState(null)

  // Payment History Modal State
  const [historyInvoice, setHistoryInvoice] = useState(null)
  const [historyPayments, setHistoryPayments] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  // Receipt Records & Print Modal State
  const [receiptModalInvoice, setReceiptModalInvoice] = useState(null)
  const [invoiceReceipts, setInvoiceReceipts] = useState([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [receiptsError, setReceiptsError] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  const tenantDisplayName =
    user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.name || 'Tenant'
  const tenantEmail = user?.email || ''

  // Load receipt records for a specific invoice
  const loadReceiptsForInvoice = useCallback(async (invoiceId) => {
    if (!invoiceId) return []
    setLoadingReceipts(true)
    setReceiptsError(null)
    try {
      const res = await getReceiptsByInvoice(invoiceId)
      const list = Array.isArray(res) ? res : res?.data || []
      setInvoiceReceipts(list)
      return list
    } catch (err) {
      console.error('Failed to load receipts for invoice:', err)
      setReceiptsError(
        extractErrorMessage(err, 'Failed to load official receipt records for this invoice.')
      )
      return []
    } finally {
      setLoadingReceipts(false)
    }
  }, [])

  const handleOpenReceiptsModal = async (inv) => {
    setReceiptModalInvoice(inv)
    setSelectedReceipt(null)
    await loadReceiptsForInvoice(inv.invoiceId)
  }

  const handleCloseReceiptsModal = () => {
    setReceiptModalInvoice(null)
    setInvoiceReceipts([])
    setReceiptsError(null)
    setSelectedReceipt(null)
  }

  // Load real invoices belonging to authenticated tenant
  const loadTenantInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Concurrently fetch tenant invoices, agreements, and applications
      const [invoicesRes, agreementsRes, appsRes] = await Promise.allSettled([
        getMyInvoices(),
        getMyAgreements(),
        getMyApplications(),
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

      const agrMap = new Map()
      rawAgreements.forEach((a) => {
        if (a && a.agreementId) {
          agrMap.set(Number(a.agreementId), a)
        }
      })

      const appMap = new Map()
      rawApps.forEach((a) => {
        if (a && a.applicationId) {
          appMap.set(Number(a.applicationId), a)
        }
      })

      // Enrich invoices with property and unit details
      const enriched = rawInvoices.map((inv) => {
        const agr = inv.agreementId ? agrMap.get(Number(inv.agreementId)) : null
        const app = agr?.applicationId ? appMap.get(Number(agr.applicationId)) : null

        return {
          ...inv,
          id: inv.invoiceId,
          propertyName: app?.propertyName || agr?.propertyName || inv.propertyName || null,
          unitNumber: app?.unitNumber
            ? `Unit #${app.unitNumber}`
            : inv.unitId
            ? `Unit #${inv.unitId}`
            : 'Entire property',
          amount: inv.totalAmount == null ? null : Number(inv.totalAmount),
          totalPaid: inv.totalPaid == null ? null : Number(inv.totalPaid),
          remainingAmount:
            inv.remainingAmount != null
              ? Number(inv.remainingAmount)
              : inv.totalAmount != null && inv.totalPaid != null
              ? Math.max(0, Number(inv.totalAmount) - Number(inv.totalPaid))
              : null,
          status: inv.status ?? null,
        }
      })

      setInvoices(enriched)
    } catch (err) {
      console.error('Failed to load tenant invoices:', err)
      setError(extractErrorMessage(err, 'Failed to load your rent invoices from the server.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTenantInvoices()
  }, [loadTenantInvoices])

  // Open Payment Settlement Modal
  const handleOpenPaymentModal = (inv) => {
    const due = inv.remainingAmount != null ? inv.remainingAmount : (inv.amount - inv.totalPaid)
    setActivePaymentInvoice(inv)
    setPaymentAmount(due > 0 ? String(due) : '0')
    setPaymentError(null)
  }

  // Close Payment Settlement Modal
  const handleClosePaymentModal = () => {
    if (isProcessingPayment) return // prevent close while in-flight
    setActivePaymentInvoice(null)
    setPaymentError(null)
  }

  // Handle Real Payment Submission via Razorpay Checkout
  const handleSubmitPayment = async (e) => {
    e.preventDefault()

    if (!activePaymentInvoice || isProcessingPayment) return

    const enteredAmount = Number(paymentAmount)
    const maxDue = Number(
      activePaymentInvoice.remainingAmount != null
        ? activePaymentInvoice.remainingAmount
        : activePaymentInvoice.amount - activePaymentInvoice.totalPaid
    )

    // 1. Validate the entered amount against the invoice's remaining balance
    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setPaymentError('Please enter a valid payment amount greater than zero.')
      return
    }

    if (enteredAmount > maxDue) {
      setPaymentError(
        `Payment amount cannot exceed the remaining balance of ₹${maxDue.toLocaleString('en-IN')}.`
      )
      return
    }

    setIsProcessingPayment(true)
    setPaymentError(null)

    // 2. Load Razorpay Checkout if not already available
    const isScriptLoaded = await loadRazorpayScript()
    if (!isScriptLoaded) {
      setPaymentError(
        'Unable to load Razorpay payment gateway. Please check your network connection and try again.'
      )
      setIsProcessingPayment(false)
      return
    }

    // Call createRazorpayOrder({ invoiceId, amount })
    let orderData
    try {
      const orderRes = await createRazorpayOrder({
        invoiceId: activePaymentInvoice.invoiceId,
        amount: enteredAmount,
      })
      orderData = orderRes?.data || orderRes
    } catch (orderErr) {
      console.error('Failed to create Razorpay order:', orderErr)
      setPaymentError(
        extractErrorMessage(
          orderErr,
          'Failed to initialize payment order with server. Please try again.'
        )
      )
      setIsProcessingPayment(false)
      return
    }

    if (!orderData || !orderData.orderId || !orderData.keyId) {
      setPaymentError('Invalid order details returned from the payment server.')
      setIsProcessingPayment(false)
      return
    }

    // Configure Checkout from backend order response
    const options = {
      key: orderData.keyId,
      order_id: orderData.orderId,
      currency: orderData.currency || 'INR',
      amount: Math.round(Number(orderData.amount) * 100), // convert rupees to paise
      name: 'SmartEstate',
      description: `Payment for Invoice #${activePaymentInvoice.invoiceNumber || activePaymentInvoice.invoiceId}`,
      prefill: {
        name:
          user?.name ||
          (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : ''),
        email: user?.email || '',
      },
      theme: {
        color: '#315A7D',
      },
      // 3. In Checkout's success handler, send parameters to verifyRazorpayPayment
      handler: async function (response) {
        try {
          const verifyRes = await verifyRazorpayPayment({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          })

          const verifiedPayment = verifyRes?.data || verifyRes
          const paymentId = verifiedPayment?.paymentId || response.razorpay_payment_id
          const updatedDue = Math.max(0, maxDue - enteredAmount)

          // 4. Show success and refresh tenant invoices & receipts only after backend verification succeeds
          const completedInvoice = activePaymentInvoice
          setActivePaymentInvoice(null)
          setSuccessNotice(
            `Payment of ₹${enteredAmount.toLocaleString('en-IN')} verified successfully (Txn #${paymentId}). Invoice status and remaining balance (₹${updatedDue.toLocaleString('en-IN')}) have been updated.`
          )
          await loadTenantInvoices()

          // Refresh receipt records for this invoice and display the newly generated receipt
          if (completedInvoice?.invoiceId) {
            setReceiptModalInvoice(completedInvoice)
            const refreshedReceipts = await loadReceiptsForInvoice(completedInvoice.invoiceId)
            if (refreshedReceipts && refreshedReceipts.length > 0) {
              const matched =
                refreshedReceipts.find(
                  (r) =>
                    String(r.paymentId) === String(paymentId) ||
                    r.razorpayPaymentId === response.razorpay_payment_id
                ) || refreshedReceipts[refreshedReceipts.length - 1]
              setSelectedReceipt(matched)
            }
          }
        } catch (verifyErr) {
          console.error('Payment verification failed on server:', verifyErr)
          // Verification failure must NEVER appear as a successful payment
          setPaymentError(
            extractErrorMessage(
              verifyErr,
              'Payment was authorized by gateway, but backend verification failed. Please contact management.'
            )
          )
        } finally {
          setIsProcessingPayment(false)
        }
      },
      modal: {
        ondismiss: function () {
          // Cancellation must NEVER appear as a successful payment
          setIsProcessingPayment(false)
          setPaymentError('Payment window was closed before completion.')
        },
      },
    }

    try {
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (failureResponse) {
        console.error('Razorpay payment failed:', failureResponse)
        // Checkout failure must NEVER appear as a successful payment
        setIsProcessingPayment(false)
        const reason =
          failureResponse?.error?.description ||
          failureResponse?.error?.reason ||
          'Payment failed at the gateway.'
        setPaymentError(`Payment failed: ${reason}`)
      })
      rzp.open()
    } catch (openErr) {
      console.error('Failed to open Razorpay Checkout:', openErr)
      setIsProcessingPayment(false)
      setPaymentError('Unable to open payment modal. Please try again.')
    }
  }

  // Open Payment Transaction History Modal
  const handleOpenHistoryModal = async (inv) => {
    setHistoryInvoice(inv)
    setLoadingHistory(true)
    setHistoryError(null)
    setHistoryPayments([])

    try {
      const res = await getPaymentsByInvoice(inv.invoiceId)
      const list = Array.isArray(res) ? res : res?.data || []
      setHistoryPayments(list)
    } catch (err) {
      console.error('Failed to load invoice payment history:', err)
      setHistoryError(
        extractErrorMessage(err, 'Failed to load transaction history for this invoice.')
      )
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleCloseHistoryModal = () => {
    setHistoryInvoice(null)
    setHistoryPayments([])
    setHistoryError(null)
  }

  // Handle Authenticated PDF Invoice/Receipt Download
  const handleDownloadInvoice = async (inv) => {
    if (!inv?.invoiceDocument) {
      setBannerNotice('No official PDF statement has been generated for this invoice.')
      setTimeout(() => setBannerNotice(''), 4000)
      return
    }

    setDownloadingInvoiceId(inv.invoiceId)
    try {
      await downloadInvoiceReceipt(
        inv.invoiceDocument,
        `Invoice-${inv.invoiceNumber || inv.invoiceId}.pdf`
      )
    } catch (err) {
      console.error('Authenticated download failed:', err)
      setBannerNotice(err?.message || 'Failed to download invoice statement. Please try again.')
      setTimeout(() => setBannerNotice(''), 4000)
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  // Summary Card calculations from real backend data
  const pendingInvoices = invoices.filter((inv) => {
    const st = String(inv.status).toUpperCase()
    return st === 'PENDING' || st === 'OVERDUE' || st === 'PARTIALLY_PAID'
  })

  const paidInvoices = invoices.filter(
    (inv) => String(inv.status).toUpperCase() === 'PAID'
  )

  const sumKnownAmounts = (rows, getAmount) => {
    if (rows.length === 0) return 0
    const values = rows.map(getAmount)
    if (values.some((amount) => amount == null || !Number.isFinite(Number(amount)))) return null
    return values.reduce((sum, amount) => sum + Number(amount), 0)
  }
  const totalPendingAmount = sumKnownAmounts(pendingInvoices, (inv) =>
    inv.remainingAmount ?? (String(inv.status).toUpperCase() === 'PENDING' ? inv.amount : null)
  )

  const totalPaidAmount = sumKnownAmounts(invoices, (inv) => inv.totalPaid)

  // Upcoming due: earliest pending/overdue due date
  const upcomingInvoice = [...pendingInvoices].sort(
    (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
  )[0]

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="payments"
      pageTitle="Payments"
    >
      <div className="space-y-6">
        {/* Success Notice Banner */}
        {successNotice && (
          <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice('')}
              className="text-[#2A583B] hover:text-[#1E432B] font-bold px-1 ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Informational Banner Notice */}
        {bannerNotice && (
          <div className="p-4 rounded-xl bg-[#EAF2F7] border border-[#C2D8E8] text-[#315A7D] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-[#315A7D] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{bannerNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerNotice('')}
              className="text-[#315A7D] hover:text-[#274B68] font-bold px-1 ml-2"
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
              onClick={loadTenantInvoices}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
              Rent Invoices &amp; Payments
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Review your monthly rent billing statements, pay dues, and track payment transactions
            </p>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={loadTenantInvoices}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading your billing invoices..." size="md" center />
          </div>
        ) : invoices.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<CreditCard className="w-8 h-8" />}
              title="No Payment Invoices Found"
              message="You do not currently have any active or past rent invoices associated with your account. Invoices are generated monthly once a rental agreement is activated."
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 3 Summary Cards: Upcoming Due, Pending Dues, Total Paid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Upcoming Due */}
              <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] block">
                    Upcoming Due
                  </span>
                  <div className="text-2xl font-bold text-[#243447] mt-1">
                    {upcomingInvoice
                      ? `₹${Number(upcomingInvoice.remainingAmount || upcomingInvoice.amount).toLocaleString('en-IN')}`
                      : '₹0'}
                  </div>
                  <span className="text-xs text-[#5B6875] block mt-0.5">
                    {upcomingInvoice
                      ? `Due: ${formatDate(upcomingInvoice.dueDate)}`
                      : 'No upcoming dues'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Pending Dues */}
              <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] block">
                    Pending Dues
                  </span>
                  <div className="text-2xl font-bold text-[#B94A48] mt-1">
                    {formatCurrency(totalPendingAmount)}
                  </div>
                  <span className="text-xs text-[#5B6875] block mt-0.5">
                    {pendingInvoices.length} outstanding {pendingInvoices.length === 1 ? 'invoice' : 'invoices'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FDF2F2] text-[#B94A48] border border-[#F4B4B4]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              {/* Total Paid */}
              <div className="rounded-2xl border border-[#D9E0E6] bg-white p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] block">
                    Total Paid
                  </span>
                  <div className="text-2xl font-bold text-[#3F7D58] mt-1">
                    {formatCurrency(totalPaidAmount)}
                  </div>
                  <span className="text-xs text-[#5B6875] block mt-0.5">
                    {paidInvoices.length} settled {paidInvoices.length === 1 ? 'invoice' : 'invoices'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#EDF7EE] text-[#3F7D58] border border-[#C6DEC8]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E0E6] flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-[#5B6875]">
                  Displaying{' '}
                  <strong className="text-[#243447]">
                    {invoices.length}
                  </strong>{' '}
                  rent billing records for {tenantDisplayName}
                </span>
                <span className="text-xs text-[#315A7D] font-medium">
                  {tenantEmail}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                      <th className="py-3.5 pl-6 pr-4">Invoice #</th>
                      <th className="py-3.5 px-4">Period</th>
                      <th className="py-3.5 px-4">Property &amp; Unit</th>
                      <th className="py-3.5 px-4">Due Date</th>
                      <th className="py-3.5 px-4">Total Amount</th>
                      <th className="py-3.5 px-4">Paid / Balance</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E6] text-sm">
                    {invoices.map((inv) => {
                      const isPaid = String(inv.status).toUpperCase() === 'PAID'
                      const isPartiallyPaid =
                        String(inv.status).toUpperCase() === 'PARTIALLY_PAID'
                      const isDownloading = downloadingInvoiceId === inv.invoiceId

                      return (
                        <tr
                          key={inv.invoiceId}
                          className="hover:bg-[#F7F8FA] transition-colors"
                        >
                          {/* Invoice Number */}
                          <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#315A7D] text-xs whitespace-nowrap">
                            {inv.invoiceNumber}
                          </td>

                          {/* Billing Period */}
                          <td className="py-4 px-4 whitespace-nowrap text-xs text-[#243447]">
                            {formatMonthYear(inv.billingMonth, inv.billingYear)}
                          </td>

                          {/* Property & Unit */}
                          <td className="py-4 px-4 min-w-[170px]">
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

                          {/* Total Amount */}
                          <td className="py-4 px-4 whitespace-nowrap font-bold text-[#243447]">
                            {formatCurrency(inv.amount)}
                          </td>

                          {/* Paid / Balance Due */}
                          <td className="py-4 px-4 whitespace-nowrap text-xs">
                            <span className="text-[#2A583B] font-semibold">
                              Paid: {formatCurrency(inv.totalPaid)}
                            </span>
                            {inv.remainingAmount > 0 ? (
                              <span className="block text-[#B94A48] font-bold mt-0.5">
                                Due: ₹{Number(inv.remainingAmount).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="block text-xs text-[#3F7D58] mt-0.5">
                                Zero balance
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <StatusBadge status={inv.status} size="sm" />
                          </td>

                          {/* Action Buttons */}
                          <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap text-xs">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Official Payment Receipts */}
                              <button
                                type="button"
                                onClick={() => handleOpenReceiptsModal(inv)}
                                className="p-1.5 rounded-lg text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors border border-transparent hover:border-[#D9E0E6]"
                                title="View payment receipts"
                              >
                                <Receipt className="w-4 h-4" />
                              </button>

                              {/* View Transactions History */}
                              <button
                                type="button"
                                onClick={() => handleOpenHistoryModal(inv)}
                                className="p-1.5 rounded-lg text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors border border-transparent hover:border-[#D9E0E6]"
                                title="View payment transaction history"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              {/* Download Invoice PDF */}
                              {inv.invoiceDocument && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoice(inv)}
                                  disabled={isDownloading}
                                  className="p-1.5 rounded-lg text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors border border-transparent hover:border-[#D9E0E6] disabled:opacity-50"
                                  title="Download official PDF receipt/invoice"
                                >
                                  {isDownloading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin text-[#315A7D]" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              {/* Pay Dues Action */}
                              {!isPaid ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleOpenPaymentModal(inv)}
                                  leftIcon={<IndianRupee className="w-3.5 h-3.5" />}
                                >
                                  {isPartiallyPaid ? 'Pay Balance' : 'Pay Dues'}
                                </Button>
                              ) : (
                                <span className="text-xs font-semibold text-[#2A583B] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8]">
                                  <Check className="w-3.5 h-3.5 text-[#3F7D58]" /> Paid
                                </span>
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
          </div>
        )}

        {/* ========================================================= */}
        {/* PAYMENT SETTLEMENT MODAL                                  */}
        {/* ========================================================= */}
        {activePaymentInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E6] overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA]">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#EAF2F7] text-[#315A7D]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#243447]">
                      Settle Rent Payment
                    </h2>
                    <p className="text-xs text-[#5B6875]">
                      Invoice {activePaymentInvoice.invoiceNumber} &bull;{' '}
                      {activePaymentInvoice.propertyName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  disabled={isProcessingPayment}
                  className="text-[#5B6875] hover:text-[#243447] p-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
                {/* Invoice Financial Snapshot */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#5B6875] block">
                      Total Invoiced
                    </span>
                    <span className="text-sm font-bold text-[#243447] mt-0.5 block">
                      {formatCurrency(activePaymentInvoice.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#5B6875] block">
                      Already Paid
                    </span>
                    <span className="text-sm font-bold text-[#2A583B] mt-0.5 block">
                      {formatCurrency(activePaymentInvoice.totalPaid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#B94A48] block">
                      Balance Due
                    </span>
                    <span className="text-sm font-extrabold text-[#B94A48] mt-0.5 block">
                      {formatCurrency(activePaymentInvoice.remainingAmount)}
                    </span>
                  </div>
                </div>

                {/* Error Banner inside Modal */}
                {paymentError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{paymentError}</span>
                  </div>
                )}

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#243447] flex items-center justify-between">
                    <span>Payment Amount (₹)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(String(activePaymentInvoice.remainingAmount))
                      }
                      className="text-[11px] text-[#315A7D] hover:underline font-normal"
                    >
                      Pay Full Due
                    </button>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#5B6875]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={activePaymentInvoice.remainingAmount}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      disabled={isProcessingPayment}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#D9E0E6] text-sm font-bold text-[#243447] focus:outline-hidden focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] disabled:bg-gray-100"
                      required
                    />
                  </div>
                  <span className="text-[11px] text-[#5B6875] block">
                    You can pay the full remaining amount or make an approved partial installment.
                  </span>
                </div>

                {/* Razorpay Gateway Information */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#243447] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#315A7D]" />
                      Payment Method
                    </span>
                    <span className="text-[10px] font-semibold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                      Razorpay Secure
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6875] leading-relaxed">
                    Choose your preferred payment method—UPI, Google Pay, PhonePe, Credit/Debit Card, or Net Banking—directly inside the secure Razorpay Checkout window.
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-[#5B6875]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                      Instant verification
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                      256-bit encryption
                    </span>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#D9E0E6]">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleClosePaymentModal}
                    disabled={isProcessingPayment}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isProcessingPayment}
                    leftIcon={
                      isProcessingPayment ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <IndianRupee className="w-4 h-4" />
                      )
                    }
                  >
                    {isProcessingPayment
                      ? 'Processing with Razorpay...'
                      : `Proceed to Pay ₹${Number(paymentAmount || 0).toLocaleString('en-IN')}`}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAYMENT TRANSACTION HISTORY MODAL                         */}
        {/* ========================================================= */}
        {historyInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#D9E0E6] overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA]">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#EDF7EE] text-[#3F7D58]">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#243447]">
                      Payment History
                    </h2>
                    <p className="text-xs text-[#5B6875]">
                      Transactions for Invoice {historyInvoice.invoiceNumber} &bull;{' '}
                      {historyInvoice.propertyName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseHistoryModal}
                  className="text-[#5B6875] hover:text-[#243447] p-1.5 rounded-lg hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Financial Summary */}
                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] flex items-center justify-between text-xs">
                  <span>
                    Total Due:{' '}
                    <strong className="text-[#243447]">
                      {formatCurrency(historyInvoice.amount)}
                    </strong>
                  </span>
                  <span>
                    Total Paid:{' '}
                    <strong className="text-[#2A583B]">
                      {formatCurrency(historyInvoice.totalPaid)}
                    </strong>
                  </span>
                  <span>
                    Remaining:{' '}
                    <strong className="text-[#B94A48]">
                      {formatCurrency(historyInvoice.remainingAmount)}
                    </strong>
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="p-8 flex justify-center">
                    <Loader text="Loading payment transactions..." size="sm" center />
                  </div>
                ) : historyError ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{historyError}</span>
                  </div>
                ) : historyPayments.length === 0 ? (
                  <div className="p-8 text-center bg-[#F7F8FA] rounded-xl border border-dashed border-[#D9E0E6]">
                    <Receipt className="w-8 h-8 text-[#5B6875] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-[#243447]">
                      No Payments Recorded Yet
                    </p>
                    <p className="text-[11px] text-[#5B6875] mt-1">
                      No successful transactions or partial settlements have been made for this invoice.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[#D9E0E6] rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F7F8FA] border-b border-[#D9E0E6] text-[11px] font-bold uppercase text-[#5B6875]">
                          <th className="py-2.5 px-3">Txn #</th>
                          <th className="py-2.5 px-3">Date &amp; Time</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E0E6]">
                        {historyPayments.map((p) => (
                          <tr key={p.paymentId} className="hover:bg-[#F7F8FA]">
                            <td className="py-3 px-3 font-mono font-semibold text-[#315A7D]">
                              #{p.paymentId}
                            </td>
                            <td className="py-3 px-3 text-[#5B6875]">
                              {formatDateTime(p.paymentDate || p.createdAt)}
                            </td>
                            <td className="py-3 px-3 font-medium text-[#243447]">
                              {p.paymentMethod || '—'}
                            </td>
                            <td className="py-3 px-3 font-bold text-[#243447]">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <StatusBadge
                                status={p.paymentStatus}
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

              {/* Footer */}
              <div className="p-4 border-t border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentInv = historyInvoice
                    handleCloseHistoryModal()
                    handleOpenReceiptsModal(currentInv)
                  }}
                  leftIcon={<Receipt className="w-3.5 h-3.5 text-[#315A7D]" />}
                >
                  View Receipts
                </Button>
                <Button variant="outline" size="sm" onClick={handleCloseHistoryModal}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* INVOICE PAYMENT RECEIPTS & PRINT VOUCHER MODAL             */}
        {/* ========================================================= */}
        {receiptModalInvoice && (
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
                      {selectedReceipt ? 'Official Payment Receipt' : 'Invoice Payment Receipts'}
                    </h2>
                    <p className="text-xs text-[#5B6875]">
                      Invoice {receiptModalInvoice.invoiceNumber || `#${receiptModalInvoice.invoiceId}`} &bull;{' '}
                      {receiptModalInvoice.propertyName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseReceiptsModal}
                  className="text-[#5B6875] hover:text-[#243447] p-1.5 rounded-lg hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* VIEW 1: SINGLE RECEIPT PRINTABLE VOUCHER */}
                {selectedReceipt ? (
                  <div className="space-y-4">
                    {/* Navigation toolbar (hidden during print) */}
                    <div className="flex items-center justify-between flex-wrap gap-2 no-print pb-2 border-b border-[#D9E0E6]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReceipt(null)}
                        leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                      >
                        All Receipts for this Invoice
                      </Button>
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
                      invoice={receiptModalInvoice}
                      tenantName={tenantDisplayName}
                      tenantEmail={tenantEmail}
                      propertyName={receiptModalInvoice.propertyName}
                      unitNumber={receiptModalInvoice.unitNumber}
                      formatDateTime={formatDateTime}
                      formatMonthYear={formatMonthYear}
                      showIds={false}
                    />

                    {/* Isolated Print-Only Portal */}
                    <IsolatedPrintReceiptPortal
                      receipt={selectedReceipt}
                      invoice={receiptModalInvoice}
                      tenantName={tenantDisplayName}
                      tenantEmail={tenantEmail}
                      propertyName={receiptModalInvoice.propertyName}
                      unitNumber={receiptModalInvoice.unitNumber}
                      formatDateTime={formatDateTime}
                      formatMonthYear={formatMonthYear}
                      showIds={false}
                    />
                  </div>
                ) : (
                  /* VIEW 2: LIST OF RECEIPTS FOR THIS INVOICE */
                  <div className="space-y-4">
                    {/* Financial Summary */}
                    <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] flex items-center justify-between text-xs">
                      <span>
                        Total Invoiced:{' '}
                        <strong className="text-[#243447]">
                          {formatCurrency(receiptModalInvoice.amount)}
                        </strong>
                      </span>
                      <span>
                        Total Paid:{' '}
                        <strong className="text-[#2A583B]">
                          {formatCurrency(receiptModalInvoice.totalPaid)}
                        </strong>
                      </span>
                      <span>
                        Remaining Due:{' '}
                        <strong className="text-[#B94A48]">
                          {formatCurrency(receiptModalInvoice.remainingAmount)}
                        </strong>
                      </span>
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
                          onClick={() => loadReceiptsForInvoice(receiptModalInvoice.invoiceId)}
                          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : invoiceReceipts.length === 0 ? (
                      /* Empty State */
                      <div className="p-8 text-center bg-[#F7F8FA] rounded-xl border border-dashed border-[#D9E0E6]">
                        <Receipt className="w-8 h-8 text-[#5B6875] mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-semibold text-[#243447]">
                          No Receipts Found
                        </p>
                        <p className="text-[11px] text-[#5B6875] mt-1 max-w-sm mx-auto">
                          No payment receipts have been generated for this invoice yet. Receipts are automatically created upon successful payment verification.
                        </p>
                      </div>
                    ) : (
                      /* Populated Receipt Records Table */
                      <div className="border border-[#D9E0E6] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F7F8FA] border-b border-[#D9E0E6] text-[11px] font-bold uppercase text-[#5B6875]">
                                <th className="py-2.5 px-3">Receipt #</th>
                                <th className="py-2.5 px-3">Invoice #</th>
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Method</th>
                                <th className="py-2.5 px-3">Amount Paid</th>
                                <th className="py-2.5 px-3">Balance</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9E0E6]">
                              {invoiceReceipts.map((rcp) => (
                                <tr key={rcp.receiptId} className="hover:bg-[#F7F8FA]">
                                  <td className="py-3 px-3 font-mono font-semibold text-[#315A7D] whitespace-nowrap">
                                    {rcp.receiptNumber || `REC-${rcp.receiptId}`}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[#243447] whitespace-nowrap">
                                    {rcp.invoiceNumber || receiptModalInvoice.invoiceNumber || `#${rcp.invoiceId}`}
                                  </td>
                                  <td className="py-3 px-3 text-[#5B6875] whitespace-nowrap">
                                    {formatDate(rcp.paymentDate || rcp.createdAt)}
                                  </td>
                                  <td className="py-3 px-3 font-medium text-[#243447] whitespace-nowrap">
                                    {rcp.paymentMethod || '—'}
                                  </td>
                                  <td className="py-3 px-3 font-bold text-[#2A583B] whitespace-nowrap">
                                    {formatCurrency(rcp.amountPaid)}
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-[#B94A48] whitespace-nowrap">
                                    {formatCurrency(rcp.remainingAmount)}
                                  </td>
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
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA] no-print">
                <span className="text-[11px] text-[#5B6875]">
                  {selectedReceipt
                    ? 'Use the Print button above to save as PDF or print via browser.'
                    : `${invoiceReceipts.length} receipt ${invoiceReceipts.length === 1 ? 'record' : 'records'} found`}
                </span>
                <Button variant="outline" size="sm" onClick={handleCloseReceiptsModal}>
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
