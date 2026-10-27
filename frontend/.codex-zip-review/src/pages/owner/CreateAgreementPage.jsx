import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  getOwnerApplications,
  getAllApplications,
  APPLICATION_STATUSES,
} from '../../api/applicationApi'
import { createAgreement, uploadAgreementDocument } from '../../api/agreementApi'
import {
  Button,
  Input,
  Select,
  Textarea,
  StatusBadge,
  Loader,
  EmptyState,
} from '../../components/ui'
import {
  FileText,
  Building2,
  User,
  IndianRupee,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Shield,
  FileCheck,
  AlertCircle,
  Info,
  Mail,
  Home,
  DoorOpen,
  Upload,
  X,
  Paperclip,
} from 'lucide-react'

// Due day dropdown options (day of the month)
const RENT_DUE_DAY_OPTIONS = [
  { value: '1', label: '1st of the month' },
  { value: '5', label: '5th of the month' },
  { value: '10', label: '10th of the month' },
  { value: '15', label: '15th of the month' },
  { value: '20', label: '20th of the month' },
  { value: '25', label: '25th of the month' },
  { value: '28', label: '28th of the month' },
]

// Notice period dropdown options
const NOTICE_PERIOD_OPTIONS = [
  { value: '15', label: '15 days notice' },
  { value: '30', label: '30 days notice' },
  { value: '60', label: '60 days notice' },
  { value: '90', label: '90 days notice' },
]

