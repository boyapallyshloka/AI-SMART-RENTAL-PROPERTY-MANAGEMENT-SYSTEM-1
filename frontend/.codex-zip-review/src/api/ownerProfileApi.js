import axiosClient from './axiosClient.js'

/**
 * Property Owner Profile API Service
 * Controller: OwnerProfileController (/api/owner-profile)
 * Security: Requires authenticated user with Role PROPERTY_OWNER
 */

/**
 * Cleanly format OwnerProfileUpdateRequest matching Spring Boot DTO constraints:
 * - Sanitizes whitespace
 * - Omits or sets empty strings to null
 * - Preserves exactly 6-digit pincode or null
 * - Strictly excludes latitude/longitude (owner profile DTO does not have coordinate fields)
 *
 * @param {Object} data
 * @returns {Object}
 */
export const formatOwnerProfileRequest = (data = {}) => {
  const payload = {}

  if (data.profileImage !== undefined) {
    const val = String(data.profileImage || '').trim()
    payload.profileImage = val || null
  }

  if (data.addressLine1 !== undefined) {
    const val = String(data.addressLine1 || '').trim()
    payload.addressLine1 = val || null
  }

  if (data.addressLine2 !== undefined) {
    const val = String(data.addressLine2 || '').trim()
    payload.addressLine2 = val || null
  }

  if (data.area !== undefined) {
    const val = String(data.area || '').trim()
    payload.area = val || null
  }

  if (data.district !== undefined) {
    const val = String(data.district || '').trim()
    payload.district = val || null
  }

  if (data.city !== undefined) {
    const val = String(data.city || '').trim()
    payload.city = val || null
  }

  if (data.state !== undefined) {
    const val = String(data.state || '').trim()
    payload.state = val || null
  }

  if (data.country !== undefined) {
    const val = String(data.country || '').trim()
    payload.country = val || null
  }

  if (data.pincode !== undefined) {
    const val = String(data.pincode || '').trim()
    // Backend @Pattern requires exactly 6 digits if present, or null
    payload.pincode = /^\d{6}$/.test(val) ? val : null
  }

  // Ensure no latitude or longitude fields are sent
  delete payload.latitude
  delete payload.longitude

  return payload
}

/**
 * Retrieve current authenticated Property Owner profile.
 * Endpoint: GET /api/owner-profile/me
 * Note: axiosClient automatically supplies the /api base prefix.
 *
 * @returns {Promise<OwnerProfileResponse>}
 */
export const getMyOwnerProfile = async () => {
  const response = await axiosClient.get('/owner-profile/me')
  return response?.data || response
}

/**
 * Update current authenticated Property Owner profile.
 * Endpoint: PUT /api/owner-profile/me
 * Note: axiosClient automatically supplies the /api base prefix.
 *
 * @param {Object} profileData - OwnerProfileUpdateRequest fields
 * @returns {Promise<OwnerProfileResponse>}
 */
export const updateMyOwnerProfile = async (profileData) => {
  const payload = formatOwnerProfileRequest(profileData)
  const response = await axiosClient.put('/owner-profile/me', payload)
  return response?.data || response
}

export default {
  getMyOwnerProfile,
  updateMyOwnerProfile,
  formatOwnerProfileRequest,
}
