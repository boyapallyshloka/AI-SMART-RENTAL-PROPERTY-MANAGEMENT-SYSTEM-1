import React from 'react'

/**
 * Loader Component for SmartEstate
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size='md']
 * @param {string} [props.text]
 * @param {string} [props.className='']
 * @param {boolean} [props.center=false]
 */
export default function Loader({
  size = 'md',
  text,
  className = '',
  center = false,
}) {
  const sizeClasses = {
    xs: 'w-3.5 h-3.5 border-2',
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-[2.5px]',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  }

  const spinner = (
    <div
      role="status"
      aria-label={text || 'Loading'}
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <div
        className={`animate-spin rounded-full border-current border-t-transparent ${
          sizeClasses[size] || sizeClasses.md
        }`}
      />
      {text && (
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {text}
        </span>
      )}
      <span className="sr-only">{text || 'Loading...'}</span>
    </div>
  )

  if (center) {
    return (
      <div className="flex w-full items-center justify-center p-6">
        {spinner}
      </div>
    )
  }

  return spinner
}
