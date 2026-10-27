import React from 'react'
import { createPortal } from 'react-dom'
import { Building2, ShieldCheck } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'

// Default date/time formatters
const defaultFormatDateTime = (dateStr) => {
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

const defaultFormatMonthYear = (month, year) => {
  if (!month && !year) return 'Billing period unavailable'
  if (month && year) {
    const d = new Date(year, month - 1, 1)
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  }
  return `${month || ''} ${year || ''}`.trim()
}

/**
 * Printable Receipt Voucher Component
 * Renders an official payment receipt document.
 * Can be used both as on-screen modal content and inside an isolated print portal.
 */
export function PrintableReceiptVoucher({
  receipt,
  invoice,
  tenantName,
  tenantEmail,
  propertyName,
  unitNumber,
  tenantId,
  unitId,
  billingMonth,
  billingYear,
  formatDateTime = defaultFormatDateTime,
  formatMonthYear = defaultFormatMonthYear,
  showIds = false,
  isPrintView = false,
}) {
  if (!receipt) return null

  const resolvedTenantName =
    tenantName ||
    receipt.tenantName ||
    invoice?.tenantName ||
    'Valued Tenant'

  const resolvedTenantEmail =
    tenantEmail ||
    receipt.tenantEmail ||
    invoice?.tenantEmail ||
    ''

  const resolvedPropertyName =
    propertyName ||
    receipt.propertyName ||
    invoice?.propertyName ||
    'Rental Property'

  const formatUnit = (val) => {
    if (!val) return ''
    const str = String(val).trim()
    if (str.startsWith('Unit') || str === '—' || str === '-') return str
    return `Unit ${str}`
  }

  const resolvedUnitNumber =
    unitNumber != null
      ? formatUnit(unitNumber)
      : receipt.unitNumber
      ? formatUnit(receipt.unitNumber)
      : invoice?.unitNumber
      ? formatUnit(invoice.unitNumber)
      : 'Premises'

  const resolvedTenantId =
    tenantId ||
    receipt.tenantId ||
    invoice?.tenantId ||
    null

  const resolvedUnitId =
    unitId ||
    receipt.unitId ||
    invoice?.unitId ||
    null

  const resolvedInvoiceNumber =
    receipt.invoiceNumber ||
    invoice?.invoiceNumber ||
    (receipt.invoiceId ? `#${receipt.invoiceId}` : '—')

  const resolvedInvoicedAmount =
    receipt.invoiceTotalAmount != null
      ? receipt.invoiceTotalAmount
      : invoice?.amount != null
      ? invoice.amount
      : invoice?.totalAmount != null
      ? invoice.totalAmount
      : null

  const resolvedBillingMonth =
    billingMonth != null
      ? billingMonth
      : invoice?.billingMonth != null
      ? invoice.billingMonth
      : null

  const resolvedBillingYear =
    billingYear != null
      ? billingYear
      : invoice?.billingYear != null
      ? invoice.billingYear
      : null

  const isFullySettled =
    receipt.remainingAmount != null && Number(receipt.remainingAmount) <= 0

  return (
    <div
      id={isPrintView ? 'isolated-receipt-printable-content' : 'printable-receipt-container'}
      className={
        isPrintView
          ? 'p-8 bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] space-y-6'
          : 'p-6 sm:p-8 rounded-xl bg-white border border-[#D9E0E6] shadow-xs space-y-6 text-[#243447]'
      }
      style={{
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* 1. Header Section */}
      <div className="flex items-start justify-between border-b border-[#D9E0E6] pb-5 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#315A7D]" />
            <span className="text-xl font-bold tracking-tight text-[#243447]">
              SmartEstate
            </span>
          </div>
          <p className="text-xs text-[#5B6875] mt-1">
            Smart Rental Property Management System
          </p>
          <p className="text-[11px] text-[#5B6875]">
            Official Transaction &amp; Payment Acknowledgment
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 rounded-md bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs font-bold uppercase tracking-wider mb-1.5">
            Payment Receipt
          </span>
          <p className="text-xs font-mono font-bold text-[#315A7D]">
            {receipt.receiptNumber || `REC-${receipt.receiptId}`}
          </p>
          <p className="text-[11px] text-[#5B6875] mt-0.5">
            Issued: {formatDateTime(receipt.paymentDate || receipt.createdAt)}
          </p>
        </div>
      </div>

      {/* 2. Two-Column Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B6875] block">
            Tenant &amp; Premises Details
          </span>
          <p className="font-bold text-[#243447] text-sm">
            {resolvedTenantName}
            {showIds && (
              <span className="font-mono text-[11px] text-[#5B6875] font-normal ml-1.5">
                (Tenant ID #{resolvedTenantId || '—'})
              </span>
            )}
          </p>
          {resolvedTenantEmail && (
            <p className="text-[#5B6875] truncate">{resolvedTenantEmail}</p>
          )}
          <p className="text-[#243447] font-medium pt-1">
            {resolvedPropertyName} &bull; {resolvedUnitNumber}
            {showIds && (
              <span className="font-mono text-[11px] text-[#5B6875] font-normal ml-1.5">
                (Unit ID #{resolvedUnitId || '—'})
              </span>
            )}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B6875] block">
            Billing &amp; Payment Reference
          </span>
          <p className="text-[#243447]">
            <strong className="text-[#5B6875]">Invoice No:</strong>{' '}
            <span className="font-mono font-semibold">
              {resolvedInvoiceNumber}
            </span>
          </p>
          <p className="text-[#243447]">
            <strong className="text-[#5B6875]">Payment Method:</strong>{' '}
            <span className="font-semibold">
              {receipt.paymentMethod || 'Razorpay / Online'}
            </span>
          </p>
          <p className="text-[#243447] truncate">
            <strong className="text-[#5B6875]">Gateway Txn ID:</strong>{' '}
            <span className="font-mono text-[11px]">
              {receipt.razorpayPaymentId ||
                (receipt.paymentId ? `#${receipt.paymentId}` : '—')}
            </span>
          </p>
        </div>
      </div>

      {/* 3. Financial Breakdown Table */}
      <div className="border border-[#D9E0E6] rounded-xl overflow-hidden text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F7F8FA] border-b border-[#D9E0E6] text-[11px] font-bold uppercase text-[#5B6875]">
              <th className="py-2.5 px-4">Description</th>
              <th className="py-2.5 px-4 text-right">Invoiced Amount</th>
              <th className="py-2.5 px-4 text-right">Amount Paid</th>
              <th className="py-2.5 px-4 text-right">Remaining Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3.5 px-4">
                <p className="font-bold text-[#243447]">
                  Rent Payment Settlement
                </p>
                <span className="text-[#5B6875] text-[11px]">
                  Billing Period: {formatMonthYear(resolvedBillingMonth, resolvedBillingYear)}
                </span>
              </td>
              <td className="py-3.5 px-4 text-right font-medium text-[#243447]">
                {formatCurrency(resolvedInvoicedAmount)}
              </td>
              <td className="py-3.5 px-4 text-right font-bold text-[#2A583B]">
                {formatCurrency(receipt.amountPaid)}
              </td>
              <td className={`py-3.5 px-4 text-right font-bold ${isFullySettled ? 'text-[#2A583B]' : 'text-[#B94A48]'}`}>
                {!isFullySettled
                  ? formatCurrency(receipt.remainingAmount)
                  : receipt.remainingAmount == null
                  ? '—'
                  : '₹0 (Settled)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. Summary Totals Box */}
      <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-2 text-xs">
        <div className="flex justify-between items-center text-[#5B6875]">
          <span>Total Invoiced</span>
          <span className="font-semibold text-[#243447]">
            {formatCurrency(resolvedInvoicedAmount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm font-bold text-[#2A583B] pt-1 border-t border-[#D9E0E6]">
          <span>Amount Paid in this Receipt</span>
          <span>{formatCurrency(receipt.amountPaid)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-[#5B6875] pt-1 border-t border-[#D9E0E6]">
          <span>Remaining Balance on Invoice</span>
          <span
            className={`font-bold ${
              !isFullySettled ? 'text-[#B94A48]' : 'text-[#3F7D58]'
            }`}
          >
            {formatCurrency(receipt.remainingAmount)}
          </span>
        </div>
      </div>

      {/* 5. Verification Stamp & Official Footer */}
      <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#5B6875]">
        <div className="flex items-center gap-1.5 text-[#2A583B] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#3F7D58]" />
          <span>Payment Verified &bull; Electronically Generated Receipt</span>
        </div>
        <span>
          Date: {formatDateTime(receipt.createdAt || receipt.paymentDate)}
        </span>
      </div>
    </div>
  )
}

/**
 * Isolated Print Receipt Portal Component
 * Uses React Portal to mount an isolated print document directly on document.body,
 * completely independent of the modal's fixed positioning, scroll height, flexbox, and overflow.
 */
export function IsolatedPrintReceiptPortal(props) {
  if (!props.receipt || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <>
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 12mm 15mm;
          }

          /* 1. Completely hide the interactive app tree (all modals, layouts, backdrops, navbars) */
          #root {
            display: none !important;
          }

          /* Also hide any direct body siblings that are not the print root */
          body > :not(#isolated-receipt-print-root) {
            display: none !important;
          }

          /* 2. Reset html & body to a pure, unconstrained white canvas */
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            width: 100% !important;
            font-size: 11pt !important;
            line-height: 1.4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 3. Display the isolated print container as a normal block directly in body */
          #isolated-receipt-print-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Force exact background and text colors in print preview */
          #isolated-receipt-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide modal controls and navigation marked with .no-print */
          .no-print {
            display: none !important;
          }
        }

        /* On screen, the print-only container is completely invisible */
        @media screen {
          #isolated-receipt-print-root {
            display: none !important;
          }
        }
      `}</style>
      <div id="isolated-receipt-print-root">
        <PrintableReceiptVoucher {...props} isPrintView={true} />
      </div>
    </>,
    document.body
  )
}

export default PrintableReceiptVoucher
