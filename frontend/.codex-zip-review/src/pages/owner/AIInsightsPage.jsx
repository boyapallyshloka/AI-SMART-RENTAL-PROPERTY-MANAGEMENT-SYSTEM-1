import React, { useRef, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { predictRentalDemand } from '../../api/aiApi'
import { Button, EmptyState } from '../../components/ui'
import { AlertCircle, Info, RotateCcw, Sparkles, TrendingUp } from 'lucide-react'

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleDateString('en-IN', { month: 'long' }),
}))

const initialPeriod = new Date()

export default function AIInsightsPage() {
  const [form, setForm] = useState({
    city: '',
    area: '',
    year: initialPeriod.getFullYear(),
    month: initialPeriod.getMonth() + 1,
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastRequest = useRef(null)

  const runPrediction = async (request) => {
    setLoading(true)
    setError('')
    try {
      const response = await predictRentalDemand(request)
      const data = response?.data ?? response
      if (data?.success === false) {
        throw new Error('The backend could not generate a rental-demand forecast for this location and period.')
      }
      setResult(data)
      lastRequest.current = request
    } catch (requestError) {
      setResult(null)
      setError(requestError?.message || 'Could not retrieve the forecast from the backend.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const request = {
      city: form.city.trim(),
      area: form.area.trim(),
      year: Number(form.year),
      month: Number(form.month),
    }
    if (!request.city || !request.area) {
      setError('Enter a city and area before requesting a forecast.')
      setResult(null)
      return
    }
    runPrediction(request)
  }

  const forecastValue = result?.predictedDemandCount ?? result?.prediction

  return (
    <DashboardLayout defaultRole="owner" activeItem="ai-insights" pageTitle="AI Insights">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-[#243447] sm:text-3xl">
            <Sparkles className="h-6 w-6 text-[#315A7D]" /> Rental Demand Forecast
          </h1>
          <p className="mt-1 text-sm text-[#5B6875]">
            Request a forecast from the backend for a city, locality, and month.
          </p>
        </header>

        <div className="flex items-start gap-3 rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] p-4 text-sm text-[#8A5B16]">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Decision-support only.</strong> Use this forecast as one input when planning. It is not a guarantee of future demand.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#243447]">
              City
              <input
                required
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                autoComplete="address-level2"
                className="mt-1 block w-full rounded-md border border-[#D9E0E6] px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-medium text-[#243447]">
              Area / locality
              <input
                required
                value={form.area}
                onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
                autoComplete="address-level3"
                className="mt-1 block w-full rounded-md border border-[#D9E0E6] px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-medium text-[#243447]">
              Forecast year
              <input
                required
                type="number"
                min="2020"
                max="2100"
                value={form.year}
                onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
                className="mt-1 block w-full rounded-md border border-[#D9E0E6] px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-medium text-[#243447]">
              Forecast month
              <select
                value={form.month}
                onChange={(event) => setForm((current) => ({ ...current, month: event.target.value }))}
                className="mt-1 block w-full rounded-md border border-[#D9E0E6] bg-white px-3 py-2 font-normal"
              >
                {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={loading} leftIcon={<TrendingUp className="h-4 w-4" />}>
              Get forecast
            </Button>
            {lastRequest.current && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                leftIcon={<RotateCcw className="h-4 w-4" />}
                onClick={() => runPrediction(lastRequest.current)}
              >
                Refresh forecast
              </Button>
            )}
          </div>
        </form>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-[#F4B4B4] bg-[#FDF2F2] p-3 text-sm text-[#8A2E2C]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-[#D9E0E6] bg-white p-8 text-center text-sm text-[#5B6875]" role="status">
            Requesting forecast from the backend…
          </div>
        ) : result ? (
          <section className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#243447]">Rental demand forecast</h2>
                <p className="mt-1 text-sm text-[#5B6875]">
                  {[result.areaLocality || form.area, result.city || form.city, result.forecastPeriod].filter(Boolean).join(' · ')}
                </p>
              </div>
              {result.modelVersion && <span className="rounded-md border border-[#D9E0E6] bg-[#F7F8FA] px-2 py-1 text-xs text-[#5B6875]">Model {result.modelVersion}</span>}
            </div>
            {forecastValue == null ? (
              <div className="mt-5"><EmptyState title="Forecast value unavailable" message="The backend response did not include a predicted demand value." /></div>
            ) : (
              <div className="mt-5 rounded-lg bg-[#EAF2F7] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6875]">Predicted demand</p>
                <p className="mt-1 text-3xl font-bold text-[#315A7D]">
                  {Number(forecastValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  {result.demandUnit ? <span className="ml-2 text-base font-medium">{result.demandUnit}</span> : null}
                </p>
              </div>
            )}
          </section>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-7 w-7" />}
            title="No forecast requested yet"
            message="Enter a city, locality, and forecast period to request live output from the rental-demand service."
          />
        )}
      </div>
    </DashboardLayout>
  )
}
