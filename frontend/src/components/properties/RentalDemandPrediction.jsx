
import React, { useState } from 'react'
import {
  TrendingUp,
  Building2,
  House,
  CalendarDays,
  Info,
} from 'lucide-react'

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleDateString('en-IN', {
    month: 'long',
  }),
}))

export default function RentalDemandPrediction() {
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const propertyTypes = [
    { name: 'Apartments', Icon: Building2 },
    { name: 'Villas', Icon: House },
    { name: 'Independent Houses', Icon: House },
  ]

  return (
    <section className="space-y-6">
      {/* Page heading */}
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#243447]">
          <TrendingUp className="h-6 w-6 text-[#315A7D]" />
          Rental Demand Prediction
        </h2>

        <p className="mt-1 text-sm text-[#5B6875]">
          View the overall rental demand forecast, monthly trends, and
          demand by property type.
        </p>
      </header>

      {/* Forecast period selection */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm">
        <CalendarDays className="h-5 w-5 text-[#315A7D]" />

        <label className="text-sm font-medium text-[#243447]">
          Forecast year
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="ml-2 rounded-md border border-[#D9E0E6] bg-white px-3 py-2 outline-none focus:border-[#315A7D]"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(
              (optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              )
            )}
          </select>
        </label>

        <label className="text-sm font-medium text-[#243447]">
          Forecast month
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="ml-2 rounded-md border border-[#D9E0E6] bg-white px-3 py-2 outline-none focus:border-[#315A7D]"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Overall forecast */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#D9E0E6] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#5B6875]">
            Overall Predicted Demand
          </p>

          <p className="mt-3 text-3xl font-bold text-[#315A7D]">
            —
          </p>

          <p className="mt-2 text-sm text-[#5B6875]">
            Forecast value will appear after backend integration.
          </p>
        </div>

        <div className="rounded-xl border border-[#D9E0E6] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#5B6875]">
            Selected Forecast Period
          </p>

          <p className="mt-3 text-2xl font-bold text-[#243447]">
            {new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
            })}
          </p>

          <p className="mt-2 text-sm text-[#5B6875]">
            Change the year or month above to select a different period.
          </p>
        </div>
      </div>

      {/* Monthly demand trend */}
      <div className="rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#315A7D]" />

          <h3 className="text-lg font-semibold text-[#243447]">
            Monthly Demand Trend
          </h3>
        </div>

        <p className="mt-1 text-sm text-[#5B6875]">
          Track how rental demand changes from month to month.
        </p>

        <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[#D9E0E6] px-5 py-8 text-center">
          <TrendingUp className="h-10 w-10 text-[#9AA8B5]" />

          <p className="mt-3 font-semibold text-[#243447]">
            Trend chart will appear here
          </p>

          <p className="mt-2 max-w-md text-sm text-[#5B6875]">
            Monthly demand data will be displayed after the M3 prediction
            service is integrated. No sample prediction values are used.
          </p>
        </div>
      </div>

      {/* Demand by property type */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#243447]">
            Demand by Property Type
          </h3>

          <p className="mt-1 text-sm text-[#5B6875]">
            View separate demand forecasts for different property types.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {propertyTypes.map(({ name, Icon }) => (
            <div
              key={name}
              className="rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAF2F7]">
                <Icon className="h-6 w-6 text-[#315A7D]" />
              </div>

              <h4 className="mt-4 font-semibold text-[#243447]">
                {name}
              </h4>

              <p className="mt-3 text-2xl font-bold text-[#315A7D]">
                —
              </p>

              <p className="mt-1 text-sm text-[#5B6875]">
                Forecast available after backend integration.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Data notice */}
      <div className="flex items-start gap-3 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] p-4 text-sm text-[#5B6875]">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#315A7D]" />

        <p>
          Prediction values and monthly trends are not available yet.
          This frontend currently provides the dashboard layout only.
          Actual forecasts will be displayed after backend integration.
        </p>
      </div>
    </section>
  )
}
