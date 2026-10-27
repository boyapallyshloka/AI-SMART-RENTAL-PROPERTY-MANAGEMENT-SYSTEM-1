import React, { createContext, useContext, useState, useEffect } from 'react'
import * as authApi from '../api/authApi.js'
import { normalizeRole, getRoleLabel } from '../utils/roles.js'

const STORAGE_KEY = 'smartestate_user'
const LEGACY_STORAGE_KEY = 'homesphere_user'
const LEGACY_MOCK_USER_KEY = 'homesphere_mock_user'
const LEGACY_TOKEN_KEY = 'homesphere_token'
const TOKEN_KEY = 'smartestate_token'
const GENERIC_TOKEN_KEY = 'token'
const LEGACY_MOCK_STORAGE_KEYS = [
  'homesphere_pending_registrations',
  'homesphere_mock_buildings',
  'homesphere_mock_floors',
  'homesphere_mock_units',
  'homesphere_maintenance',
]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Remove persisted fixtures from older frontend-only demo flows, then restore
  // only a session that contains a real backend token.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MOCK_USER_KEY)
      LEGACY_MOCK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))

      const previousUser = localStorage.getItem(LEGACY_STORAGE_KEY)
      const previousToken = localStorage.getItem(LEGACY_TOKEN_KEY)
      if (previousUser && !localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, previousUser)
      }
      if (previousToken && !localStorage.getItem(TOKEN_KEY) && !previousToken.startsWith('mock_jwt_')) {
        localStorage.setItem(TOKEN_KEY, previousToken)
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.removeItem(LEGACY_TOKEN_KEY)

      for (const key of [TOKEN_KEY, GENERIC_TOKEN_KEY]) {
        if (localStorage.getItem(key)?.startsWith('mock_jwt_')) {
          localStorage.removeItem(key)
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      const stored = localStorage.getItem(STORAGE_KEY)
      const storedToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(GENERIC_TOKEN_KEY)

      if (stored && storedToken) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.role) {
          const canonical = normalizeRole(parsed.role)
          if (parsed.role !== canonical) {
            parsed.role = canonical
            parsed.roleLabel = getRoleLabel(canonical)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          }
        }
        setUser(parsed)
        setToken(storedToken)
      } else if (stored && !storedToken) {
        // Incomplete session without token: purge invalid session
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.error('Failed to parse stored session from localStorage', e)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Log in user via authApi gateway
   * @param {string} email
   * @param {string} password
   */
  const login = async (email, password) => {
    setError(null)
    const result = await authApi.login({ email, password })

    if (result.success) {
      setUser(result.user)
      if (result.token) {
        setToken(result.token)
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.user))
        if (result.token) {
          localStorage.setItem(TOKEN_KEY, result.token)
          localStorage.setItem(GENERIC_TOKEN_KEY, result.token)
        }
      } catch (e) {
        console.error('Failed to save session to localStorage', e)
      }

      return { success: true, user: result.user, token: result.token }
    }

    setError(result.error)
    return result
  }

  /**
   * Register a user via authApi gateway
   * - PROPERTY_OWNER returns PENDING state (no active session created)
   * - TENANT & PROPERTY_MANAGER return ACTIVE state with real authenticated session
   * - SUPER_ADMIN is rejected
   */
  const register = async (registrationData) => {
    setError(null)
    const result = await authApi.register(registrationData)

    if (result.success) {
      if (result.requiresEmailVerification) {
        // A registered account cannot log in until the email OTP is verified.
        // Do not create or persist an authenticated session here.
        return {
          success: true,
          user: result.user,
          status: result.status,
          isPending: result.isPending || false,
          requiresEmailVerification: true,
        }
      }

      if (result.isPending || result.status === 'PENDING') {
        // Pending approval: do not create active authenticated session
        return {
          success: true,
          user: result.user,
          status: 'PENDING',
          isPending: true,
        }
      }

      // Active registration: automatically log in to acquire real backend JWT
      if (!result.token && registrationData.email && registrationData.password) {
        try {
          const loginResult = await login(registrationData.email, registrationData.password)
          if (loginResult.success) {
            return {
              success: true,
              user: loginResult.user,
              token: loginResult.token,
              status: 'ACTIVE',
              isPending: false,
            }
          }
        } catch (loginErr) {
          console.warn('Auto-login after registration failed, user must sign in manually', loginErr)
        }
      }

      // Persist a real backend session if registration returned a token.
      setUser(result.user)
      if (result.token) {
        setToken(result.token)
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.user))
        if (result.token) {
          localStorage.setItem(TOKEN_KEY, result.token)
          localStorage.setItem(GENERIC_TOKEN_KEY, result.token)
        }
      } catch (e) {
        console.error('Failed to save session to localStorage', e)
      }

      return {
        success: true,
        user: result.user,
        token: result.token,
        status: 'ACTIVE',
        isPending: false,
      }
    }

    setError(result.error)
    return result
  }

  /**
   * Log out user via authApi gateway and clear session
   */
  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setToken(null)
      setError(null)
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(LEGACY_TOKEN_KEY)
        localStorage.removeItem(GENERIC_TOKEN_KEY)
      } catch (e) {
        console.error('Failed to clear session from localStorage', e)
      }
    }
  }

  /**
   * Forgot password via authApi gateway
   */
  const forgotPassword = async (email) => {
    return authApi.forgotPassword(email)
  }

  /**
   * Reset password via authApi gateway
   * @param {string|Object} tokenOrData - { token, newPassword } or token string
   * @param {string} [maybeNewPassword]
   */
  const resetPassword = async (tokenOrData, maybeNewPassword) => {
    return authApi.resetPassword(tokenOrData, maybeNewPassword)
  }

  /**
   * Change password via authApi gateway
   * @param {Object} data - { currentPassword, newPassword }
   */
  const changePassword = async ({ currentPassword, newPassword }) => {
    return authApi.changePassword({ currentPassword, newPassword })
  }

  const verifyEmailOtp = async ({ email, otp }) => {
    return authApi.verifyEmailOtp({ email, otp })
  }

  const resendEmailOtp = async (email) => {
    return authApi.resendEmailOtp(email)
  }

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    verifyEmailOtp,
    resendEmailOtp,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>

}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
