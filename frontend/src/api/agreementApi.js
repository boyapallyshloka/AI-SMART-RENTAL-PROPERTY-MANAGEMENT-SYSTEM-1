import axiosClient from './axiosClient'

/**
 * Rental Agreements API Service (Spring Boot Integration)
 * Base Controller: RentalAgreementController (/api/rental-agreements)
 */

/**
 * Canonical agreement statuses matching backend AgreementStatus enum
 */
export const AGREEMENT_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
}

/**
 * Retrieve all rental agreements accessible to the authenticated user
 * - SUPER_ADMIN: all agreements
 * - PROPERTY_OWNER: agreements for owned properties
 * - PROPERTY_MANAGER: agreements for assigned properties
 * Endpoint: GET /api/rental-agreements
 *
 * @returns {Promise<Array<Object>>} List of RentalAgreementResponse
 */
export const getAgreements = async () => {
  return await axiosClient.get('/rental-agreements')
}

/**
 * Retrieve a single rental agreement by ID
 * Endpoint: GET /api/rental-agreements/{agreementId}
 *
 * @param {number|string} agreementId
 * @returns {Promise<Object>} RentalAgreementResponse
 */
export const getAgreementById = async (agreementId) => {
  return await axiosClient.get(`/rental-agreements/${agreementId}`)
}

/**
 * TENANT - Retrieve rental agreements belonging to the authenticated tenant
 * Endpoint: GET /api/rental-agreements/my
 *
 * @returns {Promise<Array<Object>>} List of RentalAgreementResponse
 */
export const getMyAgreements = async () => {
  return await axiosClient.get('/rental-agreements/my')
}

/**
 * Create a new rental agreement from an APPROVED rental application
 * Endpoint: POST /api/rental-agreements
 *
 * Backend RentalAgreementRequest fields:
 * - applicationId: Long (@NotNull)
 * - moveInDate: ISO local date (optional; defaults to the application's preferred date)
 * - dueDay: Integer (1-31, optional)
 * - noticePeriodDays: Integer (>= 0, optional)
 * - termsAndConditions: String (optional)
 *
 * (Note: Unit, tenant, rent, security deposit, start/end dates are
 * automatically derived by the backend from the approved Rental Application)
 *
 * @param {Object} payload
 * @returns {Promise<Object>} RentalAgreementResponse
 */
export const createAgreement = async (payload) => {
  const requestBody = {
    applicationId: Number(payload.applicationId),
    moveInDate: payload.moveInDate || undefined,
    dueDay:
      payload.dueDay != null && payload.dueDay !== ''
        ? Number(payload.dueDay)
        : undefined,
    noticePeriodDays:
      payload.noticePeriodDays != null && payload.noticePeriodDays !== ''
        ? Number(payload.noticePeriodDays)
        : undefined,
    termsAndConditions:
      payload.termsAndConditions && payload.termsAndConditions.trim()
        ? payload.termsAndConditions.trim()
        : undefined,
  }

  return await axiosClient.post('/rental-agreements', requestBody)
}

/**
 * Update the status of an existing rental agreement
 * Endpoint: PATCH /api/rental-agreements/{agreementId}/status?status={status}
 *
 * @param {number|string} agreementId
 * @param {'DRAFT'|'ACTIVE'|'EXPIRED'|'TERMINATED'} status
 * @returns {Promise<Object>} RentalAgreementResponse
 */
export const updateAgreementStatus = async (agreementId, status) => {
  return await axiosClient.patch(
    `/rental-agreements/${agreementId}/status`,
    null,
    {
      params: { status },
    }
  )
}

/**
 * Update the move-out date of an existing rental agreement
 * Endpoint: PATCH /api/rental-agreements/{agreementId}/move-out?moveOutDate={moveOutDate}
 *
 * @param {number|string} agreementId
 * @param {string} moveOutDate YYYY-MM-DD
 * @returns {Promise<Object>} RentalAgreementResponse
 */
export const updateAgreementMoveOut = async (agreementId, moveOutDate) => {
  return await axiosClient.patch(
    `/rental-agreements/${agreementId}/move-out`,
    null,
    {
      params: { moveOutDate },
    }
  )
}

/**
 * Upload a document (PDF) for an existing rental agreement if backend supports it
 * Endpoint: POST /api/rental-agreements/{agreementId}/document
 *
 * @param {number|string} agreementId
 * @param {File} file
 * @returns {Promise<Object>} RentalAgreementResponse
 */
export const uploadAgreementDocument = async (agreementId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return await axiosClient.post(
    `/rental-agreements/${agreementId}/document`,
    formData
  )
}

/**
 * View inline PDF document for an existing rental agreement
 * Endpoint: GET /api/rental-agreements/{agreementId}/document
 *
 * @param {number|string} agreementId
 * @returns {Promise<Blob>}
 */
export const getAgreementDocument = async (agreementId) => {
  return await axiosClient.get(`/rental-agreements/${agreementId}/document`, {
    responseType: 'blob',
  })
}

/**
 * Download attachment PDF document for an existing rental agreement
 * Endpoint: GET /api/rental-agreements/{agreementId}/document/download
 *
 * @param {number|string} agreementId
 * @returns {Promise<Blob>}
 */
export const downloadAgreementDocument = async (agreementId) => {
  return await axiosClient.get(
    `/rental-agreements/${agreementId}/document/download`,
    {
      responseType: 'blob',
    }
  )
}
