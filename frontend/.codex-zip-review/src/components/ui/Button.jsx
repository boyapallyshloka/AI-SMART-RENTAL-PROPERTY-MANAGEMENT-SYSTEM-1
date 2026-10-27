import React from 'react'
import Loader from './Loader'

/**
 * Enterprise Button Component for SmartEstate
 * Standardized to the new Primary Blue #315A7D color system
 *
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'danger' | 'outline'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {boolean} [props.isLoading=false]
 * @param {React.ReactNode} [props.leftIcon]
 * @param {React.ReactNode} [props.rightIcon]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60 disabled:bg-[#EAF2F7] disabled:text-[#5B6875] disabled:border-[#D9E0E6] disabled:cursor-not-allowed disabled:pointer-events-none select-none'

  const variantStyles = {
    primary:
      'bg-[#315A7D] hover:bg-[#274B68] text-white shadow-xs focus-visible:ring-[#315A7D]',
    secondary:
      'bg-[#EAF2F7] hover:bg-[#D9E6F0] text-[#243447] border border-[#D9E0E6] shadow-xs focus-visible:ring-[#315A7D]',
    danger:
      'border border-[#B94A48] text-[#B94A48] bg-white hover:bg-[#FDF2F2] hover:border-[#9B3B39] hover:text-[#9B3B39] shadow-xs focus-visible:ring-[#B94A48]',
    outline:
      'border border-[#315A7D] text-[#315A7D] hover:bg-[#EAF2F7] bg-white shadow-xs focus-visible:ring-[#315A7D]',
  }

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  }

  const spinnerSizes = {
    sm: 'xs',
    md: 'sm',
    lg: 'md',
  }

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${
        sizeStyles[size] || sizeStyles.md
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader size={spinnerSizes[size] || 'sm'} className="text-current" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  )
}
