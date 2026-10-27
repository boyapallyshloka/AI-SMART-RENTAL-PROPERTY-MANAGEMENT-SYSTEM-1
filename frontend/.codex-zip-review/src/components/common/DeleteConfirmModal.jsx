import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '../ui'

/**
 * Reusable Delete Confirmation Modal for SmartEstate
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title - e.g. "Delete Building"
 * @param {string} props.itemName - e.g. "Sunset Palms - Tower Alpha"
 * @param {string} [props.consequenceMessage] - e.g. "This will also permanently delete 4 floors and 8 units."
 * @param {boolean} [props.isLoading=false]
 */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Deletion',
  itemName,
  message,
  consequenceMessage,
  isLoading = false,
  confirmText = 'Delete',
  confirmVariant = 'danger',
  confirmIcon,
}) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header with Warning Icon */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FDF2F2] border border-[#EFC8C7] flex items-center justify-center text-[#B94A48] shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-base font-bold text-[#243447]">
              {title}
            </h3>
            <p className="text-xs text-[#5B6875] mt-1 leading-relaxed">
              {message ? (
                message
              ) : (
                <>
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-[#243447]">{itemName}</strong>?
                </>
              )}
            </p>
          </div>
        </div>

        {/* Consequence Alert */}
        {consequenceMessage && (
          <div className="p-3 rounded-lg bg-[#FEF7EC] border border-[#F4E2B6] text-xs text-[#8A5B16] leading-relaxed">
            <p className="font-semibold">Notice:</p>
            <p className="mt-0.5">{consequenceMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={confirmIcon || <Trash2 className="w-3.5 h-3.5" />}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
