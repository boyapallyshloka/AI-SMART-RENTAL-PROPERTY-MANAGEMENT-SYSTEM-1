import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import PropertyFilter from '../../components/properties/PropertyFilter'
import PropertyGrid from '../../components/properties/PropertyGrid'
import PropertyCard from '../../components/properties/PropertyCard'
import PropertyMapLocationPicker from '../../components/properties/PropertyMapLocationPicker'
import { Input, Select, Button } from '../../components/ui'
import {
  getPublicProperties,
  searchPublicProperties,
  resolveImageUrl,
} from '../../api/propertyApi'
import { getPropertyRecommendations } from '../../api/aiApi'
import { getMyTenantProfile } from '../../api/tenantApi'
import {
  getTenantPreferences,
  createTenantPreferences,
  updateTenantPreferences,
} from '../../api/tenantPreferenceApi'
import { getAllAmenities } from '../../api/amenityApi'
import { useAuth } from '../../context/AuthContext'
import { isTenant } from '../../utils/roles'
import {
  Building2,
  IndianRupee,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Bed,
  Sofa,
  Car,
  Compass,
  CheckCircle2,
  X,
  Check,
  Sliders,
} from 'lucide-react'

// Backend PropertyType enum options
const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Select a property type' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'Independent House' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'PG', label: 'Paying Guest (PG)' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'COMMERCIAL', label: 'Commercial Space' },
]

// Backend FurnishingStatus enum options
const FURNISHING_OPTIONS = [
  { value: '', label: 'Select a furnishing preference' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
  { value: 'SEMI_FURNISHED', label: 'Semi-Furnished' },
  { value: 'FULLY_FURNISHED', label: 'Fully Furnished' },
]

// Standard bedroom options
const BEDROOM_OPTIONS = [
  { value: '', label: 'Select minimum bedrooms' },
  { value: 0, label: 'Studio / Any' },
  { value: 1, label: '1 Bedroom (1 BHK)' },
  { value: 2, label: '2 Bedrooms (2 BHK)' },
  { value: 3, label: '3 Bedrooms (3 BHK)' },
  { value: 4, label: '4+ Bedrooms (4+ BHK)' },
]

const INITIAL_PREFERENCE_STATE = {
  preferredCity: '',
  maxBudget: '',
  minBedrooms: '',
  preferredPropertyType: '',
  furnishingPreference: '',
  parkingRequired: false,
  preferredAmenityIds: [],
  maxDistanceKm: '',
  preferredLatitude: '',
  preferredLongitude: '',
}

const INITIAL_FILTERS = {
  searchQuery: '',
  city: 'All Locations',
  propertyType: 'All Types',
  minRent: '',
  maxRent: '',
  bedrooms: 'all',
  furnishing: 'All Furnishing',
  parking: 'All Parking',
  minAiScore: 0,
}

/**
 * Map real Spring Boot M2RecommendationItem to PropertyCard-compatible object.
 */
function mapRecommendationToProperty(item) {
  if (!item) return null

  // M2 now returns a lightweight card nested under propertyCard. Keep the
  // previous propertyDetails shape as a compatibility fallback.
  const card = item.propertyCard || null
  const details = item.propertyDetails || {}
  const prop = card || details.property || (item.propertyDetails ? details : item)
  const addr = details.address || prop.address || {}
  const addressText = typeof addr === 'string'
    ? addr
    : [addr.addressLine1, addr.addressLine2, addr.area, addr.city, addr.state, addr.pincode]
        .filter(Boolean)
        .join(', ')
  const images = Array.isArray(details.images) && details.images.length > 0
    ? details.images
    : (Array.isArray(prop.images) ? prop.images : [])

  let aiScore = undefined
  if (item.recommendationScore != null && !isNaN(Number(item.recommendationScore))) {
    const rawScore = Number(item.recommendationScore)
    aiScore = rawScore <= 1.0 ? Math.round(rawScore * 100) : Math.round(rawScore)
  }

  const md = item.matchDetails || {}
  const matchCriteria = []
  if (item.cityMatch === 1 || md.cityMatch === true || md.cityMatch === 1) matchCriteria.push('City')
  if (item.budgetMatch === 1 || md.budgetMatch === true || md.budgetMatch === 1) matchCriteria.push('Budget')
  if (item.bedroomMatch === 1 || md.bedroomMatch === true || md.bedroomMatch === 1) matchCriteria.push('Bedrooms')
  if (item.propertyTypeMatch === 1 || md.propertyTypeMatch === true || md.propertyTypeMatch === 1) matchCriteria.push('Type')
  if (item.furnishingMatch === 1 || md.furnishingMatch === true || md.furnishingMatch === 1) matchCriteria.push('Furnishing')
  if (item.parkingMatch === 1 || md.parkingMatch === true || md.parkingMatch === 1) matchCriteria.push('Parking')
  if (
    item.amenityMatch === 1 ||
    (md.amenities && (md.amenities.matchPercentage > 0 || (Array.isArray(md.amenities.matched) && md.amenities.matched.length > 0)))
  ) {
    matchCriteria.push('Amenities')
  }

  const propertyId = item.propertyId || card?.id || prop.propertyId || prop.id
  let monthlyRent = item.monthlyRent != null ? item.monthlyRent : prop.monthlyRent
  if (monthlyRent == null && Array.isArray(item.availableUnits) && item.availableUnits.length > 0) {
    const rents = item.availableUnits
      .map((u) => Number(u.monthlyRent))
      .filter((r) => !isNaN(r) && r > 0)
    if (rents.length > 0) {
      monthlyRent = Math.min(...rents)
    }
  }

  let bedrooms = item.propertyBedrooms != null ? item.propertyBedrooms : prop.bedrooms
  if (bedrooms == null && Array.isArray(item.availableUnits) && item.availableUnits.length > 0) {
    const beds = item.availableUnits
      .map((u) => Number(u.bedrooms))
      .filter((b) => !isNaN(b) && b >= 0)
    if (beds.length > 0) {
      bedrooms = Math.min(...beds)
    }
  }

  const city = item.propertyCity || prop.city || (typeof addr === 'object' ? addr.city : '')

  const rawDist = item.approxDistanceKm != null ? item.approxDistanceKm : md.distance?.approxDistanceKm
  const approxDistanceKm =
    rawDist != null && !isNaN(Number(rawDist)) && Number(rawDist) > 0
      ? Number(Number(rawDist).toFixed(1))
      : null

  const availableUnitsCount =
    Array.isArray(item.availableUnits) && item.availableUnits.length > 0
      ? item.availableUnits.length
      : null

  const rawImages = Array.isArray(details.images) && details.images.length > 0
    ? details.images
    : (Array.isArray(prop.images) ? prop.images : [])

  const validImages = rawImages
    .map((img) => {
      if (typeof img === 'string') {
        const trimmed = img.trim()
        return trimmed ? { imageUrl: resolveImageUrl(trimmed), isPrimary: false } : null
      }
      if (img && typeof img === 'object' && img.imageUrl) {
        return {
          ...img,
          imageUrl: resolveImageUrl(img.imageUrl),
          isPrimary: Boolean(img.isPrimary),
        }
      }
      return null
    })
    .filter(Boolean)

  const primaryImageObj = validImages.find((img) => img.isPrimary) || validImages[0] || null
  const resolvedImageUrl = primaryImageObj?.imageUrl || (prop.imageUrl ? resolveImageUrl(prop.imageUrl) : '')

  return {
    ...prop,
    id: propertyId,
    propertyId: propertyId,
    name: prop.propertyName || prop.name || `Property #${propertyId}`,
    propertyName: prop.propertyName || prop.name || `Property #${propertyId}`,
    propertyType: prop.propertyType || prop.type,
    city: city,
    location: addressText || city || prop.location || '',
    address: addressText || '',
    monthlyRent: monthlyRent,
    bedrooms: bedrooms,
    bathrooms: prop.bathrooms,
    area: prop.areaSqft ?? prop.totalArea ?? prop.area,
    totalArea: prop.areaSqft ?? prop.totalArea ?? prop.area,
    yearBuilt: prop.yearBuilt,
    images: validImages,
    imageUrl: resolvedImageUrl,
    status: prop.status,
    isFavorite: prop.isFavorite,
    aiMatchScore: aiScore,
    matchCriteria,
    approxDistanceKm,
    availableUnitsCount,
  }
}

/**
 * Helper to obtain current browser GPS coordinates for live distance context.
 */
function getBrowserLocation() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (
          position?.coords?.latitude != null &&
          position?.coords?.longitude != null
        ) {
          resolve({
            currentLatitude: position.coords.latitude,
            currentLongitude: position.coords.longitude,
            currentAddress: null,
          })
        } else {
          resolve(null)
        }
      },
      (error) => {
        console.warn('Browser geolocation unavailable or denied:', error?.message || error)
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      }
    )
  })
}

