import React from 'react'
import { FolderOpen } from 'lucide-react'
import Button from './Button'

/**
 * Enterprise EmptyState Component for SmartEstate
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {React.ReactNode | { label: string, onClick: () => void, variant?: 'primary'|'secondary'|'danger'|'outline', icon?: React.ReactNode }} [props.action]
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className='']
 */
export default function EmptyState({
  title,
  message,
  action,
  icon,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-lg border border-dashed border-[#D9E0E6] bg-white transition-colors ${className}`}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] text-[#315A7D] mb-3">
        {icon || <FolderOpen className="w-6 h-6" aria-hidden="true" />}
      </div>

      <h3 className="text-base font-semibold text-[#243447] mb-1 tracking-tight">
        {title}
      </h3>

      {message && (
        <p className="max-w-md text-sm text-[#5B6875] mb-4">
          {message}
        </p>
      )}

      {action && (
        <div className="mt-1">
          {React.isValidElement(action) ? (
            action
          ) : typeof action === 'object' && action !== null ? (
            <Button
              variant={action.variant || 'primary'}
              size="sm"
              onClick={action.onClick}
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
