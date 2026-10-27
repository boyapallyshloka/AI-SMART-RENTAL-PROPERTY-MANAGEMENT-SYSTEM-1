import axiosClient from './axiosClient.js'

/**
 * Location API Service (Spring Boot Integration)
 * Controller: LocationController (/api/location)
 *
 * Endpoints:
 * - GET /api/location/reverse-geocode?latitude=...&longitude=...
 * - GET /api/location/pincode/{pincode}
 */

/**
 * Reverse geocode coordinates to retrieve structured address fields.
 * Endpoint: GET /api/location/reverse-geocode?latitude={lat}&longitude={lng}
 *
 * @param {number|string} latitude
 * @param {number|string} longitude
 * @returns {Promise<{
 *   addressLine1?: string,
 *   area?: string,
 *   district?: string,
 *   city?: string,
 *   state?: string,
 *   country?: string,
 *   pincode?: string
 * }>}
 */
export const reverseGeocode = async (latitude, longitude) => {
  const lat = Number(latitude)
  const lng = Number(longitude)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('Valid numeric latitude and longitude are required')
  }

  const response = await axiosClient.get('/location/reverse-geocode', {
    params: { latitude: lat, longitude: lng },
  })
  return response?.data || response
}

/**
 * Lookup Indian postal code details to retrieve state, district, city, and area suggestions.
 * Endpoint: GET /api/location/pincode/{pincode}
 *
 * @param {string} pincode - 6-digit postal pincode
 * @returns {Promise<{
 *   pincode: string,
 *   country: string,
 *   state: string,
 *   district: string,
 *   city: string,
 *   areas: string[]
 * }>}
 */
export const getPincodeDetails = async (pincode) => {
  const cleanPin = String(pincode || '').trim()
  if (!cleanPin || cleanPin.length !== 6) {
    throw new Error('Pincode must be exactly 6 digits')
  }

  const response = await axiosClient.get(`/location/pincode/${encodeURIComponent(cleanPin)}`)
  return response?.data || response
}

/**
 * Search Indian postal pincodes by prefix (3 to 6 digits).
 * Endpoint: GET /api/location/pincode/search?prefix={prefix}
 *
 * @param {string} prefix - Pincode prefix (3 to 6 digits)
 * @returns {Promise<Array<{ pincode: string, district: string, state: string }>>}
 */
export const searchPincodes = async (prefix) => {
  const cleanPrefix = String(prefix || '').trim()
  if (!cleanPrefix) {
    return []
  }

  const response = await axiosClient.get('/location/pincode/search', {
    params: { prefix: cleanPrefix },
  })
  return response?.data || response
}

export default {
  reverseGeocode,
  getPincodeDetails,
  searchPincodes,
}
