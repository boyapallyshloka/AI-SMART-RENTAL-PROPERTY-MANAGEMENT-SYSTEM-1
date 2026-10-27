import axiosClient from './axiosClient'

/**
 * Rent Invoices API Service (Spring Boot Integration)
 * Base Controller: RentInvoiceController (/api/rent-invoices)
 */

/**
 * Canonical invoice statuses matching backend InvoiceStatus enum
 */
export const INVOICE_STATUSES = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
}

/**
 * Management roles: Retrieve all rent invoices across accessible agreements
 * Endpoint: GET /api/rent-invoices
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER
 *
 * @returns {Promise<Array<Object>>} List of RentInvoiceResponse
 */
export const getInvoices = async () => {
  return await axiosClient.get('/rent-invoices')
}

/**
 * Retrieve a single rent invoice by ID
 * Endpoint: GET /api/rent-invoices/{invoiceId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} invoiceId
 * @returns {Promise<Object>} RentInvoiceResponse
 */
export const getInvoiceById = async (invoiceId) => {
  return await axiosClient.get(`/rent-invoices/${invoiceId}`)
}

/**
 * TENANT: Retrieve all rent invoices belonging to the authenticated tenant
 * Endpoint: GET /api/rent-invoices/my
 * Permitted roles: TENANT
 *
 * @returns {Promise<Array<Object>>} List of RentInvoiceResponse
 */
export const getMyInvoices = async () => {
  return await axiosClient.get('/rent-invoices/my')
}

/**
 * Management roles: Create/generate monthly rent invoice for an ACTIVE rental agreement
 * Endpoint: POST /api/rent-invoices
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER
 *
 * Payload matching RentInvoiceRequest:
 * {
 *   agreementId: Long (required)
 * }
 *
 * @param {Object} payload
 * @param {number|string} payload.agreementId
 * @returns {Promise<Object>} RentInvoiceResponse (201 Created)
 */
export const createInvoice = async (payload) => {
  const requestBody = {
    agreementId: Number(payload.agreementId),
  }
  return await axiosClient.post('/rent-invoices', requestBody)
}

/**
 * Resolve full URL for the auto-generated invoice document PDF
 *
 * @param {string} invoiceDocument Relative or absolute document path
 * @returns {string|null}
 */
export const getInvoiceDocumentUrl = (invoiceDocument) => {
  if (!invoiceDocument) return null
  if (
    invoiceDocument.startsWith('http://') ||
    invoiceDocument.startsWith('https://')
  ) {
    return invoiceDocument
  }
  const apiBase =
    import.meta?.env?.VITE_API_BASE_URL || 'http://localhost:8080/api'
  const origin = apiBase.replace(/\/api\/?$/, '')
  const normalized = String(invoiceDocument).replace(/\\/g, '/')
  const cleanPath = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`
  return `${origin}${cleanPath}`
}

/**
 * Download the backend-generated invoice PDF using authenticated axiosClient (blob response)
 *
 * @param {string} invoiceDocument Relative or full path to the invoice PDF
 * @param {string} [suggestedFileName] Optional filename for the downloaded file
 * @returns {Promise<void>}
 */
export const downloadInvoicePdf = async (invoiceDocument, suggestedFileName) => {
  if (!invoiceDocument) {
    throw new Error('No invoice document path available')
  }

  // Resolve absolute backend URL (points to /uploads/invoices/... without /api prefix)
  const fullUrl = getInvoiceDocumentUrl(invoiceDocument)
  if (!fullUrl) {
    throw new Error('Invalid invoice document path')
  }

  // Fetch the PDF binary blob through authenticated axiosClient with Bearer JWT header
  const response = await axiosClient.get(fullUrl, {
    responseType: 'blob',
    returnFullResponse: true,
  })

  // Extract filename from Content-Disposition if present, else fallback
  let filename = suggestedFileName
  const disposition = response.headers?.['content-disposition']
  if (!filename && disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match?.[1]) {
      filename = match[1].replace(/['"]/g, '').trim()
    }
  }
  if (!filename) {
    const cleanDoc = invoiceDocument.split('?')[0].replace(/\\/g, '/')
    filename = cleanDoc.split('/').pop() || 'invoice.pdf'
  }
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename = `${filename}.pdf`
  }

  // Extract binary Blob data safely regardless of whether response is AxiosResponse or pre-unwrapped
  const rawData = response?.data !== undefined ? response.data : response
  const blob =
    rawData instanceof Blob
      ? rawData
      : new Blob([rawData], { type: 'application/pdf' })

  if (!blob || blob.size === 0) {
    throw new Error('The invoice document received from server is empty.')
  }

  // Trigger browser download via temporary object URL
  const blobUrl = window.URL.createObjectURL(blob)
  const tempLink = document.createElement('a')
  tempLink.href = blobUrl
  tempLink.setAttribute('download', filename)
  tempLink.style.display = 'none'
  document.body.appendChild(tempLink)
  tempLink.click()
  document.body.removeChild(tempLink)

  // Revoke object URL after download has started
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      // ignore revocation error
    }
  }, 1000)
}

