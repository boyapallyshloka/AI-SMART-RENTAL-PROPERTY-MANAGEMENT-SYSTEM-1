import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { getMyApplications, withdrawApplication } from '../../api/applicationApi'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  FileCheck,
  Plus,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react'

// INR Currency Formatter
const formatInr = (amount) => {
  if (amount == null || isNaN(Number(amount))) return null
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function TenantApplicationsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [withdrawingId, setWithdrawingId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)

  const tenantEmail = (user?.email || '').toLowerCase().trim()

  const loadApplications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyApplications()
      const list = Array.isArray(data) ? data : []
      // Sort newest first by applicationId or createdAt
      list.sort((a, b) => (b.applicationId || 0) - (a.applicationId || 0))
      setApplications(list)
    } catch (err) {
      console.error('Failed to load tenant applications:', err)
      const msg =
        err?.isAuthError || err?.status === 401
          ? 'Your session has expired. Please log in again to view your applications.'
          : err?.isForbidden || err?.status === 403
          ? 'Access restricted: Only authenticated tenants can view submitted applications.'
          : err?.message || 'Unable to load applications. Please try again.'
      setError(msg)
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const handleWithdraw = async (applicationId) => {
    if (!window.confirm('Are you sure you want to withdraw this rental application?')) {
      return
    }

    setWithdrawingId(applicationId)
    setActionFeedback(null)
    try {
      await withdrawApplication(applicationId)
      setActionFeedback({
        type: 'success',
        text: `Application #${applicationId} has been withdrawn successfully.`,
      })
      await loadApplications()
    } catch (err) {
      console.error(`Failed to withdraw application #${applicationId}:`, err)
      setActionFeedback({
        type: 'error',
        text: err?.message || `Failed to withdraw application #${applicationId}. Please try again.`,
      })
    } finally {
      setWithdrawingId(null)
    }
  }

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="my-applications"
      pageTitle="My Applications"
    >
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
              My Rental Applications
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Track the status, submission dates, and manager reviews of your property applications
            </p>
          </div>

          <Link to="/tenant/applications/new">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Submit New Application
            </Button>
          </Link>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-2xs border ${
              actionFeedback.type === 'success'
                ? 'bg-[#EDF7EE] border-[#C6DEC8] text-[#2A583B]'
                : 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B1C1C]'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#E02424] shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-xs underline hover:opacity-75"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="rounded-lg bg-[#FDF2F2] border border-[#F8B4B4] p-4 text-[#9B1C1C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#E02424] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadApplications}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#E02424] text-white text-xs font-semibold hover:bg-[#C81E1E] transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader text="Loading your rental applications..." size="md" center />
          </div>
        ) : applications.length === 0 && !error ? (
          /* Empty State */
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
            <EmptyState
              icon={<FileCheck className="w-8 h-8" />}
              title="No rental applications found"
              message="You haven't submitted any rental applications yet with your account. Select a property and apply for a unit to get started."
              action={
                <Link to="/tenant/applications/new">
                  <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                    Submit New Application
                  </Button>
                </Link>
              }
            />
          </div>
        ) : applications.length > 0 ? (
          /* Applications Table */
          <div className="bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#D9E0E6] flex items-center justify-between">
              <span className="text-xs text-[#5B6875]">
                Displaying{' '}
                <strong className="text-[#243447]">
                  {applications.length}
                </strong>{' '}
                {applications.length === 1 ? 'application' : 'applications'}
              </span>
              {tenantEmail && (
                <span className="text-xs text-[#315A7D] font-medium">
                  Account: {tenantEmail}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">App ID</th>
                    <th className="py-3.5 px-4">Property</th>
                    <th className="py-3.5 px-4">Unit</th>
                    <th className="py-3.5 px-4">Submitted Date</th>
                    <th className="py-3.5 px-4">Move-In Date</th>
                    <th className="py-3.5 px-4">Rent & Deposit</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {applications.map((app) => {
                    const isPending = (app.status || '').toUpperCase() === 'PENDING'
                    const isWithdrawing = withdrawingId === app.applicationId
                    const propName = app.propertyName || `Property #${app.propertyId}`
                    const unitName = app.unitNumber ? `Unit ${app.unitNumber}` : `Unit #${app.unitId}`
                    const rent = formatInr(app.monthlyRent)
                    const deposit = formatInr(app.securityDeposit)

                    return (
                      <tr
                        key={app.applicationId}
                        className="hover:bg-[#F7F8FA] transition-colors"
                      >
                        {/* Application ID */}
                        <td className="py-4 pl-6 pr-4 font-mono font-bold text-xs">
                          <Link
                            to={`/tenant/applications/${app.applicationId}`}
                            className="text-[#315A7D] hover:text-[#214363] hover:underline"
                            title="View Application Details"
                          >
                            #{app.applicationId}
                          </Link>
                        </td>

                        {/* Property Name */}
                        <td className="py-4 px-4 font-semibold text-[#243447] min-w-[180px]">
                          <Link
                            to={`/tenant/applications/${app.applicationId}`}
                            className="flex items-center gap-2 text-[#243447] hover:text-[#315A7D] hover:underline"
                            title="View Application Details"
                          >
                            <Building2 className="w-4 h-4 text-[#315A7D] shrink-0" />
                            <span>{propName}</span>
                          </Link>
                        </td>

                        {/* Unit */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20">
                            {unitName}
                          </span>
                        </td>

                        {/* Submitted Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span>{app.applicationDate || (app.createdAt ? app.createdAt.split('T')[0] : '—')}</span>
                          </div>
                        </td>

                        {/* Move-In Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#243447]">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span>{app.preferredMoveInDate || 'Flexible'}</span>
                          </div>
                        </td>

                        {/* Rent & Deposit */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs">
                          {rent ? (
                            <div>
                              <span className="font-bold text-[#243447]">{rent}</span>
                              <span className="text-[#5B6875]">/mo</span>
                              {deposit && (
                                <span className="block text-[10px] text-[#5B6875]">Dep: {deposit}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#5B6875]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap text-center">
                          <StatusBadge status={app.status} size="sm" />
                          {app.rejectionReason && (
                            <span className="block text-[10px] text-[#8A2E2C] mt-0.5">
                              {app.rejectionReason}
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={`/tenant/applications/${app.applicationId}`}
                              className="text-xs font-semibold text-[#315A7D] hover:text-[#214363] hover:underline transition-colors"
                            >
                              View Details
                            </Link>
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleWithdraw(app.applicationId)}
                                disabled={isWithdrawing}
                                className="inline-flex items-center gap-1 text-xs text-[#8A2E2C] hover:text-[#B94A48] font-medium transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{isWithdrawing ? 'Withdrawing...' : 'Withdraw'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
