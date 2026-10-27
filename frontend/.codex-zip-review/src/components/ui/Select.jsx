import React, { useId } from 'react'

/**
 * Enterprise Select Component for SmartEstate
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {Array<{value: string|number, label: string, disabled?: boolean}> | Array<string>} [props.options]
 * @param {string} [props.placeholder]
 * @param {string} [props.className='']
 * @param {string} [props.id]
 */
export default function Select({
  label,
  error,
  helperText,
  options = [],
  placeholder,
  children,
  className = '',
  id,
  disabled = false,
  required = false,
  ...props
}) {
  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = `${selectId}-error`
  const helperId = `${selectId}-helper`

  return (
    <div className="w-full text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#5B6875]"
        >
          {label}
          {required && <span className="text-[#B94A48] ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-md shadow-2xs">
        <select
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`appearance-none block w-full rounded-md text-sm transition-colors border bg-white text-[#243447] pl-3 pr-8 py-2 focus:outline-none focus:ring-1 disabled:opacity-60 disabled:bg-[#F7F8FA] disabled:text-[#5B6875] disabled:cursor-not-allowed cursor-pointer ${error
              ? 'border-[#B94A48] focus:border-[#B94A48] focus:ring-[#B94A48]'
              : 'border-[#D9E0E6] hover:border-[#5B6875] focus:border-[#315A7D] focus:ring-[#315A7D]'
            } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}

          {options.length > 0
            ? options.map((opt, idx) => {
              const isObj = typeof opt === 'object' && opt !== null
              const value = isObj ? opt.value : opt
              const optLabel = isObj ? opt.label : opt
              const isDisabled = isObj ? opt.disabled : false

              return (
                <option key={idx} value={value} disabled={isDisabled}>
                  {optLabel}
                </option>
              )
            })
            : children}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#5B6875]">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
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
