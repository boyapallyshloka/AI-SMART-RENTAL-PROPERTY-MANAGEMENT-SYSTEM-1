import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UserX } from 'lucide-react'
import { deactivateMyAccount } from '../../api/authApi'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function SelfServiceAccountSection() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleDeactivate = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      await deactivateMyAccount()
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to deactivate your account. Please try again.'
      )
      setIsSubmitting(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#EFC8C7] p-6 shadow-xs space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#FDF2F2] text-[#B94A48] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#111820]">Deactivate account</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5B6875]">
            Deactivation signs you out and prevents future sign-ins. Your account
            and related records are retained; this does not permanently erase data.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#B94A48]">{error}</p>
      )}

      <Button
        variant="danger"
        size="sm"
        leftIcon={<UserX className="w-3.5 h-3.5" />}
        onClick={() => setIsConfirmOpen(true)}
        disabled={isSubmitting}
      >
        Deactivate my account
      </Button>

      <DeleteConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => !isSubmitting && setIsConfirmOpen(false)}
        onConfirm={handleDeactivate}
        title="Deactivate your account?"
        message="You will be signed out and will no longer be able to sign in."
        consequenceMessage="Your account and related records will be retained. This action does not permanently erase your data."
        confirmText="Deactivate account"
        confirmIcon={<UserX className="w-3.5 h-3.5" />}
        isLoading={isSubmitting}
      />
    </section>
  )
}
