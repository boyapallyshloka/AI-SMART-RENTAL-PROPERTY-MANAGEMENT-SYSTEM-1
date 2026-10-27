import React, { useState } from 'react'
import { Lock, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Input, Button } from '../ui'
import { changePassword } from '../../api/authApi'

/**
 * ChangePasswordForm Component
 * Authenticated Change Password Form connected to PUT /api/auth/change-password
 *
 * @param {Object} props
 * @param {() => void} [props.onSuccess]
 */
export default function ChangePasswordForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [apiError, setApiError] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
    if (apiError) setApiError('')
    if (successMessage) setSuccessMessage('')
  }

  const toggleShow = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const validate = () => {
    const errs = {}

    if (!formData.currentPassword) {
      errs.currentPassword = 'Current password is required'
    }

    if (!formData.newPassword) {
      errs.newPassword = 'New password is required'
    } else if (formData.newPassword.length < 6) {
      errs.newPassword = 'New password must contain at least 6 characters'
    } else if (formData.currentPassword && formData.newPassword === formData.currentPassword) {
      errs.newPassword = 'New password must be different from current password'
    }

    if (!formData.confirmPassword) {
      errs.confirmPassword = 'Confirm password is required'
    } else if (formData.confirmPassword !== formData.newPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setApiError('')
    setSuccessMessage('')

    try {
      const response = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      })

      const msg = typeof response === 'string'
        ? response
        : response?.message || 'Password changed successfully.'

      setSuccessMessage(msg)
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Change password failed:', err)
      const errorText =
        err?.message ||
        err?.data?.message ||
        'Failed to change password. Please check your current password and try again.'
      setApiError(errorText)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] text-xs font-medium text-[#2A583B] flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {apiError && (
        <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs font-medium text-[#B94A48] flex items-center gap-2 shadow-2xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Current Password */}
      <div>
        <Input
          label="Current Password"
          type={showPasswords.current ? 'text' : 'password'}
          value={formData.currentPassword}
          onChange={(e) => handleChange('currentPassword', e.target.value)}
          placeholder="Enter current password"
          error={errors.currentPassword}
          disabled={isSubmitting}
          required
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => toggleShow('current')}
              className="focus:outline-none hover:text-[#243447] text-[#5B6875]"
              tabIndex={-1}
              aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
            >
              {showPasswords.current ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
        />
      </div>

      {/* New Password */}
      <div>
        <Input
          label="New Password"
          type={showPasswords.new ? 'text' : 'password'}
          value={formData.newPassword}
          onChange={(e) => handleChange('newPassword', e.target.value)}
          placeholder="Enter new password (min. 6 characters)"
          error={errors.newPassword}
          disabled={isSubmitting}
          required
          leftIcon={<KeyRound className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => toggleShow('new')}
              className="focus:outline-none hover:text-[#243447] text-[#5B6875]"
              tabIndex={-1}
              aria-label={showPasswords.new ? 'Hide password' : 'Show password'}
            >
              {showPasswords.new ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          helperText="Must contain at least 6 characters"
        />
      </div>

      {/* Confirm New Password */}
      <div>
        <Input
          label="Confirm New Password"
          type={showPasswords.confirm ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          placeholder="Re-enter new password"
          error={errors.confirmPassword}
          disabled={isSubmitting}
          required
          leftIcon={<KeyRound className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => toggleShow('confirm')}
              className="focus:outline-none hover:text-[#243447] text-[#5B6875]"
              tabIndex={-1}
              aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
            >
              {showPasswords.confirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
        />
      </div>

      {/* Form Submit Button */}
      <div className="pt-2 flex items-center justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isSubmitting}
          leftIcon={<KeyRound className="w-3.5 h-3.5" />}
        >
          Update Password
        </Button>
      </div>
    </form>
  )
}
