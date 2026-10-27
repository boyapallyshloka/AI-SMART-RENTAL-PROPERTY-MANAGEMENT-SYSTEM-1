import axiosClient from './axiosClient.js'
import { ROLES, normalizeRole, getRoleLabel } from '../utils/roles.js'

/**
 * Authentication API Service Layer
 * 
 * Endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * 
 * Authentication is handled only by the Spring Boot REST backend.
 */

/**
 * Normalize Spring Boot LoginResponse DTO into frontend application user state
 * @param {Object} raw - Spring Boot LoginResponse { token, userId, firstName, lastName, email, role }
 * @returns {Object} Normalized user entity
 */
export const normalizeLoginResponse = (raw) => {
  if (!raw) return null
  const canonicalRole = normalizeRole(raw.role)
  const label = getRoleLabel(canonicalRole)
  const fullName =
    [raw.firstName, raw.lastName].filter(Boolean).join(' ') ||
    raw.name ||
    ''

  const avatarText =
    raw.avatarText ||
    ((raw.firstName?.[0] || '') + (raw.lastName?.[0] || '')) ||
    fullName.slice(0, 2)

  return {
    id: String(raw.userId || raw.id || ''),
    tenantId: raw.tenantId != null ? Number(raw.tenantId) : null,
    email: raw.email,
    name: fullName,
    firstName: raw.firstName,
    lastName: raw.lastName,
    phone: raw.phone || '',
    gender: raw.gender || '',
    role: canonicalRole,
    status: raw.status || null,
    avatarText: avatarText.toUpperCase(),
    roleLabel: label,
  }
}

/**
 * Authenticate user credentials
 * Spring Boot Endpoint: POST /api/auth/login
 * Request: LoginRequest { email, password }
 * Response: LoginResponse { token, userId, firstName, lastName, email, role }
 */
export const login = async (credentials) => {
  try {
    const payload = {
      email: (credentials?.email || '').trim().toLowerCase(),
      password: credentials?.password || '',
    }
    const data = await axiosClient.post('/auth/login', payload)
    return {
      success: true,
      token: data.token,
      user: normalizeLoginResponse(data),
      status: data.status || null,
    }
  } catch (error) {
    const backendMessage =
      error?.message || error?.data?.message || error?.data?.error || ''
    const requiresEmailVerification =
      /verify your email address before logging in/i.test(backendMessage)
    const isPending =
      backendMessage === 'Account is not active' ||
      (error.status === 403 && error.data?.isPending)

    const errorMessage = isPending
      ? 'Your account is pending administrator verification. You will be able to sign in once approved.'
      : backendMessage || 'Authentication failed'

    return {
      success: false,
      error: errorMessage,
      isPending,
      requiresEmailVerification,
    }
  }
}

/**
 * Register a new user account
 * Spring Boot Endpoint: POST /api/auth/register
 * Request: RegisterRequest { firstName, lastName, email, password, phone, gender, role }
 * Response: UserResponse { id, firstName, lastName, email, phone, gender, role, status, createdAt, updatedAt }
 */
export const register = async (userData) => {
  const canonicalRole = normalizeRole(userData.role)

  // Spring Boot Rule: SUPER_ADMIN cannot be registered through public registration
  if (canonicalRole === ROLES.SUPER_ADMIN) {
    return {
      success: false,
      error: 'Super Administrator accounts cannot be created through public registration.',
    }
  }

  // Spring Boot REST Backend via the shared authenticated axiosClient.
  try {
    const nameParts = (userData.name || '').trim().split(/\s+/)
    const firstName = (userData.firstName || nameParts[0] || '').slice(0, 50)
    const lastName = (
      userData.lastName ||
      nameParts.slice(1).join(' ') ||
      ''
    ).slice(0, 50)

    const payload = {
      firstName,
      lastName,
      email: (userData.email || '').trim().toLowerCase(),
      password: userData.password || '',
      phone: (userData.phone || '').trim(),
      gender: userData.gender || '',
      role: canonicalRole,
    }

    const data = await axiosClient.post('/auth/register', payload)
    const isPending =
      data.status === 'PENDING' || canonicalRole === ROLES.PROPERTY_OWNER

    return {
      success: true,
      user: normalizeLoginResponse(data),
      token: data.token || null,
      status: data.status || (isPending ? 'PENDING' : null),
      isPending,
      // The backend sends an OTP during registration; verification must happen
      // before this user can obtain a login token.
      requiresEmailVerification: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Registration failed',
    }
  }
}

/**
 * Verify the six-digit email OTP issued during registration.
 * Backend: POST /api/auth/verify-email-otp { email, otp }
 */
export const verifyEmailOtp = async ({ email, otp }) => {
  return axiosClient.post('/auth/verify-email-otp', {
    email: String(email || '').trim().toLowerCase(),
    otp: String(otp || '').trim(),
  })
}

/**
 * Request a new email verification OTP.
 * Backend: POST /api/auth/resend-email-otp?email={email}
 */
export const resendEmailOtp = async (email) => {
  return axiosClient.post('/auth/resend-email-otp', null, {
    params: { email: String(email || '').trim().toLowerCase() },
  })
}

/**
 * Terminate user session and remove stored credentials
 * Spring Boot backend uses stateless JWT architecture.
 */
export const logout = async () => {
  // Spring Boot uses stateless JWT authentication; clear the client session.
  localStorage.removeItem('token')
  localStorage.removeItem('smartestate_token')
  localStorage.removeItem('smartestate_user')
  localStorage.removeItem('homesphere_token')
  localStorage.removeItem('homesphere_user')
  return { success: true }
}

/**
 * Send password recovery instructions
 * Spring Boot Endpoint: POST /api/auth/forgot-password
 * Request: { email: "user@example.com" }
 * @param {string|{email: string}} emailOrData
 * @returns {Promise<any>}
 */
export const forgotPassword = async (emailOrData) => {
  const email =
    typeof emailOrData === 'object' && emailOrData !== null
      ? (emailOrData.email || '').trim().toLowerCase()
      : String(emailOrData || '').trim().toLowerCase()

  return axiosClient.post('/auth/forgot-password', { email })
}


/**
 * Reset account password using token
 * Spring Boot Endpoint: POST /api/auth/reset-password
 * Request: { token, newPassword }
 * @param {string|{token: string, newPassword?: string, password?: string}} tokenOrData
 * @param {string} [maybeNewPassword]
 * @returns {Promise<any>}
 */
export const resetPassword = async (tokenOrData, maybeNewPassword) => {
  let token = ''
  let newPassword = ''

  if (typeof tokenOrData === 'object' && tokenOrData !== null) {
    token = tokenOrData.token || ''
    newPassword = tokenOrData.newPassword || tokenOrData.password || ''
  } else {
    token = tokenOrData || ''
    newPassword = maybeNewPassword || ''
  }

  token = String(token).trim()
  newPassword = String(newPassword)

  return axiosClient.post('/auth/reset-password', {
    token,
    newPassword,
  })
}

/**
 * Change authenticated user's account password
 * Spring Boot Endpoint: PUT /api/auth/change-password
 * Request: { currentPassword, newPassword }
 * Response: String "Password changed successfully"
 */
export const changePassword = async ({ currentPassword, newPassword }) => {
  return axiosClient.put('/auth/change-password', {
    currentPassword,
    newPassword,
  })
}

/**
 * Fetch authenticated user profile
 * Spring Boot Endpoint: GET /api/users/me
 */
export const getCurrentUser = async () => {
  const data = await axiosClient.get('/users/me')
  return normalizeLoginResponse(data)
}


