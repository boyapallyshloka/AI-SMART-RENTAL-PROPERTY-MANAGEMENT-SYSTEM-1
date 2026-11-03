import React, { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, House, Info, LoaderCircle, MapPin, TrendingUp } from 'lucide-react'
import { getOwnerPropertiesWithDetails } from '../../api/propertyApi'
import { predictRentalDemand } from '../../api/rentaldemand'

const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleDateString('en-IN', { month: 'long' }),
}))

export default function RentalDemandPrediction() {
  const now = new Date()
  const [properties, setProperties] = useState([])
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [prediction, setPrediction] = useState(null)
  const [loadingProperties, setLoadingProperties] = useState(true)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getOwnerPropertiesWithDetails()
      .then((records) => { if (!cancelled) setProperties(Array.isArray(records) ? records : []) })
      .catch(() => { if (!cancelled) setError('Unable to load property locations.') })
      .finally(() => { if (!cancelled) setLoadingProperties(false) })
    return () => { cancelled = true }
  }, [])

  const cities = useMemo(() => [...new Set(properties.map((item) => item.city?.trim()).filter(Boolean))].sort(), [properties])
  const areas = useMemo(() => [...new Set(properties.filter((item) => item.city === city).map((item) => item.area?.trim()).filter(Boolean))].sort(), [properties, city])

  const runPrediction = async (event) => {
    event.preventDefault()
    if (!city || !area) return
    setLoadingPrediction(true)
    setError('')
    setPrediction(null)
    try {
      const result = await predictRentalDemand({ city, area, year, month })
      setPrediction(result?.data ?? result)
    } catch (err) {
      setError(err?.message || 'Rental demand forecast is unavailable. Please try again.')
    } finally {
      setLoadingPrediction(false)
    }
  }

  const period = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const count = prediction?.predictedDemandCount

  return (
    <section className="space-y-4 rounded-2xl border border-[#C9D9E8] bg-gradient-to-br from-white via-[#F8FBFE] to-[#EAF2F8] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#17324D]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3F7D58] text-white"><TrendingUp className="h-4 w-4" /></span>Rental demand forecast</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#5B7185]">Backend forecast for {period}. Choose a location from your property portfolio.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D5E3EF] bg-white p-2">
          <CalendarDays className="ml-1 h-4 w-4 text-[#3F7D58]" />
          <label className="sr-only" htmlFor="demand-year">Forecast year</label>
          <select id="demand-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-[#E3E8DF] bg-white px-2.5 py-2 text-sm text-[#111820]">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((value) => <option key={value}>{value}</option>)}
          </select>
          <label className="sr-only" htmlFor="demand-month">Forecast month</label>
          <select id="demand-month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border border-[#E3E8DF] bg-white px-2.5 py-2 text-sm text-[#111820]">
            {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <form onSubmit={runPrediction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-[#D5E3EF] bg-white px-3 py-2 text-sm text-[#5B7185]"><MapPin className="h-4 w-4 shrink-0 text-[#3F7D58]" /><span className="sr-only">City</span><select required value={city} onChange={(e) => { setCity(e.target.value); setArea(''); setPrediction(null) }} disabled={loadingProperties || !cities.length} className="w-full bg-transparent text-[#17324D] outline-none"><option value="">{loadingProperties ? 'Loading cities…' : 'Select city'}</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="flex items-center gap-2 rounded-xl border border-[#D5E3EF] bg-white px-3 py-2 text-sm text-[#5B7185]"><MapPin className="h-4 w-4 shrink-0 text-[#3F7D58]" /><span className="sr-only">Locality</span><select required value={area} onChange={(e) => { setArea(e.target.value); setPrediction(null) }} disabled={!city || !areas.length} className="w-full bg-transparent text-[#17324D] outline-none"><option value="">Select locality</option>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button disabled={!city || !area || loadingPrediction} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3F7D58] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loadingPrediction && <LoaderCircle className="h-4 w-4 animate-spin" />}Get forecast</button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ title: 'Apartments', icon: Building2 }, { title: 'Villas', icon: House }, { title: 'Independent houses', icon: House }].map(({ title, icon: Icon }) => (
          <div key={title} className="flex items-center gap-3 rounded-xl border border-[#D8E5EF] bg-white/90 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF2F8] text-[#3F7D58]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#111820]">{title}</p><p className="mt-0.5 text-xs text-[#60758A]">{prediction ? 'Type breakdown unavailable from backend' : 'Forecast not requested'}</p></div><span className="ml-auto text-lg font-semibold text-[#3F7D58]">—</span></div>
        ))}
      </div>
      {prediction && <div className="rounded-xl border border-[#D8E5EF] bg-white p-4"><p className="text-sm text-[#5B7185]">Predicted applications · {prediction.city || city}, {prediction.areaLocality || area}</p><p className="mt-1 text-3xl font-bold text-[#17324D]">{count ?? prediction.prediction ?? '—'}</p><p className="text-xs text-[#60758A]">{prediction.forecastPeriod || period}{prediction.demandUnit ? ` · ${prediction.demandUnit}` : ''}</p></div>}
      <p className="flex items-start gap-2 border-t border-[#D8E5EF] pt-3 text-xs leading-5 text-[#60758A]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3F7D58]" />The connected backend predicts demand for a city and locality. Property-type breakdown and alternative-locality recommendations are not available in its current API.</p>
    </section>
  )
}
