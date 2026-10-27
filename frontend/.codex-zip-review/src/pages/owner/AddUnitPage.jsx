import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Input, Select, Textarea, EmptyState, Loader } from '../../components/ui'
import { ArrowLeft, Home, Save, Layers, Building, Lock, AlertCircle, AlertTriangle, Sparkles, Info } from 'lucide-react'
import {
  getUnitById,
  createUnit,
  updateUnit,
  formatUnitRequest,
  UNIT_TYPES,
  UNIT_STATUSES,
} from '../../api/unitApi'
import { predictUnitRent } from '../../api/aiApi'
import { getFloorById } from '../../api/floorApi'
import { getBuildingById } from '../../api/buildingApi'
import { getPropertyDetails, getPropertyById } from '../../api/propertyApi'
import { getPropertyAmenities } from '../../api/amenityApi'

/**
 * Parses and extracts clear, user-readable backend error messages
 * from Spring Boot ResponseStatusException, MethodArgumentNotValidException,
 * or FastAPI detail arrays.
 */
export const extractBackendErrorMessage = (err) => {
  if (!err) return 'An unexpected error occurred while predicting rent.'

  // 1. Spring Boot MethodArgumentNotValidException field error dictionary
  // e.g. { error: "Validation Failed", messages: { floorId: "Floor ID is required", area: "Area cannot be negative" } }
  const messages = err.data?.messages || err.response?.data?.messages
  if (messages && typeof messages === 'object' && !Array.isArray(messages)) {
    const entries = Object.entries(messages)
    if (entries.length > 0) {
      return entries.map(([field, msg]) => `${field}: ${msg}`).join('. ')
    }
  }

  // 2. FastAPI validation detail array
  // e.g. { detail: [{ loc: ["body", "bedrooms_bhk"], msg: "Input should be greater than 0" }] }
  const detail = err.data?.detail || err.response?.data?.detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        const fieldName = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : ''
        return fieldName ? `${fieldName}: ${item.msg}` : item.msg || JSON.stringify(item)
      })
      .join('. ')
  }

  // 3. Spring Boot ResponseStatusException or general exception
  let rawMsg =
    err.data?.message ||
    err.response?.data?.message ||
    err.data?.error ||
    err.response?.data?.error ||
    err.message ||
    ''

  if (typeof rawMsg === 'string') {
    // Strip Spring Boot ResponseStatusException prefix like '400 BAD_REQUEST "..."' or '502 BAD_GATEWAY "..."'
    const statusMatch = rawMsg.match(/^\d{3}\s+[A-Z_]+(?:\s+"([^"]+)")?/)
    if (statusMatch && statusMatch[1]) {
      return statusMatch[1]
    }
    const quoteMatch = rawMsg.match(/"([^"]+)"/)
    if (quoteMatch && quoteMatch[1] && rawMsg.length > quoteMatch[1].length + 5) {
      return quoteMatch[1]
    }
    if (rawMsg.trim()) {
      return rawMsg.trim()
    }
  }

  return 'Failed to predict rent. Please verify the floor, area, and room details and try again.'
}

/**
 * Preflight check to verify required saved building and property context
 * before executing M1 rent prediction.
 */
