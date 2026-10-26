import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import {
  getManagerAssignedProperties,
  getManagerAssignedPropertyById,
} from '../../api/propertyApi'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  Building2,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  User,
  Calendar,
  Maximize2,
  Car,
  Sofa,
  Clock,
  Eye,
  X,
  Search,
  RotateCcw,
  FileText,
  Shield,
} from 'lucide-react'

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

// Property Type Formatter
const formatPropertyType = (type) => {
  if (!type) return '—'
  const str = String(type).replace(/_/g, ' ').toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Furnishing Status Formatter
const formatFurnishing = (furnishing) => {
  if (!furnishing) return '—'
  const upper = String(furnishing).toUpperCase()
  switch (upper) {
    case 'FULLY_FURNISHED':
      return 'Fully Furnished'
    case 'SEMI_FURNISHED':
      return 'Semi-Furnished'
    case 'UNFURNISHED':
      return 'Unfurnished'
    default:
      return String(furnishing).replace(/_/g, ' ')
  }
}

/**
 * Manager Assigned Properties Page
 * Displays the list of properties assigned to the authenticated Property Manager
 * Endpoint: GET /api/property-manager/properties
 * Details Endpoint: GET /api/property-manager/properties/{propertyId}
 */
export default function ManagerPropertiesPage() {
  const { propertyId: routePropertyId } = useParams()
  const navigate = useNavigate()

  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Details Modal State
  const [selectedPropertyId, setSelectedPropertyId] = useState(routePropertyId || null)
  const [detailsData, setDetailsData] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  // Sync route param with modal state
  useEffect(() => {
    if (routePropertyId) {
      setSelectedPropertyId(routePropertyId)
    }
  }, [routePropertyId])

  // Fetch all assigned properties
  const loadAssignedProperties = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorType(null)

    try {
      const res = await getManagerAssignedProperties()
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      setProperties(data)
    } catch (err) {
      console.error('[Manager] Failed to load assigned properties:', err)
      const status = err?.status

      if (err?.isAuthError || status === 401) {
        setErrorType('401')
        setError('Your session has expired. Please sign in again to access assigned properties.')
      } else if (err?.isForbidden || status === 403) {
        setErrorType('403')
        setError('Access restricted: You do not have permission to view manager property records. Ensure you are signed in with the Property Manager role.')
      } else if (err?.isNotFound || status === 404) {
        setErrorType('404')
        setError('The assigned property records could not be found.')
      } else if (err?.isNetworkError) {
        setErrorType('network')
        setError('Network error: Unable to connect to the server. Please check your internet connection.')
      } else {
        setErrorType('server')
        setError(err?.message || 'Unable to load assigned properties from the server. Please try again.')
      }
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAssignedProperties()
  }, [loadAssignedProperties])

  // Fetch single property details summary on modal open
  const loadPropertyDetails = useCallback(async (id) => {
    if (!id) return
    setLoadingDetails(true)
    setDetailsError(null)

    try {
      const data = await getManagerAssignedPropertyById(id)
      setDetailsData(data)
    } catch (err) {
      console.error(`[Manager] Failed to load property #${id} details summary:`, err)
      const status = err?.status

      if (err?.isAuthError || status === 401) {
        setDetailsError('Your session has expired. Please sign in again.')
      } else if (err?.isForbidden || status === 403) {
        setDetailsError('Access restricted: You do not have permission to inspect this property.')
      } else if (err?.isNotFound || status === 404) {
        setDetailsError(`Property #${id} was not found or is no longer assigned to your management portfolio.`)
      } else if (err?.isNetworkError) {
        setDetailsError('Network error: Unable to reach the server. Please check your connection.')
      } else {
        setDetailsError(err?.message || 'Failed to load property details summary.')
      }
      setDetailsData(null)
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  const handleOpenDetails = (id) => {
    navigate(`/manager/properties/${id}`)
  }

  const handleCloseDetails = () => {
    setSelectedPropertyId(null)
    setDetailsData(null)
    setDetailsError(null)
    if (routePropertyId) {
      navigate('/manager/properties', { replace: true })
    }
  }

  // Load details if propertyId was provided via route
  useEffect(() => {
    if (selectedPropertyId) {
      loadPropertyDetails(selectedPropertyId)
    }
  }, [selectedPropertyId, loadPropertyDetails])

  // Filter properties by search query and type
  const filteredProperties = properties.filter((prop) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      (prop.propertyName && prop.propertyName.toLowerCase().includes(q)) ||
      (prop.propertyId != null && String(prop.propertyId).includes(q)) ||
      (prop.ownerName && prop.ownerName.toLowerCase().includes(q)) ||
      (prop.description && prop.description.toLowerCase().includes(q))

    const matchesType =
      typeFilter === 'ALL' ||
      (prop.propertyType && String(prop.propertyType).toUpperCase() === typeFilter)

    return matchesSearch && matchesType
  })

  // Unique property types for filter dropdown
  const availableTypes = Array.from(
    new Set(properties.map((p) => p.propertyType).filter(Boolean))
  )

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="properties"
      pageTitle="Assigned Properties"
    >
      <div className="space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">

            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
                Assigned Properties
              </h1>
              {!loading && !error && (
                <span className="font-mono text-xs font-bold text-[#315A7D] bg-[#EAF2F7] px-2.5 py-1 rounded-md border border-[#D9E0E6]">
                  {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#5B6875]">
              View and Manage your Properties.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAssignedProperties}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Search and Filters Bar (only when properties exist or when filtering) */}
        {!loading && !error && properties.length > 0 && (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B6875]">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search by property name, ID, or owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-md text-xs sm:text-sm border border-[#D9E0E6] bg-white text-[#243447] placeholder:text-[#98A2B3] pl-9 pr-3 py-2 focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#5B6875] hover:text-[#243447]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {availableTypes.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                  Type:
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-md text-xs sm:text-sm border border-[#D9E0E6] bg-white text-[#243447] px-2.5 py-2 focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
                >
                  <option value="ALL">All Types</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {formatPropertyType(t)}
                    </option>
                  ))}
                </select>

                {(searchQuery || typeFilter !== 'ALL') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setTypeFilter('ALL')
                    }}
                    leftIcon={<RotateCcw className="w-3 h-3" />}
                  >
                    Reset
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader size="lg" text="Loading assigned properties..." center />
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs space-y-4">
            <div className="flex items-start gap-3 text-[#B94A48]">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#243447]">
                  {errorType === '403'
                    ? 'Access Restricted'
                    : errorType === '401'
                      ? 'Session Expired'
                      : errorType === 'network'
                        ? 'Network Connection Issue'
                        : 'Failed to Load Assigned Properties'}
                </h2>
                <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={loadAssignedProperties}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
              <Link to="/manager/dashboard">
                <Button variant="secondary" size="sm">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8 text-[#315A7D]" />}
            title="No properties assigned"
            message="You do not currently have any properties assigned to your management portfolio. Properties assigned by property owners will appear here."
            action={{
              label: 'Return to Dashboard',
              onClick: () => navigate('/manager/dashboard'),
              variant: 'primary',
            }}
          />
        ) : filteredProperties.length === 0 ? (
          <EmptyState
            icon={<Search className="w-8 h-8 text-[#5B6875]" />}
            title="No matching properties found"
            message={`No assigned properties match your search "${searchQuery}".`}
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('')
                setTypeFilter('ALL')
              },
              variant: 'secondary',
            }}
          />
        ) : (
          /* Assigned Properties Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProperties.map((prop) => (
              <div
                key={prop.propertyId}
                className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Type & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                      #{prop.propertyId}
                    </span>
                    <StatusBadge status={prop.status} size="sm" />
                  </div>

                  {/* Property Name & Type */}
                  <div>
                    <h2 className="text-base font-bold text-[#243447] tracking-tight line-clamp-1">
                      {prop.propertyName || 'Unnamed Property'}
                    </h2>
                    <span className="text-xs text-[#5B6875] font-medium">
                      {formatPropertyType(prop.propertyType)}
                    </span>
                  </div>

                  {/* Description */}
                  {prop.description ? (
                    <p className="text-xs text-[#5B6875] leading-relaxed line-clamp-2">
                      {prop.description}
                    </p>
                  ) : (
                    <p className="text-xs text-[#5B6875]/70 italic">
                      No description provided.
                    </p>
                  )}

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#D9E0E6] text-xs">
                    {/* Owner Information */}
                    <div className="flex items-center gap-1.5 text-[#5B6875] truncate">
                      <User className="w-3.5 h-3.5 shrink-0 text-[#315A7D]" />
                      <span className="truncate">
                        {prop.ownerName || (prop.ownerId ? `Owner #${prop.ownerId}` : '—')}
                      </span>
                    </div>

                    {/* Total Area */}
                    <div className="flex items-center gap-1.5 text-[#5B6875] truncate">
                      <Maximize2 className="w-3.5 h-3.5 shrink-0 text-[#315A7D]" />
                      <span className="truncate">
                        {prop.totalArea != null
                          ? `${Number(prop.totalArea).toLocaleString('en-IN')} sq. ft.`
                          : '—'}
                      </span>
                    </div>

                    {/* Furnishing */}
                    <div className="flex items-center gap-1.5 text-[#5B6875] truncate">
                      <Sofa className="w-3.5 h-3.5 shrink-0 text-[#315A7D]" />
                      <span className="truncate">{formatFurnishing(prop.furnishingStatus)}</span>
                    </div>

                    {/* Parking */}
                    <div className="flex items-center gap-1.5 text-[#5B6875] truncate">
                      <Car className="w-3.5 h-3.5 shrink-0 text-[#315A7D]" />
                      <span className="truncate">
                        {prop.parkingAvailable ? 'Parking Available' : 'No Parking'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Created Date & Action */}
                <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-between gap-2 text-xs">
                  <div className="text-[11px] text-[#5B6875] truncate">
                    <span>Registered Date: </span>
                    <span className="font-medium text-[#243447]">{formatDate(prop.createdAt)}</span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenDetails(prop.propertyId)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Summary Modal */}
      {selectedPropertyId && (
        <PropertyDetailsSummaryModal
          propertyId={selectedPropertyId}
          data={detailsData}
          loading={loadingDetails}
          error={detailsError}
          onClose={handleCloseDetails}
          onRetry={() => loadPropertyDetails(selectedPropertyId)}
        />
      )}
    </DashboardLayout>
  )
}

