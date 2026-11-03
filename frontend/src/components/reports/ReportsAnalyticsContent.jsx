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

const chartTooltipContentStyle = {
  borderRadius: 14,
  border: '1px solid #E3E8DF',
  boxShadow: '0 12px 30px -16px rgba(48,37,31,.25)',
}

const headlineMetrics = (summary) => [
  { label: 'Properties', note: 'Across your portfolio', value: summary?.totalProperties, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Apartment units', note: 'Units across buildings', value: summary?.totalUnits, icon: Building2, format: (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—' },
  { label: 'Unit occupancy', note: 'Apartment rentals in use', value: summary?.occupancyRatePercent, icon: Users, format: formatPercent },
  { label: 'Rent collected', note: 'Successful payments this period', value: summary?.rentalIncomeCollected, icon: IndianRupee, format: formatMoney },
]

const countLabel = (value) => numberValue(value)?.toLocaleString('en-IN') ?? '—'

function BreakdownRow({ label, value, percent, tone = 'green' }) {
  const normalizedPercent = numberValue(percent)
  const safePercent = normalizedPercent === null ? null : Math.max(0, Math.min(100, normalizedPercent))
  const barColor = tone === 'amber' ? 'bg-[#B7791F]' : 'bg-[#3F7D58]'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3">
      <span className="text-sm text-[#34443A]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#243447]">{countLabel(value)}</span>
      {safePercent !== null && (
        <div
          className="col-span-2 h-2 overflow-hidden rounded-full bg-[#E9E0D2]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safePercent}
        >
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${safePercent}%` }} />
        </div>
      )}
    </div>
  )
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
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)

  useEffect(() => {
    const updateViewport = () => setIsNarrowScreen(window.innerWidth < 480)
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

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
  const chartAxisFontSize = isNarrowScreen ? 10 : 11
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
    const totalInventory =
      numberValue(property.totalRentableInventory ?? property.totalUnits) ?? 0
    const occupiedInventory =
      numberValue(property.occupiedRentableInventory ?? property.occupiedUnits) ?? 0
    const occupancyPercent = numberValue(
      property.rentableInventoryOccupancyRatePercent ?? property.occupancyRatePercent
    )
    return {
      ...property,
      propertyLabel: property.propertyName || `Property ${property.propertyId}`,
      occupiedInventory,
      availableInventory: Math.max(0, totalInventory - occupiedInventory),
      totalInventory,
      occupancyPercent:
        occupancyPercent ??
        (totalInventory > 0 ? (occupiedInventory / totalInventory) * 100 : 0),
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
        className="flex flex-col gap-3 rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between"
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
              className="mt-1 block rounded-md border border-[#E3E8DF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#243447]"
            />
          </label>
          <label className="text-xs font-medium text-[#5B6875]">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 block rounded-md border border-[#E3E8DF] bg-[#FBF8F2] px-3 py-2 text-sm text-[#243447]"
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
        <div className="flex justify-center rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-12 shadow-sm">
          <Loader text="Loading live report analytics..." size="md" center />
        </div>
      ) : error ? (
        <EmptyState title="Report data unavailable" message="The report request failed. Retry after checking the backend connection and your access." />
      ) : !summary ? (
        <EmptyState title="No report summary returned" message="The backend response did not include a report summary for this period." />
      ) : (
        <>
          <p className="inline-flex rounded-full border border-[#E3E8DF] bg-[#F8F1E6]/95 px-3 py-1.5 text-xs text-[#5B6875] shadow-sm" aria-live="polite">
            Data period: {report?.startDate || appliedRange.startDate} – {report?.endDate || appliedRange.endDate}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {headlineMetrics(summary).map(({ label, note, value, icon: Icon, format }) => (
              <article key={label} className="rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-3.5 shadow-[0_8px_22px_-20px_rgba(48,37,31,0.45)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#3F7D58] sm:text-sm">{label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#5B6875] sm:text-xs">{note}</p>
                  </div>
                  <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8EFE3] text-[#3F7D58] sm:grid">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold leading-none tracking-tight text-[#243447] tabular-nums sm:mt-5 sm:text-3xl">{format(value)}</p>
              </article>
            ))}
          </div>

          {(() => {
            const inventoryRows = [
              { label: 'Whole-property rentals', value: summary?.totalDirectProperties, tone: 'green' },
              { label: 'Apartment units', value: summary?.totalUnits, tone: 'green' },
              { label: 'Other units', value: summary?.otherUnits, tone: 'amber' },
            ]
            const inventoryTotal = inventoryRows.reduce((total, row) => total + (numberValue(row.value) ?? 0), 0)
            const occupiedUnits = numberValue(summary?.occupiedUnits)
            const vacantUnits = numberValue(summary?.vacantUnits)
            const totalUnits = numberValue(summary?.totalUnits)
            const occupiedUnitPercent = numberValue(summary?.occupancyRatePercent) ?? (totalUnits && occupiedUnits !== null ? (occupiedUnits / totalUnits) * 100 : null)
            const vacantUnitPercent = numberValue(summary?.vacancyRatePercent) ?? (totalUnits && vacantUnits !== null ? (vacantUnits / totalUnits) * 100 : null)
            const directTotal = numberValue(summary?.totalDirectProperties)
            const occupiedDirect = numberValue(summary?.occupiedDirectProperties)
            const vacantDirect = numberValue(summary?.vacantDirectProperties)
            const directOccupiedPercent = directTotal && occupiedDirect !== null ? (occupiedDirect / directTotal) * 100 : null
            const directVacantPercent = directTotal && vacantDirect !== null ? (vacantDirect / directTotal) * 100 : null

            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-4 shadow-[0_8px_22px_-20px_rgba(48,37,31,0.45)] sm:p-5">
                  <div className="mb-2">
                    <h2 className="font-serif text-xl font-semibold text-[#243447]">Property inventory</h2>
                    <p className="mt-1 text-xs text-[#5B6875]">A quick breakdown of homes and units.</p>
                  </div>
                  {inventoryTotal > 0 ? inventoryRows.map((row) => (
                    <BreakdownRow key={row.label} {...row} percent={(numberValue(row.value) ?? 0) / inventoryTotal * 100} />
                  )) : <p className="py-4 text-sm text-[#5B6875]">Inventory breakdown is not available for this period.</p>}
                </section>

                <section className="rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-4 shadow-[0_8px_22px_-20px_rgba(48,37,31,0.45)] sm:p-5">
                  <div className="mb-2">
                    <h2 className="font-serif text-xl font-semibold text-[#243447]">Occupancy</h2>
                    <p className="mt-1 text-xs text-[#5B6875]">Occupied and available rentals.</p>
                  </div>
                  {totalUnits !== null && totalUnits > 0 ? (
                    <>
                      <BreakdownRow label="Occupied apartment units" value={summary?.occupiedUnits} percent={occupiedUnitPercent} />
                      <BreakdownRow label="Vacant apartment units" value={summary?.vacantUnits} percent={vacantUnitPercent} tone="amber" />
                    </>
                  ) : (
                    <p className="py-4 text-sm text-[#5B6875]">Unit occupancy details are not available for this period.</p>
                  )}
                  {directTotal !== null && directTotal > 0 && (
                    <div className="mt-2 border-t border-[#E3E8DF] pt-2">
                      <BreakdownRow label="Occupied whole-property rentals" value={summary?.occupiedDirectProperties} percent={directOccupiedPercent} />
                      <BreakdownRow label="Vacant whole-property rentals" value={summary?.vacantDirectProperties} percent={directVacantPercent} tone="amber" />
                    </div>
                  )}
                </section>
              </div>
            )
          })()}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
            <section className="overflow-hidden rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-4 shadow-[0_12px_35px_-24px_rgba(48,37,31,0.3)] sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A6959]">Cash flow</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#243447]">Monthly rent collected</h2>
                  <p className="mt-1 text-xs text-[#5B6875]">Successful payments during the selected period.</p>
                </div>
                <span className="rounded-2xl bg-[#E8EFE3] p-3 text-[#3F7D58]"><IndianRupee className="h-5 w-5" /></span>
              </div>
              {incomeTrend.length ? (
                <div className="mt-5 h-64 w-full sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={incomeTrend} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="rentCollectedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3F7D58" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#3F7D58" stopOpacity={0.015} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 6" stroke="#E3E8DF" vertical={false} />
                      <XAxis dataKey="monthLabel" stroke="#7A6959" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis stroke="#7A6959" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} width={72} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Collected']} contentStyle={chartTooltipContentStyle} />
                      <Area type="monotone" dataKey="incomeCollected" name="Collected" stroke="#315F46" strokeWidth={3} fill="url(#rentCollectedFill)" activeDot={{ r: 6, fill: '#315F46', stroke: '#fff', strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No monthly income rows were returned for this date range.</p>}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 p-4 shadow-[0_12px_35px_-24px_rgba(48,37,31,0.3)] sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A6959]">Spend breakdown</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#243447]">Expenses by category</h2>
                  <p className="mt-1 text-xs text-[#5B6875]">Recorded costs grouped by type.</p>
                </div>
                <span className="rounded-2xl bg-[#E8EFE3] p-3 text-[#3F7D58]"><Wrench className="h-5 w-5" /></span>
              </div>
              {expenseBreakdown.length ? (
                <div className="mt-5 h-64 w-full sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 8, right: 18, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="4 6" stroke="#E3E8DF" horizontal={false} />
                      <XAxis type="number" stroke="#7A6959" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                      <YAxis type="category" dataKey="categoryLabel" stroke="#5B6875" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} width={isNarrowScreen ? 96 : 132} tickFormatter={(value) => isNarrowScreen && String(value).length > 14 ? `${String(value).slice(0, 12)}…` : value} />
                      <Tooltip formatter={(value) => [formatMoney(value), 'Expense']} contentStyle={chartTooltipContentStyle} />
                      <Bar dataKey="amount" name="Expense" fill="#B7791F" radius={[0, 9, 9, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-6 text-sm text-[#5B6875]">No expense breakdown rows were returned for this date range.</p>}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[#E3E8DF] bg-[#F8F1E6]/95 shadow-[0_14px_38px_-28px_rgba(48,37,31,0.3)]">
            <div className="flex flex-col gap-3 border-b border-[#E3E8DF] bg-[#F1E7D8] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A6959]">Portfolio comparison</p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[#243447]"><Building2 className="h-5 w-5 text-[#3F7D58]" />Property performance</h2>
                <p className="mt-1 text-sm text-[#5B6875]">Compare occupancy and financial results across each property.</p>
              </div>
              <span className="w-fit rounded-full border border-[#D8C8AA] bg-[#FBF8F2] px-3 py-1.5 text-xs font-semibold text-[#3F7D58]">{propertyPerformance.length} properties</span>
            </div>
            {propertyPerformance.length ? (
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 sm:gap-5 sm:p-5">
                <div className="rounded-2xl border border-[#E3E8DF] bg-[#FBF8F2] p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#243447]">Rental occupancy</h3>
                      <p className="mt-1 text-xs text-[#5B6875]">Occupied versus available inventory</p>
                    </div>
                    <div className="flex gap-2 text-[10px] font-medium text-[#5B6875] sm:gap-3">
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#3F7D58]" />Occupied</span>
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#D8C8AA]" />Available</span>
                    </div>
                  </div>
                  <div className="w-full" style={{ height: Math.max(240, propertyPerformance.length * (isNarrowScreen ? 50 : 58)) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyPerformance} layout="vertical" margin={{ top: 8, right: isNarrowScreen ? 4 : 18, left: 4, bottom: 4 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="4 6" stroke="#E3E8DF" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} stroke="#7A6959" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis type="category" dataKey="propertyLabel" width={isNarrowScreen ? 92 : 124} stroke="#5B6875" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => isNarrowScreen && String(value).length > 13 ? `${String(value).slice(0, 11)}…` : value} />
                      <Tooltip formatter={(value, name) => [Number(value).toLocaleString('en-IN'), name]} labelFormatter={(label) => label} contentStyle={chartTooltipContentStyle} />
                      <Bar dataKey="occupiedInventory" name="Occupied" stackId="inventory" fill="#3F7D58" radius={[8, 0, 0, 8]} maxBarSize={25} />
                      <Bar dataKey="availableInventory" name="Available" stackId="inventory" fill="#D8C8AA" radius={[0, 8, 8, 0]} maxBarSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E3E8DF] bg-[#FBF8F2] p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#243447]">Income and costs</h3>
                      <p className="mt-1 text-xs text-[#5B6875]">Financial results by property</p>
                    </div>
                    <span className="rounded-xl bg-[#E8EFE3] p-2 text-[#3F7D58]"><IndianRupee className="h-4 w-4" /></span>
                  </div>
                  <div className="w-full" style={{ height: Math.max(240, propertyPerformance.length * (isNarrowScreen ? 50 : 58)) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyPerformance} layout="vertical" margin={{ top: 8, right: isNarrowScreen ? 4 : 18, left: 4, bottom: 4 }} barCategoryGap="24%">
                      <CartesianGrid strokeDasharray="4 6" stroke="#E3E8DF" horizontal={false} />
                      <XAxis type="number" stroke="#7A6959" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                      <YAxis type="category" dataKey="propertyLabel" width={isNarrowScreen ? 92 : 124} stroke="#5B6875" fontSize={chartAxisFontSize} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => isNarrowScreen && String(value).length > 13 ? `${String(value).slice(0, 11)}…` : value} />
                      <Tooltip formatter={(value, name) => [formatMoney(value), name]} labelFormatter={(label) => label} contentStyle={chartTooltipContentStyle} />
                      <Bar dataKey="incomeCollected" name="Income" fill="#315F46" radius={[0, 7, 7, 0]} maxBarSize={14} />
                      <Bar dataKey="recordedExpenses" name="Expenses" fill="#B7791F" radius={[0, 7, 7, 0]} maxBarSize={14} />
                      <Bar dataKey="maintenanceCost" name="Maintenance" fill="#8A9B79" radius={[0, 7, 7, 0]} maxBarSize={14} />
                      <Bar dataKey="estimatedNetIncome" name="Net income" fill="#D8C8AA" radius={[0, 7, 7, 0]} maxBarSize={14} />
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
