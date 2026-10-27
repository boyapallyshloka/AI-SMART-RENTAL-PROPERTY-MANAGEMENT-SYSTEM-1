import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthLayout from '../../layouts/AuthLayout'
import { Button, Input } from '../../components/ui'
import { getDashboardPath, ROLES, normalizeRole } from '../../utils/roles'
import { Eye, EyeOff, Lock, Mail, LogIn } from 'lucide-react'
/**
 * Validates whether a saved redirect destination path is authorized for the given role.
 * Prevents cross-role navigation leakage (e.g. manager redirected to owner routes).
 *
 * @param {string} pathname
 * @param {string} role
 * @returns {boolean}
 */
const isDestinationValidForRole = (pathname, role) => {
  if (!pathname || typeof pathname !== 'string') return false
  const canonicalRole = normalizeRole(role)

  // Disallow root, login, or public auth pages as valid destinations
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return false
  }

  if (pathname === '/properties' || /^\/properties\/[^/]+$/.test(pathname)) {
    return true
  }

  if (canonicalRole === ROLES.PROPERTY_MANAGER) {
    return pathname.startsWith('/manager/') || pathname === '/manager'
  }
  if (canonicalRole === ROLES.PROPERTY_OWNER) {
    return pathname.startsWith('/owner/') || pathname === '/owner'
  }
  if (canonicalRole === ROLES.TENANT) {
    return pathname.startsWith('/tenant/') || pathname === '/tenant'
  }
  if (canonicalRole === ROLES.SUPER_ADMIN) {
    return pathname.startsWith('/admin/') || pathname === '/admin'
  }
  return false
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')

  const validate = () => {
    const errs = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email.trim()) {
      errs.email = 'Email address is required'
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address (e.g. name@example.com)'
    }

    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')

    if (!validate()) return

    setIsLoading(true)
    try {
      const result = await login(email, password)
      if (result.success) {
        const savedDestination = location.state?.from
        const savedPathname = savedDestination?.pathname

        // Only honor saved destination if it is valid for the authenticated user's role
        const destination =
          isDestinationValidForRole(savedPathname, result.user.role)
            ? `${savedPathname}${savedDestination.search || ''}${savedDestination.hash || ''}`
            : getDashboardPath(result.user.role)

        navigate(destination, { replace: true })
      } else {
        setAuthError(result.error || 'Authentication failed')
        setVerificationEmail(
          result.requiresEmailVerification ? email.trim().toLowerCase() : ''
        )
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in to SmartEstate"
      subtitle="Access your smart rental property management portal"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {authError && (
          <div
            className="p-3 rounded-md bg-[#FBF0F0] border border-[#EFC8C7] text-xs font-medium text-[#B94A48]"
            role="alert"
          >
            <p>{authError}</p>
            {verificationEmail && (
              <button
                type="button"
                className="mt-2 font-semibold text-[#315A7D] underline"
                onClick={() =>
                  navigate('/verify-email', {
                    state: { email: verificationEmail },
                  })
                }
              >
                Verify your email or resend the code
              </button>
            )}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setVerificationEmail('')
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
          }}
          error={errors.email}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
              Password
            </span>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[#315A7D] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: '' }))
                }
              }}
              error={errors.password}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-[#5B6875] hover:text-[#315A7D]"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isLoading}
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            Sign In
          </Button>

          <div className="pt-2 text-center text-xs text-[#5B6875]">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#315A7D] hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  )
}
