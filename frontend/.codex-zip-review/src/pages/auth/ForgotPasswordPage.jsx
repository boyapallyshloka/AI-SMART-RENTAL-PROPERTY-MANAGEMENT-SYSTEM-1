import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthLayout from '../../layouts/AuthLayout'
import { Button, Input } from '../../components/ui'
import { Mail, ArrowLeft, CheckCircle2, KeyRound, AlertCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      setError('Email address is required')
      return false
    }
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setError('')
    try {
      await forgotPassword(email.trim().toLowerCase())
      setIsSubmitted(true)
    } catch (err) {
      console.error('Forgot password error:', err)
      const errorMsg =
        err?.message ||
        err?.data?.message ||
        'Unable to process password reset request. Please check your email and try again.'
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email to receive a recovery link"
    >
      {isSubmitted ? (
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-full bg-[#EDF7EE] text-[#3F7D58] mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Check your inbox
            </h2>
            <p className="text-xs text-[#5B6875] mt-1 max-w-sm mx-auto">
              If an account with{' '}
              <span className="font-semibold text-[#243447]">
                {email}
              </span>{' '}
              exists, password recovery instructions have been initiated.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <Link to="/reset-password">
              <Button variant="primary" className="w-full" leftIcon={<KeyRound className="w-4 h-4" />}>
                Proceed to Reset Password Page
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="w-full" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs font-medium text-[#B94A48] flex items-center gap-2 shadow-2xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError('')
            }}
            error={error}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isLoading}
            leftIcon={<Mail className="w-4 h-4" />}
          >
            Send Reset Link
          </Button>

          <div className="pt-2 text-center text-xs">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-medium text-[#5B6875] hover:text-[#315A7D]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
