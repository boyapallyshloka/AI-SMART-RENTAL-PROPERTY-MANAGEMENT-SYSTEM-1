import React, { useState, useEffect } from 'react'
import { UserCheck, AlertCircle, X, Mail, Phone } from 'lucide-react'
import { getEligiblePropertyManagers, assignPropertyManager } from '../../api/propertyApi'
import { Button, Loader } from '../ui'

/**
 * Assign or Replace Property Manager Modal
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Object} props.property
 * @param {(updatedProperty: Object) => void} props.onSuccess
 */
export default function AssignPropertyManagerModal({
  isOpen,
  onClose,
  property,
  onSuccess,
}) {
  const [managers, setManagers] = useState([])
  const [isLoadingManagers, setIsLoadingManagers] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const propertyId = property?.propertyId ?? property?.id
  const isReplacing = Boolean(property?.propertyManagerId)

  // Fetch eligible managers when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedManagerId('')
      setSubmitError(null)
      setFetchError(null)
      return
    }

    let isMounted = true

    const fetchManagers = async () => {
      setIsLoadingManagers(true)
      setFetchError(null)
      try {
        const response = await getEligiblePropertyManagers()
        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : []

        if (isMounted) {
          setManagers(list)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch property managers:', err)
          const message =
            err?.response?.data?.message ||
            err?.message ||
            'Unable to load property managers. Please try again.'
          setFetchError(message)
        }
      } finally {
        if (isMounted) {
          setIsLoadingManagers(false)
        }
      }
    }

    fetchManagers()

    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const getManagerFullName = (mgr) => {
    if (!mgr) return ''
    const full = [mgr.firstName, mgr.lastName].filter(Boolean).join(' ').trim()
    return full || mgr.email || `Manager #${mgr.propertyManagerId}`
  }

  const selectedManager = managers.find(
    (m) => String(m.propertyManagerId) === String(selectedManagerId)
  )

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!propertyId || !selectedManagerId || isSubmitting) return

    // Prevent submitting the same manager that's already assigned
    if (isReplacing && String(property?.propertyManagerId) === String(selectedManagerId)) {
      setSubmitError('This manager is already assigned to this property.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await assignPropertyManager(propertyId, selectedManagerId)
      const updated = response?.data || response
      if (onSuccess) {
        onSuccess(updated)
      }
      onClose()
    } catch (err) {
      console.error('Failed to assign property manager:', err)
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to assign property manager. Please try again.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-manager-dialog-title"
    >
      <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#D9E0E6] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D] shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="assign-manager-dialog-title"
                className="text-base font-bold text-[#243447]"
              >
                {isReplacing ? 'Replace Property Manager' : 'Assign Property Manager'}
              </h2>
              <p className="text-xs text-[#5B6875]">
                Property: <strong className="text-[#243447]">{property?.name || property?.propertyName || 'Listing'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[#8C9BA8] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Manager Box if replacing */}
        {isReplacing && (
          <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6875]">
                Currently Assigned Manager
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                Active
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white border border-[#D9E0E6] flex items-center justify-center text-xs font-bold text-[#315A7D] shrink-0">
                {property?.managerName
                  ? property.managerName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'PM'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#243447] truncate">
                  {property?.managerName || 'Assigned Manager'}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#5B6875] mt-0.5">
                  {property?.managerEmail && (
                    <span className="truncate">{property.managerEmail}</span>
                  )}
                  {property?.managerPhone && (
                    <span>&bull; {property.managerPhone}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submission Error Banner */}
        {submitError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="text-red-600 hover:text-red-800 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="property-manager-select"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]"
            >
              Select Property Manager <span className="text-[#B94A48]">*</span>
            </label>

            {isLoadingManagers ? (
              <div className="py-8 flex flex-col items-center justify-center border border-[#D9E0E6] rounded-xl bg-[#F7F8FA]">
                <Loader size="sm" text="Loading property managers..." center />
              </div>
            ) : fetchError ? (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 space-y-2">
                <p>{fetchError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setFetchError(null)
                    setIsLoadingManagers(true)
                    getEligiblePropertyManagers()
                      .then((res) => {
                        const list = Array.isArray(res)
                          ? res
                          : Array.isArray(res?.data)
                          ? res.data
                          : []
                        setManagers(list)
                      })
                      .catch((e) => {
                        setFetchError(
                          e?.response?.data?.message ||
                            e?.message ||
                            'Failed to load property managers.'
                        )
                      })
                      .finally(() => setIsLoadingManagers(false))
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : managers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[#D9E0E6] bg-[#F7F8FA] text-center space-y-1">
                <p className="text-xs font-semibold text-[#243447]">
                  No Property Managers Found
                </p>
                <p className="text-[11px] text-[#5B6875]">
                  Only active users registered with the Property Manager role can be assigned.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  id="property-manager-select"
                  value={selectedManagerId}
                  onChange={(e) => {
                    setSelectedManagerId(e.target.value)
                    setSubmitError(null)
                  }}
                  disabled={isSubmitting}
                  className="w-full text-xs rounded-xl border border-[#D9E0E6] p-2.5 bg-white text-[#243447] focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] cursor-pointer disabled:opacity-60"
                  required
                >
                  <option value="">-- Select Property Manager --</option>
                  {managers.map((mgr) => {
                    const isCurrentlyAssigned =
                      property?.propertyManagerId != null &&
                      String(mgr.propertyManagerId) === String(property.propertyManagerId)
                    const name = getManagerFullName(mgr)
                    return (
                      <option
                        key={mgr.propertyManagerId}
                        value={mgr.propertyManagerId}
                        disabled={isCurrentlyAssigned}
                      >
                        {name} ({mgr.email || 'No email'}{mgr.phone ? ` • ${mgr.phone}` : ''})
                        {isCurrentlyAssigned ? ' — Currently Assigned' : ''}
                      </option>
                    )
                  })}
                </select>

                {/* Selected Manager Profile Card */}
                {selectedManager && (
                  <div className="p-3.5 rounded-xl border border-[#C6DEC8] bg-[#EDF7EE]/60 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2A583B]">
                        Selected Manager Details
                      </span>
                      <span className="text-[10px] text-[#2A583B] font-mono">
                        ID: {selectedManager.propertyManagerId}
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#3F7D58] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {getManagerFullName(selectedManager)
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5 text-xs text-[#243447]">
                        <p className="font-bold text-sm">
                          {getManagerFullName(selectedManager)}
                        </p>
                        {selectedManager.email && (
                          <p className="flex items-center gap-1.5 text-[#5B6875] truncate">
                            <Mail className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span className="truncate">{selectedManager.email}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 text-[#5B6875]">
                          <Phone className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span>
                            {selectedManager.phone || (
                              <span className="text-[#8C9BA8] italic">No phone number</span>
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                isSubmitting ||
                isLoadingManagers ||
                !selectedManagerId ||
                (isReplacing && String(property?.propertyManagerId) === String(selectedManagerId))
              }
              isLoading={isSubmitting}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              {isSubmitting
                ? isReplacing
                  ? 'Replacing...'
                  : 'Assigning...'
                : isReplacing
                ? 'Replace Manager'
                : 'Assign Manager'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