function filterProperties(properties = [], filters = {}) {
  return properties.filter((prop) => {
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      const matches =
        (prop.name && prop.name.toLowerCase().includes(q)) ||
        (prop.propertyName && prop.propertyName.toLowerCase().includes(q)) ||
        (prop.description && prop.description.toLowerCase().includes(q)) ||
        (prop.location && prop.location.toLowerCase().includes(q)) ||
        (prop.city && prop.city.toLowerCase().includes(q)) ||
        (prop.address && prop.address.toLowerCase().includes(q)) ||
        (prop.propertyType && prop.propertyType.toLowerCase().includes(q))
      if (!matches) return false
    }

    if (filters.city && filters.city !== 'All Locations') {
      const cityLower = filters.city.toLowerCase()
      const propCity = (prop.city || '').toLowerCase()
      const propLoc = (prop.location || '').toLowerCase()
      if (propCity || propLoc) {
        if (propCity !== cityLower && !propLoc.includes(cityLower)) {
          return false
        }
      }
    }

    if (filters.propertyType && filters.propertyType !== 'All Types') {
      const filterTypeNorm = filters.propertyType.toUpperCase().replace(/\s+/g, '_')
      const propTypeNorm = (prop.propertyType || prop.type || '').toUpperCase().replace(/\s+/g, '_')
      if (filterTypeNorm !== propTypeNorm) {
        return false
      }
    }

    if (prop.monthlyRent != null) {
      if (filters.minRent !== undefined && filters.minRent !== null && filters.minRent !== '') {
        if (Number(prop.monthlyRent) < Number(filters.minRent)) return false
      }
      if (filters.maxRent !== undefined && filters.maxRent !== null && filters.maxRent !== '') {
        if (Number(prop.monthlyRent) > Number(filters.maxRent)) return false
      }
    }

    if (prop.bedrooms != null && filters.bedrooms && filters.bedrooms !== 'all') {
      if (filters.bedrooms === '3+' || filters.bedrooms === '4+') {
        const threshold = parseInt(filters.bedrooms, 10)
        if (Number(prop.bedrooms) < threshold) return false
      } else if (String(prop.bedrooms) !== String(filters.bedrooms)) {
        return false
      }
    }

    if (filters.furnishing && filters.furnishing !== 'All Furnishing') {
      const filterFurnNorm = filters.furnishing.toUpperCase().replace(/[-\s]+/g, '_')
      const propFurnNorm = (prop.furnishingStatus || prop.furnishing || '').toUpperCase().replace(/[-\s]+/g, '_')
      if (filterFurnNorm !== propFurnNorm) {
        if (filterFurnNorm !== 'FURNISHED' || propFurnNorm !== 'FULLY_FURNISHED') {
          return false
        }
      }
    }

    if (filters.parking && filters.parking !== 'All Parking') {
      const hasParking = prop.parkingAvailable != null
        ? prop.parkingAvailable === true || String(prop.parkingAvailable).toLowerCase() === 'true'
        : Boolean(prop.parking && prop.parking !== 'None' && prop.parking !== 'No Parking')
      if (!hasParking) return false
    }

    if (filters.minAiScore && Number(filters.minAiScore) > 0) {
      if (prop.aiMatchScore != null && Number(prop.aiMatchScore) < Number(filters.minAiScore)) {
        return false
      }
    }

    return true
  })
}

