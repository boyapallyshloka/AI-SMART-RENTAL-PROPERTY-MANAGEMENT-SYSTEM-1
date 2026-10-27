import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import ReportsAnalyticsContent from '../../components/reports/ReportsAnalyticsContent'
import { ROLES, isSuperAdmin } from '../../utils/roles'

export default function ReportsPage({ role = ROLES.PROPERTY_OWNER }) {
  const isAdmin = isSuperAdmin(role)

  return (
    <DashboardLayout
      defaultRole={role}
      activeItem="reports"
      pageTitle={isAdmin ? 'Platform Reports & Analytics' : 'Reports & Analytics'}
    >
      <div className="space-y-6">
        <header>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#243447] sm:text-3xl">
            {isAdmin ? 'Platform Reports & Analytics' : 'Portfolio Reports & Analytics'}
          </h1>
          <p className="mt-1 text-xs text-[#5B6875] sm:text-sm">
            Live financial and occupancy information returned by the SmartEstate backend.
          </p>
        </header>
        <ReportsAnalyticsContent scopeLabel={isAdmin ? 'Platform' : 'Portfolio'} role={role} />
      </div>
    </DashboardLayout>
  )
}

