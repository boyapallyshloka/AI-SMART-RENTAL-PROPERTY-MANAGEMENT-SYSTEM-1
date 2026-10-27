import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import {
  getApplicationById,
  reviewApplication,
  APPLICATION_STATUSES,
} from '../../api/applicationApi'
import PaymentRiskAnalysisCard from '../../components/applications/PaymentRiskAnalysisCard'
import TenantDocumentsCard from '../../components/applications/TenantDocumentsCard'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
  Textarea,
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
  RefreshCw,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Check,
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

/**
 * Format error messages safely based on backend response status
 */
const getReviewErrorMessage = (err) => {
  if (err?.isAuthError || err?.status === 401) {
    return 'Your session has expired. Please sign in again to submit an application review.'
  }
  if (err?.isForbidden || err?.status === 403) {
    return 'You are not authorized to review this application. Only assigned property managers can review.'
  }
  if (err?.isNotFound || err?.status === 404) {
    return 'This application was not found on the server.'
  }
  if (err?.isNetworkError) {
    return 'Network connection error. Please verify your internet connection and try again.'
  }
  if (err?.isServerError || (err?.status && err.status >= 500)) {
    return 'A server error occurred while reviewing the application. Please try again later.'
  }
  return (
    err?.message ||
    err?.data?.message ||
    'Failed to submit review decision. Please try again.'
  )
}

/**
 * ManagerApplicationDetailsPage
 *
 * View and review rental application records for assigned properties.
 * Fetches real backend data via GET /api/rental-applications/{applicationId}.
 * Allows reviewing (Approve / Reject) only when application status === 'PENDING'.
 */
