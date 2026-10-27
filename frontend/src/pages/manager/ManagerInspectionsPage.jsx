import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardCheck, Plus, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui'
import { getManagerAssignedProperties } from '../../api/propertyApi'
import { createManagerInspection, getManagerInspections } from '../../api/inspectionApi'

const unwrapList = (response) => {
  const queue = [response]
  const seen = new Set()
  while (queue.length) {
    const value = queue.shift()
    if (!value || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) return value
    for (const key of ['content', 'properties', 'inspections', 'items', 'results', 'data']) {
      if (value[key] && typeof value[key] === 'object') queue.push(value[key])
    }
  }
  return []
}

const propertyIdOf = (property) => property?.propertyId ?? property?.id
const propertyNameOf = (property) => property?.propertyName ?? property?.name ?? `Property #${propertyIdOf(property)}`
const today = () => new Date().toISOString().slice(0, 10)
const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

export default function ManagerInspectionsPage() {
  const [properties, setProperties] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    propertyId: '',
    inspectionDate: today(),
    inspectorName: '',
    passed: 'true',
    hasIssuesRequiringAttention: false,
    notes: '',
  })

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [propertyResult, inspectionResult] = await Promise.allSettled([
        getManagerAssignedProperties(),
        getManagerInspections(),
      ])
      const propertyList = propertyResult.status === 'fulfilled'
        ? unwrapList(propertyResult.value)
        : []
      const inspectionList = inspectionResult.status === 'fulfilled'
        ? unwrapList(inspectionResult.value)
        : []
      setProperties(propertyList)
      setInspections(inspectionList)
      setForm((current) => ({
        ...current,
        propertyId: current.propertyId || String(propertyIdOf(propertyList[0]) || ''),
      }))
      const loadErrors = [propertyResult, inspectionResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => errorMessage(result.reason, 'Could not load inspections.'))
      if (loadErrors.length) setError(loadErrors.join(' '))
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load inspection records.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPage() }, [loadPage])

  const orderedInspections = useMemo(
    () => [...inspections].sort((a, b) => String(b.inspectionDate || '').localeCompare(String(a.inspectionDate || ''))),
    [inspections],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.propertyId || !form.inspectionDate || !form.inspectorName.trim()) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const created = await createManagerInspection({
        propertyId: Number(form.propertyId),
        inspectionDate: form.inspectionDate,
        inspectorName: form.inspectorName.trim(),
        passed: form.passed === 'true',
        hasIssuesRequiringAttention: Boolean(form.hasIssuesRequiringAttention),
        notes: form.notes.trim() || null,
      })
      const record = created?.data ?? created
      setInspections((current) => [record, ...current])
      setForm((current) => ({ ...current, inspectionDate: today(), inspectorName: '', notes: '', passed: 'true', hasIssuesRequiringAttention: false }))
      setNotice('Inspection record saved.')
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the inspection.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout defaultRole="manager" activeItem="inspections" pageTitle="Property Inspections">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#243447]">Property Inspections</h1>
            <p className="mt-1 text-sm text-[#5B6875]">Review and record completed inspections for your assigned properties.</p>
          </div>
          <Button variant="outline" onClick={loadPage} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
        </header>

        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

        <form onSubmit={handleSubmit} className="rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-[#315A7D]" /><h2 className="text-lg font-semibold">Record an Inspection</h2></div>
          {properties.length === 0 && !loading ? (
            <p className="rounded-lg bg-[#F3F7FA] p-4 text-sm text-[#5B6875]">No assigned properties are available for inspection.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-sm font-medium">Property <span className="text-red-600">*</span>
                  <select required value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value })} className="w-full rounded-lg border border-[#D9E0E6] bg-white px-3 py-2 font-normal">
                    <option value="">Select property</option>
                    {properties.map((property) => <option key={propertyIdOf(property)} value={propertyIdOf(property)}>{propertyNameOf(property)}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">Inspection date <span className="text-red-600">*</span>
                  <input required type="date" max={today()} value={form.inspectionDate} onChange={(event) => setForm({ ...form, inspectionDate: event.target.value })} className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Inspector <span className="text-red-600">*</span>
                  <input required maxLength={120} value={form.inspectorName} onChange={(event) => setForm({ ...form, inspectorName: event.target.value })} placeholder="Inspector name" className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Result <span className="text-red-600">*</span>
                  <select value={form.passed} onChange={(event) => setForm({ ...form, passed: event.target.value })} className="w-full rounded-lg border border-[#D9E0E6] bg-white px-3 py-2 font-normal">
                    <option value="true">Passed</option><option value="false">Failed</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end rounded-lg border border-[#D9E0E6] px-3 py-3 text-sm">
                  <input type="checkbox" checked={form.hasIssuesRequiringAttention} onChange={(event) => setForm({ ...form, hasIssuesRequiringAttention: event.target.checked })} />
                  Issues need attention
                </label>
                <label className="space-y-1 text-sm font-medium md:col-span-2 xl:col-span-3">Notes
                  <textarea maxLength={2000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Findings or follow-up notes" className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
                </label>
              </div>
              <Button type="submit" disabled={saving || loading || properties.length === 0} leftIcon={<ClipboardCheck className="h-4 w-4" />} className="mt-4">{saving ? 'Saving…' : 'Save Inspection'}</Button>
            </>
          )}
        </form>

        <section className="space-y-3">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#315A7D]" /><h2 className="text-lg font-semibold">Inspection History</h2><span className="rounded-full bg-[#EAF2F7] px-2.5 py-0.5 text-xs font-semibold text-[#315A7D]">{inspections.length}</span></div>
          {loading ? <div className="rounded-xl border border-[#D9E0E6] bg-white p-8 text-center text-sm text-[#5B6875]">Loading inspections…</div>
            : orderedInspections.length === 0 ? <div className="rounded-xl border border-dashed border-[#C9D7E3] bg-white p-8 text-center text-sm text-[#5B6875]">No inspection records found for your assigned properties.</div>
              : <div className="overflow-hidden rounded-xl border border-[#D9E0E6] bg-white shadow-sm"><div className="divide-y divide-[#E5EAF0]">
                {orderedInspections.map((inspection) => {
                  const passed = inspection.passed === true
                  const hasIssues = inspection.hasIssuesRequiringAttention === true
                  return <article key={inspection.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`rounded-lg p-2 ${passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}</span>
                      <div className="min-w-0"><h3 className="font-semibold text-[#243447]">{inspection.propertyName || `Property #${inspection.propertyId}`}</h3><p className="mt-1 text-sm text-[#5B6875]">{inspection.inspectionDate || 'Date unavailable'} · Inspector: {inspection.inspectorName || '—'}</p>{inspection.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-[#46596B]">{inspection.notes}</p>}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2.5 py-1 ${passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{passed ? 'Passed' : 'Failed'}</span>
                      {hasIssues && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800"><ShieldAlert className="h-3.5 w-3.5" />Attention needed</span>}
                    </div>
                  </article>
                })}
              </div></div>}
        </section>
      </div>
    </DashboardLayout>
  )
}
