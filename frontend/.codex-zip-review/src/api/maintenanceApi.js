import axiosClient from './axiosClient.js'

/**
 * Maintenance Requests & Predictive Analytics API Service (Spring Boot Integration)
 */

// =========================================================
// CANONICAL BACKEND ENUMS & DEFINITIONS
// =========================================================

export const MAINTENANCE_CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'AC',
  'APPLIANCE',
  'CLEANING',
  'CARPENTRY',
  'STRUCTURAL',
  'OTHER',
]

export const MAINTENANCE_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]

export const MAINTENANCE_STATUSES = [
  'OPEN',
  'ACCEPTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

// =========================================================
// HELPER MAPPING FUNCTIONS
// =========================================================

/**
 * Format category for user display (e.g. PLUMBING -> Plumbing, AC -> AC)
 */
export const formatCategoryLabel = (category) => {
  if (!category) return 'General'
  const upper = String(category).trim().toUpperCase()
  if (upper === 'AC') return 'AC / HVAC'
  return upper.charAt(0) + upper.slice(1).toLowerCase()
}

/**
 * Map user input / legacy priority string to backend enum
 */
export const mapPriorityToBackend = (priority) => {
  if (!priority) return 'MEDIUM'
  const upper = String(priority).trim().toUpperCase()
  if (upper === 'EMERGENCY' || upper === 'CRITICAL' || upper === 'URGENT') return 'URGENT'
  if (upper === 'HIGH') return 'HIGH'
  if (upper === 'LOW') return 'LOW'
  return 'MEDIUM'
}

/**
 * Map backend priority enum to display label
 */
export const formatPriorityLabel = (priority) => {
  if (!priority) return 'Medium'
  const upper = String(priority).trim().toUpperCase()
  switch (upper) {
    case 'URGENT':
      return 'Urgent'
    case 'HIGH':
      return 'High'
    case 'MEDIUM':
      return 'Medium'
    case 'LOW':
      return 'Low'
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase()
  }
}

/**
 * Priority badge styling helper
 */
export const getPriorityBadgeClass = (priority) => {
  const norm = String(priority || '').trim().toUpperCase()
  switch (norm) {
    case 'URGENT':
    case 'EMERGENCY':
      return 'bg-[#FDF2F2] text-[#8A2E2C] border-[#F4B4B4]'
    case 'HIGH':
      return 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]'
    case 'MEDIUM':
      return 'bg-[#EAF2F7] text-[#315A7D] border-[#D9E0E6]'
    case 'LOW':
    default:
      return 'bg-[#F7F8FA] text-[#5B6875] border-[#D9E0E6]'
  }
}

/**
 * Map backend status enum to display label
 */
export const formatStatusLabel = (status) => {
  if (!status) return 'Open'
  const upper = String(status).trim().toUpperCase()
  switch (upper) {
    case 'OPEN':
      return 'Open'
    case 'ACCEPTED':
      return 'Accepted'
    case 'ASSIGNED':
      return 'Assigned'
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'COMPLETED':
      return 'Resolved'
    case 'CANCELLED':
      return 'Closed'
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase()
  }
}

// =========================================================
// API CLIENT CALLS
// =========================================================

/**
 * GET /api/maintenance
 * Fetch all maintenance requests (Property Owner / Manager / Super Admin)
 */
export const getMaintenanceRequests = async (params) => {
  return axiosClient.get('/maintenance', { params })
}

/**
 * GET /api/maintenance/{id}
 * Fetch ticket details by ID (Tenant / Property Owner / Manager / Super Admin)
 */
export const getMaintenanceRequestById = async (id) => {
  return axiosClient.get(`/maintenance/${id}`)
}

/**
 * POST /api/maintenance
 * Create a new maintenance request (Tenant only)
 * Consumes: multipart/form-data
 * Expects FormData with propertyId, unitId, category, description, priority, and optional image
 */
export const createMaintenanceRequest = async (formData) => {
  return axiosClient.post('/maintenance', formData)
}

/**
 * PATCH /api/maintenance/{ticketId}/status
 * Update ticket status (Property Owner / Manager / Super Admin)
 * Body: { status: 'COMPLETED' | 'IN_PROGRESS' | ... }
 */
export const updateMaintenanceStatus = async (ticketId, status) => {
  const normalizedStatus = String(status).trim().toUpperCase()
  return axiosClient.patch(`/maintenance/${ticketId}/status`, { status: normalizedStatus })
}

/**
 * PATCH /api/maintenance/{ticketId}/cost
 * Save the repair amount and who is responsible for it.
 * Body: { cost: number, costResponsibility: 'OWNER_PAID' | 'TENANT_PAID' }
 */
export const updateMaintenanceCost = async (ticketId, costData) => {
  return axiosClient.patch(`/maintenance/${ticketId}/cost`, costData)
}

/**
 * GET /api/maintenance-workers
 * Fetch all registered maintenance technicians
 */
export const getMaintenanceWorkers = async () => {
  return axiosClient.get('/maintenance-workers')
}

/**
 * POST /api/maintenance-workers
 * Create a technician.
 */
export const createMaintenanceWorker = async (worker) => {
  return axiosClient.post('/maintenance-workers', worker)
}

/**
 * PUT /api/maintenance-workers/{workerId}
 * Update a technician.
 */
export const updateMaintenanceWorker = async (workerId, worker) => {
  return axiosClient.put(`/maintenance-workers/${workerId}`, worker)
}

/**
 * DELETE /api/maintenance-workers/{workerId}
 * Remove a technician.
 */
export const deleteMaintenanceWorker = async (workerId) => {
  return axiosClient.delete(`/maintenance-workers/${workerId}`)
}

/**
 * GET /api/maintenance-assignments
 * Fetch all technician assignments
 */
export const getMaintenanceAssignments = async () => {
  return axiosClient.get('/maintenance-assignments')
}

/**
 * POST /api/maintenance-assignments
 * Assign a worker/technician to a maintenance ticket
 * Body: {
 *   maintenanceRequest: { requestId },
 *   worker: { workerId },
 *   status: 'ASSIGNED',
 *   notes: string,
 *   estimatedCompletionDate: 'YYYY-MM-DD'
 * }
 */
export const createMaintenanceAssignment = async (assignmentData) => {
  return axiosClient.post('/maintenance-assignments', assignmentData)
}

/**
 * GET /api/maintenance/predict/{propertyId}?unitId={unitId}
 * AI Predictive Maintenance (M5 Model)
 * Returns M5PredictionResponse: next_month_maintenance_cost, next_month_maintenance_count, maintenance_risk
 */
export const predictMaintenance = async (propertyId, unitId) => {
  const query = unitId ? `?unitId=${unitId}` : ''
  return axiosClient.get(`/maintenance/predict/${propertyId}${query}`)
}

/**
 * DELETE /api/maintenance/{requestId}
 * Delete ticket by ID (Property Owner / Manager / Super Admin)
 */
export const deleteMaintenanceRequest = async (requestId) => {
  return axiosClient.delete(`/maintenance/${requestId}`)
}
