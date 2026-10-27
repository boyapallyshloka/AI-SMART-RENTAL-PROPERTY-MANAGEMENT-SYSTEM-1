import React from 'react'

/**
 * Enterprise NavItem component for Sidebar navigation
 * Styled with Primary Blue #315A7D and Light Blue #EAF2F7
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
      className={`group w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors duration-150 select-none text-left ${
        isActive
          ? 'bg-[#EAF2F7] text-[#315A7D] font-semibold border-l-3 border-[#315A7D]'
          : 'text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7]/60 font-medium'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`shrink-0 transition-colors ${
            isActive
              ? 'text-[#315A7D]'
              : 'text-[#5B6875] group-hover:text-[#243447]'
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
              ? 'bg-[#315A7D] text-white'
              : 'bg-[#EAF2F7] text-[#5B6875]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
