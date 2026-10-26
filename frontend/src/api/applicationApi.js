import axiosClient from './axiosClient'
import { getMyProperties, getManagerAssignedProperties } from './propertyApi'

/**
 * Rental Applications API Service (Spring Boot Integration)
 * Base Controller: RentalApplicationController (/api/rental-applications)
 */

/**
 * Canonical application statuses matching backend RentalApplicationStatus enum
 */
export const APPLICATION_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  CANCELLED: 'CANCELLED',
}

/**
 * TENANT - Create a new rental application
 * Endpoint: POST /api/rental-applications
 * Payload contract includes unit, move-in, lease, income, employer/occupation, and message details.
 *
 * @param {Object} applicationData
 * @param {number|string} applicationData.unitId
 * @param {string} [applicationData.preferredMoveInDate]
 * @param {number|string|null} [applicationData.monthlyIncome]
 * @param {string|null} [applicationData.employerOccupation]
 * @param {string} [applicationData.message]
 * @returns {Promise<Object>} RentalApplicationResponse
 */
export const createApplication = async ({
  propertyId,
  unitId,
  preferredMoveInDate,
  preferredLeaseDurationMonths,
  monthlyIncome,
  employerOccupation,
  message
}) => {
  const payload = {
    propertyId: Number(propertyId),
    unitId: Number(unitId),
    preferredMoveInDate: preferredMoveInDate || null,
    preferredLeaseDurationMonths: Number(preferredLeaseDurationMonths),
    monthlyIncome:
      monthlyIncome == null || monthlyIncome === ''
        ? null
        : Number(monthlyIncome),
    employerOccupation:
      employerOccupation && employerOccupation.trim()
        ? employerOccupation.trim()
        : null,
    message: message && message.trim() ? message.trim() : null,
  }

  return await axiosClient.post('/rental-applications', payload)
}

// Alias for createApplication for backward compatibility
export const submitApplication = createApplication

/**
 * TENANT - Retrieve rental applications submitted by the currently authenticated tenant
 * Endpoint: GET /api/rental-applications/my
 *
 * @returns {Promise<Array<Object>>} List of RentalApplicationResponse
 */
export const getMyApplications = async () => {
  return await axiosClient.get('/rental-applications/my')
}

// Alias for getMyApplications for backward compatibility
export const getApplications = getMyApplications

/**
 * Retrieve a specific rental application by ID
 * Endpoint: GET /api/rental-applications/{applicationId}
 *
 * @param {number|string} applicationId
 * @returns {Promise<Object>} RentalApplicationResponse
 */
export const getApplicationById = async (applicationId) => {
  return await axiosClient.get(`/rental-applications/${applicationId}`)
}

/**
 * TENANT - Withdraw a pending rental application
 * Endpoint: PUT /api/rental-applications/{applicationId}/withdraw
 *
 * @param {number|string} applicationId
 * @returns {Promise<void>} 204 No Content
 */
export const withdrawApplication = async (applicationId) => {
  return await axiosClient.put(`/rental-applications/${applicationId}/withdraw`)
}

/**
 * OWNER / MANAGER - Retrieve applications for a specific unit
 * Endpoint: GET /api/rental-applications/unit/{unitId}
 *
 * @param {number|string} unitId
 * @returns {Promise<Array<Object>>} List of RentalApplicationResponse
 */
export const getApplicationsForUnit = async (unitId) => {
  return await axiosClient.get(`/rental-applications/unit/${unitId}`)
}

/**
 * OWNER / MANAGER - Review an application (Approve or Reject)
 * Endpoint: PUT /api/rental-applications/{applicationId}/review
 *
 * @param {number|string} applicationId
 * @param {Object} reviewData
 * @param {'APPROVED'|'REJECTED'} reviewData.status
 * @param {string} [reviewData.rejectionReason]
 * @returns {Promise<Object>} RentalApplicationResponse
 */
export const reviewApplication = async (applicationId, { status, rejectionReason }) => {
  const payload = {
    status,
  }
  if (status === APPLICATION_STATUSES.REJECTED && rejectionReason && rejectionReason.trim()) {
    payload.rejectionReason = rejectionReason.trim()
  }
  return await axiosClient.put(`/rental-applications/${applicationId}/review`, payload)
}

// Alias for updateApplicationStatus
export const updateApplicationStatus = async (applicationId, status, rejectionReason) => {
  return await reviewApplication(applicationId, { status, rejectionReason })
}

/**
 * OWNER / MANAGER / ADMIN - Retrieve applications for a specific property
 * Endpoint: GET /api/rental-applications/property/{propertyId}
 *
 * @param {number|string} propertyId
 * @returns {Promise<Array<Object>>} List of RentalApplicationResponse
 */
export const getApplicationsForProperty = async (propertyId) => {
  return await axiosClient.get(`/rental-applications/property/${propertyId}`)
}
/**
 * SUPER ADMIN - Retrieve all rental applications
 * Endpoint: GET /api/rental-applications
 *
 * @returns {Promise<Array<Object>>} List of RentalApplicationResponse
 */
export const getAllApplications = async () => {
  return await axiosClient.get('/rental-applications')
}

/**
 * OWNER - Retrieve all rental applications across the owner's properties
 * 1. Retrieves properties owned by current user (or uses provided knownProperties).
 * 2. Concurrently calls GET /api/rental-applications/property/{propertyId} for each property.
 * 3. Combines and deduplicates applications by applicationId.
 *
 * @param {Array<Object>} [knownProperties] Optional list of properties already fetched
 * @returns {Promise<Array<Object>>} Combined list of RentalApplicationResponse
 */
export const getOwnerApplications = async (knownProperties = null) => {
  let propList = knownProperties
  if (!propList) {
    try {
      const propRes = await getMyProperties()
      propList = Array.isArray(propRes?.data) ? propRes.data : Array.isArray(propRes) ? propRes : []
    } catch {
      propList = []
    }

    if (!propList || propList.length === 0) {
      try {
        const mgrRes = await getManagerAssignedProperties()
        propList = Array.isArray(mgrRes?.data) ? mgrRes.data : Array.isArray(mgrRes) ? mgrRes : []
      } catch {
        propList = []
      }
    }
  }

  if (propList.length === 0) {
    return []
  }

  const appPromises = propList.map(async (prop) => {
    const propId = prop.propertyId || prop.id
    try {
      const appRes = await getApplicationsForProperty(propId)
      const list = Array.isArray(appRes?.data) ? appRes.data : Array.isArray(appRes) ? appRes : []
      return list.map((app) => ({
        ...app,
        propertyName: app.propertyName || prop.name || prop.title || 'Property',
      }))
    } catch (err) {
      console.error(`Failed to load applications for property ${propId}:`, err)
      return []
    }
  })

  const results = await Promise.all(appPromises)
  const allApps = results.flat()

  // Deduplicate by applicationId
  const seen = new Set()
  return allApps.filter((a) => {
    if (!a || !a.applicationId) return false
    if (seen.has(a.applicationId)) return false
    seen.add(a.applicationId)
    return true
  })
}
