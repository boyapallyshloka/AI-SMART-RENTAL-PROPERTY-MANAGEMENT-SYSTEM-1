import axiosClient from './axiosClient.js'

export const PROPERTY_DOCUMENT_TYPES = {
  TITLE_DEED: 'TITLE_DEED',
  PROPERTY_TAX_RECEIPT: 'PROPERTY_TAX_RECEIPT',
  BUILDING_PERMIT: 'BUILDING_PERMIT',
  INSURANCE_POLICY: 'INSURANCE_POLICY',
  OTHER: 'OTHER',
}

export const PROPERTY_DOCUMENT_TYPE_LABELS = {
  TITLE_DEED: 'Proof of Ownership / Title Deed (Required)',
  PROPERTY_TAX_RECEIPT: 'Property Tax Receipt',
  BUILDING_PERMIT: 'Building Permit / Occupancy Certificate',
  INSURANCE_POLICY: 'Property Insurance Policy',
  OTHER: 'Other Supporting Evidence',
}

export const PROPERTY_DOCUMENT_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

// ============================================================================
// OWNER ENDPOINTS (Role: PROPERTY_OWNER)
// ============================================================================

/**
 * Upload a document for a property owned by the authenticated user.
 * @param {number|string} propertyId
 * @param {File} file
 * @param {string} documentType
 */
export const uploadPropertyDocument = async (propertyId, file, documentType) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('documentType', documentType)

  return axiosClient.post(`/owner/properties/${propertyId}/documents`, formData)
}

/**
 * Retrieve all documents for an owned property.
 * @param {number|string} propertyId
 */
export const getPropertyDocuments = async (propertyId) => {
  return axiosClient.get(`/owner/properties/${propertyId}/documents`)
}

/**
 * Retrieve a single document for an owned property.
 * @param {number|string} propertyId
 * @param {number|string} documentId
 */
export const getPropertyDocument = async (propertyId, documentId) => {
  return axiosClient.get(`/owner/properties/${propertyId}/documents/${documentId}`)
}

/**
 * Download a document file.
 * @param {number|string} propertyId
 * @param {number|string} documentId
 */
export const downloadPropertyDocument = async (propertyId, documentId) => {
  return axiosClient.get(`/owner/properties/${propertyId}/documents/${documentId}/download`, {
    responseType: 'blob',
    returnFullResponse: true,
  })
}

/**
 * Delete a pending or rejected property document.
 * @param {number|string} propertyId
 * @param {number|string} documentId
 */
export const deletePropertyDocument = async (propertyId, documentId) => {
  return axiosClient.delete(`/owner/properties/${propertyId}/documents/${documentId}`)
}

/**
 * Check publication eligibility for a property.
 * @param {number|string} propertyId
 */
export const getPropertyPublishEligibility = async (propertyId) => {
  return axiosClient.get(`/owner/properties/${propertyId}/documents/publish-eligibility`)
}

// ============================================================================
// SUPER ADMIN ENDPOINTS (Role: SUPER_ADMIN)
// ============================================================================

/**
 * List all pending property documents awaiting review.
 */
export const getPendingPropertyDocuments = async () => {
  return axiosClient.get('/admin/property-documents/pending')
}

/**
 * List all documents for a specific property (for admin inspection).
 * @param {number|string} propertyId
 */
export const getPropertyDocumentsForAdmin = async (propertyId) => {
  return axiosClient.get(`/admin/property-documents/property/${propertyId}`)
}

/**
 * Approve a property document.
 * @param {number|string} documentId
 */
export const approvePropertyDocument = async (documentId) => {
  return axiosClient.patch(`/admin/property-documents/${documentId}/approve`)
}

/**
 * Reject a property document with a mandatory reason.
 * @param {number|string} documentId
 * @param {string} reason
 */
export const rejectPropertyDocument = async (documentId, reason) => {
  return axiosClient.patch(`/admin/property-documents/${documentId}/reject`, { reason })
}

/**
 * Download / view a document file as admin.
 * @param {number|string} documentId
 */
export const downloadPropertyDocumentForAdmin = async (documentId) => {
  return axiosClient.get(`/admin/property-documents/${documentId}/download`, {
    responseType: 'blob',
    returnFullResponse: true,
  })
}