/**
 * Details Summary Modal Component
 * Displays the complete property summary returned by GET /api/property-manager/properties/{propertyId}
 * Note: Only displays fields present on PropertyResponse. Does NOT query or display hierarchy (buildings, floors, units, images, amenities).
 */
function PropertyDetailsSummaryModal({
  propertyId,
  data,
  loading,
  error,
  onClose,
  onRetry,
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#243447]/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-property-title"
    >
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-xl border border-[#D9E0E6] shadow-lg overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#D9E0E6] flex items-center justify-between bg-[#F7F8FA] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="modal-property-title"
                className="text-base font-bold text-[#243447] tracking-tight"
              >
                Property Details Summary
              </h2>
              <span className="text-xs font-mono font-medium text-[#5B6875]">
                Reference ID: #{propertyId}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader size="md" text="Loading property details summary..." center />
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#243447]">
                    Unable to load property details
                  </h3>
                  <p className="text-xs text-[#5B6875]">{error}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Primary Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                    Property Name
                  </span>
                  <h3 className="text-lg font-bold text-[#243447]">
                    {data.propertyName || 'Unnamed Property'}
                  </h3>
                  <span className="text-xs text-[#5B6875]">
                    Type: <strong className="text-[#243447] font-semibold">{formatPropertyType(data.propertyType)}</strong>
                  </span>
                </div>
                <div>
                  <StatusBadge status={data.status} size="md" />
                </div>
              </div>

              {/* Description Section */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#315A7D]" />
                  <span>Description</span>
                </h4>
                <div className="p-3.5 rounded-lg bg-white border border-[#D9E0E6] text-xs sm:text-sm text-[#243447] leading-relaxed">
                  {data.description || 'No description provided for this property.'}
                </div>
              </div>

              {/* Physical Specifications Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875]">
                  Property Specifications
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Total Area */}
                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Total Area
                    </span>
                    <p className="text-sm font-bold text-[#243447]">
                      {data.totalArea != null
                        ? `${Number(data.totalArea).toLocaleString('en-IN')} sq. ft.`
                        : '—'}
                    </p>
                  </div>

                  {/* Furnishing Status */}
                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Furnishing Status
                    </span>
                    <p className="text-sm font-bold text-[#243447]">
                      {formatFurnishing(data.furnishingStatus)}
                    </p>
                  </div>

                  {/* Parking Availability */}
                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Parking
                    </span>
                    <p className="text-sm font-bold text-[#243447]">
                      {data.parkingAvailable ? 'Available (Yes)' : 'Not Available (No)'}
                    </p>
                  </div>

                  {/* Year Built */}
                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Year Built
                    </span>
                    <p className="text-sm font-bold text-[#243447]">
                      {data.yearBuilt != null ? String(data.yearBuilt) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ownership & Administrative Information */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875]">
                  Ownership & Record Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Property Owner
                    </span>
                    <p className="text-sm font-semibold text-[#243447]">
                      {data.ownerName || '—'}
                    </p>
                    {data.ownerId != null && (
                      <span className="text-[11px] font-mono text-[#5B6875]">
                        Owner ID: #{data.ownerId}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-[#D9E0E6] space-y-0.5">
                    <span className="text-[11px] uppercase font-semibold text-[#5B6875] block">
                      Property Created
                    </span>
                    <p className="text-sm font-semibold text-[#243447]">
                      {formatDate(data.createdAt)}
                    </p>
                    {data.updatedAt && (
                      <span className="text-[11px] text-[#5B6875]">
                        Last updated: {formatDateTime(data.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#D9E0E6] bg-[#F7F8FA] flex items-center justify-end shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
