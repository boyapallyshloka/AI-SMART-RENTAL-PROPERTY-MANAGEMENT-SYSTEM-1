import React from 'react'

/**
 * Compact role navigation item used in the floating top navigation.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {string} props.label
 * @param {boolean} [props.isActive=false]
 * @param {() => void} [props.onClick]
 * @param {string|number} [props.badge]
 */
export default function NavItem({
  icon,
  label,
  isActive = false,
  onClick,
  badge,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex min-h-10 shrink-0 items-center justify-between gap-2 rounded-full px-3.5 py-2 text-sm transition-all duration-200 select-none ${
        isActive
          ? 'bg-[#3F7D58] text-white font-semibold shadow-sm shadow-[#3F7D58]/20'
          : 'text-[#5B6875] hover:text-[#243447] hover:bg-[#EDF4ED] font-medium'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`shrink-0 transition-colors ${
            isActive
              ? 'text-white'
              : 'text-[#5B6875] group-hover:text-[#3F7D58]'
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      {badge !== undefined && (
        <span
          className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 transition-colors ${
            isActive
              ? 'bg-white/20 text-white'
              : 'bg-[#EDF4ED] text-[#5B6875]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
