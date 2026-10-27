import axiosClient from './axiosClient.js'

/**
 * Tenant Documents API Service (Spring Boot Integration)
 * Base Controller: TenantDocumentController (/api/tenants)
 * Endpoints:
 * - POST   /api/tenants/me/documents
 * - GET    /api/tenants/me/documents
 * - GET    /api/tenants/me/documents/{documentId}
 * - DELETE /api/tenants/me/documents/{documentId}
 */

export const TENANT_DOCUMENT_TYPES = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  EMPLOYMENT_PROOF: 'EMPLOYMENT_PROOF',
  INCOME_PROOF: 'INCOME_PROOF',
  ADDRESS_PROOF: 'ADDRESS_PROOF',
  OTHER: 'OTHER',
}

/**
 * Upload a tenant verification document
 * Endpoint: POST /api/tenants/me/documents
 * Consumes: multipart/form-data
 *
 * @param {Object} params
 * @param {File|Blob} params.file - Actual File object from <input type="file">
 * @param {string} params.documentType - TenantDocumentType enum
 * @returns {Promise<Object>} TenantDocumentResponse
 */
export const uploadTenantDocument = async ({ file, documentType }) => {
  if (!file) {
    throw new Error('Please select a document file to upload.')
  }
  if (!documentType) {
    throw new Error('Document type is required.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('documentType', documentType)

  return axiosClient.post('/tenants/me/documents', formData, {
    params: { documentType },
  })
}

/**
 * Retrieve all documents uploaded by the authenticated tenant
 * Endpoint: GET /api/tenants/me/documents
 *
 * @returns {Promise<Array<Object>>} List of TenantDocumentResponse
 */
export const getMyTenantDocuments = async () => {
  return axiosClient.get('/tenants/me/documents')
}

/** Retrieve documents for a tenant (requires backend authorization for the caller's role). */
export const getTenantDocuments = async (tenantId) => {
  if (!tenantId) return []
  return axiosClient.get(`/tenants/${tenantId}/documents`)
}

/** Update a tenant document's review status (SUPER_ADMIN only). */
export const updateTenantDocumentVerification = async (tenantId, documentId, status) => {
  if (!tenantId || !documentId) throw new Error('Tenant and document IDs are required.')
  return axiosClient.patch(
    `/tenants/${tenantId}/documents/${documentId}/verification`,
    null,
    { params: { status } }
  )
}

/**
 * Retrieve a specific document by ID
 * Endpoint: GET /api/tenants/me/documents/{documentId}
 *
 * @param {number|string} documentId
 * @returns {Promise<Object>} TenantDocumentResponse
 */
export const getMyTenantDocument = async (documentId) => {
  return axiosClient.get(`/tenants/me/documents/${documentId}`)
}

/**
 * Delete a specific document by ID
 * Endpoint: DELETE /api/tenants/me/documents/{documentId}
 *
 * @param {number|string} documentId
 * @returns {Promise<string>}
 */
export const deleteMyTenantDocument = async (documentId) => {
  return axiosClient.delete(`/tenants/me/documents/${documentId}`)
}
