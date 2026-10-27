import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthLayout from '../../layouts/AuthLayout'
import { Button, Input, Select } from '../../components/ui'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  UserPlus,
  Building2,
  Briefcase,
  Clock,
  ShieldAlert,
  CheckCircle2,
  LogIn,
} from 'lucide-react'
import {
  ROLES,
  isTenant,
  isPropertyOwner,
  isPropertyManager,
  getDashboardPath,
} from '../../utils/roles'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('OTHER')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [role, setRole] = useState(ROLES.TENANT)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPendingApproval, setIsPendingApproval] = useState(false)
  const [registeredData, setRegisteredData] = useState(null)

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false
  })


  const validate = () => {
    const errs = {}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phoneRegex = /^[6-9]\d{9}$/


    if (!firstName.trim()) {
      errs.firstName = 'First name is required'
    }
    if (!lastName.trim()) {
      errs.lastName = 'Last name is required'
    }

    if (!email.trim()) {
      errs.email = 'Email address is required'
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address'
    }

    if (!phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!phoneRegex.test(phone.trim())) {
      errs.phone = 'Please enter a valid 10-digit Indian mobile number (starts with 6-9)'
    }

    if (!gender) {
      errs.gender = 'Gender is required'
    }

    if (!password.trim()) {
      errs.password = 'Password is required'
    } else {
      const checks = validatePassword(password)

      if (
        !checks.length ||
        !checks.uppercase ||
        !checks.lowercase ||
        !checks.number ||
        !checks.special
      ) {
        errs.password =
          'Password must contain at least 8 characters, uppercase, lowercase, number, and special character'
      }
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm password is required'
    } else if (confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validatePassword = (password) => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)

    }
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setIsLoading(true)
    try {
      const result = await register({
        firstName,
        lastName,
        email,
        phone,
        gender,
        password,
        role,
      })
      if (result.success) {
        if (result.requiresEmailVerification) {
          navigate('/verify-email', {
            replace: true,
            state: {
              email: email.trim().toLowerCase(),
              role,
              status: result.status,
              fromRegistration: true,
              resendCooldownSeconds: 60,
            },
          })
        } else if (result.isPending || result.status === 'PENDING') {
          setRegisteredData({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            gender,
            role,
          })
          setIsPendingApproval(true)
        } else {
          const destination = getDashboardPath(role)
          navigate(destination, { replace: true })
        }
      } else {
        setFormError(result.error || 'Registration failed')
      }
    } catch (err) {
      setFormError('An unexpected error occurred during registration. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  // Waiting for Approval state view for PROPERTY_OWNER
  if (isPendingApproval) {
    return (
      <AuthLayout
        title="Registration Submitted"
        subtitle="Your Property Owner account is pending administrator verification"
      >
        <div className="space-y-5">
          {/* Status Banner */}
          <div className="p-4 rounded-xl bg-[#F0F7F3] border border-[#C6DEC8] text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#EDF7EE] border border-[#C6DEC8] flex items-center justify-center mx-auto text-[#3F7D58]">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-[#243447]">
                Awaiting Administrator Approval
              </h3>
              <p className="text-xs text-[#5B6875] mt-1 max-w-sm mx-auto leading-relaxed">
                Thank you, <span className="font-semibold text-[#243447]">{registeredData
                  ? `${registeredData.firstName} ${registeredData.lastName}`
                  : `${firstName} ${lastName}`}
                </span>.
                Your property owner registration has been recorded and submitted for Super Admin review.
              </p>
            </div>
          </div>

          {/* Account Details Summary */}
          <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-2">
            <div className="flex justify-between items-center py-1 border-b border-[#D9E0E6]/60">
              <span className="text-[#5B6875]">Account Email:</span>
              <span className="font-mono font-medium text-[#243447]">{registeredData?.email || email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#D9E0E6]/60">
              <span className="text-[#5B6875]">Phone Number:</span>
              <span className="font-mono font-medium text-[#243447]">{registeredData?.phone || phone}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#D9E0E6]/60">
              <span className="text-[#5B6875]">Role Requested:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#315A7D]">
                <Building2 className="w-3.5 h-3.5" />
                Property Owner
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#5B6875]">Verification Status:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]">
                <ShieldAlert className="w-3 h-3" />
                Pending Super Admin Review
              </span>
            </div>
          </div>

          {/* Compliance & Next Steps Notice */}
          <div className="p-3 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] text-xs text-[#274B68] space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-[#243447]">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" />
              <span>What happens next?</span>
            </div>
            <p className="text-[11px] text-[#5B6875]">
              In accordance with SmartEstate enterprise security policies, property owner credentials must be verified by a Super Administrator before access to the Owner Portal is unlocked.
            </p>
          </div>

          {/* Action button */}
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => navigate('/login')}
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            Return to Sign In
          </Button>

          <div className="text-center text-xs text-[#5B6875]">
            Need immediate assistance?{' '}
            <Link to="/contact" className="font-semibold text-[#315A7D] hover:underline">
              Contact Support
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join SmartEstate as a tenant, owner, or manager"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="p-3 rounded-md bg-[#FBF0F0] border border-[#EFC8C7] text-xs font-medium text-[#B94A48]">
            {formError}
          </div>
        )}

        {/* Role Selector Tabs */}
        <div>
          <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#243447]">
            I am joining as a
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
            <button
              type="button"
              onClick={() => setRole(ROLES.TENANT)}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${isTenant(role)
                ? 'bg-white text-[#315A7D] border border-[#D9E0E6] shadow-xs'
                : 'text-[#5B6875] hover:text-[#243447]'
                }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tenant</span>
            </button>
            <button
              type="button"
              onClick={() => setRole(ROLES.PROPERTY_OWNER)}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${isPropertyOwner(role)
                ? 'bg-white text-[#315A7D] border border-[#D9E0E6] shadow-xs'
                : 'text-[#5B6875] hover:text-[#243447]'
                }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Owner</span>
            </button>
            <button
              type="button"
              onClick={() => setRole(ROLES.PROPERTY_MANAGER)}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${isPropertyManager(role)
                ? 'bg-white text-[#315A7D] border border-[#D9E0E6] shadow-xs'
                : 'text-[#5B6875] hover:text-[#243447]'
                }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Manager</span>
            </button>
          </div>
        </div>

        <Input
          label="First Name"
          placeholder="e.g.Alex"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value)
            if (errors.firstName) {
              setErrors((prev) => ({
                ...prev, firstName: ''
              }))

            }
          }}
          error={errors.firstName}
          leftIcon={<User className="w-4 h-4" />}
          required

        />
        <Input
          label="last Name"
          placeholder="e.g.mallikarjun"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value)
            if (errors.lastName) {
              setErrors((prev) => ({
                ...prev, lastName: ''
              }))
            }
          }}
          error={errors.lastName}
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
          }}
          error={errors.email}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }))
          }}
          error={errors.phone}
          leftIcon={<Phone className="w-4 h-4" />}
          required
        />

        <Select
          label="Gender"
          value={gender}
          onChange={(e) => {
            setGender(e.target.value)
            if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }))
          }}
          error={errors.gender}
          required
          options={[
            { value: 'FEMALE', label: 'Female' },
            { value: 'MALE', label: 'Male' },
            { value: 'OTHER', label: 'Other' },
            { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
          ]}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            const value = e.target.value
            setPassword(value)
            const checks = validatePassword(value)
            setPasswordChecks(checks)
            if (errors.password) {
              setErrors((prev) => ({ ...prev, password: '' }))
            }
          }}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="pointer-events-auto text-[#5B6875] hover:text-[#315A7D]"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          required
        />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className={passwordChecks.length ? 'text-green-600' : 'text-gray-500'}>
            {passwordChecks.length ? '✓' : '○'} 8+ characters
          </span>

          <span className={passwordChecks.uppercase ? 'text-green-600' : 'text-gray-500'}>
            {passwordChecks.uppercase ? '✓' : '○'} Uppercase
          </span>

          <span className={passwordChecks.lowercase ? 'text-green-600' : 'text-gray-500'}>
            {passwordChecks.lowercase ? '✓' : '○'} Lowercase
          </span>

          <span className={passwordChecks.number ? 'text-green-600' : 'text-gray-500'}>
            {passwordChecks.number ? '✓' : '○'} Number
          </span>

          <span className={passwordChecks.special ? 'text-green-600' : 'text-gray-500'}>
            {passwordChecks.special ? '✓' : '○'} Special character
          </span>
        </div>


        <Input
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => {
            const value = e.target.value
            setConfirmPassword(value)

            if (errors.confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: '' }))
            }
          }}
          error={errors.confirmPassword}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={
                showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
              }
              className="pointer-events-auto text-[#5B6875] hover:text-[#315A7D]"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          required
        />
        {confirmPassword && (
          <p
            className={
              confirmPassword === password
                ? 'text-xs text-green-600 mt-1'
                : 'text-xs text-red-500 mt-1'
            }
          >
            {confirmPassword === password
              ? '✓ Passwords match'
              : '✗ Passwords do not match'}
          </p>
        )}
        

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Create Account
        </Button>

        <div className="pt-2 text-center text-xs text-[#5B6875]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#315A7D] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
