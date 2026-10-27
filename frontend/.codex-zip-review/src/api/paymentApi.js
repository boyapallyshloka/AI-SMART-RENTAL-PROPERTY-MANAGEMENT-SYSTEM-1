import axiosClient from './axiosClient'
import {
  INVOICE_STATUSES,
  getInvoices,
  getInvoiceById,
  getMyInvoices,
  createInvoice,
  getInvoiceDocumentUrl,
  downloadInvoicePdf,
} from './invoiceApi'

/**
 * Payment Statuses matching backend PaymentStatus enum
 */
export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
}

/**
 * Payment Methods matching backend PaymentMethod enum
 */
export const PAYMENT_METHODS = {
  UPI: 'UPI',
  CARD: 'CARD',
  NET_BANKING: 'NET_BANKING',
  WALLET: 'WALLET',
}

/**
 * TENANT ONLY: Create a new pending payment record for an invoice
 * Endpoint: POST /api/payments/create
 *
 * Payload matching PaymentCreateDTO:
 * {
 *   invoiceId: Long (required),
 *   amount: BigDecimal (required, min 0.01),
 *   paymentMethod: PaymentMethod (required: 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET')
 * }
 *
 * @param {Object} payload
 * @param {number|string} payload.invoiceId
 * @param {number|string} payload.amount
 * @param {string} payload.paymentMethod
 * @returns {Promise<Object>} PaymentResponse
 */
export const createPayment = async ({ invoiceId, amount, paymentMethod }) => {
  const requestBody = {
    invoiceId: Number(invoiceId),
    amount: Number(amount),
    paymentMethod: paymentMethod || PAYMENT_METHODS.UPI,
  }
  return await axiosClient.post('/payments/create', requestBody)
}

/**
 * TENANT ONLY: Create Razorpay order for an invoice
 * Endpoint: POST /api/payments/razorpay/order
 *
 * Payload:
 * {
 *   invoiceId: Long (numeric, required),
 *   amount: BigDecimal (numeric, required in rupees)
 * }
 *
 * @param {Object} payload
 * @param {number|string} payload.invoiceId
 * @param {number|string} payload.amount
 * @returns {Promise<Object>} RazorpayOrderResponseDTO { paymentId, invoiceId, orderId, amount, currency, keyId }
 */
export const createRazorpayOrder = async ({ invoiceId, amount }) => {
  const requestBody = {
    invoiceId: Number(invoiceId),
    amount: Number(amount),
  }
  return await axiosClient.post('/payments/razorpay/order', requestBody)
}

/**
 * TENANT ONLY: Verify Razorpay payment signature & complete payment
 * Endpoint: POST /api/payments/razorpay/verify
 *
 * Payload:
 * {
 *   razorpayPaymentId: String (required),
 *   razorpayOrderId: String (required),
 *   razorpaySignature: String (required)
 * }
 *
 * @param {Object} payload
 * @param {string} payload.razorpayPaymentId
 * @param {string} payload.razorpayOrderId
 * @param {string} payload.razorpaySignature
 * @returns {Promise<Object>} PaymentResponse
 */
export const verifyRazorpayPayment = async ({
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySignature,
}) => {
  const requestBody = {
    razorpayPaymentId: String(razorpayPaymentId || '').trim(),
    razorpayOrderId: String(razorpayOrderId || '').trim(),
    razorpaySignature: String(razorpaySignature || '').trim(),
  }
  return await axiosClient.post('/payments/razorpay/verify', requestBody)
}


/**
 * Retrieve a payment record by ID
 * Endpoint: GET /api/payments/{paymentId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} paymentId
 * @returns {Promise<Object>} PaymentResponse
 */
export const getPaymentById = async (paymentId) => {
  return await axiosClient.get(`/payments/${paymentId}`)
}

/**
 * Retrieve all payment records for a specific tenant
 * Endpoint: GET /api/payments/tenant/{tenantId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} tenantId
 * @returns {Promise<Array<Object>>} List of PaymentResponse
 */
export const getPaymentsByTenant = async (tenantId) => {
  return await axiosClient.get(`/payments/tenant/${tenantId}`)
}

/**
 * Retrieve all payment records for a specific invoice
 * Endpoint: GET /api/payments/invoice/{invoiceId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} invoiceId
 * @returns {Promise<Array<Object>>} List of PaymentResponse
 */
export const getPaymentsByInvoice = async (invoiceId) => {
  return await axiosClient.get(`/payments/invoice/${invoiceId}`)
}

/**
 * Retrieve receipt(s) by invoice ID
 * Endpoint: GET /api/receipts/invoice/{invoiceId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} invoiceId
 * @returns {Promise<Array<Object>|Object>} Backend ReceiptResponse data unchanged
 */
export const getReceiptByInvoiceId = async (invoiceId) => {
  return await axiosClient.get(`/receipts/invoice/${invoiceId}`)
}

export const getReceiptsByInvoice = getReceiptByInvoiceId
export const getReceiptByInvoice = getReceiptByInvoiceId

/**
 * Retrieve receipt by payment ID
 * Endpoint: GET /api/receipts/payment/{paymentId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER, TENANT
 *
 * @param {number|string} paymentId
 * @returns {Promise<Object>} Backend ReceiptResponse data unchanged
 */
export const getReceiptByPaymentId = async (paymentId) => {
  return await axiosClient.get(`/receipts/payment/${paymentId}`)
}

export const getReceiptByPayment = getReceiptByPaymentId

/**
 * Download official invoice / payment receipt PDF using authenticated request
 *
 * @param {string} invoiceDocument Path to PDF
 * @param {string} [suggestedFileName] Fallback filename
 * @returns {Promise<void>}
 */
export const downloadInvoiceReceipt = async (invoiceDocument, suggestedFileName) => {
  return await downloadInvoicePdf(invoiceDocument, suggestedFileName)
}

/**
 * AI Decision Support: Retrieve tenant payment-risk analysis
 * Endpoint: GET /api/payments/payment-risk/{tenantId}
 * Permitted roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER
 *
 * @param {number|string} tenantId - Tenant identifier
 * @returns {Promise<{
 *   success: boolean,
 *   module: string,
 *   risk_label?: number,
 *   risk_probability?: number,
 *   risk_status: string,
 *   model?: string,
 *   model_version?: string
 * }>}
 */
export const getPaymentRisk = async (tenantId) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required to retrieve payment-risk analysis.')
  }
  return await axiosClient.get(
    `/payments/payment-risk/${encodeURIComponent(tenantId)}`,
    { timeout: 60000 }
  )
}

// Re-export invoice APIs for backward compatibility and unified access
export {
  INVOICE_STATUSES,
  getInvoices,
  getInvoiceById,
  getMyInvoices,
  createInvoice,
  getInvoiceDocumentUrl,
  downloadInvoicePdf,
}
