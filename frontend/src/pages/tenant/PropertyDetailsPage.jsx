import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import PublicLayout from '../../layouts/PublicLayout'
import PropertyDetailsSection from '../../components/properties/PropertyDetailsSection'
import { getPublicPropertyDetails as getPublicDetails } from '../../api/publicPropertyApi'
import { getPublicPropertyDetails as getTenantDetails } from '../../api/propertyApi'
import { resolveImageUrl } from '../../api/propertyApi'
import { useAuth } from '../../context/AuthContext'
import { isTenant } from '../../utils/roles'
import {
  ArrowLeft,
  MapPin,
  Share2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldAlert,
  Building,
  Check,
} from 'lucide-react'

function adaptPublicPropertyDetails(data) {
  const location = data?.location || {}
  const address = data?.address || data?.property?.address || {
    area: location.area,
    city: location.city,
    state: location.state,
  }

  // The public API returns vacant units as a flat list, while the existing
  // details UI renders them in its Building -> Floor -> Unit layout.
  const buildingsByName = new Map()
  for (const availableUnit of Array.isArray(data?.availableUnits) ? data.availableUnits : []) {
    const buildingName = availableUnit.buildingName || 'Building'
    const floorKey = availableUnit.floorNumber ?? 'unspecified'
    if (!buildingsByName.has(buildingName)) {
      buildingsByName.set(buildingName, { buildingName, floorsByNumber: new Map() })
    }
    const building = buildingsByName.get(buildingName)
    if (!building.floorsByNumber.has(floorKey)) {
      building.floorsByNumber.set(floorKey, {
        floor: {
          floorNumber: availableUnit.floorNumber,
          floorName: availableUnit.floorNumber != null ? `Floor ${availableUnit.floorNumber}` : 'Floor',
        },
        units: [],
      })
    }
    building.floorsByNumber.get(floorKey).units.push({
      ...availableUnit,
      status: availableUnit.status || 'VACANT',
    })
  }

  const buildings = [...buildingsByName.values()].map((building) => ({
    building: { buildingName: building.buildingName },
    floors: [...building.floorsByNumber.values()],
  }))

  return {
    ...data,
    address,
    buildings: Array.isArray(data?.buildings) ? data.buildings : buildings,
  }
}

