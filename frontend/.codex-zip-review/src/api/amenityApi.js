import axiosClient from './axiosClient.js'

/**
 * Amenity API Service (Spring Boot Integration)
 * Controller: AmenityController (/api/amenities)
 * Role: PROPERTY_OWNER
 */

export const ALLOWED_AMENITY_FIELDS = ['amenityName', 'description']

/**
 * Formats and sanitizes AmenityRequest payload strictly matching backend DTO:
 * - amenityName (String, required)
 * - description (String, optional)
 *
 * Strictly excludes propertyId, amenityId, ownerId, timestamps, and UI metadata.
 */
export const formatAmenityRequest = (data = {}) => {
  const amenityName = (data.amenityName || data.name || '').trim()
  const description =
    data.description != null && String(data.description).trim() !== ''
      ? String(data.description).trim()
      : undefined

  const payload = {
    amenityName: amenityName || undefined,
    description,
  }

  // Ensure IDs, property references, and response metadata are never included in body
  delete payload.amenityId
  delete payload.propertyId
  delete payload.createdAt
  delete payload.updatedAt
  delete payload.ownerId
  delete payload.id

  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  )
}

// POST /api/amenities
export const createAmenity = async (amenityData) => {
  const payload = formatAmenityRequest(amenityData)
  return axiosClient.post('/amenities', payload)
}

// GET /api/amenities
export const getAllAmenities = async () => {
  return axiosClient.get('/amenities')
}

// GET /api/amenities/{amenityId}
export const getAmenityById = async (amenityId) => {
  return axiosClient.get(`/amenities/${amenityId}`)
}

// PUT /api/amenities/{amenityId}
export const updateAmenity = async (amenityId, amenityData) => {
  const payload = formatAmenityRequest(amenityData)
  return axiosClient.put(`/amenities/${amenityId}`, payload)
}

// DELETE /api/amenities/{amenityId}
export const deleteAmenity = async (amenityId) => {
  return axiosClient.delete(`/amenities/${amenityId}`)
}

// POST /api/amenities/property/{propertyId}/amenity/{amenityId}
// Note: propertyId and amenityId belong strictly in the URL path
export const addAmenityToProperty = async (propertyId, amenityId) => {
  return axiosClient.post(`/amenities/property/${propertyId}/amenity/${amenityId}`)
}

// GET /api/amenities/property/{propertyId}
// Note: propertyId belongs strictly in the URL path
export const getPropertyAmenities = async (propertyId) => {
  return axiosClient.get(`/amenities/property/${propertyId}`)
}

// DELETE /api/amenities/property/{propertyId}/amenity/{amenityId}
// Note: propertyId and amenityId belong strictly in the URL path
export const removeAmenityFromProperty = async (propertyId, amenityId) => {
  return axiosClient.delete(`/amenities/property/${propertyId}/amenity/${amenityId}`)
}
