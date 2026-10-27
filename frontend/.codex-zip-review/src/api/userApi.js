import axiosClient from './axiosClient.js'
import { ROLES, normalizeRole } from '../utils/roles.js'

/**
 * User Management API Service (Spring Boot Integration)
 * Controller: UserController (/api/users)
 * Access: SUPER_ADMIN
 */

export { ROLES }

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  PENDING: 'PENDING',
}

export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
}

export const ALLOWED_UPDATE_USER_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'gender',
]

/**
 * Sanitize and format payload strictly for UpdateUserRequest DTO
 * @param {Object} data
 * @returns {Object} Clean UpdateUserRequest payload
 */
export const formatUpdateUserRequest = (data = {}) => {
  const payload = {}

  if (data.firstName !== undefined && data.firstName !== null) {
    payload.firstName = String(data.firstName).trim().slice(0, 50)
  }

  if (data.lastName !== undefined && data.lastName !== null) {
    payload.lastName = String(data.lastName).trim().slice(0, 50)
  }

  if (data.email !== undefined && data.email !== null) {
    payload.email = String(data.email).trim().toLowerCase().slice(0, 100)
  }

  if (data.phone !== undefined && data.phone !== null) {
    payload.phone = String(data.phone).trim()
  }

  if (data.gender !== undefined && data.gender !== null) {
    payload.gender = String(data.gender).toUpperCase().trim()
  }

  return payload
}

// GET /api/users (SUPER_ADMIN)
export const getAllUsers = async () => {
  return axiosClient.get('/users')
}

// GET /api/users/{id} (SUPER_ADMIN)
export const getUserById = async (id) => {
  return axiosClient.get(`/users/${id}`)
}

// GET /api/users/email?email=... (SUPER_ADMIN)
export const getUserByEmail = async (email) => {
  return axiosClient.get('/users/email', {
    params: { email: (email || '').trim().toLowerCase() },
  })
}

// PUT /api/users/{id} (SUPER_ADMIN)
export const updateUser = async (id, userData) => {
  return axiosClient.put(`/users/${id}`, formatUpdateUserRequest(userData))
}

// DELETE /api/users/{id} (SUPER_ADMIN)
export const deleteUser = async (id) => {
  return axiosClient.delete(`/users/${id}`)
}

// GET /api/users/role/{role} (SUPER_ADMIN)
export const getUsersByRole = async (role) => {
  const canonicalRole = normalizeRole(role)
  return axiosClient.get(`/users/role/${canonicalRole}`)
}

// GET /api/users/status/{status} (SUPER_ADMIN)
export const getUsersByStatus = async (status) => {
  const canonicalStatus = String(status || '').toUpperCase().trim()
  return axiosClient.get(`/users/status/${canonicalStatus}`)
}

// GET /api/users/filter?role=...&status=... (SUPER_ADMIN)
export const getUsersByRoleAndStatus = async (role, status) => {
  const canonicalRole = normalizeRole(role)
  const canonicalStatus = String(status || '').toUpperCase().trim()
  return axiosClient.get('/users/filter', {
    params: { role: canonicalRole, status: canonicalStatus },
  })
}

// PUT /api/users/{id}/status?status=... (SUPER_ADMIN)
export const updateUserStatus = async (id, status) => {
  const canonicalStatus = String(status || '').toUpperCase().trim()
  return axiosClient.put(`/users/${id}/status`, null, {
    params: { status: canonicalStatus },
  })
}

/**
 * Fetch authenticated user's profile
 * Spring Boot Endpoint: GET /api/users/me
 * Access: Authenticated users of all roles
 */
export const getMyProfile = async () => {
  return axiosClient.get('/users/me')
}

// Alias for getMyProfile
export const getCurrentUser = getMyProfile

/**
 * Maps Spring Boot UserResponse DTO to the shape expected by UI components
 * Backend fields:
 * - id -> id
 * - firstName, lastName -> firstName, lastName, name
 * - email -> email
 * - phone -> phone
 * - gender -> gender
 * - role -> role
 * - status -> status, accountStatus
 * - createdAt -> createdAt, joinDate
 * - updatedAt -> updatedAt
 */
export const mapBackendUserToUi = (user) => {
  if (!user) return null

  const firstName = user.firstName || ''
  const lastName = user.lastName || ''
  const name = `${firstName} ${lastName}`.trim() || user.email || 'Unnamed User'
  const id = user.id

  const role = user.role ?? null
  const status = user.status ?? null

  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

  const avatarText =
    ((firstName?.[0] || '') + (lastName?.[0] || '')) ||
    name.slice(0, 2) ||
    'U'

  return {
    ...user,
    id,
    name,
    firstName,
    lastName,
    email: user.email || '',
    phone: user.phone || '',
    gender: user.gender || '',
    role,
    status,
    accountStatus: status,
    verificationStatus:
      status === 'ACTIVE' ? 'Verified' : status === 'PENDING' ? 'Pending' : status,
    joinDate,
    avatarText: avatarText.toUpperCase(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export { changePassword, forgotPassword, resetPassword } from './authApi.js'