export default function PropertyDetailsPage({
  property: propFromProps,
  propertyId: propPropertyId,
  onBack,
  onSelectSimilar,
  publicMode = false,
}) {
  const { id: routeId, propertyId: publicRouteId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isUserTenant = !publicMode && Boolean(user && isTenant(user.role))
  const PageLayout = publicMode ? PublicLayout : DashboardLayout

  // Target property ID from route param or props
  const activeId = propPropertyId || routeId || publicRouteId || propFromProps?.propertyId || propFromProps?.id

  // State
  const [details, setDetails] = useState(
    propFromProps && (propFromProps.buildings || propFromProps.property)
      ? {
          property: propFromProps.property || propFromProps,
          address: propFromProps.address || null,
          images: Array.isArray(propFromProps.images) ? propFromProps.images : [],
          amenities: Array.isArray(propFromProps.amenities) ? propFromProps.amenities : [],
          buildings: Array.isArray(propFromProps.buildings) ? propFromProps.buildings : [],
        }
      : null
  )
  const [isLoading, setIsLoading] = useState(!details && Boolean(activeId))
  const [error, setError] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [copiedLink, setCopiedLink] = useState(false)
  const requestedIdRef = useRef(null)

  // Fetch real property details from backend
  const loadDetails = useCallback(async () => {
    if (!activeId) {
      if (!propFromProps) {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await (publicMode ? getPublicDetails : getTenantDetails)(activeId)
      const data = publicMode ? adaptPublicPropertyDetails(response) : response
      if (data && data.property) {
        setDetails({
          property: data.property,
          address: data.address || null,
          images: Array.isArray(data.images) ? data.images : [],
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          buildings: Array.isArray(data.buildings) ? data.buildings : [],
        })
      } else {
        throw { status: 404, isNotFound: true, message: 'Property not found.' }
      }
    } catch (err) {
      console.error('Failed to load property details:', err)
      setError({
        status: err?.status,
        message: err?.message || 'Failed to load property details. Please try again.',
        isNotFound: err?.isNotFound || err?.status === 404,
        isForbidden: err?.isForbidden || err?.status === 403,
        isAuthError: err?.isAuthError || err?.status === 401,
        isNetworkError: err?.isNetworkError,
      })
    } finally {
      setIsLoading(false)
    }
  }, [activeId, propFromProps, publicMode])

  useEffect(() => {
    setActiveImageIndex(0)
    if (requestedIdRef.current === activeId) return
    requestedIdRef.current = activeId
    loadDetails()
  }, [loadDetails, activeId])

  // Real image list resolved via resolveImageUrl
  const imageList = useMemo(() => {
    const raw = details?.images || []
    if (raw.length === 0) return []
    // Prioritize primary images first
    const sorted = [...raw].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    return sorted
      .map((img) => resolveImageUrl(typeof img === 'string' ? img : img.imageUrl))
      .filter(Boolean)
  }, [details])

  // Formatted address line
  const formattedAddress = useMemo(() => {
    const addr = details?.address
    if (!addr) return null
    const parts = [addr.addressLine1, addr.addressLine2, addr.area, addr.city, addr.state, addr.pincode].filter(
      Boolean
    )
    return parts.length > 0 ? parts.join(', ') : null
  }, [details])

  // Navigation handlers
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      if (publicMode) {
        navigate('/#property-listings', {
          state: { publicFilters: location.state?.publicFilters },
        })
      } else {
        navigate('/tenant/properties')
      }
    }
  }

  const handleApply = (unitId) => {
    const propertyId = property.propertyId || activeId
    const requestedUnitId = unitId || new URLSearchParams(location.search).get('unitId')
    const query = new URLSearchParams({ propertyId: String(propertyId) })
    if (requestedUnitId) query.set('unitId', requestedUnitId)
    const applicationPath = `/tenant/applications/new?${query.toString()}`

    if (!user) {
      navigate('/login', {
        state: {
          from: {
            pathname: '/tenant/applications/new',
            search: `?${query.toString()}`,
          },
        },
      })
      return
    }

    navigate(applicationPath)
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  // Helper for Status Badge Styling
  const getPropertyStatusBadge = (status) => {
    const norm = String(status || '').toUpperCase()
    if (norm === 'ACTIVE' || norm === 'AVAILABLE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
          <Check className="w-3 h-3" />
          {norm === 'AVAILABLE' ? 'Available' : 'Active'}
        </span>
      )
    }
    if (norm === 'UNDER_MAINTENANCE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]">
          Under Maintenance
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F7F8FA] text-[#5B6875] border border-[#D9E0E6]">
        {status || 'Unknown'}
      </span>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Loading Skeleton State
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <PageLayout defaultRole="tenant" activeItem="find-properties" pageTitle="Property Details">
        <div className="min-h-screen space-y-6 pb-20 animate-pulse">
          {/* Top Bar Skeleton */}
          <div className="flex items-center justify-between py-2 border-b border-[#D9E0E6]">
            <div className="h-6 w-36 bg-[#EAF2F7] rounded-md" />
            <div className="flex gap-2">
              <div className="h-7 w-20 bg-[#EAF2F7] rounded-md" />
              <div className="h-7 w-20 bg-[#EAF2F7] rounded-md" />
            </div>
          </div>

          {/* Header Skeleton */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-24 bg-[#EAF2F7] rounded-md" />
              <div className="h-5 w-20 bg-[#EAF2F7] rounded-md" />
            </div>
            <div className="h-8 w-72 bg-[#EAF2F7] rounded-md" />
            <div className="h-4 w-96 bg-[#EAF2F7] rounded-md" />
          </div>

          {/* Gallery Skeleton */}
          <div className="aspect-[16/9] md:aspect-[21/9] w-full rounded-lg bg-[#EAF2F7] border border-[#D9E0E6]" />

          {/* Two-Column Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-48 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6]" />
              <div className="h-32 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6]" />
              <div className="h-64 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6]" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <div className="h-80 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6]" />
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Error States (404, 403 Forbidden, General / Network)
  // ---------------------------------------------------------------------------
  if (error) {
    const is403 = error.isForbidden || error.status === 403
    const is404 = error.isNotFound || error.status === 404

    return (
      <PageLayout defaultRole="tenant" activeItem="find-properties" pageTitle="Property Details">
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
          {is403 ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6] mb-4">
              <ShieldAlert className="h-8 w-8" />
            </div>
          ) : is404 ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] mb-4">
              <Building2 className="h-8 w-8" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FDF2F2] text-[#E02424] border border-[#F8B4B4] mb-4">
              <AlertCircle className="h-8 w-8" />
            </div>
          )}

          <h2 className="text-xl font-bold text-[#243447]">
            {is403
              ? 'Access Restricted (403 Forbidden)'
              : is404
              ? 'Property Not Found (404)'
              : 'Failed to Load Property Details'}
          </h2>

          <p className="text-sm text-[#5B6875] mt-2 leading-relaxed">
            {is403
              ? publicMode
                ? 'The public property details endpoint is not available to guests. The backend must allow unauthenticated GET access to published property details.'
                : "You do not currently have permission to access this property's full details. Please ensure you are logged in with the appropriate tenant account or try again."
              : is404
              ? 'The rental property you requested does not exist or may have been removed by its owner.'
              : error.status === 401 || error.status === 403
              ? `The public property details endpoint returned ${error.status}. The backend must allow unauthenticated GET access to published property details.`
              : error.message || 'An unexpected error occurred while communicating with the server.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E0E6] bg-white px-4 py-2 text-xs font-semibold text-[#243447] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#5B6875]" />
              <span>Back to Properties</span>
            </button>

            {/* Try Again button for recoverable errors */}
            <button
              type="button"
              onClick={loadDetails}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#315A7D] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#274B68] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </PageLayout>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Empty State (No property ID provided)
  // ---------------------------------------------------------------------------
  if (!details || !details.property) {
    return (
      <PageLayout defaultRole="tenant" activeItem="find-properties" pageTitle="Property Details">
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-[#243447]">No Property Selected</h2>
          <p className="text-sm text-[#5B6875] mt-1">
            Please browse the available properties to view full floor plans, unit pricing, and verified amenities.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#315A7D] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#274B68] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse Properties</span>
          </button>
        </div>
      </PageLayout>
    )
  }

  const { property, address, amenities, buildings } = details

  return (
    <PageLayout
      defaultRole="tenant"
      activeItem="find-properties"
      pageTitle={property.propertyName || 'Property Details'}
    >
      <div className={`${publicMode ? 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8' : 'min-h-screen pb-20'} space-y-6`}>
        {/* 1. Navigation Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-[#D9E0E6]">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#243447] hover:text-[#315A7D] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#315A7D]" />
            <span>Back to All Properties</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#D9E0E6] bg-white text-xs font-medium text-[#243447] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#5B6875]" />
              <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

          </div>
        </div>

        {/* 2. Property Header & Location */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20 uppercase tracking-wider">
                {property.propertyType || '—'}
              </span>
              {getPropertyStatusBadge(property.status)}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#243447]">
            {property.propertyName}
          </h1>

          <p className="flex items-center gap-1.5 text-sm text-[#5B6875]">
            <MapPin className="w-4 h-4 text-[#315A7D] shrink-0" />
            <span>{formattedAddress || 'Address details in specs below'}</span>
          </p>
        </div>

        {/* 3. Image Gallery */}
        <div className="space-y-3">
          {imageList.length > 0 ? (
            <>
              {/* Main Display Image */}
              <div className="relative aspect-[16/9] md:aspect-[21/9] max-h-[560px] w-full overflow-hidden rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] shadow-sm">
                <img
                  src={imageList[activeImageIndex] || imageList[0]}
                  alt={`${property.propertyName} preview`}
                  className="h-full w-full object-cover transition-all duration-300"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-md bg-[#243447]/80 text-white text-xs font-medium backdrop-blur-xs">
                  Photo {activeImageIndex + 1} of {imageList.length}
                </div>
              </div>

              {/* Thumbnails Row (if more than 1 image) */}
              {imageList.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {imageList.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-md border-2 transition-all cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-[#315A7D] ring-2 ring-[#315A7D]/30'
                          : 'border-[#D9E0E6] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Clean placeholder when no images are uploaded */
            <div className="aspect-[16/9] md:aspect-[21/9] max-h-[560px] w-full rounded-xl bg-[#F7F8FA] border-2 border-dashed border-[#D9E0E6] flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="p-4 rounded-full bg-[#EAF2F7] text-[#315A7D]">
                <Building className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-[#243447]">No Photos Uploaded Yet</p>
              <p className="text-xs text-[#5B6875] max-w-sm">
                Floor plans, unit specifications, and building details for {property.propertyName} are listed in full below.
              </p>
            </div>
          )}
        </div>

        {/* 4. Main Two-Column Layout (Details + Sticky Booking Action Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
          {/* Left Column: Full Specifications, Real Address, Real Amenities, Buildings -> Floors -> Units Hierarchy */}
          <div className="lg:col-span-8 space-y-8">
            <PropertyDetailsSection
              property={property}
              address={address}
              amenities={amenities}
              buildings={buildings}
              onSelectUnit={(unit) => {
                const propId = property.propertyId || activeId
                const unitId = unit.unitId || unit.id
                handleApply(unitId)
              }}
            />
          </div>

          {/* Right Column: Sticky Inquiries / Action Card */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs space-y-5">
              {/* Header */}
              <div className="space-y-1 pb-4 border-b border-[#D9E0E6]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#315A7D] uppercase tracking-wide">
                    Property Overview
                  </span>
                  {getPropertyStatusBadge(property.status)}
                </div>
                <h3 className="text-lg font-bold text-[#243447] pt-1">
                  {property.propertyName}
                </h3>
                <p className="text-xs text-[#5B6875]">
                  {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase())
                    ? 'Rental details and home specifications for this property.'
                    : 'Unit-level pricing, layouts, and availability are listed under Buildings & Units below.'}
                </p>
              </div>

              {/* Real Property Highlights list */}
              <div className="space-y-2 text-xs text-[#5B6875]">
                {property.propertyType && (
                  <div className="flex items-center justify-between py-1">
                    <span>Property Type</span>
                    <span className="font-semibold text-[#243447] capitalize">
                      {String(property.propertyType).replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </div>
                )}

                {property.totalArea != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Total Area</span>
                    <span className="font-semibold text-[#243447]">
                      {property.totalArea.toLocaleString('en-IN')} sq ft
                    </span>
                  </div>
                )}

                {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase()) && property.monthlyRent != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Monthly Rent</span>
                    <span className="font-semibold text-[#315A7D]">₹{Number(property.monthlyRent).toLocaleString('en-IN')} / mo</span>
                  </div>
                )}
                {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase()) && property.securityDeposit != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Security Deposit</span>
                    <span className="font-semibold text-[#243447]">₹{Number(property.securityDeposit).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase()) && property.bedrooms != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Bedrooms / BHK</span>
                    <span className="font-semibold text-[#243447]">{property.bedrooms} BHK</span>
                  </div>
                )}
                {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase()) && property.bathrooms != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Bathrooms</span>
                    <span className="font-semibold text-[#243447]">{property.bathrooms}</span>
                  </div>
                )}
                {['HOUSE', 'VILLA'].includes(String(property.propertyType || '').toUpperCase()) && property.totalFloors != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Total Floors</span>
                    <span className="font-semibold text-[#243447]">{property.totalFloors}</span>
                  </div>
                )}

                {property.furnishingStatus && (
                  <div className="flex items-center justify-between py-1">
                    <span>Furnishing</span>
                    <span className="font-semibold text-[#243447] capitalize">
                      {String(property.furnishingStatus).replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </div>
                )}

                {property.parkingAvailable != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Parking</span>
                    <span className="font-semibold text-[#243447]">
                      {property.parkingAvailable ? 'Available on premise' : 'No dedicated parking'}
                    </span>
                  </div>
                )}

                {property.yearBuilt != null && (
                  <div className="flex items-center justify-between py-1">
                    <span>Year Built</span>
                    <span className="font-semibold text-[#243447]">{property.yearBuilt}</span>
                  </div>
                )}

                {isUserTenant && property.ownerName && (
                  <div className="flex items-center justify-between py-1">
                    <span>Property Manager</span>
                    <span className="font-semibold text-[#243447]">{property.ownerName}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (pre-existing) */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleApply()
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#315A7D] hover:bg-[#274B68] px-5 py-3 text-sm font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply for Property</span>
                </button>

                <p className="rounded-md border border-[#D9E0E6] bg-[#F7F8FA] px-4 py-3 text-xs text-[#5B6875]">
                  Tour scheduling is unavailable because the backend does not provide a tour-request service.
                </p>
              </div>

              {/* Tenant Guarantee Badge */}
              <div className="rounded-md bg-[#F7F8FA] border border-[#D9E0E6] p-3 flex items-start gap-2.5 text-[11px] text-[#5B6875]">
                <ShieldCheck className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#243447]">SmartEstate Tenant Protection:</strong> Direct digital lease signing, verified owner listings, and transparent security deposit terms.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageLayout>
  )
}