function sortProperties(properties = [], sortBy = 'ai_match') {
  const sorted = [...properties]
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => (b.propertyId || b.id || 0) - (a.propertyId || a.id || 0))
    case 'price_asc':
      return sorted.sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0))
    case 'price_desc':
      return sorted.sort((a, b) => (b.monthlyRent || 0) - (a.monthlyRent || 0))
    case 'bedrooms_desc':
      return sorted.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0))
    case 'area_desc':
      return sorted.sort((a, b) => (b.totalArea || b.area || 0) - (a.totalArea || a.area || 0))
    case 'ai_match':
    default:
      return sorted.sort((a, b) => {
        if (b.aiMatchScore != null && a.aiMatchScore != null) {
          return b.aiMatchScore - a.aiMatchScore
        }
        return (b.propertyId || b.id || 0) - (a.propertyId || a.id || 0)
      })
  }
}

export default function PropertySearchPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isUserTenant = Boolean(user && isTenant(user.role))

  // Canonical Tenant ID Ref (tenants.tenant_id, NOT users.id)
  const resolvedTenantIdRef = useRef(
    user?.tenantId != null && !isNaN(Number(user.tenantId)) && Number(user.tenantId) > 0
      ? Number(user.tenantId)
      : null
  )

  // Current Live Geolocation Context Ref
  const currentLocationRef = useRef(null)

  // Request Lifecycle & Deduplication Refs
  const inFlightPromiseRef = useRef(null)
  const lastRequestKeyRef = useRef(null)
  const isMountedRef = useRef(true)
  const initialLoadStartedRef = useRef(false)

  // ==========================================
  // SECTION 1: TENANT PREFERENCES STATE
  // ==========================================
  const [preferenceData, setPreferenceData] = useState(INITIAL_PREFERENCE_STATE)
  const [hasExistingPreferences, setHasExistingPreferences] = useState(false)
  const [isPrefLoading, setIsPrefLoading] = useState(false)
  const [isPrefSaving, setIsPrefSaving] = useState(false)
  const [prefValidationErrors, setPrefValidationErrors] = useState({})
  const [prefSuccessMessage, setPrefSuccessMessage] = useState('')
  const [prefErrorMessage, setPrefErrorMessage] = useState('')
  const [availableAmenities, setAvailableAmenities] = useState([])
  const [isAmenitiesLoading, setIsAmenitiesLoading] = useState(false)
  const [amenityLoadError, setAmenityLoadError] = useState('')
  // Reverse-geocode feedback driven by PropertyMapLocationPicker callbacks
  const [hubGeoLoading, setHubGeoLoading] = useState(false)
  const [hubGeoError, setHubGeoError] = useState(null)
  const [isPreferencesCollapsed, setIsPreferencesCollapsed] = useState(false)

  // ==========================================
  // SECTION 2: AI RECOMMENDATIONS STATE
  // ==========================================
  const [aiRecommendations, setAiRecommendations] = useState([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiModelVersion, setAiModelVersion] = useState(null)
  const [isAiSectionCollapsed, setIsAiSectionCollapsed] = useState(false)
  const [locationStatus, setLocationStatus] = useState('idle')

  // ==========================================
  // SECTION 3: ALL PROPERTIES (MARKETPLACE) STATE
  // ==========================================
  const [rawProperties, setRawProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [sortBy, setSortBy] = useState('ai_match')
  const [favoriteIds, setFavoriteIds] = useState([])
  const isFirstRender = useRef(true)

  // Resolve canonical Tenant ID from authenticated session/profile (GET /api/tenants/me)
  const resolveTenantId = useCallback(async () => {
    if (!isUserTenant) return null

    if (
      resolvedTenantIdRef.current != null &&
      !isNaN(Number(resolvedTenantIdRef.current)) &&
      Number(resolvedTenantIdRef.current) > 0
    ) {
      return Number(resolvedTenantIdRef.current)
    }

    if (user?.tenantId != null && !isNaN(Number(user.tenantId)) && Number(user.tenantId) > 0) {
      const tid = Number(user.tenantId)
      resolvedTenantIdRef.current = tid
      return tid
    }

    try {
      const profile = await getMyTenantProfile()
      const tid = profile?.tenantId != null ? Number(profile.tenantId) : null
      if (tid && !isNaN(tid) && tid > 0) {
        resolvedTenantIdRef.current = tid
        if (user) {
          user.tenantId = tid
          try {
            localStorage.setItem('SmartEstate_user', JSON.stringify(user))
          } catch {
            // Ignore storage errors
          }
        }
        return tid
      }
    } catch (err) {
      console.error('Failed to resolve canonical tenant ID for AI recommendations:', err)
    }

    return null
  }, [isUserTenant, user])

  // 1. Load real amenities from the tenant-accessible backend API.
  const loadAmenities = useCallback(async () => {
    setIsAmenitiesLoading(true)
    setAmenityLoadError('')
    try {
      const res = await getAllAmenities()
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      setAvailableAmenities(list.filter((amenity) => amenity?.amenityId != null || amenity?.id != null))
    } catch (err) {
      setAvailableAmenities([])
      setAmenityLoadError(err?.message || 'Could not load amenities. Please try again.')
    } finally {
      setIsAmenitiesLoading(false)
    }
  }, [])

  // 2. Load existing preferences for the authenticated tenant (GET /api/tenant/preferences)
  const loadPreferences = useCallback(async () => {
    if (!isUserTenant) return false
    setIsPrefLoading(true)
    setPrefErrorMessage('')

    try {
      const data = await getTenantPreferences()
      if (!isMountedRef.current) return false

      if (data && (data.preferenceId || data.preferredCity)) {
        setHasExistingPreferences(true)
        const amenityIds = Array.isArray(data.preferredAmenities)
          ? data.preferredAmenities
              .map((amenity) => Number(typeof amenity === 'object' ? amenity.amenityId : amenity))
              .filter(Number.isFinite)
          : []

        setPreferenceData({
          preferredCity: data.preferredCity || '',
          maxBudget: data.maxBudget != null ? String(data.maxBudget) : '',
          minBedrooms: data.minBedrooms != null ? Number(data.minBedrooms) : '',
          preferredPropertyType: data.preferredPropertyType || '',
          furnishingPreference: data.furnishingPreference || '',
          parkingRequired: Boolean(data.parkingRequired),
          preferredAmenityIds: amenityIds,
          maxDistanceKm: data.maxDistanceKm != null ? String(data.maxDistanceKm) : '',
          preferredLatitude: data.preferredLatitude != null ? String(data.preferredLatitude) : '',
          preferredLongitude: data.preferredLongitude != null ? String(data.preferredLongitude) : '',
        })
        return true
      } else {
        setHasExistingPreferences(false)
        return false
      }
    } catch (err) {
      if (!isMountedRef.current) return false
      const msg = String(err?.message || err?.data?.message || err?.error || '')
      const isNotFound = err?.status === 404 || err?.isNotFound || msg.toLowerCase().includes('not found')

      setHasExistingPreferences(false)
      if (!isNotFound) {
        console.warn('Unable to load saved preferences:', err)
      }
      return false
    } finally {
      if (isMountedRef.current) {
        setIsPrefLoading(false)
      }
    }
  }, [isUserTenant])

  // 3. Fetch AI Recommendations with in-flight deduplication (GET /api/ai/recommendations)
  const fetchRecommendations = useCallback(
    async (tenantId, locationContext = null, force = false) => {
      if (!isUserTenant || !tenantId) {
        setAiRecommendations([])
        setIsAiLoading(false)
        return
      }

      const lat =
        locationContext?.currentLatitude != null && !isNaN(Number(locationContext.currentLatitude))
          ? Number(Number(locationContext.currentLatitude).toFixed(4))
          : null
      const lng =
        locationContext?.currentLongitude != null && !isNaN(Number(locationContext.currentLongitude))
          ? Number(Number(locationContext.currentLongitude).toFixed(4))
          : null
      const requestKey = `${tenantId}:${lat ?? 'none'}:${lng ?? 'none'}`

      // If identical request completed and not forced, return cached state
      if (!force && lastRequestKeyRef.current === requestKey) {
        return
      }

      // If an identical request is already in flight, return the active promise to deduplicate
      if (inFlightPromiseRef.current) {
        if (!force) {
          return inFlightPromiseRef.current
        }
      }

      if (isMountedRef.current) {
        setIsAiLoading(true)
        setAiError(null)
      }

      const promise = (async () => {
        try {
          const response = await getPropertyRecommendations(
            tenantId,
            5,
            locationContext || {}
          )
          if (!isMountedRef.current) return

          const rawItems = Array.isArray(response?.recommendations)
            ? response.recommendations
            : Array.isArray(response)
            ? response
            : []

          const mapped = rawItems
            .map(mapRecommendationToProperty)
            .filter((p) => p && p.id != null)

          // Deduplicate by property ID to ensure no duplicate cards are shown
          const seenIds = new Set()
          const uniqueMapped = mapped.filter((p) => {
            const key = String(p.id)
            if (seenIds.has(key)) return false
            seenIds.add(key)
            return true
          })

          setAiRecommendations(uniqueMapped)
          lastRequestKeyRef.current = requestKey

          if (response?.modelVersion) {
            setAiModelVersion(response.modelVersion)
          }
        } catch (err) {
          if (!isMountedRef.current) return

          const msg = String(err?.message || err?.data?.message || err?.error || '')
          const isPrefNotFound =
            msg.toLowerCase().includes('no tenant preferences found') ||
            msg.toLowerCase().includes('preferences_not_found') ||
            msg.toLowerCase().includes('tenant preference not found') ||
            err?.errorCode === 'PREFERENCES_NOT_FOUND' ||
            err?.data?.errorCode === 'PREFERENCES_NOT_FOUND'

          if (isPrefNotFound) {
            // Handled cleanly in empty state: "Set your preferences above to get personalized property recommendations."
            setHasExistingPreferences(false)
            setAiRecommendations([])
            setAiError(null)
            lastRequestKeyRef.current = requestKey
          } else {
            console.error('Failed to load AI property recommendations:', err)
            const errorMsg =
              err?.status === 401
                ? 'Session expired. Please log in again to view recommendations.'
                : err?.status === 403
                ? 'AI recommendations are exclusively available for verified tenant accounts.'
                : msg || 'Unable to load property recommendations at this time.'
            setAiError(errorMsg)
            setAiRecommendations([])
          }
        } finally {
          if (isMountedRef.current) {
            setIsAiLoading(false)
          }
          inFlightPromiseRef.current = null
        }
      })()

      inFlightPromiseRef.current = promise
      return promise
    },
    [isUserTenant]
  )

  const handleRefreshRecommendations = useCallback(async () => {
    const tid = resolvedTenantIdRef.current || (await resolveTenantId())
    if (!tid) return

    const hasPrefs = await loadPreferences()
    if (!hasPrefs) {
      setHasExistingPreferences(false)
      setAiRecommendations([])
      setAiError(null)
      return
    }

    fetchRecommendations(tid, currentLocationRef.current, true)
  }, [fetchRecommendations, loadPreferences, resolveTenantId])

  // Coordinated Single Mount Sequence:
  // Find Properties loads -> Resolve tenant ID -> Load saved preferences -> Resolve current location -> ONE GET /api/ai/recommendations
  useEffect(() => {
    isMountedRef.current = true

    if (!isUserTenant) return

    // Guard against duplicate initial execution (e.g. StrictMode or concurrent runs)
    if (initialLoadStartedRef.current) return
    initialLoadStartedRef.current = true

    const initializeTenantDiscovery = async () => {
      // Non-blocking load of amenities
      loadAmenities()

      // 1. Resolve canonical tenant ID
      const activeTenantId = await resolveTenantId()
      if (!isMountedRef.current || !activeTenantId) {
        if (isMountedRef.current) setIsAiLoading(false)
        return
      }

      // 2. Load saved preferences
      const hasPrefs = await loadPreferences()
      if (!isMountedRef.current) return

      // If tenant does not have preferences configured, do NOT call AI recommendation API!
      if (!hasPrefs) {
        if (isMountedRef.current) {
          setIsAiLoading(false)
          setAiRecommendations([])
          setAiError(null)
        }
        return
      }

      // 3. Resolve current browser location if available
      const location = await getBrowserLocation()
      if (!isMountedRef.current) return

      currentLocationRef.current = location
      if (location?.currentLatitude != null && location?.currentLongitude != null) {
        setLocationStatus('available')
      } else {
        setLocationStatus('unavailable')
      }

      // 4. Once required inputs are ready -> exactly ONE GET /api/ai/recommendations
      await fetchRecommendations(activeTenantId, location, false)
    }

    initializeTenantDiscovery()

    return () => {
      isMountedRef.current = false
    }
  }, [isUserTenant, loadAmenities, loadPreferences, resolveTenantId, fetchRecommendations])

  // 4. Save Tenant Preferences (POST for new, PUT for existing)
  const validatePreferences = () => {
    const errs = {}
    if (!preferenceData.preferredCity || !preferenceData.preferredCity.trim()) {
      errs.preferredCity = 'Preferred city is required.'
    }

    const budgetNum = Number(preferenceData.maxBudget)
    if (!preferenceData.maxBudget || isNaN(budgetNum) || budgetNum <= 0) {
      errs.maxBudget = 'Please enter a valid positive monthly budget.'
    }

    if (
      preferenceData.minBedrooms === '' ||
      isNaN(Number(preferenceData.minBedrooms)) ||
      Number(preferenceData.minBedrooms) < 0
    ) {
      errs.minBedrooms = 'Minimum bedrooms must be 0 or greater.'
    }

    if (!preferenceData.preferredPropertyType) {
      errs.preferredPropertyType = 'Please select a property type.'
    }

    if (!preferenceData.furnishingPreference) {
      errs.furnishingPreference = 'Please select a furnishing preference.'
    }

    if (
      preferenceData.maxDistanceKm !== '' &&
      (isNaN(Number(preferenceData.maxDistanceKm)) || Number(preferenceData.maxDistanceKm) <= 0)
    ) {
      errs.maxDistanceKm = 'Maximum distance must be a positive number.'
    }

    setPrefValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSavePreferences = async (e) => {
    if (e) e.preventDefault()
    if (!validatePreferences()) {
      return
    }

    setIsPrefSaving(true)
    setPrefErrorMessage('')
    setPrefSuccessMessage('')

    const payload = {
      preferredCity: preferenceData.preferredCity.trim(),
      maxBudget: Math.round(Number(preferenceData.maxBudget)),
      minBedrooms: Number(preferenceData.minBedrooms),
      preferredPropertyType: preferenceData.preferredPropertyType,
      furnishingPreference: preferenceData.furnishingPreference,
      parkingRequired: Boolean(preferenceData.parkingRequired),
      preferredAmenityIds: (preferenceData.preferredAmenityIds || []).map(Number).filter(Number.isFinite),
    }

    if (
      preferenceData.maxDistanceKm !== '' &&
      !isNaN(Number(preferenceData.maxDistanceKm)) &&
      Number(preferenceData.maxDistanceKm) > 0
    ) {
      payload.maxDistanceKm = Number(preferenceData.maxDistanceKm)
    }

    if (
      preferenceData.preferredLatitude !== '' &&
      !isNaN(Number(preferenceData.preferredLatitude))
    ) {
      payload.preferredLatitude = Number(preferenceData.preferredLatitude)
    }

    if (
      preferenceData.preferredLongitude !== '' &&
      !isNaN(Number(preferenceData.preferredLongitude))
    ) {
      payload.preferredLongitude = Number(preferenceData.preferredLongitude)
    }

    try {
      if (hasExistingPreferences) {
        try {
          await updateTenantPreferences(payload)
        } catch (updateErr) {
          if (updateErr?.status === 404 || updateErr?.message?.includes('not found')) {
            await createTenantPreferences(payload)
          } else {
            throw updateErr
          }
        }
      } else {
        try {
          await createTenantPreferences(payload)
        } catch (createErr) {
          if (createErr?.status === 409 || createErr?.message?.includes('already exists')) {
            await updateTenantPreferences(payload)
          } else {
            throw createErr
          }
        }
      }

      setHasExistingPreferences(true)
      setPrefSuccessMessage('Preferences saved successfully! Updating recommendations...')

      // Auto-clear success banner after 5 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setPrefSuccessMessage('')
        }
      }, 5000)

      // Explicitly refresh recommendations once with force = true
      const activeTenantId = resolvedTenantIdRef.current || (await resolveTenantId())
      if (activeTenantId) {
        await fetchRecommendations(activeTenantId, currentLocationRef.current, true)
      }
    } catch (err) {
      console.error('Failed to save tenant preferences:', err)
      setPrefErrorMessage(
        err?.message || 'Failed to save preferences. Please check your inputs and try again.'
      )
    } finally {
      if (isMountedRef.current) {
        setIsPrefSaving(false)
      }
    }
  }

  const handleToggleAmenity = (amenityId) => {
    const selectedId = Number(amenityId)
    if (!Number.isFinite(selectedId)) return
    setPreferenceData((prev) => {
      const current = (prev.preferredAmenityIds || []).map(Number).filter(Number.isFinite)
      const next = current.includes(selectedId)
        ? current.filter((id) => id !== selectedId)
        : [...current, selectedId]
      return { ...prev, preferredAmenityIds: next }
    })
  }

  /**
   * Called by PropertyMapLocationPicker on map click, marker drag, or "Use My Location".
   * Updates preferredLatitude and preferredLongitude in preferenceData.
   * Does NOT save default map-center coordinates — the picker only fires this after a real user interaction.
   */
  const handleHubLocationChange = useCallback(({ latitude, longitude }) => {
    setPreferenceData((prev) => ({
      ...prev,
      preferredLatitude: String(latitude),
      preferredLongitude: String(longitude),
    }))
    setHubGeoLoading(true)
    setHubGeoError(null)
  }, [])

  /**
   * Called by PropertyMapLocationPicker after a successful reverse-geocode.
   * Only populates preferredCity when the response includes a city value.
   * The field remains editable; this is a convenience fill, not a lock.
   */
  const handleHubAddressResolved = useCallback((result) => {
    setHubGeoLoading(false)
    setHubGeoError(null)
    if (result?.city) {
      setPreferenceData((prev) => ({ ...prev, preferredCity: result.city }))
    }
  }, [])

  /**
   * Called by PropertyMapLocationPicker when reverse-geocode fails or returns 404.
   * Coordinates in preferenceData are preserved; tenant can type city manually.
   */
  const handleHubLookupError = useCallback((_err, { message }) => {
    setHubGeoLoading(false)
    setHubGeoError(message || 'Address lookup unavailable. You can enter the city manually.')
  }, [])

  const handleResetPreferences = () => {
    setPrefValidationErrors({})
    setPrefErrorMessage('')
    loadPreferences()
  }

  // 5. Load Public / All Properties
  const hasActiveBackendFilters = (f) => {
    return Boolean(
      (f.searchQuery && f.searchQuery.trim()) ||
      (f.city && f.city !== 'All Locations') ||
      (f.propertyType && f.propertyType !== 'All Types') ||
      (f.furnishing && f.furnishing !== 'All Furnishing') ||
      (f.parking && f.parking !== 'All Parking') ||
      (f.minRent !== undefined && f.minRent !== null && f.minRent !== '') ||
      (f.maxRent !== undefined && f.maxRent !== null && f.maxRent !== '') ||
      (f.bedrooms && f.bedrooms !== 'all')
    )
  }

  const loadProperties = useCallback(async (currentFilters = filters) => {
    setIsLoading(true)
    setError(null)
    try {
      let list = []
      if (hasActiveBackendFilters(currentFilters)) {
        list = await searchPublicProperties(currentFilters)
      } else {
        list = await getPublicProperties()
      }
      const properties = Array.isArray(list) ? list : []
      setRawProperties(properties)
      setFavoriteIds(
        properties
          .filter((property) => property.isFavorite)
          .map((property) => property.propertyId ?? property.id)
      )
    } catch (err) {
      console.error('Failed to load available properties from backend:', err)
      const errorMsg =
        err?.isAuthError || err?.status === 401
          ? 'Authentication required or session expired. Please sign in to view properties.'
          : err?.isForbidden || err?.status === 403
          ? 'Access restricted: Please log in with a tenant account to browse available properties.'
          : err?.message || 'Unable to load rental properties. Please try again.'
      setError(errorMsg)
      setRawProperties([])
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (isFirstRender.current) {
      const timer = setTimeout(() => loadProperties(INITIAL_FILTERS), 0)
      isFirstRender.current = false
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      loadProperties(filters)
    }, 350)
    return () => clearTimeout(timer)
  }, [filters, loadProperties])

  const filteredProperties = useMemo(() => {
    const filtered = filterProperties(rawProperties, filters)
    return sortProperties(filtered, sortBy)
  }, [rawProperties, filters, sortBy])

  const availableCities = useMemo(() => {
    const cities = rawProperties
      .map((property) => property.city || property.address?.city || property.propertyAddress?.city)
      .map((city) => String(city || '').trim())
      .filter(Boolean)
    return [...new Set(cities)].sort((a, b) => a.localeCompare(b))
  }, [rawProperties])

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS)
  }

  const handleToggleFavorite = (propertyId) => {
    setFavoriteIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    )
  }

  const handleSelectProperty = (property) => {
    const propertyId = property.propertyId ?? property.id
    navigate(`/tenant/properties/${propertyId}`)
  }

  const stats = useMemo(() => {
    const total = rawProperties.length
    const propsWithRent = rawProperties.filter(
      (p) => p.monthlyRent != null && Number(p.monthlyRent) > 0
    )
    const avgRent =
      propsWithRent.length > 0
        ? Math.round(
            propsWithRent.reduce((acc, p) => acc + Number(p.monthlyRent), 0) /
              propsWithRent.length
          )
        : null
    const allScored = [
      ...rawProperties.filter((p) => p.aiMatchScore != null).map((p) => p.aiMatchScore),
      ...aiRecommendations.filter((p) => p.aiMatchScore != null).map((p) => p.aiMatchScore),
    ]
    const topMatch = allScored.length > 0 ? Math.max(...allScored) : null
    return { total, avgRent, topMatch }
  }, [rawProperties, aiRecommendations])

  const pageContent = (
      <div className="space-y-7 pb-12">
        {/* ========================================================= */}
        {/* SECTION 1 — YOUR PREFERENCES ("Find Your Next Home")      */}
        {/* ========================================================= */}
        {isUserTenant && (
          <div className="rounded-lg bg-white border border-[#D9E0E6] shadow-2xs overflow-hidden">
            {/* Preference Section Header */}
            <div className="p-5 sm:p-6 border-b border-[#D9E0E6] bg-[#F7F8FA]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20">
                    <Sliders className="w-3 h-3 text-[#315A7D]" />
                    Your Rental Preferences
                  </span>
                  {hasExistingPreferences ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EDF7ED] text-[#1E4620] border border-[#C8E6C9]">
                      <Check className="w-3 h-3 text-[#2E7D32]" />
                      Preferences Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF3E2] text-[#8A5B16] border border-[#F6D8A8]">
                      Not Configured Yet
                    </span>
                  )}
                </div>

                <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#243447]">
                  Find Your Next Home
                </h1>

                <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
                  Tell us what you're looking for and we'll personalize your recommendations.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsPreferencesCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#D9E0E6] text-xs font-medium text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                  title={isPreferencesCollapsed ? 'Expand Preferences Form' : 'Collapse Preferences Form'}
                >
                  <span>{isPreferencesCollapsed ? 'Edit Preferences' : 'Hide Controls'}</span>
                  {isPreferencesCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Notification Banners */}
            {prefSuccessMessage && (
              <div className="mx-5 sm:mx-6 mt-4 rounded-md bg-[#EDF7ED] border border-[#C8E6C9] p-3 text-xs text-[#1E4620] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0" />
                  <span className="font-medium">{prefSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefSuccessMessage('')}
                  className="text-[#2E7D32] hover:text-[#1E4620] p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {prefErrorMessage && (
              <div className="mx-5 sm:mx-6 mt-4 rounded-md bg-[#FDF2F2] border border-[#F8B4B4] p-3 text-xs text-[#9B1C1C] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#E02424] shrink-0" />
                  <span className="font-medium">{prefErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefErrorMessage('')}
                  className="text-[#E02424] hover:text-[#9B1C1C] p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Preference Form Controls */}
            {!isPreferencesCollapsed && (
              <form onSubmit={handleSavePreferences} className="p-5 sm:p-6 space-y-5">
                {isPrefLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-5 h-5 text-[#315A7D] animate-spin" />
                    <span className="text-xs text-[#5B6875]">Loading your saved preferences...</span>
                  </div>
                ) : (
                  <>
                    {/* Row 1: City, Budget, Bedrooms */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Input
                          label="Preferred City"
                          required
                          placeholder="e.g. Hyderabad, Mumbai, Bengaluru"
                          value={preferenceData.preferredCity}
                          onChange={(e) => {
                            setPreferenceData((prev) => ({ ...prev, preferredCity: e.target.value }))
                            if (prefValidationErrors.preferredCity) {
                              setPrefValidationErrors((prev) => ({ ...prev, preferredCity: null }))
                            }
                          }}
                          error={prefValidationErrors.preferredCity}
                          leftIcon={<MapPin className="w-4 h-4" />}
                          disabled={isPrefSaving}
                        />
                      </div>

                      <div>
                        <Input
                          label="Maximum Monthly Budget (₹)"
                          required
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 25000"
                          value={preferenceData.maxBudget}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^\d+$/.test(val)) {
                              setPreferenceData((prev) => ({ ...prev, maxBudget: val }))
                              if (prefValidationErrors.maxBudget) {
                                setPrefValidationErrors((prev) => ({ ...prev, maxBudget: null }))
                              }
                            }
                          }}
                          error={prefValidationErrors.maxBudget}
                          leftIcon={<IndianRupee className="w-4 h-4" />}
                          disabled={isPrefSaving}
                        />
                      </div>

                      <div>
                        <Select
                          label="Minimum Bedrooms"
                          required
                          options={BEDROOM_OPTIONS}
                          value={preferenceData.minBedrooms}
                          onChange={(e) => {
                            setPreferenceData((prev) => ({
                              ...prev,
                              minBedrooms: e.target.value === '' ? '' : Number(e.target.value),
                            }))
                            if (prefValidationErrors.minBedrooms) {
                              setPrefValidationErrors((prev) => ({ ...prev, minBedrooms: null }))
                            }
                          }}
                          error={prefValidationErrors.minBedrooms}
                          disabled={isPrefSaving}
                        />
                      </div>
                    </div>

                    {/* Row 2: Property Type, Furnishing, Parking */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Select
                          label="Property Type"
                          required
                          options={PROPERTY_TYPE_OPTIONS}
                          value={preferenceData.preferredPropertyType}
                          onChange={(e) =>
                            setPreferenceData((prev) => ({ ...prev, preferredPropertyType: e.target.value }))
                          }
                          error={prefValidationErrors.preferredPropertyType}
                          disabled={isPrefSaving}
                        />
                      </div>

                      <div>
                        <Select
                          label="Furnishing Preference"
                          required
                          options={FURNISHING_OPTIONS}
                          value={preferenceData.furnishingPreference}
                          onChange={(e) =>
                            setPreferenceData((prev) => ({ ...prev, furnishingPreference: e.target.value }))
                          }
                          error={prefValidationErrors.furnishingPreference}
                          disabled={isPrefSaving}
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                          Parking Requirement
                        </label>
                        <label className="flex items-center gap-2.5 h-[42px] px-3.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] hover:bg-[#EAF2F7]/50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={preferenceData.parkingRequired}
                            onChange={(e) =>
                              setPreferenceData((prev) => ({ ...prev, parkingRequired: e.target.checked }))
                            }
                            disabled={isPrefSaving}
                            className="w-4 h-4 rounded text-[#315A7D] focus:ring-[#315A7D] border-[#D9E0E6]"
                          />
                          <span className="text-xs font-medium text-[#243447] flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-[#5B6875]" />
                            Dedicated Parking Required
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Row 3: Optional Distance & Location Hub */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div>
                        <Input
                          label="Maximum Distance (km, optional)"
                          type="number"
                          min="1"
                          placeholder="e.g. 15"
                          value={preferenceData.maxDistanceKm}
                          onChange={(e) =>
                            setPreferenceData((prev) => ({ ...prev, maxDistanceKm: e.target.value }))
                          }
                          error={prefValidationErrors.maxDistanceKm}
                          leftIcon={<Compass className="w-4 h-4" />}
                          disabled={isPrefSaving}
                          helperText="Maximum distance from your preferred hub"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                          Preferred Location Hub
                          <span className="normal-case font-normal text-[#5B6875] ml-1">(optional — click map or drag pin)</span>
                        </label>

                        {/* Interactive map picker — initializes from saved coords when valid */}
                        <PropertyMapLocationPicker
                          latitude={
                            preferenceData.preferredLatitude !== '' &&
                            !isNaN(Number(preferenceData.preferredLatitude))
                              ? Number(preferenceData.preferredLatitude)
                              : undefined
                          }
                          longitude={
                            preferenceData.preferredLongitude !== '' &&
                            !isNaN(Number(preferenceData.preferredLongitude))
                              ? Number(preferenceData.preferredLongitude)
                              : undefined
                          }
                          onLocationChange={handleHubLocationChange}
                          onAddressResolved={handleHubAddressResolved}
                          onLookupError={handleHubLookupError}
                          autoReverseGeocode={true}
                        />

                        {/* Inline reverse-geocode feedback (loading / error) */}
                        {hubGeoLoading && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#315A7D] px-1">
                            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                            <span>Looking up address from coordinates…</span>
                          </div>
                        )}
                        {!hubGeoLoading && hubGeoError && (
                          <div className="flex items-start gap-1.5 text-[11px] text-amber-700 px-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{hubGeoError}</span>
                          </div>
                        )}

                        {/* Read-only coordinate display */}
                        {preferenceData.preferredLatitude !== '' && preferenceData.preferredLongitude !== '' && (
                          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] text-[11px] text-[#5B6875]">
                            <MapPin className="w-3 h-3 text-[#315A7D] shrink-0" />
                            <span>
                              Lat:{' '}
                              <strong className="font-mono text-[#243447]">{preferenceData.preferredLatitude}</strong>
                            </span>
                            <span>
                              Lng:{' '}
                              <strong className="font-mono text-[#243447]">{preferenceData.preferredLongitude}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preferred amenities are loaded from GET /api/amenities and saved as IDs. */}
                    <div className="space-y-2 pt-1 border-t border-[#D9E0E6]">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                        Preferred Amenities
                      </label>
                      {availableAmenities.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availableAmenities.map((amenity) => {
                            const id = Number(amenity.amenityId ?? amenity.id)
                            const isSelected = preferenceData.preferredAmenityIds.some(
                              (selectedId) => Number(selectedId) === id
                            )
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => handleToggleAmenity(id)}
                                disabled={isPrefSaving}
                                aria-pressed={isSelected}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                                  isSelected
                                    ? 'bg-[#EAF2F7] text-[#315A7D] border-[#315A7D]/40 font-semibold'
                                    : 'bg-white text-[#5B6875] border-[#D9E0E6] hover:bg-[#F7F8FA] hover:text-[#243447]'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#315A7D]" />}
                                <span>{amenity.amenityName || amenity.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : isAmenitiesLoading ? (
                        <p className="text-xs text-[#5B6875]">Loading amenities…</p>
                      ) : amenityLoadError ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#9B1C1C]">
                          <span>{amenityLoadError}</span>
                          <button
                            type="button"
                            onClick={loadAmenities}
                            className="font-semibold underline underline-offset-2"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[#5B6875]">No amenities are currently available.</p>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D9E0E6]">
                      <button
                        type="button"
                        onClick={handleResetPreferences}
                        disabled={isPrefSaving}
                        className="px-3.5 py-2 rounded-md border border-[#D9E0E6] text-xs font-medium text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        Reset Form
                      </button>

                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isPrefSaving}
                        className="px-5 py-2 text-xs font-semibold cursor-pointer"
                      >
                        {isPrefSaving ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Saving Preferences...
                          </span>
                        ) : hasExistingPreferences ? (
                          'Update Preferences'
                        ) : (
                          'Save Preferences'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 2 — RECOMMENDED FOR YOU (AI Recommendations)      */}
        {/* ========================================================= */}
        {isUserTenant && (
          <div className="rounded-lg bg-white border border-[#D9E0E6] p-5 sm:p-6 shadow-2xs space-y-4">
            {/* Recommendation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E6] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 border border-[#D9E0E6]">
                  <Sparkles className="w-4 h-4 text-[#315A7D]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg sm:text-xl font-semibold text-[#243447]">
                      Recommended For You
                    </h2>
                    {aiModelVersion && (
                      <span className="text-[10px] font-mono text-[#5B6875] bg-[#F7F8FA] px-1.5 py-0.5 rounded border border-[#D9E0E6]">
                        {aiModelVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5B6875] mt-0.5">
                    Based on your saved preferences
                  </p>
                  {locationStatus === 'unavailable' && aiRecommendations.length > 0 && !isAiLoading && (
                    <p className="text-[11px] text-[#8A5B16] mt-0.5">
                      Live location unavailable. Matching without real-time GPS distance.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {aiRecommendations.length > 0 && !isAiLoading && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20">
                    {aiRecommendations.length} {aiRecommendations.length === 1 ? 'Match' : 'Matches'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRefreshRecommendations}
                  disabled={isAiLoading || !isUserTenant}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#D9E0E6] text-xs font-medium text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] disabled:opacity-50 transition-colors cursor-pointer"
                  title="Refresh AI Recommendations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin text-[#315A7D]' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiSectionCollapsed((prev) => !prev)}
                  className="p-1.5 rounded-md border border-[#D9E0E6] text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                  title={isAiSectionCollapsed ? 'Expand Recommendations' : 'Collapse Recommendations'}
                >
                  {isAiSectionCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Recommendation Body */}
            {!isAiSectionCollapsed && (
              <>
                {isAiLoading ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center space-y-2.5 bg-[#F7F8FA] rounded-lg border border-[#D9E0E6]">
                    <RefreshCw className="w-6 h-6 text-[#315A7D] animate-spin" />
                    <p className="text-sm font-medium text-[#243447]">Calculating personalized property matches...</p>
                  </div>
                ) : aiError ? (
                  <div className="rounded-lg bg-[#FDF2F2] border border-[#F8B4B4] p-4 text-[#9B1C1C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-[#E02424] shrink-0" />
                      <span>{aiError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshRecommendations}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#E02424] text-white text-xs font-semibold hover:bg-[#C81E1E] transition-colors shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Try Again</span>
                    </button>
                  </div>
                ) : aiRecommendations.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center space-y-2.5 bg-[#F7F8FA] rounded-lg border border-[#D9E0E6]">
                    <div className="w-10 h-10 rounded-full bg-[#EAF2F7] flex items-center justify-center text-[#315A7D]">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-[#243447]">
                      {hasExistingPreferences
                        ? 'No property recommendations found matching your saved preferences.'
                        : 'Set your preferences above to get personalized property recommendations.'}
                    </p>
                    <p className="text-xs text-[#5B6875] max-w-md">
                      {hasExistingPreferences
                        ? 'Try adjusting your budget, distance, or property type in the preferences section above and click "Update Preferences".'
                        : 'Once you save your preferred city, budget, and property specifications, our AI engine will rank the best matching homes for you.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {aiRecommendations.map((prop) => (
                      <PropertyCard
                        key={`ai-${prop.propertyId ?? prop.id}`}
                        property={prop}
                        onSelect={handleSelectProperty}
                        isFavorite={favoriteIds.includes(prop.propertyId ?? prop.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Global Error Alert Box for Regular Search */}
        {error && (
          <div className="rounded-lg bg-[#FDF2F2] border border-[#F8B4B4] p-4 text-[#9B1C1C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#E02424] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadProperties(filters)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#E02424] text-white text-xs font-semibold hover:bg-[#C81E1E] transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 3 — ALL PROPERTIES (Browse & Marketplace)         */}
        {/* ========================================================= */}
        <div className="space-y-4 pt-1">
          {/* Section 3 Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9E0E6] pb-3">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#243447]">
                All Properties
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                Browse and filter all available rental listings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#5B6875] bg-[#F7F8FA] px-2.5 py-1 rounded-md border border-[#D9E0E6]">
                {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
              </span>
              {stats.avgRent != null && (
                <span className="hidden md:inline-flex text-xs font-medium text-[#5B6875] bg-[#F7F8FA] px-2.5 py-1 rounded-md border border-[#D9E0E6]">
                  Avg ₹{stats.avgRent}/mo
                </span>
              )}
            </div>
          </div>

          {/* Filter Controls */}
          <PropertyFilter
            filters={filters}
            onFilterChange={setFilters}
            onResetFilters={handleResetFilters}
            totalResults={filteredProperties.length}
            availableCities={availableCities}
          />

          {/* Property Grid Results */}
          <PropertyGrid
            properties={filteredProperties}
            onSelectProperty={handleSelectProperty}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onResetFilters={handleResetFilters}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            isLoading={isLoading}
          />
        </div>
      </div>
  )

  return (
    <DashboardLayout defaultRole="tenant" activeItem="find-properties" pageTitle="Find Properties">
      {pageContent}
    </DashboardLayout>
  )
}
