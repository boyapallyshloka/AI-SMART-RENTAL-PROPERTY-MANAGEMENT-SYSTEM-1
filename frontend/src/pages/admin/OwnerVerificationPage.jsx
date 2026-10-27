import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { getUsersByRoleAndStatus, updateUserStatus } from '../../api/userApi'
import PropertyApprovalPage from './PropertyApprovalPage'
import { Button, EmptyState, Loader, StatusBadge } from '../../components/ui'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

const unwrapList = (response) => {
  const value = response?.data ?? response
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.content)) return value.content
  if (Array.isArray(value?.users)) return value.users
  return []
}

export default function OwnerVerificationPage() {
  const location = useLocation()
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')

  const loadOwners = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getUsersByRoleAndStatus('PROPERTY_OWNER', 'PENDING')
      setOwners(unwrapList(response))
    } catch (err) {
      setOwners([])
      setError(err?.message || 'Could not load pending owner accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOwners()
  }, [loadOwners])

  useEffect(() => {
    if (!location.hash) return undefined
    const targetId = location.hash.slice(1)
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  const changeStatus = async (owner, status) => {
    const id = owner?.id ?? owner?.userId
    if (id == null || busyId != null) return
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      await updateUserStatus(id, status)
      setNotice(
        `Owner account ${status === 'ACTIVE' ? 'approved (activated)' : 'blocked'} successfully.`
      )
      await loadOwners()
    } catch (err) {
      setError(err?.message || 'The owner status could not be updated.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardLayout
      defaultRole="admin"
      activeItem="owner-verification"
      pageTitle="Owner Verification"
    >
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#243447]">
              Owner Verification
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#5B6875]">
              Review owner accounts, property submissions, and their verification documents.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadOwners}
            isLoading={loading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>

        {/* Live Feedback Banners */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md border border-[#F4B4B4] bg-[#FDF2F2] p-3 text-xs sm:text-sm text-[#8A2E2C]"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <Button size="sm" variant="outline" onClick={loadOwners}>
              Retry
            </Button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-[#C6DEC8] bg-[#EDF7EE] p-3 text-xs sm:text-sm text-[#2A583B]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </div>
        )}

        {/* Section 1: Live Pending Owner Accounts (Backend Connected) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#243447]">
                Pending Owner Account Registrations
              </h2>
              <p className="text-xs text-[#5B6875]">
                Real database records from <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#D9E0E6]">GET /api/users/filter?role=PROPERTY_OWNER&amp;status=PENDING</code>
              </p>
            </div>
            {!loading && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                {owners.length} Pending Account{owners.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center rounded-lg border border-[#D9E0E6] bg-white p-12 shadow-2xs">
              <Loader text="Loading pending owner accounts from backend..." size="md" center />
            </div>
          ) : owners.length === 0 ? (
            <div className="rounded-lg border border-[#D9E0E6] bg-white p-8 shadow-2xs">
              <EmptyState
                icon={<ShieldCheck className="h-8 w-8 text-[#3F7D58]" />}
                title={error ? 'Owner accounts unavailable' : 'No pending owner accounts'}
                message={
                  error
                    ? 'Unable to connect to the user service. Please retry.'
                    : 'There are currently no property owner accounts awaiting status approval in the database.'
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#D9E0E6] bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F7F8FA] text-[11px] uppercase tracking-wider text-[#5B6875] border-b border-[#D9E0E6]">
                    <tr>
                      <th className="p-3.5">Owner Name</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Registered On</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Account Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E0E6]">
                    {owners.map((owner) => {
                      const id = owner.id ?? owner.userId
                      const name =
                        [owner.firstName, owner.lastName].filter(Boolean).join(' ') ||
                        owner.email ||
                        `Owner #${id ?? '—'}`

                      return (
                        <tr key={id ?? owner.email} className="hover:bg-[#F7F8FA]/60 transition-colors">
                          <td className="p-3.5 font-medium text-[#243447]">
                            <span className="inline-flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-[#315A7D] shrink-0" />
                              {name}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#5B6875]">{owner.email || '—'}</td>
                          <td className="p-3.5 text-[#5B6875]">
                            {owner.createdAt
                              ? new Date(owner.createdAt).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="p-3.5">
                            <StatusBadge status={owner.status} size="sm" />
                          </td>
                          <td className="p-3.5">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={busyId != null}
                                isLoading={busyId === id}
                                onClick={() => changeStatus(owner, 'ACTIVE')}
                                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                              >
                                Approve Account
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={busyId != null}
                                onClick={() => changeStatus(owner, 'BLOCKED')}
                                leftIcon={<XCircle className="h-3.5 w-3.5" />}
                              >
                                Block Account
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <PropertyApprovalPage />
      </div>
    </DashboardLayout>
  )
}