export const checkPreflightContext = (floor, building, propertyDetails) => {
  // 1. Floor context
  if (!floor || !floor.floorId) {
    return {
      ok: false,
      isMissing: true,
      title: 'Missing Floor Context',
      message: 'Target floor context is required for rent prediction.',
    }
  }

  if (floor.floorNumber == null || isNaN(Number(floor.floorNumber))) {
    return {
      ok: false,
      isMissing: true,
      title: 'Missing Floor Number',
      message: 'The assigned floor is missing a valid floor number (required by M1 model).',
    }
  }

  // 2. Building context
  if (!building || (!building.buildingId && !building.id)) {
    return {
      ok: false,
      isMissing: true,
      title: 'Missing Building Context',
      message: 'The assigned floor has no associated building context in the database.',
    }
  }

  if (
    building.totalFloors == null ||
    building.totalFloors === '' ||
    isNaN(Number(building.totalFloors)) ||
    Number(building.totalFloors) <= 0
  ) {
    return {
      ok: false,
      isMissing: true,
      title: 'Missing Building Total Floors',
      message:
        'Building total floors (greater than 0) is required by the M1 rent prediction model. Please update the building details.',
    }
  }

  // 3. Property context
  if (propertyDetails) {
    const prop = propertyDetails.property || propertyDetails
    const addr = propertyDetails.address

    // Unsupported property types (COMMERCIAL, HOSTEL)
    if (prop?.propertyType) {
      const typeUpper = String(prop.propertyType).toUpperCase()
      if (typeUpper === 'COMMERCIAL') {
        return {
          ok: false,
          isUnsupported: true,
          title: 'Unsupported Property Type (Commercial)',
          message:
            'Commercial properties are not supported by the M1 rent prediction model. Supported types are Apartment, House, Villa, and PG.',
        }
      }
      if (typeUpper === 'HOSTEL') {
        return {
          ok: false,
          isUnsupported: true,
          title: 'Unsupported Property Type (Hostel)',
          message:
            'Hostel properties are not supported by the M1 rent prediction model. Supported types are Apartment, House, Villa, and PG.',
        }
      }
    } else if (prop && !prop.propertyType) {
      return {
        ok: false,
        isMissing: true,
        title: 'Missing Property Type',
        message: 'The saved property is missing a valid property type.',
      }
    }

    // Furnishing status
    if (prop && !prop.furnishingStatus) {
      return {
        ok: false,
        isMissing: true,
        title: 'Missing Furnishing Status',
        message: 'Property furnishing status is required by the M1 rent prediction model.',
      }
    }

    // Parking available
    if (prop && prop.parkingAvailable == null) {
      return {
        ok: false,
        isMissing: true,
        title: 'Missing Parking Details',
        message: 'Property parking specification is required by the M1 rent prediction model.',
      }
    }

    // Year built
    if (prop && prop.yearBuilt != null) {
      const currentYear = new Date().getFullYear()
      if (Number(prop.yearBuilt) > currentYear) {
        return {
          ok: false,
          isUnsupported: true,
          title: 'Invalid Year Built',
          message: `Property year built (${prop.yearBuilt}) cannot be greater than the current year (${currentYear}).`,
        }
      }
    } else if (prop && prop.yearBuilt == null) {
      return {
        ok: false,
        isMissing: true,
        title: 'Missing Property Year Built',
        message: 'Property year built is required by the M1 rent prediction model to determine property age.',
      }
    }

    // Address context
    if (addr) {
      if (addr.areaType && String(addr.areaType).toUpperCase() === 'PLOT_AREA') {
        return {
          ok: false,
          isUnsupported: true,
          title: 'Unsupported Area Type (Plot Area)',
          message:
            'Plot Area (PLOT_AREA) is not supported by the M1 rent prediction model (supported: Super Built-up, Built-up, and Carpet Area).',
        }
      }
      if (!addr.city || !String(addr.city).trim()) {
        return {
          ok: false,
          isMissing: true,
          title: 'Missing Property City',
          message: 'Property city is required for geographic valuation in the M1 rent prediction model.',
        }
      }
      if (!addr.area || !String(addr.area).trim()) {
        return {
          ok: false,
          isMissing: true,
          title: 'Missing Property Locality / Area',
          message: 'Property locality/area is required by the M1 rent prediction model.',
        }
      }
      if (addr.latitude == null || addr.longitude == null) {
        return {
          ok: false,
          isMissing: true,
          title: 'Missing Geographic Coordinates',
          message: 'Property latitude and longitude coordinates are required by the M1 rent prediction model.',
        }
      }
    }
  }

  return { ok: true }
}

