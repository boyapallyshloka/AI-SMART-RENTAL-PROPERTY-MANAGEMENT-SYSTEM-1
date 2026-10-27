import axiosClient from './axiosClient.js'

/**
 * Expense API Service — SmartEstate backend
 * Controller: ExpenseController (/api/expenses)
 * Role: PROPERTY_OWNER
 *
 * Expense response fields:
 *   expenseId, propertyId, category, description, amount,
 *   expenseDate, imagePath, createdAt
 *
 * Categories (backend enum):
 *   PROPERTY_TAX, INSURANCE, ELECTRICITY_BILL, WATER_BILL, SECURITY,
 *   CLEANING_SERVICE, PROPERTY_MANAGEMENT, LEGAL_FEES, ADMINISTRATIVE,
 *   COMMON_AREA, OTHER
 */

export const EXPENSE_CATEGORIES = [
  { value: 'PROPERTY_TAX', label: 'Property Tax' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill' },
  { value: 'WATER_BILL', label: 'Water Bill' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'CLEANING_SERVICE', label: 'Cleaning Service' },
  { value: 'PROPERTY_MANAGEMENT', label: 'Property Management' },
  { value: 'LEGAL_FEES', label: 'Legal Fees' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'OTHER', label: 'Other' },
]

/**
 * POST /api/expenses
 * Create a new expense using multipart/form-data.
 * Required fields: propertyId, category, amount, expenseDate
 * Optional fields: description, image (File)
 *
 * The axiosClient interceptor automatically removes Content-Type for FormData
 * so the browser sets the correct multipart boundary.
 *
 * @param {{ propertyId: number|string, category: string, amount: number|string, expenseDate: string, description?: string, image?: File }} data
 */
export const createExpense = async (data) => {
  const formData = new FormData()
  formData.append('propertyId', data.propertyId)
  formData.append('category', data.category)
  formData.append('amount', data.amount)
  formData.append('expenseDate', data.expenseDate)
  if (data.description && String(data.description).trim()) {
    formData.append('description', String(data.description).trim())
  }
  if (data.image instanceof File) {
    formData.append('image', data.image)
  }
  return axiosClient.post('/expenses', formData)
}

/**
 * GET /api/expenses/property/{propertyId}
 * Retrieve all expenses for a specific property.
 *
 * @param {number|string} propertyId
 * @param {{ signal?: AbortSignal }} [options]
 */
export const getExpensesByProperty = async (propertyId, { signal } = {}) => {
  return axiosClient.get(`/expenses/property/${propertyId}`, { signal })
}

/**
 * GET /api/expenses/{expenseId}
 * Retrieve a single expense by ID.
 *
 * @param {number|string} expenseId
 */
export const getExpenseById = async (expenseId) => {
  return axiosClient.get(`/expenses/${expenseId}`)
}

/**
 * PUT /api/expenses/{expenseId}
 * Update an existing expense (JSON body).
 * Send only the fields you want to update.
 *
 * @param {number|string} expenseId
 * @param {{ category?: string, amount?: number|string, expenseDate?: string, description?: string }} data
 */
export const updateExpense = async (expenseId, data) => {
  const payload = {}
  if (data.category !== undefined) payload.category = data.category
  if (data.amount !== undefined) payload.amount = Number(data.amount)
  if (data.expenseDate !== undefined) payload.expenseDate = data.expenseDate
  if (data.description !== undefined)
    payload.description = data.description ? String(data.description).trim() : null
  return axiosClient.put(`/expenses/${expenseId}`, payload)
}

/**
 * DELETE /api/expenses/{expenseId}
 * Delete an expense by ID.
 *
 * @param {number|string} expenseId
 */
export const deleteExpense = async (expenseId) => {
  return axiosClient.delete(`/expenses/${expenseId}`)
}

/**
 * POST /api/expenses/{expenseId}/receipt
 * Generate a PDF receipt for an expense.
 *
 * @param {number|string} expenseId
 */
export const generateReceipt = async (expenseId) => {
  return axiosClient.post(`/expenses/${expenseId}/receipt`)
}

/**
 * GET /api/expenses/{expenseId}/receipt
 * Download the PDF receipt for an expense as a Blob.
 *
 * @param {number|string} expenseId
 */
export const downloadReceipt = async (expenseId) => {
  return axiosClient.get(`/expenses/${expenseId}/receipt`, {
    responseType: 'blob',
    returnFullResponse: true,
  })
}
