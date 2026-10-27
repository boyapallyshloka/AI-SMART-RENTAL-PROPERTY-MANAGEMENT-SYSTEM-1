import axiosClient from './axiosClient.js'

/**
 * Tenant Preferences API Service (Spring Boot Integration)
 * Base Controller: TenantPreferenceController (/api/tenant/preferences)
 * Role: TENANT
 */

/**
 * Retrieve saved preferences for the authenticated tenant.
 * Endpoint: GET /api/tenant/preferences
 *
 * @returns {Promise<Object>} TenantPreferenceResponseDTO {
 *   preferenceId,
 *   preferredCity,
 *   maxBudget,
 *   minBedrooms,
 *   preferredPropertyType,
 *   furnishingPreference,
 *   parkingRequired,
 *   preferredAmenities: [{ amenityId, amenityName }],
 *   preferredLatitude,
 *   preferredLongitude,
 *   maxDistanceKm,
 *   createdAt,
 *   updatedAt
 * }
 */
export const getTenantPreferences = async () => {
  return axiosClient.get('/tenant/preferences')
}

/**
 * Create initial rental preferences for the authenticated tenant.
 * Endpoint: POST /api/tenant/preferences
 *
 * @param {Object} data - TenantPreferenceDTO
 * @param {string} data.preferredCity
 * @param {number} data.maxBudget
 * @param {number} data.minBedrooms
 * @param {string} data.preferredPropertyType - Enum: APARTMENT, HOUSE, VILLA, PG, HOSTEL, COMMERCIAL
 * @param {string} data.furnishingPreference - Enum: UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED
 * @param {boolean} data.parkingRequired
 * @param {number[]} [data.preferredAmenityIds]
 * @param {number} [data.preferredLatitude]
 * @param {number} [data.preferredLongitude]
 * @param {number} [data.maxDistanceKm]
 * @returns {Promise<Object>} TenantPreferenceResponseDTO
 */
export const createTenantPreferences = async (data) => {
  return axiosClient.post('/tenant/preferences', data)
}

/**
 * Update existing rental preferences for the authenticated tenant.
 * Endpoint: PUT /api/tenant/preferences
 *
 * @param {Object} data - TenantPreferenceDTO
 * @returns {Promise<Object>} TenantPreferenceResponseDTO
 */
export const updateTenantPreferences = async (data) => {
  return axiosClient.put('/tenant/preferences', data)
}

/**
 * Delete rental preferences for the authenticated tenant.
 * Endpoint: DELETE /api/tenant/preferences
 *
 * @returns {Promise<void>}
 */
export const deleteTenantPreferences = async () => {
  return axiosClient.delete('/tenant/preferences')
}
