import axiosClient from './axiosClient.js'

/**
 * Property Enums matching Spring Boot backend exactly
 */
export const PROPERTY_TYPES = {
  APARTMENT: 'APARTMENT',
  HOUSE: 'HOUSE',
  VILLA: 'VILLA',
  PG: 'PG',
  HOSTEL: 'HOSTEL',
  COMMERCIAL: 'COMMERCIAL',
}

export const FURNISHING_STATUSES = {
  UNFURNISHED: 'UNFURNISHED',
  SEMI_FURNISHED: 'SEMI_FURNISHED',
  FULLY_FURNISHED: 'FULLY_FURNISHED',
}

export const PROPERTY_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  AVAILABLE: 'AVAILABLE',
  PUBLISHED: 'PUBLISHED',
  OCCUPIED: 'OCCUPIED',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  INACTIVE: 'INACTIVE',
}

/**
 * Helper to map property types to canonical backend enums
 */
export const mapPropertyTypeToBackend = (type) => {
  if (!type) return undefined
  const upper = String(type).trim().toUpperCase().replace(/\s+/g, '_')
  return Object.values(PROPERTY_TYPES).includes(upper) ? upper : undefined
}

/**
 * Helper to map furnishing status to canonical backend enums
 */
export const mapFurnishingStatusToBackend = (furnishing) => {
  if (!furnishing) return undefined
  const upper = String(furnishing).trim().toUpperCase().replace(/[-\s]+/g, '_')
  if (upper === 'FURNISHED' || upper === 'FULLY_FURNISHED') return 'FULLY_FURNISHED'
  if (upper === 'SEMI_FURNISHED') return 'SEMI_FURNISHED'
  if (upper === 'UNFURNISHED') return 'UNFURNISHED'
  return undefined
}

/**
 * Helper to map parking options to canonical boolean
 */
export const mapParkingAvailableToBackend = (parking) => {
  if (typeof parking === 'boolean') return parking
  if (typeof parking === 'string') {
    const s = parking.trim().toLowerCase()
    if (['false', 'no', 'none', '0', '', 'no parking', 'not available', 'unavailable'].includes(s)) {
      return false
    }
    if (['true', 'yes', '1', 'available', 'parking available', 'covered parking', 'covered garage', 'dedicated spot', 'street parking'].includes(s)) {
      return true
    }
  }
  return null
}

/**
 * Build clean PropertyRequest payload from UI form data.
 * Strictly converts form field names to backend names:
 *   name -> propertyName
 *   type -> propertyType (canonical enums)
 *   description -> description
 *   area -> totalArea
 *   furnishing -> furnishingStatus (canonical enums)
 *   parking -> parkingAvailable (boolean)
 *   year / yearBuilt -> yearBuilt (integer)
 *
 * Current backend-supported PropertyRequest fields:
 *   - propertyName
 *   - propertyType
 *   - description
 *   - totalArea
 *   - furnishingStatus
 *   - parkingAvailable
 *   - yearBuilt
 *
 * Strictly EXCLUDES response/status/legacy/UI-only fields:
 *   ownerId, ownerName, propertyId, id, status, createdAt, updatedAt,
 *   bedrooms, bathrooms, monthlyRent, securityDeposit,
 *   address, city, state, zipCode, amenities, buildings, units, images, etc.
 */
