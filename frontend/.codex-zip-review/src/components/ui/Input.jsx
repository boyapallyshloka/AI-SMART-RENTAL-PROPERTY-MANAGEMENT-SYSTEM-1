import React, { useId } from 'react'

/**
 * Enterprise Input Component for SmartEstate
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {React.ReactNode} [props.leftIcon]
 * @param {React.ReactNode} [props.rightIcon]
 * @param {string} [props.className='']
 * @param {string} [props.id]
 */
export default function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  disabled = false,
  required = false,
  ...props
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  return (
    <div className="w-full text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]"
        >
          {label}
          {required && <span className="text-[#B94A48] ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-md shadow-2xs">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B6875]">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full rounded-md text-sm transition-colors border bg-white text-[#243447] placeholder:text-[#98A2B3] focus:outline-none focus:ring-1 disabled:opacity-60 disabled:bg-[#F7F8FA] disabled:text-[#5B6875] disabled:cursor-not-allowed ${
            leftIcon ? 'pl-9' : 'pl-3'
          } ${rightIcon ? 'pr-9' : 'pr-3'} py-2 ${
            error
              ? 'border-[#B94A48] focus:border-[#B94A48] focus:ring-[#B94A48]'
              : 'border-[#D9E0E6] hover:border-[#5B6875] focus:border-[#315A7D] focus:ring-[#315A7D]'
          } ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#5B6875]">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-[#B94A48]" role="alert">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={helperId} className="mt-1.5 text-xs text-[#5B6875]">
          {helperText}
        </p>
      )}
    </div>
  )
}
