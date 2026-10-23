import React from 'react'

/**
 * Enterprise Status Badge Configurations for SmartEstate
 * High-contrast dark text on light backgrounds:
 * - Success: #3F7D58 (text #2A583B on #EDF7EE)
 * - Warning: #B7791F (text #8A5B16 on #FEF7EC)
 * - Error: #B94A48 (text #8A2E2C on #FDF2F2)
 * - Info/Open: #315A7D (text #274B68 on #EAF2F7)
 * - Neutral: #5B6875 (text #5B6875 on #F0F4F7)
 */
const STATUS_CONFIG = {
  // Available / Active / Paid / Success / Resolved / Approved / Vacant
  vacant: {
    label: 'Vacant',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  available: {
    label: 'Available',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  active: {
    label: 'Active',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  approved: {
    label: 'Approved',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  verified: {
    label: 'Verified',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  paid: {
    label: 'Paid',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  resolved: {
    label: 'Resolved',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },
  success: {
    label: 'Success',
    badge: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
    dot: 'bg-[#3F7D58]',
  },

  // Warnings / Pending / In Review / Reserved / Maintenance
  reserved: {
    label: 'Reserved',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  maintenance: {
    label: 'Maintenance',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  pending_approval: {
    label: 'Pending Approval',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  'pending signature': {
    label: 'Pending Signature',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  'under review': {
    label: 'Under Review',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  underreview: {
    label: 'Under Review',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  warning: {
    label: 'Warning',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  'partially paid': {
    label: 'Partially Paid',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },
  partially_paid: {
    label: 'Partially Paid',
    badge: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
    dot: 'bg-[#B7791F]',
  },

  // Error / Rejected / Overdue / Failed
  rejected: {
    label: 'Rejected',
    badge: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#EFC8C7]',
    dot: 'bg-[#B94A48]',
  },
  overdue: {
    label: 'Overdue',
    badge: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#EFC8C7]',
    dot: 'bg-[#B94A48]',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#EFC8C7]',
    dot: 'bg-[#B94A48]',
  },
  error: {
    label: 'Error',
    badge: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#EFC8C7]',
    dot: 'bg-[#B94A48]',
  },

  // Info / Open / In Progress / Assigned
  open: {
    label: 'Open',
    badge: 'bg-[#EAF2F7] text-[#274B68] border-[#D9E0E6]',
    dot: 'bg-[#315A7D]',
  },
  assigned: {
    label: 'Assigned',
    badge: 'bg-[#EAF2F7] text-[#274B68] border-[#D9E0E6]',
    dot: 'bg-[#315A7D]',
  },
  'in progress': {
    label: 'In Progress',
    badge: 'bg-[#EAF2F7] text-[#274B68] border-[#D9E0E6]',
    dot: 'bg-[#315A7D]',
  },
  inprogress: {
    label: 'In Progress',
    badge: 'bg-[#EAF2F7] text-[#274B68] border-[#D9E0E6]',
    dot: 'bg-[#315A7D]',
  },

  // Neutral / Secondary / Inactive / Cancelled / Withdrawn
  occupied: {
    label: 'Occupied',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  },
  closed: {
    label: 'Closed',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  },
  withdrawn: {
    label: 'Withdrawn',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#EFC8C7]',
    dot: 'bg-[#B94A48]',
  },
  refunded: {
    label: 'Refunded',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  },
  draft: {
    label: 'Draft',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  },
}

/**
 * StatusBadge Component for SmartEstate
 * @param {Object} props
 * @param {string} props.status
 * @param {'sm' | 'md'} [props.size='md']
 * @param {boolean} [props.withDot=true]
 * @param {string} [props.className='']
 */
export default function StatusBadge({
  status = '',
  size = 'md',
  withDot = true,
  className = '',
}) {
  const normalizedKey = String(status).trim().toLowerCase()
  const config = STATUS_CONFIG[normalizedKey] || {
    label: normalizedKey ? status : '—',
    badge: 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]',
    dot: 'bg-[#5B6875]',
  }

  const sizeClasses = {
    sm: 'text-[11px] font-semibold px-2 py-0.5 gap-1.5',
    md: 'text-xs font-semibold px-2.5 py-0.5 gap-1.5',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border select-none ${
        sizeClasses[size] || sizeClasses.md
      } ${config.badge} ${className}`}
    >
      {withDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span className="capitalize">{config.label}</span>
    </span>
  )
}