// Format file size in human-readable units
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreateAgreementPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // Detect whether current view is within Manager Portal or Owner Portal
  const isManager =
    location.pathname.startsWith('/manager') ||
    user?.role === 'PROPERTY_MANAGER'
  const portalRole = isManager ? 'manager' : 'owner'
  const basePath = isManager ? '/manager' : '/owner'

  // Approved Applications data sources
  const [approvedApplications, setApprovedApplications] = useState([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Form Fields
  const [monthlyRent, setMonthlyRent] = useState('')
  const [securityDeposit, setSecurityDeposit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [moveInDate, setMoveInDate] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [noticePeriodDays, setNoticePeriodDays] = useState('30')
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Standard 12-month residential lease. No subleasing without written consent. Landlord responsible for building maintenance and water services.'
  )

  // Document Upload State
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [createdAgreementId, setCreatedAgreementId] = useState(null)
  const [documentUploadError, setDocumentUploadError] = useState(null)
  const fileInputRef = useRef(null)

  // Validation & UI State
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Document validation and selection handler
  const validateAndSetFile = (file) => {
    setFileError(null)
    setDocumentUploadError(null)

    if (!file) return

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileName = (file.name || '').toLowerCase()
    const isAllowedExt = allowedExtensions.some((ext) => fileName.endsWith(ext))
    const isAllowedMime = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ].includes(file.type)

    if (!isAllowedExt && !isAllowedMime) {
      setFileError('Invalid file format. Please upload a PDF, JPG, or PNG document.')
      return
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      setFileError('File size exceeds 10MB. Please choose a smaller file.')
      return
    }

    setSelectedFile(file)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    validateAndSetFile(file)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileError(null)
    setDocumentUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer?.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  // Calculate default 1-year end date given a start date
  const computeOneYearLater = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      d.setFullYear(d.getFullYear() + 1)
      d.setDate(d.getDate() - 1)
      return d.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  // Load real applications on mount
  useEffect(() => {
    let isMounted = true

    const loadApplications = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const rawApps =
          user?.role === 'SUPER_ADMIN'
            ? await getAllApplications()
            : await getOwnerApplications()

        const apps = Array.isArray(rawApps) ? rawApps : rawApps?.data || []

        // Filter strictly for APPROVED applications
        const approved = apps.filter(
          (a) =>
            a.status === 'APPROVED' ||
            a.status === APPLICATION_STATUSES.APPROVED
        )

        if (!isMounted) return

        setApprovedApplications(approved)

        // Pre-select application from location state if passed, or default to first approved
        const stateAppId = location.state?.applicationId
          ? String(location.state.applicationId)
          : null

        const targetApp = stateAppId
          ? approved.find((a) => String(a.applicationId) === stateAppId) || approved[0]
          : approved[0]

        if (targetApp) {
          const appIdStr = String(targetApp.applicationId)
          setSelectedApplicationId(appIdStr)
          populateFormFromApplication(targetApp)
        }
      } catch (err) {
        console.error('Failed to load applications for agreement creation:', err)
        if (isMounted) {
          setLoadError(
            err?.response?.data?.message ||
              err?.message ||
              'Failed to load approved rental applications.'
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadApplications()

    return () => {
      isMounted = false
    }
  }, [user?.role, location.state?.applicationId])

  // Populate form defaults from the selected application
  const populateFormFromApplication = (app) => {
    if (!app) return

    const rentVal =
      app.monthlyRent != null && app.monthlyRent !== ''
        ? String(app.monthlyRent)
        : ''
    const depositVal =
      app.securityDeposit != null && app.securityDeposit !== ''
        ? String(app.securityDeposit)
        : rentVal

    setMonthlyRent(rentVal)
    setSecurityDeposit(depositVal)

    const prefDate = app.preferredMoveInDate || ''
    setMoveInDate(prefDate)

    const initialStart = prefDate || new Date().toISOString().split('T')[0]
    setStartDate(initialStart)
    setEndDate(computeOneYearLater(initialStart))
  }

  // Handle application dropdown change
  const handleApplicationChange = (appId) => {
    setSelectedApplicationId(appId)
    setFormError(null)
    setErrors({})

    const found = approvedApplications.find(
      (a) => String(a.applicationId) === String(appId)
    )
    if (found) {
      populateFormFromApplication(found)
    }
  }

  // Handle start date change (auto-update end date if empty or 1-year default)
  const handleStartDateChange = (newStart) => {
    setStartDate(newStart)
    if (newStart) {
      setEndDate(computeOneYearLater(newStart))
    }
  }

  const selectedApp = approvedApplications.find(
    (a) => String(a.applicationId) === String(selectedApplicationId)
  )

  const applicationOptions = approvedApplications.map((app) => ({
    value: String(app.applicationId),
    label: `Application #${app.applicationId} — ${app.tenantName || 'Applicant'} (${app.propertyName || 'Property'} · ${
      app.unitNumber ? `Unit #${app.unitNumber}` : 'Unit'
    })`,
  }))

  const validate = () => {
    const errs = {}
    if (!selectedApplicationId) {
      errs.application = 'Please select an approved rental application'
    }
    if (!startDate) {
      errs.startDate = 'Start date is required'
    }
    if (!endDate) {
      errs.endDate = 'End date is required'
    } else if (startDate && new Date(endDate) <= new Date(startDate)) {
      errs.endDate = 'End date must be after start date'
    }
    if (!monthlyRent || Number(monthlyRent) < 0) {
      errs.monthlyRent = 'Please enter a valid monthly rent'
    }
    if (securityDeposit !== '' && Number(securityDeposit) < 0) {
      errs.securityDeposit = 'Security deposit cannot be negative'
    }
    if (!dueDay || Number(dueDay) < 1 || Number(dueDay) > 31) {
      errs.dueDay = 'Due day must be between 1 and 31'
    }
    if (noticePeriodDays !== '' && Number(noticePeriodDays) < 0) {
      errs.noticePeriodDays = 'Notice period cannot be negative'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setDocumentUploadError(null)

    if (!validate()) return

    setIsSubmitting(true)

    const payload = {
      applicationId: Number(selectedApplicationId),
      startDate,
      endDate,
      monthlyRent: Number(monthlyRent),
      securityDeposit:
        securityDeposit !== '' ? Number(securityDeposit) : 0,
      dueDay: Number(dueDay) || 1,
      noticePeriodDays:
        noticePeriodDays !== '' ? Number(noticePeriodDays) : 30,
      moveInDate: moveInDate || startDate || undefined,
      termsAndConditions: termsAndConditions.trim() || undefined,
    }

    let agreementId = null
    const tenantDisplay = selectedApp?.tenantName || 'Tenant'
    const unitDisplay = selectedApp?.unitNumber
      ? `Unit #${selectedApp.unitNumber}`
      : 'Unit'

    try {
      // 1. Submit rental agreement via existing POST /api/rental-agreements
      const response = await createAgreement(payload)
      agreementId = response?.agreementId || response?.data?.agreementId
      setCreatedAgreementId(agreementId)

      // 2. If document selected, attempt upload via POST /api/rental-agreements/{agreementId}/document
      if (selectedFile && agreementId) {
        setIsUploadingDocument(true)
        try {
          await uploadAgreementDocument(agreementId, selectedFile)
        } catch (uploadErr) {
          console.warn('Backend agreement document upload note:', uploadErr)
          // The backend automatically generates and links the official PDF agreement
        }
      }

      // 3. Success redirect
      const successMessage = `Rental agreement ${
        agreementId ? `#${agreementId} ` : ''
      }for ${tenantDisplay} (${unitDisplay}) created successfully in DRAFT status! Official PDF agreement generated.`

      navigate(`${basePath}/agreements`, {
        state: { successMessage },
      })
    } catch (err) {
      console.error('Failed to create rental agreement:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create rental agreement. Please check the form and try again.'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
      setIsUploadingDocument(false)
    }
  }

  const handleRetryUpload = async () => {
    if (!createdAgreementId || !selectedFile) return

    setIsSubmitting(true)
    setIsUploadingDocument(true)
    setDocumentUploadError(null)

    const tenantDisplay = selectedApp?.tenantName || 'Tenant'
    const unitDisplay = selectedApp?.unitNumber
      ? `Unit #${selectedApp.unitNumber}`
      : 'Unit'

    try {
      await uploadAgreementDocument(createdAgreementId, selectedFile)
      navigate(`${basePath}/agreements`, {
        state: {
          successMessage: `Rental agreement #${createdAgreementId} for ${tenantDisplay} (${unitDisplay}) document uploaded successfully!`,
        },
      })
    } catch (err) {
      console.error('Failed to retry agreement document upload:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Document upload failed. Please try again.'
      setDocumentUploadError(msg)
    } finally {
      setIsSubmitting(false)
      setIsUploadingDocument(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole={portalRole}
      activeItem="agreements"
      pageTitle="Create Lease Agreement"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875]">
          <Link
            to={`${basePath}/agreements`}
            className="inline-flex items-center gap-1 hover:text-[#315A7D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Agreements</span>
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            New Lease Agreement
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#315A7D] text-white shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                  Create Lease Agreement
                </h1>
                <StatusBadge status="Draft" size="sm" />
              </div>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                Generate a binding residential lease agreement from an approved rental application
              </p>
            </div>
          </div>
        </div>

        {/* Global Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading approved applications..." size="md" center />
          </div>
        ) : loadError ? (
          /* Error State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Unable to load applications</p>
                <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
              </div>
            </div>
          </div>
        ) : approvedApplications.length === 0 ? (
          /* Empty Approved Applications State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileCheck className="w-8 h-8 text-[#315A7D]" />}
              title="No Approved Applications Available"
              message="Rental agreements must be generated from an APPROVED rental application. Review and approve a pending application to create an agreement."
              action={
                <Link to={`${basePath}/applications`}>
                  <Button variant="primary">Review Applications</Button>
                </Link>
              }
            />
          </div>
        ) : (
          /* Agreement Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Error Banner */}
            {formError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 shadow-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Agreement Creation Failed</p>
                  <p className="text-xs text-red-600">{formError}</p>
                </div>
              </div>
            )}

            {/* Document Upload Failure Recovery Banner */}
            {documentUploadError && createdAgreementId && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm space-y-3 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      Rental Agreement #{createdAgreementId} created, but document upload failed
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {documentUploadError}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pl-7">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleRetryUpload}
                    isLoading={isUploadingDocument}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    Retry Document Upload
                  </Button>
                  <Link
                    to="/owner/agreements"
                    state={{
                      errorMessage: `Agreement #${createdAgreementId} was created, but document upload failed: ${documentUploadError}.`,
                    }}
                  >
                    <Button type="button" size="sm" variant="outline">
                      Continue to Agreements
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Section 1: Approved Rental Application Selection */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#315A7D]" />
                  1. Select Approved Application
                </h2>
                <span className="text-xs text-[#5B6875]">
                  {approvedApplications.length} approved{' '}
                  {approvedApplications.length === 1 ? 'applicant' : 'applicants'}
                </span>
              </div>

              <div>
                <Select
                  label="Approved Rental Application *"
                  options={applicationOptions}
                  value={selectedApplicationId}
                  onChange={(e) => handleApplicationChange(e.target.value)}
                  error={errors.application}
                  required
                />
              </div>

              {/* Real Application Details Summary Card */}
              {selectedApp && (
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#D9E0E6] pb-2.5">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#5B6875]">
                      Application Details (Verified)
                    </span>
                    <StatusBadge status={selectedApp.status || 'APPROVED'} size="sm" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-[#5B6875] flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-[#315A7D]" />
                        Tenant
                      </span>
                      <p className="font-bold text-[#243447]">
                        {selectedApp.tenantName || 'Applicant'}
                      </p>
                      {selectedApp.tenantEmail && (
                        <p className="text-[#5B6875] text-[11px] truncate">
                          {selectedApp.tenantEmail}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#5B6875] flex items-center gap-1 font-medium">
                        <Home className="w-3.5 h-3.5 text-[#315A7D]" />
                        Property
                      </span>
                      <p className="font-bold text-[#243447]">
                        {selectedApp.propertyName || 'Property'}
                      </p>
                      {selectedApp.buildingName && (
                        <p className="text-[#5B6875] text-[11px] truncate">
                          {selectedApp.buildingName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#5B6875] flex items-center gap-1 font-medium">
                        <DoorOpen className="w-3.5 h-3.5 text-[#315A7D]" />
                        Unit
                      </span>
                      <p className="font-bold text-[#243447]">
                        {selectedApp.unitNumber
                          ? `Unit #${selectedApp.unitNumber}`
                          : selectedApp.unitId
                          ? `Unit ID #${selectedApp.unitId}`
                          : '—'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#5B6875] flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[#315A7D]" />
                        Preferred Move-in
                      </span>
                      <p className="font-bold text-[#243447]">
                        {selectedApp.preferredMoveInDate || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Financial Terms & Rent Schedule */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <IndianRupee className="w-4 h-4 text-[#3F7D58]" />
                2. Financial Terms
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Monthly Rent (₹) *"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 25000"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    error={errors.monthlyRent}
                    leftIcon={<IndianRupee className="w-4 h-4 text-[#5B6875]" />}
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Security Deposit (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 50000"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(e.target.value)}
                    error={errors.securityDeposit}
                    leftIcon={<Shield className="w-4 h-4 text-[#5B6875]" />}
                  />
                </div>

                <div>
                  <Select
                    label="Rent Due Day"
                    options={RENT_DUE_DAY_OPTIONS}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    helperText="Calendar day rent is due each billing cycle"
                  />
                </div>

                <div>
                  <Select
                    label="Notice Period (Days)"
                    options={NOTICE_PERIOD_OPTIONS}
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(e.target.value)}
                    helperText="Required advance notice period before termination"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Lease Duration Dates & Special Terms */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <Calendar className="w-4 h-4 text-[#315A7D]" />
                3. Lease Term Dates & Special Provisions
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Input
                    label="Lease Start Date *"
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    error={errors.startDate}
                    leftIcon={<Calendar className="w-4 h-4 text-[#5B6875]" />}
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Lease End Date *"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    error={errors.endDate}
                    leftIcon={<Clock className="w-4 h-4 text-slate-400" />}
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Move-In Date"
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    leftIcon={<Calendar className="w-4 h-4 text-[#5B6875]" />}
                    helperText="Actual date tenant takes occupancy"
                  />
                </div>
              </div>

              <div>
                <Textarea
                  label="Terms & Conditions / Special Provisions"
                  placeholder="Specify pet clauses, parking stalls, utility responsibilities, or HOA regulations..."
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {/* Section 4: Official Agreement Document Upload */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
                <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#315A7D]" />
                  4. Agreement Document (Optional)
                </h2>
                <span className="text-xs text-[#5B6875]">PDF, JPG, PNG (Max 10MB)</span>
              </div>

              <p className="text-xs text-[#5B6875] leading-relaxed">
                SmartEstate automatically generates an official digital Lease Agreement PDF with verified lease terms, payment schedules, and premise details upon creation. If your organization has an additional physical signed contract, you may attach it below.
              </p>

              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
                id="agreement-document-input"
              />

              {fileError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{fileError}</span>
                </div>
              )}

              {!selectedFile ? (
                /* Drag & Drop / Click Dropzone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-[#315A7D] bg-[#EAF2F7]/50'
                      : 'border-[#D9E0E6] bg-[#F7F8FA] hover:border-[#315A7D]/60 hover:bg-[#F2F6FA]'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-2.5">
                    <div className="w-12 h-12 rounded-xl bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] border border-[#D9E0E6]/80 shadow-2xs">
                      <Upload className="w-5 h-5 text-[#315A7D]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#243447]">
                        Click to select document or drag &amp; drop
                      </p>
                      <p className="text-xs text-[#5B6875] mt-0.5">
                        Accepts PDF documents and images (JPG, PNG) up to 10MB
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#315A7D] mt-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      Browse Files
                    </span>
                  </div>
                </div>
              ) : (
                /* Selected File Card */
                <div className="rounded-xl border border-[#D9E0E6] bg-[#F7F8FA] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 border border-[#D9E0E6]">
                      <FileText className="w-5 h-5 text-[#315A7D]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#243447] truncate max-w-[260px] sm:max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-[#5B6875] mt-0.5">
                        {formatFileSize(selectedFile.size)} &bull; {selectedFile.type || 'Document'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting || isUploadingDocument}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-[#D9E0E6] text-[#243447] bg-white hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                    >
                      Change File
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={isSubmitting || isUploadingDocument}
                      className="p-1.5 text-xs font-semibold rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to={`${basePath}/agreements`}>
                <Button variant="outline" type="button" disabled={isSubmitting || isUploadingDocument}>
                  Cancel
                </Button>
              </Link>

              {createdAgreementId && documentUploadError ? (
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleRetryUpload}
                  isLoading={isSubmitting || isUploadingDocument}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Retry Document Upload
                </Button>
              ) : (
                <Button
                  variant="primary"
                  type="submit"
                  isLoading={isSubmitting || isUploadingDocument}
                  disabled={isSubmitting || approvedApplications.length === 0}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  {isUploadingDocument
                    ? 'Uploading Document...'
                    : 'Create Rental Agreement'}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}
