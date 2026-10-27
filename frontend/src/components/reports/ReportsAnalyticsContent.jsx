import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  IndianRupee,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getReportsAnalytics } from '../../api/reportApi'
import { isPropertyOwner } from '../../utils/roles'
import { Button, EmptyState, Loader } from '../ui'
import OwnerExpensePanel from './OwnerExpensePanel'

const localDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const makeCurrentMonthRange = () => {
  const today = new Date()
  return {
    startDate: localDateValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: localDateValue(today),
  }
}

const numberValue = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const formatMoney = (value) => {
  const number = numberValue(value)
  return number === null
    ? '—'
    : `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const formatPercent = (value) => {
  const number = numberValue(value)
  return number === null ? '—' : `${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`
}

const formatMonth = (value) => {
  if (!value) return '—'
  const monthText = typeof value === 'string'
    ? value
    : value.year && value.month
      ? `${value.year}-${String(value.month).padStart(2, '0')}`
      : ''
  if (!monthText) return String(value)
  const date = new Date(`${monthText}-01T00:00:00`)
  return Number.isNaN(date.getTime())
    ? monthText
    : date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

const metricCards = (summary) => [
  { label: 'Properties', note: 'Across your portfolio', value: summary?.totalProperties, icon: Building2, kind: 'portfolio', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Rentable inventory', note: 'Homes and apartment units', value: summary?.totalRentableInventory, icon: Building2, kind: 'inventory', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Occupied rentals', note: 'Currently earning rent', value: summary?.occupiedRentableInventory, icon: Users, kind: 'occupied', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'House & villa rentals', note: 'Listed as whole properties', value: summary?.totalDirectProperties, icon: Building2, kind: 'homes', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Occupied direct rentals', note: 'Houses and villas leased', value: summary?.occupiedDirectProperties, icon: Users, kind: 'occupiedDirect', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Vacant direct rentals', note: 'Houses and villas available', value: summary?.vacantDirectProperties, icon: Building2, kind: 'vacant', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Apartment units', note: 'Units across buildings', value: summary?.totalUnits, icon: Building2, kind: 'apartments', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Occupied units', note: 'Apartment rentals in use', value: summary?.occupiedUnits, icon: Users, kind: 'unitOccupied', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Vacant units', note: 'Apartment units available', value: summary?.vacantUnits, icon: Building2, kind: 'unitVacant', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Other units', note: 'Additional unit inventory', value: summary?.otherUnits, icon: Building2, kind: 'otherUnits', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Overall occupancy', note: 'Across all rentable inventory', value: summary?.rentableInventoryOccupancyRatePercent, icon: Users, kind: 'overallRate', format: formatPercent },
  { label: 'Unit occupancy', note: 'Apartment units only', value: summary?.occupancyRatePercent, icon: Users, kind: 'unitRate', format: formatPercent },
  { label: 'Unit vacancy rate', note: 'Apartment units only', value: summary?.vacancyRatePercent, icon: Building2, kind: 'vacancyRate', format: formatPercent },
  { label: 'Rent collected', note: 'Successful payments this period', value: summary?.rentalIncomeCollected, icon: IndianRupee, kind: 'income', format: formatMoney },
  { label: 'Outstanding rent', note: 'Still waiting to be collected', value: summary?.outstandingRent, icon: AlertCircle, kind: 'outstanding', format: formatMoney },
  { label: 'Recorded expenses', note: 'Costs logged this period', value: summary?.recordedExpenses, icon: IndianRupee, kind: 'expenses', format: formatMoney },
  { label: 'Maintenance cost', note: 'Repair and service spend', value: summary?.maintenanceCost, icon: Wrench, kind: 'maintenanceCost', format: formatMoney },
  { label: 'Estimated net income', note: 'After recorded costs', value: summary?.estimatedNetIncome, icon: IndianRupee, kind: 'net', format: formatMoney },
  { label: 'Maintenance requests', note: 'Tickets reported this period', value: summary?.maintenanceRequests, icon: Wrench, kind: 'requests', format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
]

const metricStyle = {
  portfolio: { card: 'xl:col-span-6 min-h-[184px] rounded-[30px_30px_30px_12px] border-[#24496B] bg-gradient-to-br from-[#17324D] via-[#244D70] to-[#367095] text-white', icon: 'bg-white/15 text-white ring-white/20', label: 'text-white/85', note: 'text-blue-100/80', value: 'text-white' },
  inventory: { card: 'rounded-[30px_12px_30px_12px] border-sky-200 bg-gradient-to-br from-white to-sky-100 text-[#17324D]', icon: 'bg-sky-100 text-sky-800 ring-sky-200', label: 'text-sky-950/80', note: 'text-slate-600', value: 'text-[#17324D]' },
  occupied: { card: 'rounded-[42px_18px_42px_18px] border-blue-200 bg-blue-50 text-[#17324D]', icon: 'bg-blue-100 text-blue-800 ring-blue-200', label: 'text-blue-950/80', note: 'text-slate-600', value: 'text-blue-950' },
  unitOccupied: { card: 'xl:col-span-4 min-h-[184px] rounded-[42px_18px_42px_18px] border-blue-200 bg-blue-50 text-[#17324D]', icon: 'bg-blue-100 text-blue-800 ring-blue-200', label: 'text-blue-950/80', note: 'text-slate-600', value: 'text-blue-950' },
  unitVacant: { card: 'xl:col-span-4 min-h-[184px] rounded-[24px_42px_24px_42px] border-blue-200 bg-gradient-to-br from-blue-50 to-sky-100 text-[#17324D]', icon: 'bg-white text-blue-800 ring-blue-200', label: 'text-blue-950/80', note: 'text-slate-600', value: 'text-blue-950' },
  otherUnits: { card: 'xl:col-span-4 min-h-[184px] rounded-[30px_12px_30px_12px] border-sky-200 bg-gradient-to-br from-white to-sky-100 text-[#17324D]', icon: 'bg-sky-100 text-sky-800 ring-sky-200', label: 'text-sky-950/80', note: 'text-slate-600', value: 'text-[#17324D]' },
  occupiedDirect: { card: 'rounded-[18px_42px_18px_42px] border-cyan-200 bg-gradient-to-br from-cyan-50 to-white text-[#17324D]', icon: 'bg-cyan-100 text-cyan-800 ring-cyan-200', label: 'text-cyan-950/80', note: 'text-slate-600', value: 'text-cyan-950' },
  homes: { card: 'rounded-[18px_42px_18px_42px] border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-[#17324D]', icon: 'bg-indigo-100 text-indigo-800 ring-indigo-200', label: 'text-indigo-950/80', note: 'text-slate-600', value: 'text-indigo-950' },
  apartments: { card: 'rounded-[32px_12px_32px_12px] border-[#C8D9E8] bg-[#EAF2F7] text-[#17324D]', icon: 'bg-white text-[#315A7D] ring-[#C8D9E8]', label: 'text-[#315A7D]', note: 'text-slate-600', value: 'text-[#17324D]' },
  vacant: { card: 'rounded-[24px_42px_24px_42px] border-blue-200 bg-gradient-to-br from-blue-50 to-sky-100 text-[#17324D]', icon: 'bg-white text-blue-800 ring-blue-200', label: 'text-blue-950/80', note: 'text-slate-600', value: 'text-blue-950' },
  overallRate: { card: 'xl:col-span-6 min-h-[184px] rounded-[42px_18px_42px_18px] border-[#1E527C] bg-gradient-to-br from-[#1A4A70] via-[#23648F] to-[#3986B2] text-white', icon: 'bg-white/15 text-white ring-white/20', label: 'text-white/90', note: 'text-blue-100/80', value: 'text-white' },
  unitRate: { card: 'rounded-[18px_42px_18px_42px] border-blue-200 bg-gradient-to-br from-blue-100 to-white text-[#17324D]', icon: 'bg-white text-blue-800 ring-blue-200', label: 'text-blue-950/80', note: 'text-slate-600', value: 'text-blue-950' },
  vacancyRate: { card: 'rounded-[42px_18px_18px_42px] border-sky-200 bg-sky-50 text-[#17324D]', icon: 'bg-sky-100 text-sky-800 ring-sky-200', label: 'text-sky-950/80', note: 'text-slate-600', value: 'text-sky-950' },
  income: { card: 'xl:col-span-6 min-h-[184px] rounded-[30px_30px_12px_30px] border-[#B9D5E9] bg-gradient-to-br from-[#EAF4FB] via-white to-[#D7EAF7] text-[#17324D]', icon: 'bg-white text-[#1B628F] ring-blue-200', label: 'text-[#1B5277]', note: 'text-slate-600', value: 'text-[#17324D]' },
  outstanding: { card: 'rounded-[42px_18px_42px_18px] border-[#B7D1E5] bg-[#E6F0F8] text-[#17324D]', icon: 'bg-white text-[#315A7D] ring-[#C8D9E8]', label: 'text-[#315A7D]', note: 'text-slate-600', value: 'text-[#17324D]' },
  expenses: { card: 'rounded-[18px_42px_18px_42px] border-indigo-200 bg-gradient-to-br from-indigo-50 to-white text-[#17324D]', icon: 'bg-indigo-100 text-indigo-800 ring-indigo-200', label: 'text-indigo-950/80', note: 'text-slate-600', value: 'text-indigo-950' },
  maintenanceCost: { card: 'rounded-[30px_12px_30px_12px] border-[#B9D5E9] bg-gradient-to-br from-[#DCEAF5] to-[#F5F9FC] text-[#17324D]', icon: 'bg-white text-[#315A7D] ring-[#B9D5E9]', label: 'text-[#315A7D]', note: 'text-slate-600', value: 'text-[#17324D]' },
  net: { card: 'xl:col-span-6 min-h-[184px] rounded-[18px_42px_18px_42px] border-[#9FC7E2] bg-gradient-to-br from-[#D8EAF7] via-[#F4F9FC] to-[#C8E0F1] text-[#17324D]', icon: 'bg-white text-[#1B628F] ring-blue-200', label: 'text-[#1B5277]', note: 'text-slate-600', value: 'text-[#17324D]' },
  requests: { card: 'rounded-[42px_18px_42px_18px] border-[#C8D9E8] bg-white text-[#17324D]', icon: 'bg-[#EAF2F7] text-[#315A7D] ring-[#C8D9E8]', label: 'text-[#315A7D]', note: 'text-slate-600', value: 'text-[#17324D]' },
}

export default function ReportsAnalyticsContent({ scopeLabel = 'Portfolio', role }) {
  const initialRange = makeCurrentMonthRange()
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [appliedRange, setAppliedRange] = useState(initialRange)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isCurrentRequest = true
    setLoading(true)
    setError('')

    getReportsAnalytics({ ...appliedRange, signal: controller.signal })
      .then((response) => {
        if (!isCurrentRequest) return
        const payload = response?.data ?? response ?? null
        setReport(payload && typeof payload === 'object' ? payload : null)
      })
      .catch((loadError) => {
        if (!isCurrentRequest || controller.signal.aborted || loadError?.code === 'ERR_CANCELED') return
        setReport(null)
        setError(loadError?.message || 'Could not load report analytics from the backend.')
      })
      .finally(() => {
        if (isCurrentRequest && !controller.signal.aborted) setLoading(false)
      })

    return () => {
      isCurrentRequest = false
      controller.abort()
    }
  }, [appliedRange, refreshKey])

  const refreshReports = () => setRefreshKey((current) => current + 1)

  const handleApplyRange = (event) => {
    event.preventDefault()
    if (!startDate || !endDate) {
      setRangeError('Choose both a start date and an end date.')
      return
    }
    if (startDate > endDate) {
      setRangeError('The start date must be on or before the end date.')
      return
    }
    setRangeError('')
    setAppliedRange({ startDate, endDate })
  }

  const summary = report?.summary
  const propertyIncome = Array.isArray(report?.propertyIncome) ? report.propertyIncome : []
  const incomeTrend = (Array.isArray(report?.monthlyIncomeTrend) ? report.monthlyIncomeTrend : [])
    .map((item) => ({
      monthLabel: formatMonth(item?.month),
      incomeCollected: numberValue(item?.incomeCollected),
    }))
    .filter((item) => item.incomeCollected !== null)
  const expenseBreakdown = (Array.isArray(report?.expenseBreakdown) ? report.expenseBreakdown : [])
    .map((item) => ({
      category: item?.category || '—',
      categoryLabel: String(item?.category || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      amount: numberValue(item?.amount),
    }))
    .filter((item) => item.amount !== null)
  const propertyPerformance = propertyIncome.map((property) => {
    const totalInventory = numberValue(property.totalRentableInventory) ?? 0
    const occupiedInventory = numberValue(property.occupiedRentableInventory) ?? 0
    return {
      ...property,
      propertyLabel: property.propertyName || `Property ${property.propertyId}`,
      occupiedInventory,
      availableInventory: Math.max(0, totalInventory - occupiedInventory),
      totalInventory,
      occupancyPercent: numberValue(property.rentableInventoryOccupancyRatePercent) ?? 0,
      incomeCollected: numberValue(property.incomeCollected) ?? 0,
      recordedExpenses: numberValue(property.recordedExpenses) ?? 0,
      maintenanceCost: numberValue(property.maintenanceCost) ?? 0,
      estimatedNetIncome: numberValue(property.estimatedNetIncome) ?? 0,
    }
  })

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleApplyRange}
        className="flex flex-col gap-3 rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-2xs sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-sm font-semibold text-[#243447]">Reporting period</p>
          <p className="mt-1 text-xs text-[#5B6875]">
            Live {scopeLabel.toLowerCase()} figures from the authenticated reports API.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs font-medium text-[#5B6875]">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 block rounded-md border border-[#D9E0E6] bg-white px-3 py-2 text-sm text-[#243447]"
            />
          </label>
          <label className="text-xs font-medium text-[#5B6875]">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 block rounded-md border border-[#D9E0E6] bg-white px-3 py-2 text-sm text-[#243447]"
            />
          </label>
          <Button type="submit" isLoading={loading} leftIcon={<CalendarDays className="h-4 w-4" />}>
            Apply dates
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={refreshReports}
            disabled={loading}
            aria-label="Refresh reports"
            leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
        {rangeError && <p role="alert" className="text-xs text-[#B94A48]">{rangeError}</p>}
      </form>

      {/* Expense entry panel — visible only to Property Owners */}
      {isPropertyOwner(role) && (
        <OwnerExpensePanel onExpenseSaved={refreshReports} />
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-[#F4B4B4] bg-[#FDF2F2] p-3 text-sm text-[#8A2E2C]">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>
          <Button size="sm" variant="outline" onClick={refreshReports}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center rounded-lg border border-[#D9E0E6] bg-white p-12 shadow-2xs">
          <Loader text="Loading live report analytics..." size="md" center />
        </div>
      ) : error ? (
        <EmptyState title="Report data unavailable" message="The report request failed. Retry after checking the backend connection and your access." />
      ) : !summary ? (
        <EmptyState title="No report summary returned" message="The backend response did not include a report summary for this period." />
      ) : (
        <>
          <p className="text-xs text-[#5B6875]" aria-live="polite">
            Data period: {report?.startDate || appliedRange.startDate} – {report?.endDate || appliedRange.endDate}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
            {metricCards(summary).map((metric) => {
              const { label, note, value, icon: Icon, format, kind } = metric
              const style = metricStyle[kind] || metricStyle.requests
              const isRate = ['overallRate', 'unitRate', 'vacancyRate'].includes(kind)
              const rate = isRate ? Math.max(0, Math.min(100, numberValue(value) ?? 0)) : 0
              const occupiedShare = kind === 'occupied' || kind === 'unitOccupied'
                ? Math.max(0, Math.min(100, (numberValue(kind === 'unitOccupied' ? summary?.occupiedUnits : summary?.occupiedRentableInventory) / (numberValue(kind === 'unitOccupied' ? summary?.totalUnits : summary?.totalRentableInventory) || 1)) * 100))
                : 0

              return (
                <article
                  key={label}
                  className={`group relative isolate min-h-[158px] overflow-hidden border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg xl:col-span-3 ${style.card}`}
                >
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold tracking-wide ${style.label}`}>{label}</p>
                      <p className={`mt-1 text-xs ${style.note}`}>{note}</p>
                    </div>
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${style.icon}`}>
                      <Icon className="h-5 w-5" strokeWidth={2.1} />
                    </span>
                  </div>

                  <p className={`relative z-10 mt-4 text-[2rem] font-bold leading-none tracking-tight ${style.value}`}>
                    {format(value)}
                  </p>

                  {isRate && (
                    <div className={`relative z-10 mt-4 h-2 overflow-hidden rounded-full ${kind === 'overallRate' ? 'bg-white/20' : 'bg-blue-900/10'}`}>
                      <div className="h-full rounded-full bg-current opacity-80 transition-all" style={{ width: `${rate}%` }} />
                    </div>
                  )}
                  {(kind === 'occupied' || kind === 'unitOccupied') && (
                    <div className="relative z-10 mt-4 h-2 overflow-hidden rounded-full bg-blue-900/10">
                      <div className="h-full rounded-full bg-[#367095] transition-all" style={{ width: `${occupiedShare}%` }} />
                    </div>
                  )}
                  {(kind === 'vacant' || kind === 'unitVacant') && (
                    <span className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Ready to lease
                    </span>
                  )}
                  {['income', 'expenses', 'maintenanceCost', 'net'].includes(kind) && (
                    <div className="relative z-10 mt-3 flex h-5 items-end gap-1" aria-hidden="true">
                      {[34, 58, 42, 78, 55, 94, 68, 84].map((height, index) => (
                        <span key={index} className="w-1.5 rounded-t-full bg-current opacity-25" style={{ height: `${height}%` }} />
                      ))}
                      <span className={`ml-2 self-center text-[10px] font-semibold tracking-wide ${style.note}`}>PERIOD TOTAL</span>
                    </div>
                  )}
                  {kind === 'requests' && (
                    <span className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#EAF2F7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#315A7D]">
                      <Wrench className="h-3 w-3" /> Service activity
                    </span>
                  )}

                  <Icon className="pointer-events-none absolute -bottom-5 -right-4 -z-0 h-28 w-28 rotate-[-12deg] opacity-[0.055]" strokeWidth={1.3} />
                  {kind === 'portfolio' && <span className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-sky-300 via-white/70 to-transparent" />}
                </article>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="overflow-hidden rounded-[28px] border border-[#D4E2EE] bg-gradient-to-br from-white via-white to-[#EFF6FB] p-5 shadow-[0_12px_35px_-24px_rgba(27,78,113,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5680A0]">Cash flow</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#17324D]">Monthly rent collected</h2>
                  <p className="mt-1 text-xs text-[#63788A]">Successful payments during the selected period.</p>
                </div>
                <span className="rounded-2xl bg-[#E6F0F8] p-3 text-[#315A7D]"><IndianRupee className="h-5 w-5" /></span>
              </div>
              {incomeTrend.length ? (
                <div className="mt-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={incomeTrend} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="rentCollectedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#397DA8" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#397DA8" stopOpacity={0.015} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 6" stroke="#DCE7F0" vertical={false} />
                      <XAxis dataKey="monthLabel" stroke="#7890A2" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis stroke="#7890A2" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} width={72} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Collected']} contentStyle={{ borderRadius: 14, border: '1px solid #D4E2EE', boxShadow: '0 12px 30px -16px rgba(23,50,77,.35)' }} />
                      <Area type="monotone" dataKey="incomeCollected" name="Collected" stroke="#275F86" strokeWidth={3} fill="url(#rentCollectedFill)" activeDot={{ r: 6, fill: '#275F86', stroke: '#fff', strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No monthly income rows were returned for this date range.</p>}
            </section>

            <section className="overflow-hidden rounded-[28px] border border-[#D4E2EE] bg-gradient-to-br from-[#F5F9FC] via-white to-[#EAF3F9] p-5 shadow-[0_12px_35px_-24px_rgba(27,78,113,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5680A0]">Spend breakdown</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#17324D]">Expenses by category</h2>
                  <p className="mt-1 text-xs text-[#63788A]">Recorded costs grouped by type.</p>
                </div>
                <span className="rounded-2xl bg-[#DCEAF5] p-3 text-[#315A7D]"><Wrench className="h-5 w-5" /></span>
              </div>
              {expenseBreakdown.length ? (
                <div className="mt-5 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 8, right: 18, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#DCE7F0" horizontal={false} />
                      <XAxis type="number" stroke="#7890A2" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                      <YAxis type="category" dataKey="categoryLabel" stroke="#526B7E" fontSize={11} tickLine={false} axisLine={false} width={132} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Expense']} contentStyle={{ borderRadius: 14, border: '1px solid #D4E2EE', boxShadow: '0 12px 30px -16px rgba(23,50,77,.35)' }} />
                      <Bar dataKey="amount" name="Expense" fill="#397DA8" radius={[0, 9, 9, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No expense breakdown rows were returned for this date range.</p>}
            </section>
          </div>

          <section className="overflow-hidden rounded-[30px] border border-[#D4E2EE] bg-white shadow-[0_14px_38px_-28px_rgba(27,78,113,0.5)]">
            <div className="flex flex-col gap-3 border-b border-[#DFEAF2] bg-gradient-to-r from-[#F1F7FB] via-white to-[#E7F1F8] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5680A0]">Portfolio comparison</p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[#17324D]"><Building2 className="h-5 w-5 text-[#315A7D]" />Property performance</h2>
                <p className="mt-1 text-sm text-[#63788A]">Compare occupancy and financial results across each property.</p>
              </div>
              <span className="w-fit rounded-full border border-[#C8D9E8] bg-white px-3 py-1.5 text-xs font-semibold text-[#315A7D]">{propertyPerformance.length} properties</span>
            </div>
            {propertyPerformance.length ? (
              <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
                <div className="rounded-[24px] border border-[#E0EAF2] bg-[#FBFDFF] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#243F56]">Rental occupancy</h3>
                      <p className="mt-1 text-xs text-[#718698]">Occupied versus available inventory</p>
                    </div>
                    <div className="flex gap-3 text-[10px] font-medium text-[#5D7488]">
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#275F86]" />Occupied</span>
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#B8D3E6]" />Available</span>
                    </div>
                  </div>
                  <div className="w-full" style={{ height: Math.max(260, propertyPerformance.length * 58) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyPerformance} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 4 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="4 6" stroke="#E2EBF2" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} stroke="#8AA0B2" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="propertyLabel" width={124} stroke="#506A7D" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value, name) => [Number(value).toLocaleString('en-IN'), name]} labelFormatter={(label) => label} contentStyle={{ borderRadius: 14, border: '1px solid #D4E2EE', boxShadow: '0 12px 30px -16px rgba(23,50,77,.35)' }} />
                        <Bar dataKey="occupiedInventory" name="Occupied" stackId="inventory" fill="#275F86" radius={[8, 0, 0, 8]} maxBarSize={25} />
                        <Bar dataKey="availableInventory" name="Available" stackId="inventory" fill="#B8D3E6" radius={[0, 8, 8, 0]} maxBarSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#E0EAF2] bg-[#FBFDFF] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#243F56]">Income and costs</h3>
                      <p className="mt-1 text-xs text-[#718698]">Financial results by property</p>
                    </div>
                    <span className="rounded-xl bg-[#E6F0F8] p-2 text-[#315A7D]"><IndianRupee className="h-4 w-4" /></span>
                  </div>
                  <div className="w-full" style={{ height: Math.max(260, propertyPerformance.length * 58) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyPerformance} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 4 }} barCategoryGap="24%">
                        <CartesianGrid strokeDasharray="4 6" stroke="#E2EBF2" horizontal={false} />
                        <XAxis type="number" stroke="#8AA0B2" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                        <YAxis type="category" dataKey="propertyLabel" width={124} stroke="#506A7D" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value, name) => [formatMoney(value), name]} labelFormatter={(label) => label} contentStyle={{ borderRadius: 14, border: '1px solid #D4E2EE', boxShadow: '0 12px 30px -16px rgba(23,50,77,.35)' }} />
                        <Bar dataKey="incomeCollected" name="Income" fill="#1E4E71" radius={[0, 7, 7, 0]} maxBarSize={14} />
                        <Bar dataKey="recordedExpenses" name="Expenses" fill="#397DA8" radius={[0, 7, 7, 0]} maxBarSize={14} />
                        <Bar dataKey="maintenanceCost" name="Maintenance" fill="#78A7C8" radius={[0, 7, 7, 0]} maxBarSize={14} />
                        <Bar dataKey="estimatedNetIncome" name="Net income" fill="#B8D3E6" radius={[0, 7, 7, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : <div className="p-5 text-sm text-[#5B6875]">The backend returned no property rows for this period.</div>}
          </section>
        </>
      )}
    </div>
  )
}