export const buildPropertyRequestPayload = (data = {}) => {
  const propertyName = (data.propertyName || data.name || '').trim()

  const propertyType = data.propertyType
    ? mapPropertyTypeToBackend(data.propertyType)
    : (data.type ? mapPropertyTypeToBackend(data.type) : undefined)

  const description =
    data.description != null && String(data.description).trim() !== ''
      ? String(data.description).trim()
      : undefined

  const rawArea = data.totalArea != null ? data.totalArea : data.area
  const totalArea =
    rawArea != null && rawArea !== '' && !isNaN(Number(rawArea))
      ? Number(rawArea)
      : undefined

  const rawFurnishing = data.furnishingStatus || data.furnishing
  const furnishingStatus = rawFurnishing
    ? mapFurnishingStatusToBackend(rawFurnishing)
    : undefined

  const rawParking =
    data.parkingAvailable != null ? data.parkingAvailable : data.parking
  const parkingAvailable =
    rawParking != null ? mapParkingAvailableToBackend(rawParking) : undefined

  const rawYear = data.yearBuilt != null ? data.yearBuilt : data.year
  const yearBuilt =
    rawYear != null && rawYear !== '' && !isNaN(Number(rawYear))
      ? Math.round(Number(rawYear))
      : undefined

  const payload = {
    propertyName: propertyName || undefined,
    propertyType,
    description,
    totalArea,
    furnishingStatus,
    parkingAvailable,
    yearBuilt,
  }

  // Ensure ownerId, status, id, and all legacy/UI fields are NEVER included in request payload
  delete payload.ownerId
  delete payload.ownerName
  delete payload.propertyId
  delete payload.id
  delete payload.status
  delete payload.createdAt
  delete payload.updatedAt
  delete payload.bedrooms
  delete payload.bathrooms
  delete payload.monthlyRent
  delete payload.securityDeposit
  delete payload.deposit
  delete payload.rent
  delete payload.address
  delete payload.city
  delete payload.state
  delete payload.zipCode
  delete payload.amenities
  delete payload.buildings
  delete payload.units
  delete payload.images
  delete payload.imageUrl
  delete payload.totalUnits
  delete payload.occupiedUnits
  delete payload.propertyManagerId
  delete payload.managerName
  delete payload.managerEmail
  delete payload.managerPhone

  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  )
}

/**
 * Format PropertyRequest payload matching Spring Boot DTO constraints
 * Note: ownerId is explicitly omitted (backend derives it from authenticated JWT)
 */
export const formatPropertyRequest = (data = {}) => {
  return buildPropertyRequestPayload(data)
}

/**
 * GET /api/owner/properties
 * Retrieve all properties belonging to the authenticated Property Owner
 */
export const getMyProperties = async () => {
  return axiosClient.get('/owner/properties')
}

/**
 * GET /api/owner/properties/{id}
 * Retrieve single property details by ID for authenticated Property Owner
 */
export const getPropertyById = async (id) => {
  return axiosClient.get(`/owner/properties/${id}`)
}

/**
 * GET /api/owner/properties/{id}/details
 * Retrieve complete property details (property, address, buildings, amenities, images)
 */
export const getPropertyDetails = async (id) => {
  return axiosClient.get(`/owner/properties/${id}/details`)
}

/**
 * POST /api/owner/properties
 * Create a new property for authenticated Property Owner
 * Payload: PropertyRequest (ownerId omitted)
 */
export const createProperty = async (propertyData) => {
  const payload = formatPropertyRequest(propertyData)
  return axiosClient.post('/owner/properties', payload)
}

/**
 * Submit a draft property and its uploaded documents for administrator review.
 */
export const submitPropertyForApproval = async (id) => {
  return axiosClient.post(`/owner/properties/${id}/submit-for-approval`)
}

/**
 * Administrator property review endpoints.
 */
export const getPendingPropertyApprovals = async () => {
  return axiosClient.get('/admin/properties/pending-approval')
}

export const getPropertyForAdminReview = async (id) => {
  return axiosClient.get(`/admin/properties/${id}`)
}

export const approveProperty = async (id) => {
  return axiosClient.patch(`/admin/properties/${id}/approve`)
}

/**
 * PUT /api/owner/properties/{id}
 * Update an existing property
 * Payload: PropertyRequest (ownerId omitted)
 */
export const updateProperty = async (id, propertyData) => {
  const payload = formatPropertyRequest(propertyData)
  return axiosClient.put(`/owner/properties/${id}`, payload)
}

/**
 * DELETE /api/owner/properties/{id}
 * Delete a property by ID
 */
export const deleteProperty = async (id) => {
  return axiosClient.delete(`/owner/properties/${id}`)
}

export const CANONICAL_PROPERTY_STATUSES = [
  'DRAFT',
  'AVAILABLE',
  'PUBLISHED',
  'OCCUPIED',
  'UNDER_MAINTENANCE',
  'INACTIVE',
]

/**
 * PUT /api/owner/properties/{id}/status?status={status}
 * Update property lifecycle status using canonical PropertyStatus values
 */
