import axios from 'axios'

/**
 * Axios Client configured for SmartEstate Spring Boot REST API
 * 
 * Base URL:
 * - VITE_API_BASE_URL environment variable
 * - Fallback: http://localhost:8080/api
 */
const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || 'http://localhost:8080/api'

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

/**
 * Request Interceptor
 * 1. Automatically attach JWT Bearer token if present in localStorage
 * 2. Do NOT force Content-Type for FormData (multipart/form-data) requests to allow automatic boundary generation
 */
axiosClient.interceptors.request.use(
  (config) => {
    // 1. Dynamic JWT attachment
    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('smartestate_token') ||
        localStorage.getItem('homesphere_token')

      if (token && token.trim()) {
        config.headers.Authorization = `Bearer ${token.trim()}`
      }
    } catch (e) {
      // Ignore storage access errors in non-browser/restricted environments
    }

    // 2. FormData / Multipart handling: allow browser/axios to set multipart boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type')
        } else {
          delete config.headers['Content-Type']
        }
      }
    } else if (config.headers && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Response Interceptor
 * Centralized error handling for:
 * - 401 Unauthorized (session expired / invalid token)
 * - 403 Forbidden (insufficient permissions / role restriction)
 * - 404 Not Found (resource missing)
 * - 500+ Server Errors (internal server error / bad gateway / unavailable)
 * - Network / Timeout errors
 */
axiosClient.interceptors.response.use(
  (response) => {
    if (response.config?.returnFullResponse) {
      return response
    }
    return response.data
  },
  (error) => {
    const status = error.response?.status
    const data = error.response?.data
    let message = data?.message
    if (!message && data?.messages && typeof data.messages === 'object') {
      message = Object.values(data.messages).join('. ')
    }
    if (!message && data?.error && typeof data.error === 'string') {
      message = data.error
    }

    switch (status) {
      case 401:
        // Unauthorized: token expired or invalid credentials
        message = 'Your session has expired. Please sign in again.'
        try {
          localStorage.removeItem('token')
          localStorage.removeItem('smartestate_token')
          localStorage.removeItem('smartestate_user')
          localStorage.removeItem('homesphere_token')
          localStorage.removeItem('homesphere_user')
        } catch (e) {
          // Ignore storage cleanup error in restricted environments
        }
        break

      case 403:
        // Forbidden: user doesn't have permission for this resource
        message = message || 'You do not have permission to access or download this resource.'
        break

      case 404:
        // Not Found
        message = message || 'The requested document or resource was not found.'
        break

      case 500:
      case 502:
      case 503:
      case 504:
        // Server Errors
        message = message || 'A server error occurred while retrieving the document. Please try again later.'
        break

      default:
        if (!error.response) {
          // Network connection or timeout error
          message = 'Unable to connect to the server. Please check your network connection.'
        } else if (!message) {
          message = error.message || 'An unexpected error occurred.'
        }
        break
    }

    const standardizedError = {
      status: status || 0,
      message,
      data,
      isNetworkError: !error.response,
      isAuthError: status === 401,
      isForbidden: status === 403,
      isNotFound: status === 404,
      isServerError: status ? status >= 500 : false,
      originalError: error,
    }

    console.error('API Error:', {
      status: standardizedError.status,
      message: standardizedError.message,
      url: error.config?.url,
    })

    return Promise.reject(standardizedError)
  }
)

export default axiosClient
