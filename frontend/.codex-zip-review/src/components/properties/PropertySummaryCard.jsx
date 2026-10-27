import React from 'react'
import { Building2, Users, IndianRupee, Home } from 'lucide-react'

/**
 * KPI Summary Cards for Owner Properties
 * Synchronized with real backend building, floor, and unit data.
 * 
 * Strict metrics:
 * - totalUnits = sum of actual totalUnits
 * - occupiedUnits = sum of actual occupiedUnits
 * - vacantUnits = sum of actual vacantUnits
 * - reservedUnits = sum of actual reservedUnits
 * - maintenanceUnits = sum of actual maintenanceUnits
 * - occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0
 * - monthlyRevenue = sum of monthlyRent for OCCUPIED units only
 * 
 * @param {Object} props
 * @param {Array} props.properties
 */
export default function PropertySummaryCard({ properties = [] }) {
  const totalProperties = properties.length
  const countFields = ['totalUnits', 'occupiedUnits', 'vacantUnits', 'reservedUnits', 'maintenanceUnits', 'occupiedRevenue']
  const unitMetricsAvailable = properties.length === 0 || properties.every((property) =>
    countFields.every((field) => property[field] != null && Number.isFinite(Number(property[field])))
  )
  const sumMetric = (field) => unitMetricsAvailable
    ? properties.reduce((sum, property) => sum + Number(property[field]), 0)
    : null

  const totalUnits = sumMetric('totalUnits')
  const occupiedUnits = sumMetric('occupiedUnits')
  const vacantUnits = sumMetric('vacantUnits')
  const reservedUnits = sumMetric('reservedUnits')
  const maintenanceUnits = sumMetric('maintenanceUnits')
  const monthlyRevenue = sumMetric('occupiedRevenue')
  const occupancyRate = totalUnits != null && totalUnits > 0 && occupiedUnits != null
    ? Math.round((occupiedUnits / totalUnits) * 100)
    : totalUnits === 0 ? 0 : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 1. Total Properties */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
            Portfolio Size
          </span>
          <div className="p-2.5 rounded-md bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
            {totalProperties}
          </p>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Active real estate listings
          </p>
        </div>
        <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between text-[11px] text-[#5B6875]">
          <span>Portfolio status</span>
          <span className="text-[#315A7D] font-semibold">
            {totalProperties > 0 ? 'Managed' : 'No properties'}
          </span>
        </div>
      </div>

      {/* 2. Total Units & Explicit Status Breakdown */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
            Total Units
          </span>
          <div className="p-2.5 rounded-md bg-[#EDF7EE] text-[#3F7D58] border border-[#C6DEC8]">
            <Home className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
            {totalUnits ?? '—'}
          </p>
          <p className="text-xs text-[#5B6875] mt-0.5 truncate">
            {unitMetricsAvailable ? (
              <>
                {occupiedUnits} occupied &bull; {vacantUnits} vacant
                {reservedUnits > 0 ? ` • ${reservedUnits} res.` : ''}
                {maintenanceUnits > 0 ? ` • ${maintenanceUnits} maint.` : ''}
              </>
            ) : 'Unit data unavailable'}
          </p>
        </div>
        <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between text-[11px] text-[#5B6875]">
          <span>Ready to lease</span>
          <span className="text-[#3F7D58] font-semibold">
            {vacantUnits ?? '—'} Vacant
          </span>
        </div>
      </div>

      {/* 3. Occupancy Rate */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
            Occupancy Rate
          </span>
          <div className="p-2.5 rounded-md bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
            {occupancyRate == null ? '—' : `${occupancyRate}%`}
          </p>
          {occupancyRate != null && (
            <div className="w-full bg-[#F7F8FA] border border-[#D9E0E6] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#315A7D] h-full rounded-full transition-all duration-300"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          )}
        </div>
        <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between text-[11px] text-[#5B6875]">
          <span>Target: &gt;90%</span>
          <span className="text-[#315A7D] font-semibold">
            {occupancyRate == null ? 'Unavailable' : occupancyRate >= 80 ? 'Healthy' : 'Below Target'}
          </span>
        </div>
      </div>

      {/* 4. Estimated Monthly Revenue (OCCUPIED Units Only) */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
            Est. Monthly Revenue
          </span>
          <div className="p-2.5 rounded-md bg-[#FEF7EC] text-[#B7791F] border border-[#F4E2B6]">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
            {monthlyRevenue == null ? '—' : `₹${monthlyRevenue.toLocaleString('en-IN')}`}
          </p>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Occupied unit receivables
          </p>
        </div>
        <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between text-[11px] text-[#5B6875]">
          <span>Yielding units</span>
          <span className="text-[#B7791F] font-semibold">
            {occupiedUnits ?? '—'} Occupied
          </span>
        </div>
      </div>
    </div>
  )
}
