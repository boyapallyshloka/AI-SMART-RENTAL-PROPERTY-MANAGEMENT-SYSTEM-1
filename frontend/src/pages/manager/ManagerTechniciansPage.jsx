import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, HardHat, Plus, RefreshCw, Trash2, UserRound, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui'
import {
  MAINTENANCE_CATEGORIES,
  createMaintenanceWorker,
  deleteMaintenanceWorker,
  formatCategoryLabel,
  getMaintenanceWorkers,
} from '../../api/maintenanceApi'

const readList = (response) => {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.content)) return value.content
  if (Array.isArray(value?.workers)) return value.workers
  return []
}

const workerId = (worker) => worker?.workerId ?? worker?.id

export default function ManagerTechniciansPage() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', email: '' })

  const loadWorkers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getMaintenanceWorkers()
      setWorkers(readList(response))
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Could not load technicians.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWorkers() }, [loadWorkers])

  const groupedWorkers = useMemo(() => {
    const groups = new Map()
    workers.forEach((worker) => {
      const service = String(worker?.specialization || worker?.service || 'OTHER').toUpperCase()
      if (!groups.has(service)) groups.set(service, [])
      groups.get(service).push(worker)
    })
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [workers])

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.specialization) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await createMaintenanceWorker({
        name: form.name.trim(),
        specialization: form.specialization,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        availabilityStatus: 'AVAILABLE',
      })
      const created = response?.data ?? response
      if (workerId(created)) setWorkers((current) => [...current, created])
      else await loadWorkers()
      setForm({ name: '', specialization: '', phone: '', email: '' })
      setNotice('Technician added.')
    } catch (createError) {
      setError(createError?.response?.data?.message || createError?.message || 'Could not add technician.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (worker) => {
    const id = workerId(worker)
    if (!id || !window.confirm(`Remove ${worker.name || 'this technician'}?`)) return
    setRemovingId(id)
    setError('')
    setNotice('')
    try {
      await deleteMaintenanceWorker(id)
      setWorkers((current) => current.filter((item) => String(workerId(item)) !== String(id)))
      setNotice(`${worker.name || 'Technician'} removed.`)
    } catch (removeError) {
      setError(removeError?.response?.data?.message || removeError?.message || 'Could not remove technician.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <DashboardLayout defaultRole="manager" activeItem="technicians" pageTitle="Maintenance Technicians">
      <div className="space-y-6">
        <Link to="/manager/maintenance" className="inline-flex items-center gap-2 text-sm font-medium text-[#315A7D] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Maintenance
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#243447]">Maintenance Technicians</h1>
            <p className="mt-1 text-sm text-[#5B6875]">Manage the technicians available for maintenance tickets.</p>
          </div>
          <Button variant="outline" onClick={loadWorkers} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </header>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

        <form onSubmit={handleCreate} className="rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#315A7D]" />
            <h2 className="text-lg font-semibold">Add a Technician</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">Technician name <span className="text-red-600">*</span>
              <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">Service <span className="text-red-600">*</span>
              <select required value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} className="w-full rounded-lg border border-[#D9E0E6] bg-white px-3 py-2 font-normal">
                <option value="">Select service</option>
                {MAINTENANCE_CATEGORIES.map((category) => <option key={category} value={category}>{formatCategoryLabel(category)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Phone
              <input type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
            </label>
            <label className="space-y-1 text-sm font-medium">Email
              <input type="email" maxLength={160} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email address" className="w-full rounded-lg border border-[#D9E0E6] px-3 py-2 font-normal" />
            </label>
          </div>
          <Button type="submit" variant="primary" disabled={saving || !form.name.trim() || !form.specialization} leftIcon={<Plus className="h-4 w-4" />} className="mt-4">
            {saving ? 'Adding…' : 'Add Technician'}
          </Button>
        </form>

        <section className="space-y-4">
          <div className="flex items-center gap-2"><HardHat className="h-5 w-5 text-[#315A7D]" /><h2 className="text-lg font-semibold">Technicians</h2><span className="rounded-full bg-[#EAF2F7] px-2.5 py-0.5 text-xs font-semibold text-[#315A7D]">{workers.length}</span></div>
          {loading ? (
            <div className="rounded-xl border border-[#D9E0E6] bg-white p-8 text-center text-sm text-[#5B6875]">Loading technicians…</div>
          ) : workers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C9D7E3] bg-white p-8 text-center text-sm text-[#5B6875]">No technicians are registered yet. Add one above to make them available for ticket dispatch.</div>
          ) : groupedWorkers.map(([service, serviceWorkers]) => (
            <div key={service} className="overflow-hidden rounded-xl border border-[#D9E0E6] bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#D9E0E6] bg-[#F3F7FA] px-4 py-3"><Wrench className="h-4 w-4 text-[#315A7D]" /><h3 className="font-semibold">{formatCategoryLabel(service)}</h3><span className="text-xs text-[#5B6875]">{serviceWorkers.length} {serviceWorkers.length === 1 ? 'technician' : 'technicians'}</span></div>
              <div className="divide-y divide-[#E5EAF0]">
                {serviceWorkers.map((worker) => {
                  const id = workerId(worker)
                  const available = String(worker.availabilityStatus || 'AVAILABLE').toUpperCase() === 'AVAILABLE'
                  return <article key={id || `${service}-${worker.name}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="rounded-full bg-[#EAF2F7] p-2 text-[#315A7D]"><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0"><p className="font-semibold">{worker.name || 'Unnamed technician'}</p><p className="text-sm text-[#5B6875]">{[worker.phone, worker.email].filter(Boolean).join(' · ') || 'No contact details'}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{available ? 'Available' : worker.availabilityStatus}</span>
                      <Button variant="outline" disabled={!id || removingId === id} onClick={() => handleRemove(worker)} leftIcon={<Trash2 className="h-4 w-4" />} className="text-red-700">
                        {removingId === id ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  </article>
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </DashboardLayout>
  )
}
