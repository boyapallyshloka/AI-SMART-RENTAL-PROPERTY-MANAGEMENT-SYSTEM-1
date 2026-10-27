import axiosClient from './axiosClient.js'

/**
 * Property Address API Service (Spring Boot Integration)
 * Controller: PropertyAddressController (/api/owner/properties/{propertyId}/address)
 * Role: PROPERTY_OWNER
 */

/**
 * Allowed fields in Spring Boot PropertyAddressRequest DTO
 */
export const ALLOWED_ADDRESS_REQUEST_FIELDS = [
  'addressLine1',
  'addressLine2',
  'area',
  'areaType',
  'city',
  'state',
  'country',
  'pincode',
  'latitude',
  'longitude',
]

export const AREA_TYPES = {
  SUPER_BUILT_UP_AREA: 'SUPER_BUILT_UP_AREA',
  BUILT_UP_AREA: 'BUILT_UP_AREA',
  PLOT_AREA: 'PLOT_AREA',
  CARPET_AREA: 'CARPET_AREA',
}

/**
 * Cleanly format PropertyAddressRequest payload matching Spring Boot DTO constraints:
 * - Maps UI fields: address -> addressLine1, zipCode -> pincode
 * - Preserves: addressLine1, addressLine2, area, areaType, city, state, country, pincode, latitude, longitude
 * - Strictly OMITS: propertyId (must be in URL path only), addressId, and response metadata
 */
export const formatAddressRequest = (data = {}) => {
  const payload = {}

  // addressLine1 (accepts addressLine1 or address)
  const line1 = data.addressLine1 != null ? data.addressLine1 : data.address
  if (line1 != null && String(line1).trim() !== '') {
    payload.addressLine1 = String(line1).trim()
  }

  // addressLine2 (optional)
  if (data.addressLine2 != null && String(data.addressLine2).trim() !== '') {
    payload.addressLine2 = String(data.addressLine2).trim()
  }

  // area
  if (data.area != null && String(data.area).trim() !== '') {
    payload.area = String(data.area).trim()
  }

  // areaType (optional AreaType enum)
  if (data.areaType != null && String(data.areaType).trim() !== '') {
    payload.areaType = String(data.areaType).trim()
  }

  // city
  if (data.city != null && String(data.city).trim() !== '') {
    payload.city = String(data.city).trim()
  }

  // state
  if (data.state != null && String(data.state).trim() !== '') {
    payload.state = String(data.state).trim()
  }

  // country
  if (data.country != null && String(data.country).trim() !== '') {
    payload.country = String(data.country).trim()
  }

  // pincode (accepts pincode or zipCode)
  const pin = data.pincode != null ? data.pincode : data.zipCode
  if (pin != null && String(pin).trim() !== '') {
    payload.pincode = String(pin).trim()
  }

  // latitude (optional BigDecimal/number)
  if (data.latitude != null && data.latitude !== '') {
    const lat = Number(data.latitude)
    if (!Number.isNaN(lat)) {
      payload.latitude = lat
    }
  }

  // longitude (optional BigDecimal/number)
  if (data.longitude != null && data.longitude !== '') {
    const lng = Number(data.longitude)
    if (!Number.isNaN(lng)) {
      payload.longitude = lng
    }
  }

  // Strictly exclude propertyId and response-only fields
  delete payload.propertyId
  delete payload.addressId
  delete payload.id
  delete payload.createdAt
  delete payload.updatedAt

  return payload
}

// POST /api/owner/properties/{propertyId}/address
export const createAddress = async (propertyId, addressData) => {
  const payload = formatAddressRequest(addressData)
  return axiosClient.post(`/owner/properties/${propertyId}/address`, payload)
}

// GET /api/owner/properties/{propertyId}/address
export const getAddress = async (propertyId) => {
  return axiosClient.get(`/owner/properties/${propertyId}/address`)
}

// PUT /api/owner/properties/{propertyId}/address
export const updateAddress = async (propertyId, addressData) => {
  const payload = formatAddressRequest(addressData)
  return axiosClient.put(`/owner/properties/${propertyId}/address`, payload)
}

// DELETE /api/owner/properties/{propertyId}/address
export const deleteAddress = async (propertyId) => {
  return axiosClient.delete(`/owner/properties/${propertyId}/address`)
}

