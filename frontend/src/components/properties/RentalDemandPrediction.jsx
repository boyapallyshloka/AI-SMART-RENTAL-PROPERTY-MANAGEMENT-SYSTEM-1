import React, { useState } from 'react'
import { Building2, CalendarDays, House, Info, TrendingUp } from 'lucide-react'

const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleDateString('en-IN', { month: 'long' }),
}))

export default function RentalDemandPrediction() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const period = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  const categories = [
    { title: 'Apartments', icon: Building2 },
    { title: 'Villas', icon: House },
    { title: 'Independent houses', icon: House },
  ]

  return (
    <section className="space-y-4 rounded-2xl border border-[#C9D9E8] bg-gradient-to-br from-white via-[#F8FBFE] to-[#EAF2F8] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#17324D]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#315A7D] text-white">
              <TrendingUp className="h-4 w-4" />
            </span>
            Rental demand forecast
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#5B7185]">
            A snapshot for {period}. Forecast values will appear when the demand prediction service is connected.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D5E3EF] bg-white p-2">
          <CalendarDays className="ml-1 h-4 w-4 text-[#315A7D]" />
          <label className="sr-only" htmlFor="demand-year">Forecast year</label>
          <select
            id="demand-year"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-lg border border-[#D9E0E6] bg-white px-2.5 py-2 text-sm text-[#243447] outline-none focus:border-[#315A7D]"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="demand-month">Forecast month</label>
          <select
            id="demand-month"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="rounded-lg border border-[#D9E0E6] bg-white px-2.5 py-2 text-sm text-[#243447] outline-none focus:border-[#315A7D]"
          >
            {months.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {categories.map(({ title, icon: Icon }) => (
          <div key={title} className="flex items-center gap-3 rounded-xl border border-[#D8E5EF] bg-white/90 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF2F8] text-[#315A7D]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#243447]">{title}</p>
              <p className="mt-0.5 text-xs text-[#60758A]">Forecast not available</p>
            </div>
            <span className="ml-auto text-lg font-semibold text-[#315A7D]">—</span>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 border-t border-[#D8E5EF] pt-3 text-xs leading-5 text-[#60758A]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#315A7D]" />
        This is a forecast dashboard layout; it does not display sample or predicted values until the backend service is integrated.
      </p>
    </section>
  )
}
