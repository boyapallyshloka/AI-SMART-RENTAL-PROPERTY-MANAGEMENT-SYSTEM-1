import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import {
  getApplicationById,
  reviewApplication,
  APPLICATION_STATUSES,
} from '../../api/applicationApi'
import PaymentRiskAnalysisCard from '../../components/applications/PaymentRiskAnalysisCard'
import TenantDocumentsCard from '../../components/applications/TenantDocumentsCard'
import {
  ROLES,
  normalizeRole,
  isPropertyManager,
  isPropertyOwner,
  isSuperAdmin,
  getDashboardPath,
} from '../../utils/roles'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
  Textarea,
} from '../../components/ui'
import {
  ArrowLeft,
  User,
  Building2,
  IndianRupee,
  Calendar,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'

// INR Currency Formatter
const formatInr = (amount) => {
  if (amount == null || isNaN(Number(amount))) return '—'
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
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

// Date & Time Formatter
const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(dateStr)
  }
}

export default function ApplicationDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canonicalRole = normalizeRole(user?.role)

  // Route Guard: If a PROPERTY_MANAGER visits /owner/applications/:id, redirect to manager view
  if (canonicalRole === ROLES.PROPERTY_MANAGER) {
    return <Navigate to={id ? `/manager/applications/${id}` : '/manager/applications'} replace />
  }

  // If user is not authorized, redirect to their role dashboard
  if (user && canonicalRole !== ROLES.PROPERTY_OWNER && canonicalRole !== ROLES.SUPER_ADMIN) {
    return <Navigate to={getDashboardPath(canonicalRole)} replace />
  }

  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)

  // Review Dialog States
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  // Load real application details from backend
  const loadApplication = useCallback(async () => {
    if (!id) return
    const role = normalizeRole(user?.role)
    if (role === ROLES.PROPERTY_MANAGER) return

    setLoading(true)
    setError(null)
    setErrorStatus(null)

    try {
      const data = await getApplicationById(id)
      setApplication(data)
    } catch (err) {
      console.error(`Failed to load rental application #${id}:`, err)
      const status = err?.status || err?.response?.status
      setErrorStatus(status)

      if (status === 404 || err?.isNotFound) {
        setError(`Application #${id} was not found on the server.`)
      } else if (status === 403 || err?.isForbidden) {
        setError(
          'Access restricted (403 Forbidden): You are not authorized to view this application.'
        )
      } else if (status === 401) {
        setError('Your session has expired. Please sign in again.')
      } else {
        setError(
          err?.message || 'Failed to load application details. Please check your connection and try again.'
        )
      }
      setApplication(null)
    } finally {
      setLoading(false)
    }
  }, [id, user?.role])

  useEffect(() => {
    loadApplication()
  }, [loadApplication])

  // Is application eligible for review
  const isPending = application?.status === APPLICATION_STATUSES.PENDING

  // Open Modals
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

  // Handle Confirm Approve
  const handleConfirmApprove = async () => {
    if (isSubmittingReview || !application) return
    setIsSubmittingReview(true)
    setReviewError(null)
    setActionSuccess(null)

    try {
      await reviewApplication(application.applicationId, {
        status: APPLICATION_STATUSES.APPROVED,
      })

      setShowApproveModal(false)
      setActionSuccess(
        `Application #${application.applicationId} for ${
          application.tenantName || 'applicant'
        } has been successfully approved.`
      )

      // Refresh real application data from backend
      await loadApplication()
    } catch (err) {
      console.error('Failed to approve application:', err)
      setReviewError(
        err?.message ||
          'Failed to approve application. Please verify your connection and try again.'
      )
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Handle Confirm Reject
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
    setActionSuccess(null)

    try {
      await reviewApplication(application.applicationId, {
        status: APPLICATION_STATUSES.REJECTED,
        rejectionReason: trimmedReason,
      })

      setShowRejectModal(false)
      setActionSuccess(
        `Application #${application.applicationId} has been rejected.`
      )

      // Refresh real application data from backend
      await loadApplication()
    } catch (err) {
      console.error('Failed to reject application:', err)
      setReviewError(
        err?.message ||
          'Failed to reject application. Please verify your connection and try again.'
      )
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="applications"
      pageTitle={
        application
          ? `Application: ${application.tenantName || 'Details'}`
          : 'Application Details'
      }
    >
      <div className="space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link to="/owner/applications">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Applications
            </Button>
          </Link>

          {application && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadApplication}
              disabled={loading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading rental application details..." size="md" center />
          </div>
        ) : error ? (
          /* Dedicated Error State - NEVER show generic "Not Found" for forbidden/server errors */
          <div className="bg-white rounded-2xl border border-[#F4B4B4] bg-[#FFF8F8] p-8 sm:p-12 shadow-xs text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FDF2F2] text-[#B94A48] mb-1">
              {errorStatus === 403 ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <AlertCircle className="w-8 h-8" />
              )}
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-[#243447]">
                {errorStatus === 403 ? 'Access Forbidden' : 'Failed to Load Application'}
              </h3>
              <p className="text-sm text-[#8A2E2C] leading-relaxed">{error}</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link to="/owner/applications">
                <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Applications
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                onClick={loadApplication}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Retry Request
              </Button>
            </div>
          </div>
        ) : !application ? (
          /* Real Not Found State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileCheck className="w-8 h-8 text-[#315A7D]" />}
              title="Application Not Found"
              message={`No rental application matching reference ID "${id}" could be located.`}
              action={{
                label: 'Back to Applications',
                onClick: () => window.history.back(),
                variant: 'primary',
              }}
            />
          </div>
        ) : (
          <>
            {/* Action Success Feedback Banner */}
            {actionSuccess && (
              <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSuccess(null)}
                  className="text-[#2A583B] hover:text-[#1d3d29] font-bold px-1"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Header Status Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                      {application.tenantName || 'Applicant'}
                    </h1>
                    <StatusBadge status={application.status} size="md" />
                  </div>
                  <p className="text-xs text-[#5B6875] mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>
                      Application ID:{' '}
                      <strong className="font-mono text-[#243447]">
                        #{application.applicationId}
                      </strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Submitted on{' '}
                      <strong className="text-[#243447]">
                        {formatDate(application.applicationDate || application.createdAt)}
                      </strong>
                    </span>
                    {application.reviewedAt && (
                      <>
                        <span>&bull;</span>
                        <span>
                          Reviewed on{' '}
                          <strong className="text-[#243447]">
                            {formatDateTime(application.reviewedAt)}
                          </strong>
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Review Action Controls */}
                <div className="flex items-center gap-2.5">
                  {isPending ? (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<XCircle className="w-4 h-4" />}
                        onClick={openRejectModal}
                        disabled={isSubmittingReview}
                      >
                        Reject Application
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        onClick={openApproveModal}
                        disabled={isSubmittingReview}
                      >
                        Approve Application
                      </Button>
                    </>
                  ) : (
                    <div className="text-xs text-[#5B6875] font-medium bg-[#F7F8FA] border border-[#D9E0E6] px-3.5 py-2 rounded-xl">
                      Decision recorded ({application.status})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rejection Notice Banner (if status is REJECTED) */}
            {application.status === APPLICATION_STATUSES.REJECTED && (
              <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F4B4B4] space-y-1 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#8A2E2C]">
                  <AlertTriangle className="w-4 h-4 text-[#B94A48] shrink-0" />
                  <span>Application Rejected</span>
                </div>
                <p className="text-xs text-[#8A2E2C] pl-6">
                  <strong>Reason:</strong>{' '}
                  {application.rejectionReason || 'No specific reason provided.'}
                </p>
              </div>
            )}

            {/* Application Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Applicant Details Card */}
              <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                  <User className="w-4 h-4 text-[#315A7D]" />
                  Applicant Information
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Tenant Name</span>
                    <span className="font-semibold text-[#243447]">
                      {application.tenantName || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875] flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#5B6875]" /> Email Address
                    </span>
                    <span className="font-medium text-[#243447]">
                      {application.tenantEmail || '—'}
                    </span>
                  </div>

                  {application.tenantId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875]">Tenant ID</span>
                      <span className="font-mono text-xs text-[#243447]">
                        #{application.tenantId}
                      </span>
                    </div>
                  )}

                  {application.monthlyIncome != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875]">Monthly Gross Income</span>
                      <span className="font-semibold text-[#243447]">
                        {formatInr(application.monthlyIncome)} / mo
                      </span>
                    </div>
                  )}

                  {application.employerOccupation && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875]">Employer / Occupation</span>
                      <span className="font-medium text-[#243447] text-right">
                        {application.employerOccupation}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#5B6875]" /> Preferred Move-In
                    </span>
                    <span className="font-medium text-[#243447]">
                      {application.preferredMoveInDate
                        ? formatDate(application.preferredMoveInDate)
                        : 'Flexible / Not Specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property & Unit Details Card */}
              <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                  <Building2 className="w-4 h-4 text-[#315A7D]" />
                  Property & Unit Information
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Property Name</span>
                    <span className="font-semibold text-[#243447] text-right">
                      {application.propertyName || 'Property'}
                    </span>
                  </div>

                  {application.buildingName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875]">Building</span>
                      <span className="font-medium text-[#243447]">
                        {application.buildingName}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875]">Unit Number</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#F7F8FA] text-[#243447] border border-[#D9E0E6]">
                      Unit {application.unitNumber || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5B6875] flex items-center gap-1">
                      <IndianRupee className="w-3.5 h-3.5 text-[#5B6875]" /> Monthly Rent
                    </span>
                    <span className="font-semibold text-[#243447]">
                      {formatInr(application.monthlyRent)} / mo
                    </span>
                  </div>

                  {application.securityDeposit != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#5B6875] flex items-center gap-1">
                        <IndianRupee className="w-3.5 h-3.5 text-[#5B6875]" /> Security Deposit
                      </span>
                      <span className="font-medium text-[#243447]">
                        {formatInr(application.securityDeposit)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TenantDocumentsCard tenantId={application.tenantId} />

            {/* AI Decision Support: Tenant Payment-Risk Analysis */}
            <PaymentRiskAnalysisCard tenantId={application.tenantId} />

            {/* Applicant Message / Notes */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-3">
              <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <FileText className="w-4 h-4 text-[#315A7D]" />
                Applicant Message & Notes
              </h2>

              <p className="text-sm text-[#243447] leading-relaxed bg-[#F7F8FA] p-4 rounded-xl border border-[#D9E0E6]">
                {application.message && application.message.trim()
                  ? application.message
                  : 'No additional message was included with this rental application.'}
              </p>
            </div>

            {/* Review Audit Information */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-3 text-xs text-[#5B6875]">
              <h3 className="font-semibold text-sm text-[#243447] border-b border-[#D9E0E6] pb-2">
                Application Timestamps
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-[#5B6875]">
                    Submitted At
                  </span>
                  <span className="font-medium text-[#243447] mt-0.5 block">
                    {formatDateTime(application.createdAt || application.applicationDate)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-[#5B6875]">
                    Last Updated
                  </span>
                  <span className="font-medium text-[#243447] mt-0.5 block">
                    {formatDateTime(application.updatedAt || application.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-[#5B6875]">
                    Review Status
                  </span>
                  <span className="font-medium text-[#243447] mt-0.5 block">
                    {application.status} {application.reviewedAt && `(${formatDate(application.reviewedAt)})`}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal: Confirm Approval */}
        {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D9E0E6]">
              <div className="flex items-center gap-3 text-[#2A583B]">
                <div className="p-2.5 rounded-xl bg-[#EDF7EE]">
                  <CheckCircle2 className="w-6 h-6 text-[#3F7D58]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#243447]">Approve Application</h3>
                  <p className="text-xs text-[#5B6875]">Confirm decision for applicant</p>
                </div>
              </div>

              <p className="text-sm text-[#243447] leading-relaxed">
                Are you sure you want to approve the application for{' '}
                <strong>{application.tenantName || 'this tenant'}</strong> for{' '}
                <strong>{application.propertyName}</strong> (Unit {application.unitNumber})?
              </p>

              {reviewError && (
                <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F4B4B4] text-xs text-[#8A2E2C]">
                  {reviewError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeModals}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmApprove}
                  disabled={isSubmittingReview}
                  leftIcon={
                    isSubmittingReview ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )
                  }
                >
                  {isSubmittingReview ? 'Approving...' : 'Yes, Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirm Rejection */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D9E0E6]">
              <div className="flex items-center gap-3 text-[#8A2E2C]">
                <div className="p-2.5 rounded-xl bg-[#FDF2F2]">
                  <XCircle className="w-6 h-6 text-[#B94A48]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#243447]">Reject Application</h3>
                  <p className="text-xs text-[#5B6875]">Specify the reason for rejection</p>
                </div>
              </div>

              <p className="text-sm text-[#243447]">
                Please enter a reason for rejecting the application for{' '}
                <strong>{application.tenantName || 'this applicant'}</strong>. The reason will be recorded on the application record.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#243447] mb-1.5">
                  Rejection Reason <span className="text-[#B94A48]">*</span>
                </label>
                <Textarea
                  placeholder="Provide a clear, professional reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value)
                    if (rejectionError) setRejectionError('')
                  }}
                  rows={4}
                  disabled={isSubmittingReview}
                />
                <div className="flex items-center justify-between text-[11px] text-[#5B6875] mt-1">
                  {rejectionError ? (
                    <span className="text-[#B94A48] font-medium">{rejectionError}</span>
                  ) : (
                    <span>Required field</span>
                  )}
                  <span>{rejectionReason.length}/1000</span>
                </div>
              </div>

              {reviewError && (
                <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F4B4B4] text-xs text-[#8A2E2C]">
                  {reviewError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeModals}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmReject}
                  disabled={isSubmittingReview}
                  leftIcon={
                    isSubmittingReview ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )
                  }
                >
                  {isSubmittingReview ? 'Rejecting...' : 'Yes, Reject'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