export default function AddUnitPage() {
  const { buildingId, floorId, unitId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(unitId)

  const effectiveFloorId = floorId || searchParams.get('floorId')
  const effectiveBuildingId = buildingId || searchParams.get('buildingId')

  const [floor, setFloor] = useState(null)
  const [building, setBuilding] = useState(null)
  const [propertyDetails, setPropertyDetails] = useState(null)
  const [propertyAmenities, setPropertyAmenities] = useState([])
  const [formData, setFormData] = useState({
    unitNumber: '',
    unitType: 'APARTMENT',
    area: '',
    bedrooms: '1',
    bathrooms: '1',
    monthlyRent: '',
    securityDeposit: '',
    status: 'VACANT',
    description: '',
  })
  const [errors, setErrors] = useState({})
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [predictedRentDisplay, setPredictedRentDisplay] = useState('')

  const preflightStatus = useMemo(() => {
    return checkPreflightContext(floor, building, propertyDetails)
  }, [floor, building, propertyDetails])

  useEffect(() => {
    const loadInitData = async () => {
      setIsPageLoading(true)
      setErrorMessage('')
      try {
        if (isEditMode) {
          const res = await getUnitById(unitId)
          const existing = res?.data || res || null
          if (existing) {
            setFormData({
              unitNumber: existing.unitNumber || '',
              unitType: existing.unitType || '',
              area: String(existing.area ?? ''),
              bedrooms: String(existing.bedrooms ?? ''),
              bathrooms: String(existing.bathrooms ?? ''),
              monthlyRent: String(existing.monthlyRent ?? ''),
              securityDeposit: String(existing.securityDeposit ?? ''),
              status: existing.status || '',
              description: existing.description || '',
            })

            const uFloorId = existing.floorId || existing.floor?.floorId
            const uBuildingId = existing.buildingId || existing.floor?.building?.buildingId

            let flr = null
            if (uFloorId) {
              try {
                const fRes = await getFloorById(uFloorId)
                flr = fRes?.data || fRes || null
              } catch {
                flr = null
              }
            }
            if (!flr && (existing.floor || existing.floorName)) {
              flr = {
                floorId: uFloorId,
                floorName: existing.floorName || existing.floor?.floorName,
                floorNumber: existing.floorNumber ?? existing.floor?.floorNumber,
              }
            }
            setFloor(flr)

            let bld = null
            const bId = uBuildingId || flr?.buildingId || flr?.building?.buildingId
            if (bId) {
              try {
                const bRes = await getBuildingById(bId)
                bld = bRes?.data || bRes || null
              } catch {
                bld = null
              }
            }
            if (!bld && (existing.buildingName || flr?.buildingName)) {
              bld = {
                buildingId: bId,
                buildingName: existing.buildingName || flr?.buildingName,
              }
            }
            setBuilding(bld)

            const pId = existing.propertyId || flr?.propertyId || bld?.propertyId
            if (pId) {
              try {
                const pRes = await getPropertyDetails(pId)
                const pData = pRes?.data || pRes || null
                setPropertyDetails(pData)
                let aList = Array.isArray(pData?.amenities) ? pData.amenities : []
                if (aList.length === 0) {
                  try {
                    const aRes = await getPropertyAmenities(pId)
                    const directList = Array.isArray(aRes?.data) ? aRes.data : Array.isArray(aRes) ? aRes : []
                    if (directList.length > 0) aList = directList
                  } catch {
                    // Ignore fallback amenity fetch error
                  }
                }
                setPropertyAmenities(aList)
              } catch (pErr) {
                console.warn('Could not fetch full property details for preflight:', pErr)
                try {
                  const pRes2 = await getPropertyById(pId)
                  const pData2 = pRes2?.data || pRes2 || null
                  if (pData2) setPropertyDetails({ property: pData2, address: null })
                  try {
                    const aRes = await getPropertyAmenities(pId)
                    const directList = Array.isArray(aRes?.data) ? aRes.data : Array.isArray(aRes) ? aRes : []
                    setPropertyAmenities(directList)
                  } catch {
                    setPropertyAmenities([])
                  }
                } catch {
                  setPropertyDetails(null)
                  setPropertyAmenities([])
                }
              }
            }
          } else {
            setNotFound(true)
          }
        } else {
          const targetFloorId = effectiveFloorId
          if (targetFloorId) {
            try {
              const fRes = await getFloorById(targetFloorId)
              const targetFloor = fRes?.data || fRes || null
              if (targetFloor) {
                setFloor(targetFloor)
                const bId =
                  targetFloor.buildingId ||
                  targetFloor.building?.buildingId ||
                  effectiveBuildingId
                let targetBuilding = null
                if (bId) {
                  try {
                    const bRes = await getBuildingById(bId)
                    targetBuilding = bRes?.data || bRes || targetFloor.building || null
                    setBuilding(targetBuilding)
                  } catch {
                    targetBuilding = targetFloor.building || null
                    setBuilding(targetBuilding)
                  }
                }

                const actualPropId =
                  targetFloor.propertyId ||
                  targetBuilding?.propertyId ||
                  targetFloor.building?.propertyId
                if (actualPropId) {
                  try {
                    const pRes = await getPropertyDetails(actualPropId)
                    const pData = pRes?.data || pRes || null
                    setPropertyDetails(pData)
                    let aList = Array.isArray(pData?.amenities) ? pData.amenities : []
                    if (aList.length === 0) {
                      try {
                        const aRes = await getPropertyAmenities(actualPropId)
                        const directList = Array.isArray(aRes?.data) ? aRes.data : Array.isArray(aRes) ? aRes : []
                        if (directList.length > 0) aList = directList
                      } catch {
                        // Ignore fallback amenity fetch error
                      }
                    }
                    setPropertyAmenities(aList)
                  } catch (pErr) {
                    console.warn('Could not fetch full property details for preflight:', pErr)
                    try {
                      const pRes2 = await getPropertyById(actualPropId)
                      const pData2 = pRes2?.data || pRes2 || null
                      if (pData2) setPropertyDetails({ property: pData2, address: null })
                      try {
                        const aRes = await getPropertyAmenities(actualPropId)
                        const directList = Array.isArray(aRes?.data) ? aRes.data : Array.isArray(aRes) ? aRes : []
                        setPropertyAmenities(directList)
                      } catch {
                        setPropertyAmenities([])
                      }
                    } catch {
                      setPropertyDetails(null)
                      setPropertyAmenities([])
                    }
                  }
                }
              } else {
                setNotFound(true)
              }
            } catch (fErr) {
              console.error('Error fetching target floor:', fErr)
              setNotFound(true)
            }
          } else {
            setNotFound(true)
          }
        }
      } catch (err) {
        console.error('Error loading initial unit form data:', err)
        setErrorMessage(
          err?.response?.data?.message ||
            err?.data?.message ||
            err?.message ||
            'Failed to load unit context.'
        )
      } finally {
        setIsPageLoading(false)
      }
    }
    loadInitData()
  }, [buildingId, floorId, unitId, isEditMode, effectiveFloorId, effectiveBuildingId])

  const validate = () => {
    const errs = {}

    if (!formData.unitNumber || !formData.unitNumber.trim()) {
      errs.unitNumber = 'Unit number is required (e.g. 101, A-102).'
    }

    if (!formData.unitType || !['APARTMENT', 'ROOM'].includes(formData.unitType.toUpperCase())) {
      errs.unitType = 'Unit type must be APARTMENT or ROOM.'
    }

    const validStatuses = ['VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']
    if (!formData.status || !validStatuses.includes(formData.status.toUpperCase())) {
      errs.status = 'Occupancy status must be VACANT, OCCUPIED, RESERVED, or MAINTENANCE.'
    }

    const areaNum = Number(formData.area)
    if (formData.area === '' || formData.area === null || isNaN(areaNum) || areaNum < 0) {
      errs.area = 'Area must be 0 or greater.'
    }

    const bedNum = Number(formData.bedrooms)
    if (
      formData.bedrooms === '' ||
      formData.bedrooms === null ||
      isNaN(bedNum) ||
      bedNum < 0 ||
      !Number.isInteger(bedNum)
    ) {
      errs.bedrooms = 'Bedrooms must be a non-negative integer (0 or greater).'
    }

    const bathNum = Number(formData.bathrooms)
    if (formData.bathrooms === '' || formData.bathrooms === null || isNaN(bathNum) || bathNum < 0) {
      errs.bathrooms = 'Bathrooms must be 0 or greater.'
    }

    const rentNum = Number(formData.monthlyRent)
    if (formData.monthlyRent === '' || formData.monthlyRent === null || isNaN(rentNum) || rentNum < 0) {
      errs.monthlyRent = 'Monthly rent must be 0 or greater.'
    }

    const depositNum = Number(formData.securityDeposit)
    if (formData.securityDeposit === '' || formData.securityDeposit === null || isNaN(depositNum) || depositNum < 0) {
      errs.securityDeposit = 'Security deposit must be 0 or greater.'
    }

    const targetFloorId = Number(floor?.floorId || effectiveFloorId)
    if (!targetFloorId || isNaN(targetFloorId) || targetFloorId <= 0) {
      errs.floorId = 'Valid floor association is required.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val)
  }

  const handlePredictRent = async () => {
    if (isPredicting) return
    setPredictionError('')

    // 1. Preflight check for saved property/building context
    if (preflightStatus && !preflightStatus.ok) {
      setPredictionError(preflightStatus.message)
      return
    }

    const targetFloorId = Number(floor?.floorId || effectiveFloorId)
    if (!targetFloorId || isNaN(targetFloorId) || targetFloorId <= 0) {
      setPredictionError('A valid positive floor ID is required to predict rent.')
      return
    }

    // 2. Validate Area for prediction only (must be strictly greater than 0)
    const areaNum = Number(formData.area)
    if (
      formData.area === '' ||
      formData.area === null ||
      formData.area === undefined ||
      isNaN(areaNum) ||
      areaNum <= 0
    ) {
      setPredictionError('Area must be greater than zero (> 0 sqft) for AI rent prediction.')
      return
    }

    // 3. Validate Bedrooms for prediction only (must be strictly greater than 0)
    // Explaining that zero-bedroom units can still be saved manually but cannot be predicted
    const bedNum = Number(formData.bedrooms)
    if (
      formData.bedrooms === '' ||
      formData.bedrooms === null ||
      formData.bedrooms === undefined ||
      isNaN(bedNum) ||
      !Number.isInteger(bedNum) ||
      bedNum <= 0
    ) {
      if (bedNum === 0) {
        setPredictionError(
          'Bedrooms must be greater than zero for AI rent prediction. Zero-bedroom units (e.g. studios) can still be saved, but cannot be predicted with this model.'
        )
      } else {
        setPredictionError(
          'Bedrooms must be a positive whole number (greater than 0) for AI rent prediction.'
        )
      }
      return
    }

    // 4. Validate Bathrooms for prediction only (must be strictly greater than 0)
    const bathNum = Number(formData.bathrooms)
    if (
      formData.bathrooms === '' ||
      formData.bathrooms === null ||
      formData.bathrooms === undefined ||
      isNaN(bathNum) ||
      bathNum <= 0
    ) {
      setPredictionError('Bathrooms must be greater than zero (> 0) for AI rent prediction.')
      return
    }

    setIsPredicting(true)

    try {
      // POST /ai/rent-prediction/predict-unit with exactly floorId, area, bedrooms, bathrooms
      // Amenities are NOT sent because Spring Boot automatically enriches them from the saved property
      const response = await predictUnitRent({
        floorId: targetFloorId,
        area: areaNum,
        bedrooms: bedNum,
        bathrooms: bathNum,
      })

      const rawPredicted = response?.predictedRent ?? response?.data?.predictedRent
      const numericPredicted =
        typeof rawPredicted === 'number' ? rawPredicted : parseFloat(rawPredicted)

      if (numericPredicted != null && isFinite(numericPredicted) && numericPredicted >= 0) {
        const formattedRent = String(Math.round(numericPredicted * 100) / 100)
        setFormData((prev) => ({ ...prev, monthlyRent: formattedRent }))
        if (errors.monthlyRent) {
          setErrors((prev) => ({ ...prev, monthlyRent: null }))
        }
        setPredictedRentDisplay(formatINR(numericPredicted))
        setPredictionError('')
      } else {
        throw new Error('AI service returned an invalid prediction value.')
      }
    } catch (err) {
      console.error('Failed to predict unit rent:', err)
      const errorMsg = extractBackendErrorMessage(err)
      setPredictionError(errorMsg)
    } finally {
      setIsPredicting(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
    if (predictionError && ['area', 'bedrooms', 'bathrooms'].includes(field)) {
      setPredictionError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!validate()) return

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const targetFloorId = Number(floor?.floorId || effectiveFloorId)
      const payload = formatUnitRequest({
        unitNumber: formData.unitNumber,
        unitType: formData.unitType,
        area: formData.area,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        monthlyRent: formData.monthlyRent,
        securityDeposit: formData.securityDeposit,
        status: formData.status,
        description: formData.description,
        floorId: targetFloorId,
      })

      if (isEditMode) {
        await updateUnit(unitId, payload)
        navigate(`/owner/units/${unitId}`, {
          state: {
            toastMessage: `Unit "${payload.unitNumber}" was updated successfully.`,
          },
        })
      } else {
        await createUnit(payload)
        const targetBId = building?.buildingId || effectiveBuildingId
        navigate(`/owner/buildings/${targetBId}/floors/${targetFloorId}`, {
          state: {
            toastMessage: `Unit "${payload.unitNumber}" was created successfully.`,
          },
        })
      }
    } catch (err) {
      console.error('Failed to save unit:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to save unit. Please check the entered values and try again.'
      setErrorMessage(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Back destination
  const targetBuildingId = building?.buildingId || effectiveBuildingId
  const targetFloorId = floor?.floorId || effectiveFloorId
  const backDestination = isEditMode
    ? `/owner/units/${unitId}`
    : `/owner/buildings/${targetBuildingId}/floors/${targetFloorId}`

  if (isPageLoading) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle={isEditMode ? 'Loading Unit...' : 'Loading Floor Context...'}
      >
        <div className="flex items-center justify-center min-h-[350px]">
          <Loader text={isEditMode ? 'Loading unit data...' : 'Loading floor details...'} />
        </div>
      </DashboardLayout>
    )
  }

  if (notFound) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle="Record Not Found"
      >
        <div className="max-w-3xl mx-auto py-12 space-y-4">
          <EmptyState
            icon={<Home className="w-8 h-8 text-[#5B6875]" />}
            title={isEditMode ? 'Unit Not Found' : 'Floor Context Not Found'}
            description={
              isEditMode
                ? `Could not find a unit matching ID "${unitId}".`
                : `Target floor "${effectiveFloorId}" was not found.`
            }
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

  const unitTypeOptions = UNIT_TYPES.map((t) => ({
    value: t,
    label: t === 'APARTMENT' ? 'Apartment' : 'Private Room / Suite',
  }))
  unitTypeOptions.unshift({ value: '', label: 'Select unit type' })

  const statusOptions = UNIT_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  }))
  statusOptions.unshift({ value: '', label: 'Select status' })

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="properties"
      pageTitle={isEditMode ? `Edit Unit ${formData.unitNumber}` : 'Add New Unit'}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875] flex-wrap">
          <Link
            to={backDestination}
            className="inline-flex items-center gap-1 hover:text-[#315A7D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {isEditMode ? `Back to Unit ${formData.unitNumber || ''}` : 'Back to Floor Units'}
            </span>
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            {isEditMode ? 'Edit Unit' : 'Add Unit'}
          </span>
        </div>

        {/* Page Header */}
        <div className="border-b border-[#D9E0E6] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#315A7D] text-white shadow-xs">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                {isEditMode ? `Edit Unit ${formData.unitNumber}` : 'Register New Unit'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                {building?.buildingName} &bull; {floor?.floorName} (Floor {floor?.floorNumber})
              </p>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B94A48] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-[#B94A48] hover:text-[#8C3836] text-base leading-none px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-6"
        >
          {/* Location & Saved Property Context Card (Read-only) */}
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[#243447]">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#315A7D] shrink-0" />
                <span>
                  Building: <strong>{building?.buildingName || 'Assigned Building'}</strong>
                </span>
                {propertyDetails?.property?.propertyName && (
                  <span className="text-[#5B6875]">
                    &bull; Property: <strong>{propertyDetails.property.propertyName}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#315A7D] shrink-0" />
                <span>
                  Target Floor:{' '}
                  <strong>
                    {floor?.floorName || (floor?.floorNumber == null ? '—' : `Floor ${floor.floorNumber}`)} (Level {floor?.floorNumber ?? '—'})
                  </strong>
                </span>
              </div>
            </div>

            {/* Saved Property Amenities (Read-Only Context) */}
            <div className="pt-2.5 border-t border-[#E5E9EE] space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-[#315A7D] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#315A7D]" />
                  Saved Property Amenities (Read-Only Context):
                </span>
                <span className="text-[11px] text-[#5B6875]">
                  Loaded automatically by Spring Boot for M1 rent prediction
                </span>
              </div>

              {propertyAmenities && propertyAmenities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {propertyAmenities.map((amenity, idx) => {
                    const name =
                      typeof amenity === 'string'
                        ? amenity
                        : amenity?.amenityName || amenity?.name || 'Amenity'
                    return (
                      <span
                        key={amenity?.amenityId || idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-[#243447] text-[11px] font-medium border border-[#D9E0E6] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#315A7D]" />
                        {name}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#5B6875] italic">
                  No amenities are attached to the saved property yet.
                </p>
              )}
            </div>
          </div>

          {/* Floor Locking Note in Edit Mode */}
          {isEditMode && (
            <div className="flex items-center gap-2 text-xs text-[#5B6875] bg-[#F7F8FA] px-3.5 py-2.5 rounded-lg border border-[#D9E0E6]">
              <Lock className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
              <span>Floor and building assignment are locked to this unit's registered location.</span>
            </div>
          )}

          {errors.floorId && (
            <p className="text-xs text-[#B94A48] font-medium">{errors.floorId}</p>
          )}

          {/* Section: Unit Overview & Classification */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#315A7D] border-b border-[#D9E0E6] pb-2">
              Unit Overview &amp; Type
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Unit Number / Identifier"
                placeholder="e.g. 101, A-202"
                value={formData.unitNumber}
                onChange={(e) => handleChange('unitNumber', e.target.value)}
                error={errors.unitNumber}
                required
              />

              <Select
                label="Unit Type"
                value={formData.unitType}
                onChange={(e) => handleChange('unitType', e.target.value)}
                options={unitTypeOptions}
                error={errors.unitType}
                required
              />

              <Select
                label="Current Status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                options={statusOptions}
                error={errors.status}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Area (Square Feet)"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1150"
                value={formData.area}
                onChange={(e) => handleChange('area', e.target.value)}
                error={errors.area}
                required
              />

              <div>
                <Input
                  label="Bedrooms"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2"
                  value={formData.bedrooms}
                  onChange={(e) => handleChange('bedrooms', e.target.value)}
                  error={errors.bedrooms}
                  required
                />
                {Number(formData.bedrooms) === 0 && (
                  <p className="mt-1 text-[11px] text-[#73510D] bg-[#FFF9E6] px-2 py-0.5 rounded border border-[#FFE082] leading-tight">
                    Zero-bedroom units can still be saved manually, but cannot be predicted with this model.
                  </p>
                )}
              </div>

              <Input
                label="Bathrooms"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 2 or 1.5"
                value={formData.bathrooms}
                onChange={(e) => handleChange('bathrooms', e.target.value)}
                error={errors.bathrooms}
                required
              />
            </div>
          </div>

          {/* Section: Rental & Financials */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#315A7D] border-b border-[#D9E0E6] pb-2">
              Rental &amp; Deposit
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  label="Monthly Rent (₹ INR)"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 3200"
                  value={formData.monthlyRent}
                  onChange={(e) => handleChange('monthlyRent', e.target.value)}
                  error={errors.monthlyRent}
                  required
                />

                {!isEditMode && (
                  <div className="space-y-2 pt-1">
                    {/* Preflight Context Alert Card when saved building/property context is missing or unsupported */}
                    {preflightStatus && !preflightStatus.ok && (
                      <div className="p-3 rounded-lg bg-[#FFF9E6] border border-[#FFE082] text-xs text-[#856404] space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[#856404]">
                          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
                          <span>Preflight Notice: {preflightStatus.title}</span>
                        </div>
                        <p className="text-[#73510D] pl-5 leading-relaxed">
                          {preflightStatus.message}
                        </p>
                        <p className="text-[#92701A] pl-5 text-[11px] italic">
                          Zero-bedroom units and units with missing or unsupported property context can still be saved manually, but AI rent prediction requires supported saved context.
                        </p>
                      </div>
                    )}

                    {/* AI Prediction Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handlePredictRent}
                        disabled={isPredicting || (preflightStatus && !preflightStatus.ok)}
                        isLoading={isPredicting}
                        leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#315A7D]" />}
                        className="text-xs"
                        title={
                          preflightStatus && !preflightStatus.ok
                            ? preflightStatus.message
                            : 'Predict monthly rent using M1 model'
                        }
                      >
                        {isPredicting ? 'Predicting Rent...' : 'Predict Rent with AI'}
                      </Button>

                      {predictedRentDisplay && !predictionError && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EAF2F7] text-[#315A7D] text-xs font-semibold border border-[#D9E0E6]">
                          <Sparkles className="w-3.5 h-3.5 text-[#315A7D]" />
                          AI Predicted Rent: {predictedRentDisplay}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#5B6875] leading-normal">
                      AI prediction requires area, bedrooms, and bathrooms &gt; 0. Amenities are automatically loaded from the saved property. Zero-bedroom units can still be saved manually.
                    </p>

                    {/* Backend Validation / Service Error Display */}
                    {predictionError && (
                      <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs animate-in fade-in">
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-[#B94A48] mt-0.5" />
                          <div>
                            <span className="font-semibold block text-[#8C3836]">Rent Prediction Error:</span>
                            <span className="text-[#B94A48] leading-relaxed">{predictionError}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={handlePredictRent}
                            disabled={isPredicting || (preflightStatus && !preflightStatus.ok)}
                            className="font-semibold underline hover:text-[#8C3836] cursor-pointer disabled:opacity-50"
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            onClick={() => setPredictionError('')}
                            className="text-[#B94A48] hover:text-[#8C3836] text-base leading-none px-1 cursor-pointer"
                            title="Dismiss error"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Input
                label="Security Deposit (₹ INR)"
                type="number"
                min="0"
                step="25"
                placeholder="e.g. 3200"
                value={formData.securityDeposit}
                onChange={(e) => handleChange('securityDeposit', e.target.value)}
                error={errors.securityDeposit}
                required
              />
            </div>
          </div>

          {/* Section: Description */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#315A7D] border-b border-[#D9E0E6] pb-2">
              Description (Optional)
            </h2>

            <Textarea
              label="Unit Description"
              placeholder="Describe layout features, views, balconies, or interior fixtures..."
              rows={4}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#D9E0E6] flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(backDestination)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isEditMode ? 'Save Unit Changes' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
