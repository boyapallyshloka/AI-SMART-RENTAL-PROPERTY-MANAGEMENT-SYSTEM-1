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
  { label: 'Properties', value: summary?.totalProperties, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Units', value: summary?.totalUnits, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Occupied Units', value: summary?.occupiedUnits, icon: Users, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Vacant Units', value: summary?.vacantUnits, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Other Units', value: summary?.otherUnits, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Occupancy', value: summary?.occupancyRatePercent, icon: Users, format: formatPercent },
  { label: 'Vacancy Rate', value: summary?.vacancyRatePercent, icon: Users, format: formatPercent },
  { label: 'Rent Collected', value: summary?.rentalIncomeCollected, icon: IndianRupee, format: formatMoney },
  { label: 'Outstanding Rent', value: summary?.outstandingRent, icon: AlertCircle, format: formatMoney },
  { label: 'Recorded Expenses', value: summary?.recordedExpenses, icon: IndianRupee, format: formatMoney },
  { label: 'Maintenance Cost', value: summary?.maintenanceCost, icon: Wrench, format: formatMoney },
  { label: 'Estimated Net Income', value: summary?.estimatedNetIncome, icon: IndianRupee, format: formatMoney },
  { label: 'Maintenance Requests', value: summary?.maintenanceRequests, icon: Wrench, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
]

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
      amount: numberValue(item?.amount),
    }))
    .filter((item) => item.amount !== null)

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards(summary).map(({ label, value, icon: Icon, format }) => (
              <div key={label} className="rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">{label}</span>
                  <span className="rounded-md border border-[#D9E0E6] bg-[#EAF2F7] p-2 text-[#315A7D]"><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#243447]">{format(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs">
              <h2 className="text-base font-semibold text-[#243447]">Monthly rent collected</h2>
              <p className="mt-1 text-xs text-[#5B6875]">Successful payments returned by the backend for the selected period.</p>
              {incomeTrend.length ? (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeTrend} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9E0E6" vertical={false} />
                      <XAxis dataKey="monthLabel" stroke="#5B6875" fontSize={12} tickLine={false} />
                      <YAxis stroke="#5B6875" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Collected']} />
                      <Bar dataKey="incomeCollected" name="Collected" fill="#315A7D" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No monthly income rows were returned for this date range.</p>}
            </section>

            <section className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs">
              <h2 className="text-base font-semibold text-[#243447]">Recorded expenses by category</h2>
              <p className="mt-1 text-xs text-[#5B6875]">Categories and amounts returned by the backend.</p>
              {expenseBreakdown.length ? (
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBreakdown} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9E0E6" vertical={false} />
                      <XAxis dataKey="category" stroke="#5B6875" fontSize={11} tickLine={false} />
                      <YAxis stroke="#5B6875" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Expense']} />
                      <Bar dataKey="amount" name="Expense" fill="#B7791F" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No expense breakdown rows were returned for this date range.</p>}
            </section>
          </div>

          <section className="overflow-hidden rounded-lg border border-[#D9E0E6] bg-white shadow-2xs">
            <div className="border-b border-[#D9E0E6] p-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#243447]"><Building2 className="h-4 w-4 text-[#315A7D]" />Property performance</h2>
              <p className="mt-1 text-xs text-[#5B6875]">Income, expenses, maintenance costs, occupancy, and net income from the report response.</p>
            </div>
            {propertyIncome.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-[#F7F8FA] text-[11px] uppercase tracking-wider text-[#5B6875]">
                    <tr>
                      <th className="p-3">Property</th><th className="p-3">Occupied units</th><th className="p-3">Vacant units</th><th className="p-3">Total units</th><th className="p-3">Occupancy</th><th className="p-3">Income</th><th className="p-3">Expenses</th><th className="p-3">Maintenance</th><th className="p-3">Estimated net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E6]">
                    {propertyIncome.map((property) => (
                      <tr key={property.propertyId}>
                        <td className="p-3 font-medium text-[#243447]">{property.propertyName || '—'}</td>
                        <td className="p-3 text-[#5B6875]">{numberValue(property.occupiedUnits)?.toLocaleString('en-IN') ?? '—'}</td>
                        <td className="p-3 text-[#5B6875]">{numberValue(property.vacantUnits)?.toLocaleString('en-IN') ?? '—'}</td>
                        <td className="p-3 text-[#5B6875]">{numberValue(property.totalUnits)?.toLocaleString('en-IN') ?? '—'}</td>
                        <td className="p-3 text-[#5B6875]">{formatPercent(property.occupancyRatePercent)}</td>
                        <td className="p-3 text-[#243447]">{formatMoney(property.incomeCollected)}</td>
                        <td className="p-3 text-[#5B6875]">{formatMoney(property.recordedExpenses)}</td>
                        <td className="p-3 text-[#5B6875]">{formatMoney(property.maintenanceCost)}</td>
                        <td className="p-3 font-semibold text-[#243447]">{formatMoney(property.estimatedNetIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-4 text-sm text-[#5B6875]">The backend returned no property rows for this period.</div>}
          </section>
        </>
      )}
    </div>
  )
}