export const updatePropertyStatus = async (id, status) => {
  const normalizedStatus = String(status || '').trim().toUpperCase()
  if (!CANONICAL_PROPERTY_STATUSES.includes(normalizedStatus)) {
    throw new Error(
      `Invalid property status: "${status}". Canonical values are: ${CANONICAL_PROPERTY_STATUSES.join(', ')}`
    )
  }
  return axiosClient.put(`/owner/properties/${id}/status`, null, {
    params: { status: normalizedStatus },
  })
}

/**
 * Resolves property image URLs:
 * - Returns presigned HTTPS URLs (e.g. AWS S3 private bucket objects) directly as-is
 * - Resolves legacy relative image URLs (e.g. /uploads/property-images/...) to full backend URLs
 * - Never constructs public S3 URLs or exposes AWS credentials on frontend
 */
export const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  const backendBase = import.meta?.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:8080'
  return `${backendBase}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}

/**
 * Maps Spring Boot PropertyResponse to the shape expected by UI components
 * Backend fields:
 * - propertyId -> id, propertyId
 * - propertyName -> name, propertyName
 * - propertyType -> type, propertyType
 * - description -> description
 * - totalArea -> area, totalArea
 * - furnishingStatus -> furnishing, furnishingStatus
 * - parkingAvailable -> parking, parkingAvailable
 * - yearBuilt -> yearBuilt
 * - status -> status
 * - ownerId, ownerName, createdAt, updatedAt
 */
export const mapBackendPropertyToUi = (prop) => {
  if (!prop) return null

  const id =
    prop.propertyId != null
      ? String(prop.propertyId)
      : prop.id != null
      ? String(prop.id)
      : ''
  const name = prop.propertyName || prop.name || 'Unnamed Property'
  const type = prop.propertyType || prop.type || null
  const rawArea = prop.totalArea ?? prop.area ?? prop.areaSqft
  const area = rawArea != null && rawArea !== '' && Number.isFinite(Number(rawArea))
    ? Number(rawArea)
    : null
  const parkingAvailable = prop.parkingAvailable != null
    ? Boolean(prop.parkingAvailable)
    : prop.parking != null
      ? mapParkingAvailableToBackend(prop.parking)
      : null

  return {
    ...prop,
    id,
    propertyId: prop.propertyId ?? prop.id,
    name,
    propertyName: prop.propertyName ?? prop.name,
    type,
    propertyType: prop.propertyType ?? prop.type,
    // Property Manager fields (canonical backend contract with defensive fallbacks)
    propertyManagerId:
      prop.propertyManagerId ??
      prop.property_manager_id ??
      prop.managerId ??
      prop.manager_id ??
      prop.propertyManager?.propertyManagerId ??
      prop.propertyManager?.id ??
      null,
    managerName:
      prop.managerName ??
      prop.manager_name ??
      (prop.propertyManager
        ? [prop.propertyManager.firstName, prop.propertyManager.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || prop.propertyManager.name
        : null) ??
      null,
    managerEmail:
      prop.managerEmail ??
      prop.manager_email ??
      prop.propertyManager?.email ??
      null,
    managerPhone:
      prop.managerPhone ??
      prop.manager_phone ??
      prop.propertyManager?.phone ??
      null,
    // Address fields: keep in current fallback/empty state until Phase 4 Address integration
    address: prop.address || '',
    city: prop.city || '',
    state: prop.state || '',
    zipCode: prop.zipCode || '',
    // Specs (legacy fields no longer returned by backend Property API)
    bedrooms: prop.bedrooms != null ? Number(prop.bedrooms) : null,
    bathrooms: prop.bathrooms != null ? Number(prop.bathrooms) : null,
    area,
    totalArea: area,
    furnishing: prop.furnishingStatus || prop.furnishing || null,
    furnishingStatus: prop.furnishingStatus || prop.furnishing || null,
    parking:
      prop.parkingAvailable != null
        ? prop.parkingAvailable
          ? 'Available'
          : 'None'
        : prop.parking || null,
    parkingAvailable,
    yearBuilt:
      prop.yearBuilt != null
        ? Number(prop.yearBuilt)
        : prop.year != null
        ? Number(prop.year)
        : null,
    // Financials (legacy fields no longer returned by backend Property API)
    monthlyRent: prop.monthlyRent != null ? Number(prop.monthlyRent) : null,
    deposit:
      prop.securityDeposit != null
        ? Number(prop.securityDeposit)
        : prop.deposit != null
        ? Number(prop.deposit)
        : null,
    securityDeposit:
      prop.securityDeposit != null
        ? Number(prop.securityDeposit)
        : prop.deposit != null
        ? Number(prop.deposit)
        : null,
    // Status & details
    status: prop.status || null,
    description: prop.description || '',
    // Units metrics (backend PropertyResponse does not have nested building/units)
    totalUnits: prop.totalUnits != null ? Number(prop.totalUnits) : null,
    occupiedUnits: prop.occupiedUnits != null ? Number(prop.occupiedUnits) : null,
    images: Array.isArray(prop.images) && prop.images.length > 0 ? prop.images : [],
    imageUrl: prop.imageUrl
      ? resolveImageUrl(prop.imageUrl)
      : Array.isArray(prop.images) && prop.images[0]?.imageUrl
      ? resolveImageUrl(prop.images[0].imageUrl)
      : '',
    amenities: Array.isArray(prop.amenities) ? prop.amenities : [],
    ownerId: prop.ownerId,
    ownerName: prop.ownerName,
    createdAt: prop.createdAt,
    updatedAt: prop.updatedAt,
  }
}

/**
 * Maps Spring Boot PropertyDetailsResponse (consolidating property, address, buildings, floors, units, images)
 * to the exact UI representation for Owner Property List and related components.
 * 
 * Sources of truth:
 * - PropertyResponse: core metadata (propertyName, propertyType, status, totalArea, furnishingStatus, parkingAvailable, yearBuilt)
 * - PropertyAddressResponse: addressLine1, addressLine2, area, city, state, country, pincode
 * - List<BuildingDetailsResponse> -> List<FloorDetailsResponse> -> List<UnitResponse>
 * - List<PropertyImageResponse>: imageId, imageUrl, imageType, isPrimary
 */
export const mapOwnerPropertyDetailsToUi = (details, fallbackProp = {}) => {
  if (!details && !fallbackProp) return null

  const prop = details?.property || fallbackProp || details || {}
  const fallback = fallbackProp || {}

  const id =
    prop.propertyId != null
      ? String(prop.propertyId)
      : prop.id != null
      ? String(prop.id)
      : fallback.propertyId != null
      ? String(fallback.propertyId)
      : fallback.id != null
      ? String(fallback.id)
      : ''
  const propertyId = prop.propertyId ?? prop.id ?? fallback.propertyId ?? fallback.id ?? null
  const propertyName = prop.propertyName || prop.name || fallback.propertyName || fallback.name || 'Unnamed Property'
  const propertyType = prop.propertyType || prop.type || fallback.propertyType || fallback.type || null
  const status = prop.status || fallback.status || null
  const description = prop.description || fallback.description || ''
  const totalArea =
    prop.totalArea != null && !isNaN(Number(prop.totalArea))
      ? Number(prop.totalArea)
      : fallback.totalArea != null && !isNaN(Number(fallback.totalArea))
      ? Number(fallback.totalArea)
      : null
  const furnishingStatus =
    prop.furnishingStatus || fallback.furnishingStatus || null
  const parkingAvailable =
    prop.parkingAvailable != null
      ? Boolean(prop.parkingAvailable)
      : fallback.parkingAvailable != null
      ? Boolean(fallback.parkingAvailable)
      : prop.parking != null
      ? mapParkingAvailableToBackend(prop.parking)
      : fallback.parking != null
      ? mapParkingAvailableToBackend(fallback.parking)
      : null
  const yearBuilt =
    prop.yearBuilt != null && !isNaN(Number(prop.yearBuilt))
      ? Number(prop.yearBuilt)
      : fallback.yearBuilt != null && !isNaN(Number(fallback.yearBuilt))
      ? Number(fallback.yearBuilt)
      : null

  // 1. ADDRESS EXTRACTION & CLEAN FORMATTING (Zero dangling commas)
  const addr = details?.address || prop.address || fallback.address || null
  let addressLine1 = ''
  let addressLine2 = ''
  let area = ''
  let city = ''
  let state = ''
  let pincode = ''

  if (addr && typeof addr === 'object') {
    addressLine1 = (addr.addressLine1 || '').trim()
    addressLine2 = (addr.addressLine2 || '').trim()
    area = (addr.area || '').trim()
    city = (addr.city || '').trim()
    state = (addr.state || '').trim()
    pincode = (addr.pincode || '').trim()
  } else if (typeof addr === 'string') {
    addressLine1 = addr.trim()
  }

  let locationDisplay = null
  const primaryLoc = addressLine1 || area
  const secondaryLoc = [city, state].filter(Boolean).join(', ')

  if (primaryLoc && secondaryLoc) {
    locationDisplay = `${primaryLoc}, ${secondaryLoc}`
  } else if (primaryLoc) {
    locationDisplay = primaryLoc
  } else if (secondaryLoc) {
    locationDisplay = secondaryLoc
  } else if (city) {
    locationDisplay = city
  } else if (state) {
    locationDisplay = state
  }

  const fullLocation = [addressLine1, addressLine2, area, city, state, pincode]
    .filter(Boolean)
    .join(', ')

  // 2. BUILDINGS, FLOORS, UNITS EXTRACTION
  const allUnits = []
  if (Array.isArray(details?.buildings)) {
    details.buildings.forEach((b) => {
      if (Array.isArray(b?.floors)) {
        b.floors.forEach((f) => {
          if (Array.isArray(f?.units)) {
            f.units.forEach((u) => {
              if (u) allUnits.push(u)
            })
          }
        })
      }
    })
  } else if (Array.isArray(prop.units)) {
    prop.units.forEach((u) => {
      if (u) allUnits.push(u)
    })
  }

  // Explicit Unit Status Categorization (VACANT, OCCUPIED, RESERVED, MAINTENANCE)
  const hasUnitData = Array.isArray(details?.buildings) || Array.isArray(prop.units)
  const readCount = (field) => {
    const value = prop[field] ?? fallback[field]
    return value != null && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null
  }
  const countByStatus = (statusValue, field) =>
    hasUnitData
      ? allUnits.filter((unit) => unit.status === statusValue).length
      : readCount(field)

  const totalUnits = hasUnitData ? allUnits.length : readCount('totalUnits')
  const vacantUnits = countByStatus('VACANT', 'vacantUnits')
  const occupiedUnits = countByStatus('OCCUPIED', 'occupiedUnits')
  const reservedUnits = countByStatus('RESERVED', 'reservedUnits')
  const maintenanceUnits = countByStatus('MAINTENANCE', 'maintenanceUnits')
  const occupancyRate = totalUnits > 0 && occupiedUnits != null
    ? Math.round((occupiedUnits / totalUnits) * 100)
    : readCount('occupancyRate')

  // Monthly Revenue: Sum of monthlyRent for OCCUPIED units only
  const occupiedRevenue = hasUnitData
    ? allUnits
        .filter((u) => u.status === 'OCCUPIED')
        .reduce((sum, u) => {
          const rent = Number(u.monthlyRent)
          return sum + (!isNaN(rent) && rent > 0 ? rent : 0)
        }, 0)
    : readCount('occupiedRevenue')

  // 3. RENT EXTRACTION (Stored clean without "/ mo")
  const unitRents = allUnits
    .map((u) => Number(u.monthlyRent))
    .filter((r) => !isNaN(r) && r > 0)

  let minRent = null
  let maxRent = null
  let rentDisplay = null

  if (unitRents.length > 0) {
    minRent = Math.min(...unitRents)
    maxRent = Math.max(...unitRents)
    rentDisplay =
      minRent === maxRent
        ? `₹${minRent.toLocaleString('en-IN')}`
        : `₹${minRent.toLocaleString('en-IN')} – ₹${maxRent.toLocaleString('en-IN')}`
  } else if (prop.monthlyRent != null && Number(prop.monthlyRent) > 0) {
    minRent = Number(prop.monthlyRent)
    maxRent = Number(prop.monthlyRent)
    rentDisplay = `₹${minRent.toLocaleString('en-IN')}`
  }

  // Security Deposit
  const unitDeposits = allUnits
    .map((u) => Number(u.securityDeposit))
    .filter((d) => !isNaN(d) && d > 0)

  let minDeposit = null
  let maxDeposit = null
  let depositDisplay = null

  if (unitDeposits.length > 0) {
    minDeposit = Math.min(...unitDeposits)
    maxDeposit = Math.max(...unitDeposits)
    depositDisplay =
      minDeposit === maxDeposit
        ? `₹${minDeposit.toLocaleString('en-IN')}`
        : `₹${minDeposit.toLocaleString('en-IN')} – ₹${maxDeposit.toLocaleString('en-IN')}`
  } else if (prop.securityDeposit != null && Number(prop.securityDeposit) > 0) {
    minDeposit = Number(prop.securityDeposit)
    maxDeposit = Number(prop.securityDeposit)
    depositDisplay = `₹${minDeposit.toLocaleString('en-IN')}`
  }

  // 4. BEDROOMS & BATHROOMS EXTRACTION
  const unitBeds = allUnits
    .map((u) => Number(u.bedrooms))
    .filter((b) => !isNaN(b) && b > 0)
  const unitBaths = allUnits
    .map((u) => Number(u.bathrooms))
    .filter((b) => !isNaN(b) && b > 0)

  let minBed = null
  let maxBed = null
  let bedroomDisplay = null

  if (unitBeds.length > 0) {
    minBed = Math.min(...unitBeds)
    maxBed = Math.max(...unitBeds)
    bedroomDisplay = minBed === maxBed ? `${minBed} bd` : `${minBed} – ${maxBed} bd`
  } else if (prop.bedrooms != null && Number(prop.bedrooms) > 0) {
    minBed = Number(prop.bedrooms)
    maxBed = Number(prop.bedrooms)
    bedroomDisplay = `${minBed} bd`
  }

  let minBath = null
  let maxBath = null
  let bathroomDisplay = null

  if (unitBaths.length > 0) {
    minBath = Math.min(...unitBaths)
    maxBath = Math.max(...unitBaths)
    bathroomDisplay = minBath === maxBath ? `${minBath} ba` : `${minBath} – ${maxBath} ba`
  } else if (prop.bathrooms != null && Number(prop.bathrooms) > 0) {
    minBath = Number(prop.bathrooms)
    maxBath = Number(prop.bathrooms)
    bathroomDisplay = `${minBath} ba`
  }

  // 5. IMAGE EXTRACTION (Zero fake or Unsplash images)
  // Hierarchy:
  // 1. Primary image (isPrimary === true)
  // 2. Secondary image (first valid image from images list)
  // 3. null (UI renders neutral "No image available" placeholder)
  const rawImages = Array.isArray(details?.images) && details.images.length > 0
    ? details.images
    : Array.isArray(prop.images) && prop.images.length > 0
    ? prop.images
    : []

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
  const imageUrl = primaryImageObj?.imageUrl || (prop.imageUrl ? resolveImageUrl(prop.imageUrl) : null)

  return {
    ...prop,
    id,
    propertyId,
    name: propertyName,
    propertyName,
    type: propertyType,
    propertyType,
    status,
    description,
    totalArea,
    area: totalArea,
    furnishingStatus,
    parkingAvailable,
    yearBuilt,
    // Address
    addressData: addr,
    address: addressLine1 || area || '',
    addressLine1,
    addressLine2,
    area,
    city,
    state,
    pincode,
    locationDisplay,
    fullLocation,
    // Units
    units: allUnits,
    totalUnits,
    vacantUnits,
    occupiedUnits,
    reservedUnits,
    maintenanceUnits,
    occupancyRate,
    occupiedRevenue,
    // Financials
    minRent,
    maxRent,
    monthlyRent: minRent,
    rentDisplay,
    minDeposit,
    maxDeposit,
    securityDeposit: minDeposit,
    deposit: minDeposit,
    depositDisplay,
    // Specs
    bedrooms: minBed,
    bathrooms: minBath,
    bedroomDisplay,
    bathroomDisplay,
    // Images
    images: validImages,
    imageUrl, // null if no real backend image exists
    // Manager
    propertyManagerId: prop.propertyManagerId ?? fallback.propertyManagerId ?? null,
    managerName: prop.managerName ?? fallback.managerName ?? null,
    managerEmail: prop.managerEmail ?? fallback.managerEmail ?? null,
    managerPhone: prop.managerPhone ?? fallback.managerPhone ?? null,
    ownerId: prop.ownerId ?? fallback.ownerId,
    ownerName: prop.ownerName ?? fallback.ownerName,
    createdAt: prop.createdAt ?? fallback.createdAt,
    updatedAt: prop.updatedAt ?? fallback.updatedAt,
  }
}

// ============================================================================
// Real Backend Property Fetching
// Retrieves all properties from real Spring Boot backend /api/owner/properties
// ============================================================================
export const getProperties = async () => {
  const response = await getMyProperties()
  const data = Array.isArray(response) ? response : response?.data || []
  return data.map(mapBackendPropertyToUi)
}

/**
 * Retrieves all properties belonging to the authenticated Property Owner
 * and enriches each property with full backend details (address, buildings, floors, units, images)
 * via GET /api/owner/properties/{id}/details.
 * 
 * @returns {Promise<Array<Object>>} List of enriched Owner property UI objects
 */
export const getOwnerPropertiesWithDetails = async () => {
  const response = await getMyProperties()
  const rawProperties = Array.isArray(response) ? response : response?.data || []

  if (rawProperties.length === 0) {
    return []
  }

  const detailsResults = await Promise.allSettled(
    rawProperties.map(async (prop) => {
      const propId = prop.propertyId ?? prop.id
      if (!propId) {
        return mapOwnerPropertyDetailsToUi(null, prop)
      }
      try {
        const detailsRes = await getPropertyDetails(propId)
        const detailsData = detailsRes?.data || detailsRes
        return mapOwnerPropertyDetailsToUi(detailsData, prop)
      } catch (err) {
        console.warn(`Failed to fetch details for property ${propId}:`, err)
        return mapOwnerPropertyDetailsToUi(null, prop)
      }
    })
  )

  return detailsResults.map((res, index) => {
    if (res.status === 'fulfilled' && res.value) {
      return res.value
    }
    return mapOwnerPropertyDetailsToUi(null, rawProperties[index])
  })
}

/**
 * GET /api/owner/managers
 * Retrieve all active Property Manager profiles for assignment
 */
export const getEligiblePropertyManagers = async () => {
  return axiosClient.get('/owner/managers')
}

/**
 * PUT /api/owner/properties/{propertyId}/manager/{propertyManagerId}
 * Assign or replace a Property Manager for a property
 */
export const assignPropertyManager = async (propertyId, propertyManagerId) => {
  return axiosClient.put(`/owner/properties/${propertyId}/manager/${propertyManagerId}`)
}

/**
 * DELETE /api/owner/properties/{propertyId}/manager
 * Remove the assigned Property Manager from a property
 */
export const removePropertyManager = async (propertyId) => {
  return axiosClient.delete(`/owner/properties/${propertyId}/manager`)
}

// ============================================================================
// Property Manager Assigned Properties API Layer
// Controller: PropertyManagerController (/api/property-manager)
// Role: PROPERTY_MANAGER
// ============================================================================

/**
 * GET /api/property-manager/properties
 * Retrieve all properties assigned to the authenticated Property Manager
 * Role: PROPERTY_MANAGER
 * @returns {Promise<Array<Object>>} List of PropertyResponse
 */
export const getManagerAssignedProperties = async () => {
  return axiosClient.get('/property-manager/properties')
}

/**
 * GET /api/property-manager/properties/{propertyId}
 * Retrieve single assigned property details summary by ID for authenticated Property Manager
 * Role: PROPERTY_MANAGER
 * @param {number|string} propertyId
 * @returns {Promise<Object>} PropertyResponse
 */
export const getManagerAssignedPropertyById = async (propertyId) => {
  return axiosClient.get(`/property-manager/properties/${propertyId}`)
}

/**
 * GET /api/property-manager/me
 * Retrieve profile information for the authenticated Property Manager
 * Role: PROPERTY_MANAGER
 * @returns {Promise<Object>} PropertyManagerResponse
 */
export const getManagerProfile = async () => {
  return axiosClient.get('/property-manager/me')
}

/**
 * GET /api/property-manager/properties/{propertyId}/details
 * Retrieve full property details (including address, buildings, images) for authenticated Property Manager
 * Role: PROPERTY_MANAGER
 * @param {number|string} propertyId
 * @returns {Promise<Object>} PropertyDetailsResponse
 */
export const getManagerAssignedPropertyDetails = async (propertyId) => {
  return axiosClient.get(`/property-manager/properties/${propertyId}/details`)
}

/**
 * PUT /api/property-manager/properties/{propertyId}
 * Update an assigned property by authenticated Property Manager
 * Role: PROPERTY_MANAGER
 * @param {number|string} propertyId
 * @param {Object} propertyData
 * @returns {Promise<Object>} PropertyResponse
 */
export const updateManagerAssignedProperty = async (
  propertyId,
  propertyData
) => {
  const payload = formatPropertyRequest(propertyData)

  return axiosClient.put(
    `/property-manager/properties/${propertyId}`,
    payload
  )
}

// ============================================================================
// Tenant / Public Property API Layer
// Controller: PropertyPublicController (/api/properties)
// Role: TENANT
// ============================================================================

/**
 * GET /api/properties/public
 * Used by tenants to browse properties that are currently available for rental.
 * Role: TENANT
 * @returns {Promise<Array<Object>>} Lightweight mapped property cards
 */
export const getPublicProperties = async () => {
  const response = await axiosClient.get('/properties/public')
  const data = Array.isArray(response) ? response : response?.data || []
  return data.map(mapBackendPropertyToUi)
}

/**
 * GET /api/properties/public/search
 * Used by tenants to search available properties using optional filters.
 * Role: TENANT
 * Supported backend query params:
 * - searchQuery (string)
 * - city (string)
 * - propertyType (APARTMENT, HOUSE, VILLA, PG, HOSTEL, COMMERCIAL)
 * - furnishingStatus (UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED)
 * - parkingAvailable (boolean)
 * - minRent (double)
 * - maxRent (double)
 * - bedrooms (integer)
 *
 * @param {Object} [filters={}]
 * @returns {Promise<Array<Object>>} Mapped property search results
 */
export const searchPublicProperties = async (filters = {}) => {
  const params = {}

  if (filters.searchQuery && String(filters.searchQuery).trim()) {
    params.searchQuery = String(filters.searchQuery).trim()
  }

  if (filters.city && filters.city !== 'All Locations' && String(filters.city).trim()) {
    const rawCity = String(filters.city).split(',')[0].trim()
    if (rawCity) {
      params.city = rawCity
    }
  }

  const rawType = filters.propertyType || filters.type
  if (rawType && rawType !== 'All Types') {
    params.propertyType = mapPropertyTypeToBackend(rawType)
  }

  const rawFurn = filters.furnishingStatus || filters.furnishing
  if (rawFurn && rawFurn !== 'All Furnishing') {
    params.furnishingStatus = mapFurnishingStatusToBackend(rawFurn)
  }

  const rawParking = filters.parkingAvailable != null ? filters.parkingAvailable : filters.parking
  if (rawParking != null && rawParking !== 'All Parking') {
    params.parkingAvailable = mapParkingAvailableToBackend(rawParking)
  }

  if (
    filters.minRent !== undefined &&
    filters.minRent !== null &&
    filters.minRent !== '' &&
    !isNaN(Number(filters.minRent))
  ) {
    const min = Number(filters.minRent)
    if (min >= 0) params.minRent = min
  }

  if (
    filters.maxRent !== undefined &&
    filters.maxRent !== null &&
    filters.maxRent !== '' &&
    !isNaN(Number(filters.maxRent))
  ) {
    const max = Number(filters.maxRent)
    if (max >= 0) params.maxRent = max
  }

  if (filters.bedrooms != null && filters.bedrooms !== '' && filters.bedrooms !== 'all') {
    const parsed = parseInt(filters.bedrooms, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      params.bedrooms = parsed
    }
  }

  const response = await axiosClient.get('/properties/public/search', { params })
  const data = Array.isArray(response) ? response : response?.data || []
  return data.map(mapBackendPropertyToUi)
}

/**
 * GET /api/properties/public/{propertyId}
 * Used by tenants to view complete details of one available property.
 * Role: TENANT
 * Response structure: { property, address, buildings, amenities, images }
 *
 * @param {number|string} propertyId
 * @returns {Promise<Object>} PropertyDetailsResponse
 */
export const getPublicPropertyDetails = async (propertyId) => {
  return axiosClient.get(`/properties/public/${propertyId}`)
}
