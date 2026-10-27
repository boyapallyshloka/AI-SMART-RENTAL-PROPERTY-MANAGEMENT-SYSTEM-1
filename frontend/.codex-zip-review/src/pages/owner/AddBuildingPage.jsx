import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Input, Select, Textarea, EmptyState, Loader } from '../../components/ui'
import { ArrowLeft, Building, Building2, Save, AlertCircle, Plus } from 'lucide-react'
import {
  getBuildingById,
  createBuilding,
  updateBuilding,
} from '../../api/buildingApi'
import { getMyProperties, getPropertyById } from '../../api/propertyApi'

export default function AddBuildingPage() {
  const { buildingId, propertyId: routePropertyId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(buildingId)

  // Extract propertyId and propertyName from query, state, or route params
  const queryPropertyId = searchParams.get('propertyId')
  const statePropertyId = location.state?.propertyId || location.state?.property?.id
  const statePropertyName = location.state?.propertyName || location.state?.property?.name
  const initialPropertyId = String(routePropertyId || queryPropertyId || statePropertyId || '')

  const [properties, setProperties] = useState([])
  const [propertyContext, setPropertyContext] = useState(
    statePropertyName ? { name: statePropertyName, id: initialPropertyId } : null
  )
  const [formData, setFormData] = useState({
    buildingName: '',
    totalFloors: '1',
    totalUnits: '0',
    description: '',
    propertyId: initialPropertyId,
  })
  const [errors, setErrors] = useState({})
  const [isInitLoading, setIsInitLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  // Load properties and existing building data if in edit mode
  useEffect(() => {
    let isMounted = true

    const loadInitData = async () => {
      setIsInitLoading(true)
      setApiError(null)

      try {
        // 1. Load Owner Properties directly from backend API
        const propsRes = await getMyProperties()
        const propsList = Array.isArray(propsRes?.data)
          ? propsRes.data
          : Array.isArray(propsRes)
          ? propsRes
          : []

        if (!isMounted) return
        setProperties(propsList)

        // 2. In Edit Mode: Load existing building by ID (GET /api/buildings/{id})
        if (isEditMode) {
          try {
            const existing = await getBuildingById(buildingId)
            if (!isMounted) return

            if (existing) {
              const bPropId = existing.propertyId ?? existing.property?.id ?? ''
              setFormData({
                buildingName: existing.buildingName || '',
                totalFloors: String(existing.totalFloors ?? 1),
                totalUnits: String(existing.totalUnits ?? 0),
                description: existing.description || '',
                propertyId: String(bPropId),
              })
              if (existing.propertyName || existing.property?.name) {
                setPropertyContext({
                  id: String(bPropId),
                  name: existing.propertyName || existing.property?.name,
                })
              }
            } else {
              setNotFound(true)
            }
          } catch (bErr) {
            console.error('Failed to load building details:', bErr)
            if (isMounted) setNotFound(true)
          }
        } else {
          // Add Mode: pre-select from resolved property ID or first property
          const targetPropId = initialPropertyId
            ? String(initialPropertyId)
            : propsList.length === 1
            ? String(propsList[0].propertyId ?? propsList[0].id)
            : ''

          setFormData((prev) => ({
            ...prev,
            propertyId: prev.propertyId || targetPropId,
          }))

          if (targetPropId && !statePropertyName) {
            const matched = propsList.find(
              (p) => String(p.propertyId ?? p.id) === String(targetPropId)
            )
            if (matched) {
              setPropertyContext({
                id: targetPropId,
                name: matched.propertyName ?? matched.name,
                address: matched.city || matched.address?.city,
              })
            }
          }
        }
      } catch (err) {
        console.error('Error loading initial building form data:', err)
        if (isMounted) {
          setApiError(err.message || 'Failed to load initial data. Please refresh the page.')
        }
      } finally {
        if (isMounted) setIsInitLoading(false)
      }
    }

    loadInitData()

    return () => {
      isMounted = false
    }
  }, [buildingId, isEditMode, initialPropertyId, statePropertyName])

  const validate = () => {
    const errs = {}

    if (!formData.buildingName.trim()) {
      errs.buildingName = 'Building name is required.'
    }

    const floorsNum = Number(formData.totalFloors)
    if (
      formData.totalFloors === '' ||
      isNaN(floorsNum) ||
      !Number.isInteger(floorsNum) ||
      floorsNum < 0
    ) {
      errs.totalFloors = 'Total floors must be a non-negative integer (0 or greater).'
    }

    const unitsNum = Number(formData.totalUnits)
    if (
      formData.totalUnits === '' ||
      isNaN(unitsNum) ||
      !Number.isInteger(unitsNum) ||
      unitsNum < 0
    ) {
      errs.totalUnits = 'Total units must be a non-negative integer (0 or greater).'
    }

    if (!formData.propertyId) {
      errs.propertyId = 'Associated property is required.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
    if (apiError) {
      setApiError(null)
    }
  }

  const targetProperty = properties.find(
    (p) => String(p.propertyId ?? p.id) === String(formData.propertyId)
  )
  const targetPropertyName =
    propertyContext?.name ||
    targetProperty?.propertyName ||
    targetProperty?.name ||
    (formData.propertyId ? `Property #${formData.propertyId}` : '')

  const targetPropertySubtitle =
    propertyContext?.address ||
    (targetProperty
      ? [
          targetProperty.addressLine1 || targetProperty.address?.addressLine1,
          targetProperty.city || targetProperty.address?.city,
          targetProperty.state || targetProperty.address?.state,
        ]
          .filter(Boolean)
          .join(', ')
      : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)

    if (!validate()) return

    setIsSubmitting(true)
    try {
      const payload = {
        buildingName: formData.buildingName.trim(),
        totalFloors: Number(formData.totalFloors),
        totalUnits: Number(formData.totalUnits),
        description: formData.description?.trim() || '',
        propertyId: Number(formData.propertyId),
      }

      if (isEditMode) {
        await updateBuilding(buildingId, payload)
        navigate(`/owner/buildings/${buildingId}`, {
          state: { toastMessage: 'Building specifications updated successfully.' },
        })
      } else {
        const created = await createBuilding(payload)
        if (formData.propertyId) {
          navigate(`/owner/properties/${formData.propertyId}`, {
            state: { toastMessage: `Building "${payload.buildingName}" was registered successfully.` },
          })
        } else {
          const newBuildingId = created?.data?.buildingId || created?.buildingId
          if (newBuildingId) {
            navigate(`/owner/buildings/${newBuildingId}`, {
              state: { toastMessage: `Building "${payload.buildingName}" was registered successfully.` },
            })
          } else {
            navigate('/owner/properties')
          }
        }
      }
    } catch (err) {
      console.error('Failed to submit building form:', err)
      const errorMsg =
        err.message ||
        err.data?.message ||
        (isEditMode ? 'Failed to update building.' : 'Failed to create building.')
      setApiError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isInitLoading) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle={isEditMode ? 'Edit Building' : 'Add Building'}
      >
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader size="lg" text={isEditMode ? 'Loading building details...' : 'Loading property context...'} />
        </div>
      </DashboardLayout>
    )
  }

  if (notFound) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle="Building Not Found"
      >
        <div className="max-w-3xl mx-auto py-12 space-y-4">
          <EmptyState
            icon={<Building className="w-8 h-8 text-[#5B6875]" />}
            title="Building Not Found"
            description={`Could not locate a building with ID "${buildingId}".`}
            action={
              <Link to="/owner/properties">
                <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Properties
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  if (!isEditMode && properties.length === 0) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle="Add Building"
      >
        <div className="max-w-3xl mx-auto py-12 space-y-4">
          <EmptyState
            icon={<Building className="w-8 h-8 text-[#5B6875]" />}
            title="No Properties Found"
            description="A building must be associated with an existing property in your portfolio. Please register a property first before adding buildings."
            action={
              <Link to="/owner/properties/add">
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                  Add Property First
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  const propertyOptions = [
    { value: '', label: '-- Select Associated Property --' },
    ...properties.map((p) => {
      const pId = String(p.propertyId ?? p.id)
      const pName = p.propertyName ?? p.name ?? `Property #${pId}`
      const pCity = p.city ?? p.address?.city ?? ''
      const pState = p.state ?? p.address?.state ?? ''
      const location = pCity && pState ? ` (${pCity}, ${pState})` : pCity ? ` (${pCity})` : ''
      return {
        value: pId,
        label: `${pName}${location}`,
      }
    }),
  ]

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="properties"
      pageTitle={isEditMode ? 'Edit Building' : 'Add Building'}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs & Back Link */}
        <div className="space-y-2">
          <div>
            <Link
              to={
                isEditMode
                  ? `/owner/buildings/${buildingId}`
                  : formData.propertyId
                  ? `/owner/properties/${formData.propertyId}`
                  : '/owner/properties'
              }
              className="inline-flex items-center gap-1.5 text-xs text-[#5B6875] hover:text-[#315A7D] font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                {isEditMode
                  ? 'Back to Building Details'
                  : targetPropertyName
                  ? `Back to Property: ${targetPropertyName}`
                  : 'Back to Properties'}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5B6875] flex-wrap">
            <Link
              to="/owner/properties"
              className="hover:text-[#315A7D] transition-colors"
            >
              Properties
            </Link>
            {formData.propertyId && (
              <>
                <span>/</span>
                <Link
                  to={`/owner/properties/${formData.propertyId}`}
                  className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
                >
                  {targetPropertyName || `Property #${formData.propertyId}`}
                </Link>
              </>
            )}
            {isEditMode && buildingId && (
              <>
                <span>/</span>
                <Link
                  to={`/owner/buildings/${buildingId}`}
                  className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
                >
                  {formData.buildingName || 'Building Details'}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-[#243447] font-semibold">
              {isEditMode ? 'Edit Building' : 'Add New Building'}
            </span>
          </div>
        </div>

        {/* Page Header */}
        <div className="border-b border-[#D9E0E6] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#315A7D] text-white shadow-xs">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                {isEditMode ? 'Edit Building' : 'Add New Building'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                {isEditMode
                  ? 'Update building specifications, floor count, and property association.'
                  : `Register a residential tower or block for ${targetPropertyName || 'your property'}.`}
              </p>
            </div>
          </div>
        </div>

        {/* API Error Alert Banner */}
        {apiError && (
          <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] flex items-start gap-3 shadow-2xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">Unable to save building: </span>
              {apiError}
            </div>
          </div>
        )}

        {/* Building Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-6"
        >
          {/* Section: Building Details */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#315A7D] border-b border-[#D9E0E6] pb-2">
              Building Specifications
            </h2>

            {/* Property Context (Requirement 3: Read-only context, not dropdown when known) */}
            {formData.propertyId ? (
              <div>
                <label className="text-xs font-semibold text-[#243447] block mb-1.5">
                  Property
                </label>
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] text-xs">
                  <div className="p-2 rounded-lg bg-white border border-[#D9E0E6] text-[#315A7D] shadow-2xs">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#243447] text-xs sm:text-sm">
                      {targetPropertyName || `Property #${formData.propertyId}`}
                    </p>
                    {targetPropertySubtitle && (
                      <p className="text-[11px] text-[#5B6875] mt-0.5">
                        {targetPropertySubtitle}
                      </p>
                    )}
                  </div>
                </div>
                <input type="hidden" name="propertyId" value={formData.propertyId} />
              </div>
            ) : (
              <div>
                <Select
                  label="Associated Property"
                  value={formData.propertyId}
                  onChange={(e) => handleChange('propertyId', e.target.value)}
                  options={propertyOptions}
                  error={errors.propertyId}
                  disabled={isEditMode}
                  required
                />
                <p className="text-[11px] text-[#5B6875] mt-1">
                  The master property portfolio to which this building belongs.
                </p>
              </div>
            )}

            <div>
              <Input
                label="Building Name"
                placeholder="e.g. Sunset Palms - Tower Alpha"
                value={formData.buildingName}
                onChange={(e) => handleChange('buildingName', e.target.value)}
                error={errors.buildingName}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Total Floors"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 4"
                value={formData.totalFloors}
                onChange={(e) => handleChange('totalFloors', e.target.value)}
                error={errors.totalFloors}
                required
              />

              <Input
                label="Total Units"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 8"
                value={formData.totalUnits}
                onChange={(e) => handleChange('totalUnits', e.target.value)}
                error={errors.totalUnits}
                required
              />
            </div>

            <div>
              <Textarea
                label="Description (Optional)"
                placeholder="Provide details about building amenities, architecture, or entrance locations..."
                rows={4}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#D9E0E6] flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(
                  isEditMode
                    ? `/owner/buildings/${buildingId}`
                    : formData.propertyId
                    ? `/owner/properties/${formData.propertyId}`
                    : '/owner/properties'
                )
              }
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isEditMode ? 'Save Changes' : 'Create Building'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
