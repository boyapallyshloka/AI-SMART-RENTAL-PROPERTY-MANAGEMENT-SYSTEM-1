import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { getApplicationById, withdrawApplication } from '../../api/applicationApi'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  IndianRupee,
  User,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
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

// Date Formatter
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// Date & Time Formatter
const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function TenantApplicationDetailsPage() {
  const { id } = useParams()

  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null) // '404' | '401' | '403' | 'network' | 'server'
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [actionFeedback, setActionFeedback] = useState(null)

  const loadApplication = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setErrorType(null)

    try {
      const data = await getApplicationById(id)
      setApplication(data)
    } catch (err) {
      console.error(`Failed to load application #${id}:`, err)
      const status = err?.status
      if (err?.isNotFound || status === 404) {
        setErrorType('404')
        setError(`Application #${id} was not found. It may have been deleted or the ID is invalid.`)
      } else if (err?.isAuthError || status === 401) {
        setErrorType('401')
        setError('Your session has expired. Please sign in again to view this application.')
      } else if (err?.isForbidden || status === 403) {
        setErrorType('403')
        setError('Access restricted: You do not have permission to view this application.')
      } else if (err?.isNetworkError) {
        setErrorType('network')
        setError('Network error: Unable to reach the server. Please verify your internet connection.')
      } else {
        setErrorType('server')
        setError(err?.message || 'Failed to load application details. Please try again.')
      }
      setApplication(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadApplication()
  }, [loadApplication])

  const handleWithdraw = async () => {
    if (!application) return
    const confirmed = window.confirm(
      `Are you sure you want to withdraw application #${application.applicationId}? This action cannot be undone.`
    )
    if (!confirmed) return

    setIsWithdrawing(true)
    setActionFeedback(null)

    try {
      await withdrawApplication(application.applicationId)
      setActionFeedback({
        type: 'success',
        text: `Application #${application.applicationId} has been withdrawn successfully.`,
      })
      // Reload fresh application state from backend
      await loadApplication()
    } catch (err) {
      console.error(`Failed to withdraw application #${application.applicationId}:`, err)
      setActionFeedback({
        type: 'error',
        text: err?.message || 'Failed to withdraw application. Please try again.',
      })
    } finally {
      setIsWithdrawing(false)
    }
  }

  const isPending = (application?.status || '').toUpperCase() === 'PENDING'
  const rentFormatted = formatInr(application?.monthlyRent)
  const depositFormatted = formatInr(application?.securityDeposit)

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="my-applications"
      pageTitle="Application Details"
    >
      <div className="space-y-6 pb-12 max-w-5xl">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/tenant/applications"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#315A7D] hover:text-[#214363] transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Applications</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
                Application Details
              </h1>
              {application?.applicationId && (
                <span className="font-mono text-xs font-bold text-[#315A7D] bg-[#EAF2F7] px-2.5 py-1 rounded-md border border-[#D9E0E6]">
                  #{application.applicationId}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#5B6875]">
              Real-time application status, property assignment, and submission data
            </p>
          </div>

          {/* Action Button: Withdraw if PENDING */}
          {application && isPending && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="text-[#8A2E2C] border-[#F8B4B4] hover:bg-[#FDF2F2] hover:text-[#B94A48]"
                leftIcon={<XCircle className="w-4 h-4 text-[#8A2E2C]" />}
              >
                {isWithdrawing ? 'Withdrawing...' : 'Withdraw Application'}
              </Button>
            </div>
          )}
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

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-16 shadow-2xs flex justify-center">
            <Loader text="Loading rental application details..." size="md" center />
          </div>
        ) : error ? (
          /* Error / Empty States */
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
            {errorType === '404' ? (
              <EmptyState
                icon={<AlertCircle className="w-10 h-10 text-[#B94A48]" />}
                title="Application Not Found"
                message={error}
                action={
                  <Link to="/tenant/applications">
                    <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                      Return to Applications
                    </Button>
                  </Link>
                }
              />
            ) : errorType === '401' ? (
              <EmptyState
                icon={<ShieldAlert className="w-10 h-10 text-[#B7791F]" />}
                title="Session Expired"
                message={error}
                action={
                  <Link to="/login">
                    <Button variant="primary">
                      Sign In Again
                    </Button>
                  </Link>
                }
              />
            ) : errorType === '403' ? (
              <EmptyState
                icon={<ShieldAlert className="w-10 h-10 text-[#8A2E2C]" />}
                title="Access Restricted"
                message={error}
                action={
                  <Link to="/tenant/applications">
                    <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                      Back to My Applications
                    </Button>
                  </Link>
                }
              />
            ) : (
              /* Network or Server Error with Manual Retry */
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex p-3 rounded-full bg-[#FDF2F2] border border-[#F8B4B4] text-[#E02424]">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#243447]">
                    Unable to Load Application Details
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5B6875] max-w-md mx-auto">
                    {error}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={loadApplication}
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                  >
                    Try Again
                  </Button>
                  <Link to="/tenant/applications">
                    <Button variant="outline">
                      Back to Applications
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : application ? (
          /* Application Details Content */
          <div className="space-y-6">
            {/* Status Banner Card */}
            <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#F0F4F7] text-[#315A7D]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-[#5B6875] block">Current Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={application.status} size="md" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs text-[#5B6875] border-t sm:border-t-0 pt-3 sm:pt-0">
                <div>
                  <span className="block text-[#5B6875]">Submitted On</span>
                  <span className="font-semibold text-[#243447]">
                    {formatDate(application.applicationDate || application.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-[#5B6875]">Preferred Move-In</span>
                  <span className="font-semibold text-[#243447]">
                    {formatDate(application.preferredMoveInDate) || 'Flexible'}
                  </span>
                </div>
                {application.reviewedAt && (
                  <div>
                    <span className="block text-[#5B6875]">Reviewed At</span>
                    <span className="font-semibold text-[#243447]">
                      {formatDateTime(application.reviewedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Alert (Only displayed when rejectionReason is provided by backend) */}
            {application.rejectionReason && (
              <div className="bg-[#FDF2F2] border border-[#F8B4B4] rounded-lg p-4 text-[#8A2E2C] shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-[#B94A48] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8A2E2C]">
                      Reason for Rejection
                    </h4>
                    <p className="text-sm font-medium text-[#243447]">
                      {application.rejectionReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grid of Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Property & Unit Information */}
              <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
                  <h2 className="text-sm font-bold text-[#243447] uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#315A7D]" />
                    Property & Unit Details
                  </h2>
                  {application.propertyId && (
                    <Link
                      to={`/tenant/properties/${application.propertyId}`}
                      className="text-xs text-[#315A7D] hover:underline font-medium"
                    >
                      View Property
                    </Link>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-[#5B6875] block">Property</span>
                    <span className="font-semibold text-[#243447] text-base">
                      {application.propertyName || `Property #${application.propertyId || '—'}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-xs text-[#5B6875] block">Building</span>
                      <span className="font-medium text-[#243447]">
                        {application.buildingName || (application.buildingId ? `Building #${application.buildingId}` : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#5B6875] block">Unit</span>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20">
                        {application.unitNumber ? `Unit ${application.unitNumber}` : (application.unitId ? `Unit #${application.unitId}` : '—')}
                      </span>
                    </div>
                  </div>

                  {application.floorId != null && (
                    <div className="pt-1">
                      <span className="text-xs text-[#5B6875] block">Floor</span>
                      <span className="font-medium text-[#243447]">
                        Floor #{application.floorId}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Terms */}
              <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
                <div className="border-b border-[#D9E0E6] pb-3">
                  <h2 className="text-sm font-bold text-[#243447] uppercase tracking-wider flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-[#315A7D]" />
                    Rental & Financial Terms
                  </h2>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-[#5B6875] block">Monthly Rent</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-[#243447]">
                        {rentFormatted || '—'}
                      </span>
                      {rentFormatted && <span className="text-xs text-[#5B6875]">/ month</span>}
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="text-xs text-[#5B6875] block">Security Deposit</span>
                    <span className="font-semibold text-[#243447]">
                      {depositFormatted || '—'}
                    </span>
                  </div>

                  <div className="pt-1 text-xs text-[#5B6875]">
                    Terms reflect the verified unit specifications at the time of application submission.
                  </div>
                </div>
              </div>

              {/* Applicant Profile */}
              <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
                <div className="border-b border-[#D9E0E6] pb-3">
                  <h2 className="text-sm font-bold text-[#243447] uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-[#315A7D]" />
                    Applicant Information
                  </h2>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-[#5B6875] block">Full Name</span>
                    <span className="font-semibold text-[#243447]">
                      {application.tenantName || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[#5B6875] block">Email Address</span>
                    <div className="flex items-center gap-1.5 text-[#243447]">
                      <Mail className="w-3.5 h-3.5 text-[#5B6875]" />
                      <span>{application.tenantEmail || '—'}</span>
                    </div>
                  </div>

                  {application.tenantId != null && (
                    <div>
                      <span className="text-xs text-[#5B6875] block">Tenant Profile ID</span>
                      <span className="font-mono text-xs text-[#5B6875]">
                        #{application.tenantId}
                      </span>
                    </div>
                  )}

                  {application.monthlyIncome != null && (
                    <div>
                      <span className="text-xs text-[#5B6875] block">Monthly Gross Income</span>
                      <span className="font-semibold text-[#243447]">
                        {formatInr(application.monthlyIncome)} / mo
                      </span>
                    </div>
                  )}

                  {application.employerOccupation && (
                    <div>
                      <span className="text-xs text-[#5B6875] block">Employer / Occupation</span>
                      <span className="font-medium text-[#243447]">
                        {application.employerOccupation}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submission Notes & Message */}
              <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
                <div className="border-b border-[#D9E0E6] pb-3">
                  <h2 className="text-sm font-bold text-[#243447] uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#315A7D]" />
                    Applicant Message
                  </h2>
                </div>

                <div className="text-sm">
                  {application.message ? (
                    <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-[#243447] whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                      {application.message}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5B6875] italic">
                      No additional message or notes provided with this application.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Metadata Footer */}
            <div className="bg-white rounded-lg border border-[#D9E0E6] px-6 py-4 shadow-2xs text-xs text-[#5B6875] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span>Record Created: </span>
                <span className="font-medium text-[#243447]">
                  {formatDateTime(application.createdAt)}
                </span>
              </div>
              {application.updatedAt && (
                <div>
                  <span>Last Updated: </span>
                  <span className="font-medium text-[#243447]">
                    {formatDateTime(application.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
