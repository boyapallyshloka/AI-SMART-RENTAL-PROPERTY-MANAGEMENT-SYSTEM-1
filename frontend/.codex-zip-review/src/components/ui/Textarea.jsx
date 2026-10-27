import React, { useId } from 'react'

/**
 * Enterprise Textarea Component for SmartEstate
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {number} [props.rows=3]
 * @param {string} [props.className='']
 * @param {string} [props.id]
 */
export default function Textarea({
  label,
  error,
  helperText,
  rows = 3,
  className = '',
  id,
  disabled = false,
  required = false,
  ...props
}) {
  const generatedId = useId()
  const textareaId = id || generatedId
  const errorId = `${textareaId}-error`
  const helperId = `${textareaId}-helper`

  return (
    <div className="w-full text-left">
      {label && (
        <label
          htmlFor={textareaId}
          className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]"
        >
          {label}
          {required && <span className="text-[#B94A48] ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-md shadow-2xs">
        <textarea
          id={textareaId}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full rounded-md text-sm transition-colors border bg-white text-[#243447] placeholder:text-[#98A2B3] p-3 focus:outline-none focus:ring-1 disabled:opacity-60 disabled:bg-[#F7F8FA] disabled:text-[#5B6875] disabled:cursor-not-allowed ${
            error
              ? 'border-[#B94A48] focus:border-[#B94A48] focus:ring-[#B94A48]'
              : 'border-[#D9E0E6] hover:border-[#5B6875] focus:border-[#315A7D] focus:ring-[#315A7D]'
          } ${className}`}
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-[#B94A48]">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1 text-xs text-[#5B6875]">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
