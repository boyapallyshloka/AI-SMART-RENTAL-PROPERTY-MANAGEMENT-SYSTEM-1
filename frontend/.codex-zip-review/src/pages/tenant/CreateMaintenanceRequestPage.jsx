import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import axiosClient from '../../api/axiosClient'
import {
  createMaintenanceRequest,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  formatCategoryLabel,
  formatPriorityLabel,
} from '../../api/maintenanceApi'
import {
  getPublicProperties,
  getPublicPropertyDetails,
} from '../../api/propertyApi'
import { getMyAgreements } from '../../api/agreementApi'
import { getMyApplications } from '../../api/applicationApi'
import {
  Button,
  Input,
  Select,
  Textarea,
  StatusBadge,
} from '../../components/ui'
import {
  Wrench,
  Building2,
  Calendar,
  AlertTriangle,
  Upload,
  ArrowLeft,
  CheckCircle2,
  FileText,
  User,
  X,
  ImageIcon,
} from 'lucide-react'

export default function CreateMaintenanceRequestPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Pre-fill tenant details from user profile
  const tenantName = user?.name || user?.username || 'Tenant'
  const tenantEmail = user?.email || ''

  // Property and Unit selection
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [units, setUnits] = useState([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  // Form Fields
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('PLUMBING')
  const [priority, setPriority] = useState('MEDIUM')
  const [description, setDescription] = useState('')
  const [preferredVisitDate, setPreferredVisitDate] = useState(
    () => new Date(Date.now() + 86400000).toISOString().split('T')[0]
  )

  // Real Image Upload
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // UI & Validation State
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Attempt to load properties from backend and match tenant agreement/application
  useEffect(() => {
    let isMounted = true
    const loadProperties = async () => {
      let tenantMatch = null

      // Check tenant agreements & applications for pre-filling their rented property and unit
      try {
        const [agreementsRes, appsRes] = await Promise.allSettled([
          getMyAgreements(),
          getMyApplications(),
        ])

        const rawAgreements =
          agreementsRes.status === 'fulfilled'
            ? Array.isArray(agreementsRes.value)
              ? agreementsRes.value
              : agreementsRes.value?.data || []
            : []

        const rawApps =
          appsRes.status === 'fulfilled'
            ? Array.isArray(appsRes.value)
              ? appsRes.value
              : appsRes.value?.data || []
            : []

        const appMap = new Map()
        rawApps.forEach((a) => {
          if (a && a.applicationId) {
            appMap.set(Number(a.applicationId), a)
          }
        })

        // Prefer active agreement
        const activeAgr =
          rawAgreements.find(
            (a) => String(a.status).toUpperCase() === 'ACTIVE'
          ) || rawAgreements[0]

        if (activeAgr) {
          const matchedApp = activeAgr.applicationId
            ? appMap.get(Number(activeAgr.applicationId))
            : null

          tenantMatch = {
            propertyId: matchedApp?.propertyId || activeAgr.propertyId,
            propertyName: matchedApp?.propertyName,
            unitId: activeAgr.unitId || matchedApp?.unitId,
            unitNumber: matchedApp?.unitNumber
              ? String(matchedApp.unitNumber)
              : activeAgr.unitId
              ? String(activeAgr.unitId)
              : undefined,
          }
        } else {
          // If no agreements, check approved/first application
          const approvedApp =
            rawApps.find((a) => (a.status || '').toUpperCase() === 'APPROVED') ||
            rawApps[0]

          if (approvedApp) {
            tenantMatch = {
              propertyId: approvedApp.propertyId,
              propertyName: approvedApp.propertyName,
              unitId: approvedApp.unitId,
              unitNumber: approvedApp.unitNumber ? String(approvedApp.unitNumber) : undefined,
            }
          }
        }
      } catch (err) {
        // Silently fallback if agreement/app call fails
      }

      try {
        const publicProps = await getPublicProperties()
        const propList = Array.isArray(publicProps) ? publicProps : []
        if (isMounted && propList.length > 0) {
          setProperties(propList)

          if (tenantMatch?.propertyId) {
            const matchedId = String(tenantMatch.propertyId)
            setPropertyId(matchedId)
            setPropertyName(tenantMatch.propertyName || 'Selected Property')
            if (tenantMatch.unitId) {
              setUnitId(String(tenantMatch.unitId))
            }
            if (tenantMatch.unitNumber) {
              setUnitNumber(String(tenantMatch.unitNumber))
            }
          } else {
            const firstProp = propList[0]
            const firstId = String(firstProp.propertyId || firstProp.id)
            setPropertyId(firstId)
            setPropertyName(firstProp.propertyName || firstProp.name || 'Selected Property')
          }
        }
      } catch (err) {
        console.warn('Failed to load public properties:', err)
      }
    }

    loadProperties()
    return () => {
      isMounted = false
    }
  }, [tenantEmail, tenantName])

  // Fetch actual property details and extract units whenever propertyId changes
  useEffect(() => {
    if (!propertyId) {
      setUnits([])
      setUnitId('')
      setUnitNumber('')
      return
    }

    let isMounted = true
    const loadUnitsForProperty = async () => {
      setIsLoadingUnits(true)
      try {
        const data = await getPublicPropertyDetails(propertyId)
        if (!isMounted) return

        // Flatten units across buildings -> floors -> units
        let rawUnits = []
        if (Array.isArray(data?.buildings)) {
          for (const b of data.buildings) {
            if (Array.isArray(b?.floors)) {
              for (const f of b.floors) {
                if (Array.isArray(f?.units)) {
                  for (const u of f.units) {
                    const uid = u.unitId ?? u.id
                    const uNum = u.unitNumber ?? u.unitNo ?? u.number
                    if (uid != null) {
                      rawUnits.push({
                        unitId: String(uid),
                        unitNumber: uNum != null ? String(uNum) : String(uid),
                        buildingName: b?.building?.buildingName,
                        floorName:
                          f?.floor?.floorName ||
                          (f?.floor?.floorNumber != null ? `Floor ${f.floor.floorNumber}` : null),
                        status: u.status,
                      })
                    }
                  }
                }
              }
            }
          }
        }

        // Fallback if data has flat units array
        if (rawUnits.length === 0 && Array.isArray(data?.units)) {
          for (const u of data.units) {
            const uid = u.unitId ?? u.id
            const uNum = u.unitNumber ?? u.unitNo ?? u.number
            if (uid != null) {
              rawUnits.push({
                unitId: String(uid),
                unitNumber: uNum != null ? String(uNum) : String(uid),
                status: u.status,
              })
            }
          }
        }

        setUnits(rawUnits)

        if (rawUnits.length > 0) {
          // If current unitId matches one of the loaded units, keep it
          const existingMatch = rawUnits.find(
            (u) => String(u.unitId) === String(unitId)
          )

          // Or match by unitNumber string (e.g. "201" or "Unit 201")
          const cleanTargetNum = String(unitNumber || '')
            .trim()
            .toLowerCase()
            .replace(/^unit\s*#?/i, '')
            .replace(/^townhome\s*#?/i, '')
            .replace(/^loft\s*#?/i, '')
            .replace(/^apartment\s*#?/i, '')
            .replace(/^#/i, '')
            .trim()

          const numberMatch =
            !existingMatch && cleanTargetNum
              ? rawUnits.find((u) => {
                const cleanUNum = String(u.unitNumber || '')
                  .trim()
                  .toLowerCase()
                  .replace(/^unit\s*#?/i, '')
                  .replace(/^townhome\s*#?/i, '')
                  .replace(/^loft\s*#?/i, '')
                  .replace(/^apartment\s*#?/i, '')
                  .replace(/^#/i, '')
                  .trim()
                return cleanUNum === cleanTargetNum
              })
              : null

          const targetUnit = existingMatch || numberMatch || rawUnits[0]
          setUnitId(String(targetUnit.unitId))
          setUnitNumber(String(targetUnit.unitNumber))
        } else {
          setUnitId('')
          setUnitNumber('')
        }
      } catch (err) {
        console.warn(`Failed to load details for property ${propertyId}:`, err)
        if (isMounted) {
          setUnits([])
          setUnitId('')
          setUnitNumber('')
        }
      } finally {
        if (isMounted) {
          setIsLoadingUnits(false)
        }
      }
    }

    loadUnitsForProperty()
    return () => {
      isMounted = false
    }
  }, [propertyId])

  // Category dropdown options (canonical backend enums)
  const categoryOptions = MAINTENANCE_CATEGORIES.map((cat) => ({
    value: cat,
    label: formatCategoryLabel(cat),
  }))

  // Priority dropdown options (canonical backend enums)
  const priorityOptions = MAINTENANCE_PRIORITIES.map((pri) => ({
    value: pri,
    label: `${formatPriorityLabel(pri)} Priority`,
  }))

  // Handle Real Image Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB file size limit check matching backend
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        image: 'File size must be under 10MB.',
      }))
      return
    }

    setErrors((prev) => ({ ...prev, image: undefined }))
    setImageFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validate = () => {
    const errs = {}
    if (!title.trim()) errs.title = 'Issue title or summary is required'
    if (!category) errs.category = 'Please select a maintenance category'
    if (!priority) errs.priority = 'Please select a priority level'
    if (!description.trim()) errs.description = 'Please describe the issue or repair needed'
    if (!propertyId || isNaN(Number(propertyId))) errs.propertyId = 'Valid Property ID is required'
    if (!unitId || isNaN(Number(unitId))) errs.unitId = 'Valid Unit ID is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    if (!validate()) return

    setIsSubmitting(true)

    try {
      // Build FormData payload strictly matching backend createRequest:
      // @RequestParam Long propertyId, @RequestParam Long unitId,
      // @RequestParam MaintenanceCategory category, @RequestParam String description,
      // @RequestParam MaintenancePriority priority, @RequestParam MultipartFile image
      const formData = new FormData()
      formData.append('propertyId', propertyId)
      formData.append('unitId', unitId)
      formData.append('category', category)
      formData.append(
        'description',
        title.trim() ? `${title.trim()}: ${description.trim()}` : description.trim()
      )
      formData.append('priority', priority)

      if (imageFile) {
        formData.append('image', imageFile)
      }

      const createdResponse = await createMaintenanceRequest(formData)
      const newTicketId = createdResponse?.requestId || createdResponse?.id

      // Redirect to tenant maintenance portal with confirmation banner
      navigate('/tenant/maintenance', {
        state: {
          successMessage: `Maintenance request created successfully! Ticket #${newTicketId || 'New'} is now OPEN.`,
        },
      })
    } catch (err) {
      const errorMsg =
        err?.message ||
        err?.originalError?.message ||
        'Failed to submit maintenance request. Please ensure you are logged in as a tenant and try again.'
      setApiError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="maintenance"
      pageTitle="Create Maintenance Request"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875]">
          <Link
            to="/tenant/maintenance"
            className="inline-flex items-center gap-1 hover:text-[#315A7D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Maintenance</span>
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-medium">
            New Maintenance Request
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-[#315A7D] text-white">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
                  Request Maintenance
                </h1>
                <StatusBadge status="Open" size="sm" />
              </div>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                Report an issue or repair request directly to property management
              </p>
            </div>
          </div>
        </div>

        {/* API Error Notification */}
        {apiError && (
          <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F4B4B4] text-[#8A2E2C] text-xs sm:text-sm flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#8A2E2C]" />
            <div className="flex-1">
              <p className="font-semibold">Submission Error</p>
              <p className="mt-0.5">{apiError}</p>
            </div>
            <button
              type="button"
              onClick={() => setApiError('')}
              className="text-[#8A2E2C] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Tenant & Property Identification */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <Building2 className="w-4 h-4 text-[#315A7D]" />
              1. Location & Tenant Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                  Tenant Name
                </label>
                <div className="p-2.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] text-sm font-medium text-[#243447] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#5B6875] shrink-0" />
                  <span className="truncate">{tenantName}</span>
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                  Property
                </label>
                {properties.length > 0 ? (
                  <select
                    value={propertyId}
                    onChange={(e) => {
                      const newId = e.target.value
                      setPropertyId(newId)
                      setUnitId('')
                      setUnitNumber('')
                      const found = properties.find(
                        (p) => String(p.propertyId || p.id) === newId
                      )
                      if (found) setPropertyName(found.propertyName || found.name || 'Selected Property')
                      if (errors.propertyId) {
                        setErrors((prev) => ({ ...prev, propertyId: undefined }))
                      }
                    }}
                    className="w-full p-2.5 rounded-md bg-white border border-[#D9E0E6] text-sm font-medium text-[#243447] focus:outline-hidden focus:border-[#315A7D]"
                  >
                    {properties.map((prop) => {
                      const propId = prop.propertyId ?? prop.id
                      const name = prop.propertyName || prop.name || 'Property'
                      return (
                        <option key={propId} value={propId}>
                          {name} (Property ID: {propId})
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="Property ID (e.g. 1)"
                      value={propertyId}
                      onChange={(e) => {
                        setPropertyId(e.target.value)
                        if (errors.propertyId) {
                          setErrors((prev) => ({ ...prev, propertyId: undefined }))
                        }
                      }}
                      error={errors.propertyId}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                  Unit Number
                </label>
                {isLoadingUnits ? (
                  <div className="p-2.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] text-sm text-[#5B6875] flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#315A7D] border-t-transparent rounded-full animate-spin" />
                    <span>Loading units...</span>
                  </div>
                ) : units.length > 0 ? (
                  <div className="space-y-1">
                    <select
                      id="unit-select"
                      value={unitId}
                      onChange={(e) => {
                        const selUnitId = e.target.value
                        setUnitId(selUnitId)
                        const foundUnit = units.find(
                          (u) => String(u.unitId) === String(selUnitId)
                        )
                        if (foundUnit) {
                          setUnitNumber(foundUnit.unitNumber)
                        }
                        if (errors.unitId) {
                          setErrors((prev) => ({ ...prev, unitId: undefined }))
                        }
                      }}
                      className={`w-full p-2.5 rounded-md bg-white border ${errors.unitId ? 'border-[#E05252]' : 'border-[#D9E0E6]'
                        } text-sm font-medium text-[#243447] focus:outline-hidden focus:border-[#315A7D]`}
                    >
                      {units.map((unit) => {
                        const cleanNum = String(unit.unitNumber || unit.unitId).replace(/^Unit\s*/i, '')
                        return (
                          <option key={unit.unitId} value={unit.unitId}>
                            Unit {cleanNum}
                          </option>
                        )
                      })}
                    </select>
                    {errors.unitId && (
                      <p className="text-xs text-[#E05252] mt-1">{errors.unitId}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="Unit ID (e.g. 1)"
                      value={unitId}
                      onChange={(e) => {
                        setUnitId(e.target.value)
                        if (errors.unitId) {
                          setErrors((prev) => ({ ...prev, unitId: undefined }))
                        }
                      }}
                      error={errors.unitId}
                      helperText={
                        unitNumber
                          ? `Unit ${String(unitNumber).replace(/^Unit\s*/i, '')}`
                          : 'No units listed for this property'
                      }
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Repair Information */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <Wrench className="w-4 h-4 text-[#315A7D]" />
              2. Repair Information
            </h2>

            <div>
              <Input
                label="Issue Title / Short Summary"
                placeholder="e.g. Kitchen faucet leaking under vanity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Category"
                  options={categoryOptions}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  error={errors.category}
                  required
                />
              </div>

              <div>
                <Select
                  label="Priority Level"
                  options={priorityOptions}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  error={errors.priority}
                  required
                />
              </div>
            </div>

            <div>
              <Textarea
                label="Detailed Description"
                placeholder="Describe what happened, exact location, when it started, and symptoms..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={errors.description}
                rows={4}
                required
              />
            </div>
          </div>

          {/* Section 3: Scheduling & Real Image Upload */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <Calendar className="w-4 h-4 text-[#315A7D]" />
              3. Scheduling & Issue Photo
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Input
                  label="Preferred Visit Date"
                  type="date"
                  value={preferredVisitDate}
                  onChange={(e) => setPreferredVisitDate(e.target.value)}
                  leftIcon={<Calendar className="w-4 h-4 text-[#5B6875]" />}
                  helperText="Date when technician may inspect"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                  Attach Photo (Max 10MB)
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!imageFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#D9E0E6] hover:border-[#315A7D] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-colors bg-[#F7F8FA]"
                  >
                    <Upload className="w-5 h-5 text-[#5B6875]" />
                    <div>
                      <p className="text-xs font-medium text-[#243447]">
                        Click to upload photo
                      </p>
                      <p className="text-[11px] text-[#5B6875]">
                        JPG, PNG, WEBP up to 10MB
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl border border-[#D9E0E6] bg-[#F7F8FA] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Issue preview"
                          className="w-10 h-10 object-cover rounded-md border border-[#D9E0E6] shrink-0"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-[#315A7D] shrink-0" />
                      )}
                      <div className="overflow-hidden text-left">
                        <p className="text-xs font-medium text-[#243447] truncate">
                          {imageFile.name}
                        </p>
                        <span className="text-[10px] text-[#5B6875]">
                          {(imageFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Remove image"
                      className="p-1.5 rounded-md hover:bg-[#EAF2F7] text-[#8A2E2C] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {errors.image && (
                  <p className="text-xs text-[#8A2E2C] mt-1">{errors.image}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link to="/tenant/maintenance">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>

            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Submit Maintenance Request
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
