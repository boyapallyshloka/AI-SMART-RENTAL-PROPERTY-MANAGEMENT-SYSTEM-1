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

const UI_TO_API_DOCUMENT_TYPE = {
  [PROPERTY_DOCUMENT_TYPES.TITLE_DEED]: 'PROPERTY_OWNERSHIP_PROOF',
  [PROPERTY_DOCUMENT_TYPES.PROPERTY_TAX_RECEIPT]: 'PROPERTY_TAX_DOCUMENT',
  [PROPERTY_DOCUMENT_TYPES.BUILDING_PERMIT]: 'PROPERTY_REGISTRATION',
  [PROPERTY_DOCUMENT_TYPES.INSURANCE_POLICY]: 'INSURANCE',
  [PROPERTY_DOCUMENT_TYPES.OTHER]: 'OTHER',
}

const API_TO_UI_DOCUMENT_TYPE = Object.fromEntries(
  Object.entries(UI_TO_API_DOCUMENT_TYPE).map(([uiType, apiType]) => [apiType, uiType])
)

const normalizePropertyDocument = (document) => {
  if (!document) return document
  const apiStatus = String(document.verificationStatus || document.status || '').toUpperCase()
  return {
    ...document,
    documentType: API_TO_UI_DOCUMENT_TYPE[document.documentType] || document.documentType,
    status: apiStatus === 'VERIFIED' ? PROPERTY_DOCUMENT_STATUSES.APPROVED : apiStatus,
  }
}

export const derivePropertyPublishEligibility = (documents = []) => {
  const ownershipProofs = documents.filter(
    (document) => document.documentType === PROPERTY_DOCUMENT_TYPES.TITLE_DEED
  )
  const eligible = ownershipProofs.some(
    (document) => document.status === PROPERTY_DOCUMENT_STATUSES.APPROVED
  )

  let reasons = []
  if (!eligible) {
    if (ownershipProofs.length === 0) {
      reasons = ['Upload proof of ownership (title deed) for administrator review.']
    } else if (ownershipProofs.some((document) => document.status === PROPERTY_DOCUMENT_STATUSES.PENDING)) {
      reasons = ['Proof of ownership is awaiting administrator review.']
    } else {
      reasons = ['An approved proof of ownership is required before listing this property.']
    }
  }

  return { eligible, reasons }
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
  formData.append('documentType', UI_TO_API_DOCUMENT_TYPE[documentType] || documentType)

  const response = await axiosClient.post(`/properties/${propertyId}/documents`, formData)
  return normalizePropertyDocument(response?.data || response)
}

/**
 * Retrieve all documents for an owned property.
 * @param {number|string} propertyId
 */
export const getPropertyDocuments = async (propertyId) => {
  const response = await axiosClient.get(`/properties/${propertyId}/documents`)
  const documents = response?.data || response
  return Array.isArray(documents) ? documents.map(normalizePropertyDocument) : documents
}

/**
 * Retrieve a single document for an owned property.
 * @param {number|string} propertyId
 * @param {number|string} documentId
 */
export const getPropertyDocument = async (propertyId, documentId) => {
  const response = await axiosClient.get(`/properties/${propertyId}/documents/${documentId}`)
  return normalizePropertyDocument(response?.data || response)
}

/**
 * Download a document file.
 * @param {number|string} propertyId
 * @param {number|string} documentId
 */
export const downloadPropertyDocument = async (propertyId, documentId) => {
  return axiosClient.get(`/properties/${propertyId}/documents/${documentId}/download`, {
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
  return axiosClient.delete(`/properties/${propertyId}/documents/${documentId}`)
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