export default function ManagerApplicationDetailsPage() {
  const { id } = useParams()

  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null) // '404' | '401' | '403' | 'network' | 'server'

  // Review Workflow State
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [successBanner, setSuccessBanner] = useState(null) // { type: 'approved' | 'rejected', message: string }

  const loadApplication = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setErrorType(null)

    try {
      const data = await getApplicationById(id)
      setApplication(data)
    } catch (err) {
      console.error(`[Manager] Failed to load application #${id}:`, err)
      const status = err?.status
      if (err?.isNotFound || status === 404) {
        setErrorType('404')
        setError(`Application #${id} was not found. It may have been deleted or the reference ID is invalid.`)
      } else if (err?.isAuthError || status === 401) {
        setErrorType('401')
        setError('Your session has expired. Please sign in again to view this application.')
      } else if (err?.isForbidden || status === 403) {
        setErrorType('403')
        setError('Access restricted: You do not have permission to view this application.')
      } else if (err?.isNetworkError) {
        setErrorType('network')
        setError('Network error: Unable to connect to the server. Please verify your internet connection.')
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

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmittingReview) {
        if (showApproveModal || showRejectModal) {
          closeModals()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showApproveModal, showRejectModal, isSubmittingReview])

  const openApproveModal = () => {
    setReviewError(null)
    setShowApproveModal(true)
  }

  const openRejectModal = () => {
    setReviewError(null)
    setRejectionReason('')
    setRejectionError('')
    setShowRejectModal(true)
  }

  const closeModals = () => {
    if (isSubmittingReview) return
    setShowApproveModal(false)
    setShowRejectModal(false)
    setReviewError(null)
    setRejectionError('')
  }

  // Handle Approve Application
  const handleConfirmApprove = async () => {
    if (isSubmittingReview || !application) return
    setIsSubmittingReview(true)
    setReviewError(null)

    try {
      const updatedResponse = await reviewApplication(application.applicationId, {
        status: APPLICATION_STATUSES.APPROVED,
      })

      const updatedData = updatedResponse?.data || updatedResponse
      setApplication((prev) => ({
        ...prev,
        ...updatedData,
        status: APPLICATION_STATUSES.APPROVED,
        rejectionReason: null,
        reviewedAt: updatedData?.reviewedAt || new Date().toISOString(),
      }))

      setShowApproveModal(false)
      setSuccessBanner({
        type: 'approved',
        message: `Application #${application.applicationId} has been successfully approved.`,
      })
    } catch (err) {
      console.error('[Manager] Failed to approve application:', err)
      setReviewError(getReviewErrorMessage(err))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Handle Reject Application
  const handleConfirmReject = async () => {
    if (isSubmittingReview || !application) return

    const trimmedReason = (rejectionReason || '').trim()
    if (!trimmedReason) {
      setRejectionError('Rejection reason is required.')
      return
    }

    if (trimmedReason.length > 1000) {
      setRejectionError('Rejection reason cannot exceed 1000 characters.')
      return
    }

    setIsSubmittingReview(true)
    setReviewError(null)
    setRejectionError('')

    try {
      const updatedResponse = await reviewApplication(application.applicationId, {
        status: APPLICATION_STATUSES.REJECTED,
        rejectionReason: trimmedReason,
      })

      const updatedData = updatedResponse?.data || updatedResponse
      setApplication((prev) => ({
        ...prev,
        ...updatedData,
        status: APPLICATION_STATUSES.REJECTED,
        rejectionReason: trimmedReason,
        reviewedAt: updatedData?.reviewedAt || new Date().toISOString(),
      }))

      setShowRejectModal(false)
      setRejectionReason('')
      setSuccessBanner({
        type: 'rejected',
        message: `Application #${application.applicationId} has been rejected.`,
      })
    } catch (err) {
      console.error('[Manager] Failed to reject application:', err)
      setReviewError(getReviewErrorMessage(err))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const rentFormatted = formatInr(application?.monthlyRent)
  const depositFormatted = formatInr(application?.securityDeposit)
  const isPending =
    application &&
    String(application.status || '').toUpperCase() === APPLICATION_STATUSES.PENDING

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="applications"
      pageTitle="Application Details"
    >
      <div className="space-y-6 pb-12 max-w-5xl">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/manager/applications"
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
              Rental application record, applicant submission details, and review workflow
            </p>
          </div>

          {/* Header Action / Review Controls (Approve / Reject only for PENDING) */}
          {isPending ? (
            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <Button
                variant="primary"
                size="sm"
                onClick={openApproveModal}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Approve Application
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={openRejectModal}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject Application
              </Button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] self-start sm:self-center">
              <UserCheck className="w-3.5 h-3.5 text-[#315A7D]" />
              <span>Property Manager Oversight</span>
            </div>
          )}
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div
            className={`rounded-lg p-4 flex items-center justify-between gap-3 border shadow-2xs ${
              successBanner.type === 'approved'
                ? 'bg-[#EDF7EE] border-[#C6DEC8] text-[#2A583B]'
                : 'bg-[#FDF2F2] border-[#EFC8C7] text-[#8A2E2C]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {successBanner.type === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-[#B94A48] shrink-0" />
              )}
              <span className="text-sm font-medium">{successBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-xs font-semibold underline hover:opacity-75 focus:outline-none"
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
                  <Link to="/manager/applications">
                    <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                      Back to Applications
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
                  <Link to="/manager/dashboard">
                    <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                      Back to Dashboard
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
                  <Link to="/manager/applications">
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
                  <span className="text-xs text-[#5B6875] block">Current Application Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={application.status} size="md" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-xs text-[#5B6875] border-t sm:border-t-0 pt-3 sm:pt-0">
                <div>
                  <span className="block text-[#5B6875]">Application Date</span>
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

            {/* Pending Review Callout Banner (Shown ONLY for PENDING applications) */}
            {isPending && (
              <div className="bg-[#FEF7EC] border border-[#F4E2B6] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5 text-[#8A5B16]">
                  <Clock className="w-4 h-4 text-[#B7791F] shrink-0" />
                  <div>
                    <span className="font-bold text-sm block">Decision Pending</span>
                    <span className="text-xs text-[#8A5B16]/90">
                      This application is awaiting your review. Verify the details below and select Approve or Reject.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={openApproveModal}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={openRejectModal}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}

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

            <TenantDocumentsCard tenantId={application.tenantId} />

            {/* AI Decision Support: Tenant Payment-Risk Analysis */}
            <PaymentRiskAnalysisCard tenantId={application.tenantId} />

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

        {/* Approve Confirmation Modal */}
        {showApproveModal && application && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-modal-title"
          >
            <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EDF7EE] border border-[#C6DEC8] flex items-center justify-center text-[#2A583B] shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#3F7D58]" />
                </div>
                <div className="space-y-1">
                  <h3 id="approve-modal-title" className="text-base font-bold text-[#243447]">
                    Approve Rental Application
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
                    Are you sure you want to approve the application for{' '}
                    <strong className="text-[#243447]">{application.tenantName || 'Applicant'}</strong>{' '}
                    for{' '}
                    <strong className="text-[#243447]">
                      {application.propertyName || 'Property'}
                      {application.unitNumber ? ` · Unit ${application.unitNumber}` : ''}
                    </strong>
                    ?
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] text-xs text-[#274B68] leading-relaxed">
                <p className="font-semibold">Workflow Notice:</p>
                <p className="mt-0.5">
                  Approving changes the application status to <strong>APPROVED</strong>. This marks the application as officially accepted for this property.
                </p>
              </div>

              {reviewError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#EFC8C7] text-xs text-[#8A2E2C]">
                  <p className="font-semibold">Review Submission Failed:</p>
                  <p className="mt-0.5">{reviewError}</p>
                </div>
              )}

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={closeModals}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleConfirmApprove}
                  isLoading={isSubmittingReview}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Confirm Approval
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal */}
        {showRejectModal && application && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
          >
            <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FDF2F2] border border-[#EFC8C7] flex items-center justify-center text-[#B94A48] shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 id="reject-modal-title" className="text-base font-bold text-[#243447]">
                    Reject Rental Application
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
                    You are rejecting the rental application for{' '}
                    <strong className="text-[#243447]">{application.tenantName || 'Applicant'}</strong>.
                    Please provide an explicit reason below for the applicant and records.
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <Textarea
                  id="rejection-reason"
                  label="Reason for Rejection"
                  required
                  rows={4}
                  maxLength={1000}
                  disabled={isSubmittingReview}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value)
                    if (rejectionError) setRejectionError('')
                    if (reviewError) setReviewError(null)
                  }}
                  placeholder="Please provide a clear and professional reason for declining this application (e.g., credit criteria not met, incomplete documentation, unit already leased)..."
                  error={rejectionError}
                  helperText={`${rejectionReason.length} / 1000 characters (required)`}
                />
              </div>

              {reviewError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#EFC8C7] text-xs text-[#8A2E2C]">
                  <p className="font-semibold">Review Submission Failed:</p>
                  <p className="mt-0.5">{reviewError}</p>
                </div>
              )}

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={closeModals}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={handleConfirmReject}
                  isLoading={isSubmittingReview}
                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
