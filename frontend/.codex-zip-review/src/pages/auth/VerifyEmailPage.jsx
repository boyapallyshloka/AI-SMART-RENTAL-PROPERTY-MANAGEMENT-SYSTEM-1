import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthLayout from '../../layouts/AuthLayout'
import { Button, Input } from '../../components/ui'
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react'

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  const { verifyEmailOtp, resendEmailOtp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(
    Math.max(0, Number(location.state?.resendCooldownSeconds) || 0)
  )

  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setTimeout(() => {
      setResendSeconds((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  const normalizedEmail = email.trim().toLowerCase()

  const handleVerify = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!normalizedEmail) {
      setError('Enter the email address used to create your account.')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit verification code from your email.')
      return
    }

    setIsVerifying(true)
    try {
      await verifyEmailOtp({ email: normalizedEmail, otp })
      setIsVerified(true)
    } catch (requestError) {
      setError(
        requestError?.message ||
          requestError?.data?.message ||
          'Email verification failed. Check the code and try again.'
      )
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setNotice('')
    if (!normalizedEmail) {
      setError('Enter your email address before requesting a new code.')
      return
    }

    setIsResending(true)
    try {
      await resendEmailOtp(normalizedEmail)
      setOtp('')
      setResendSeconds(RESEND_COOLDOWN_SECONDS)
      setNotice('A new verification code has been sent if the account is eligible.')
    } catch (requestError) {
      setError(
        requestError?.message ||
          requestError?.data?.message ||
          'Could not resend the verification code. Please try again.'
      )
    } finally {
      setIsResending(false)
    }
  }

  const accountPendingApproval =
    location.state?.fromRegistration && location.state?.status === 'PENDING'

  if (isVerified) {
    return (
      <AuthLayout
        title="Email verified"
        subtitle="Your email address has been confirmed."
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#C6DEC8] bg-[#EDF7EE] text-[#3F7D58]">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#243447]">{normalizedEmail}</p>
            {accountPendingApproval ? (
              <p className="text-sm leading-relaxed text-[#5B6875]">
                Your email is verified. Your account is still awaiting administrator approval; you can sign in after it is approved.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-[#5B6875]">
                You can now sign in with your email address and password.
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => navigate('/login', { replace: true, state: { email: normalizedEmail } })}
          >
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the six-digit code sent to your email address."
    >
      <form onSubmit={handleVerify} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] p-3 text-sm text-[#5B6875]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#315A7D]" aria-hidden="true" />
          <p>Email verification is required before your SmartEstate account can sign in.</p>
        </div>

        {error && (
          <div className="rounded-md border border-[#EFC8C7] bg-[#FBF0F0] p-3 text-xs font-medium text-[#B94A48]" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-md border border-[#C6DEC8] bg-[#EDF7EE] p-3 text-xs font-medium text-[#2A583B]" role="status">
            {notice}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setOtp('')
            setError('')
          }}
          leftIcon={<Mail className="h-4 w-4" />}
          required
        />

        <Input
          label="Six-Digit Verification Code"
          type="text"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          helperText="The code expires after 10 minutes."
          required
        />

        <Button
          type="submit"
          className="w-full"
          isLoading={isVerifying}
          disabled={!normalizedEmail || otp.length !== 6}
        >
          Verify email
        </Button>

        <div className="flex flex-col items-center gap-3 pt-1 text-center text-xs text-[#5B6875]">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendSeconds > 0 || !normalizedEmail}
            className="font-semibold text-[#315A7D] underline disabled:cursor-not-allowed disabled:text-[#98A2B3] disabled:no-underline"
          >
            {isResending
              ? 'Sending code…'
              : resendSeconds > 0
                ? `Resend code in ${resendSeconds}s`
                : 'Resend verification code'}
          </button>
          <Link to="/login" state={{ email: normalizedEmail }} className="font-medium text-[#315A7D] hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
