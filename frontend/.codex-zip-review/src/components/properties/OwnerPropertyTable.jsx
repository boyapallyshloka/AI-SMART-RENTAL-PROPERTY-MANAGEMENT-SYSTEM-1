import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge, Button, EmptyState, Loader } from '../ui'
import { CANONICAL_PROPERTY_STATUSES } from '../../api/propertyApi'
import {
  Eye,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Plus,
} from 'lucide-react'

/**
 * Format property type for clean presentation
 */
const formatPropertyType = (type) => {
  if (!type) return '—'
  const str = String(type)
  return str.charAt(0) + str.slice(1).toLowerCase().replace(/_/g, ' ')
}

/**
 * OwnerPropertyTable Component
 * Displays real synchronized backend property, address, building, floor, and unit data.
 * Zero mock data, zero hardcoded Unsplash images, zero false fallback values.
 * 
 * @param {Object} props
 * @param {Array} props.properties
 * @param {(id: string) => void} [props.onDelete]
 * @param {(id: string, status: string) => void} [props.onStatusChange]
 * @param {string|number|null} [props.deletingId]
 * @param {string|number|null} [props.updatingStatusId]
 */
export default function OwnerPropertyTable({
  properties = [],
  onDelete,
  onStatusChange,
  deletingId = null,
  updatingStatusId = null,
}) {
  const [imgErrors, setImgErrors] = useState({})

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No properties found"
          message="Try adjusting your search query or filter settings, or list a new property to get started."
          action={
            <Link to="/owner/properties/add">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                Add Property
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
              <th className="py-3.5 pl-6 pr-4">Property</th>
              <th className="py-3.5 px-4">Type & Layout</th>
              <th className="py-3.5 px-4">Occupancy</th>
              <th className="py-3.5 px-4">Rent</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9E0E6] text-sm">
            {properties.map((prop) => {
              const hasImage = Boolean(prop.imageUrl) && !imgErrors[prop.id]

              return (
                <tr
                  key={prop.id}
                  className="hover:bg-[#F7F8FA] transition-colors group"
                >
                  {/* Property Name, Location & Image */}
                  <td className="py-4 pl-6 pr-4 min-w-[260px]">
                    <div className="flex items-center gap-3.5">
                      {hasImage ? (
                        <img
                          src={prop.imageUrl}
                          alt={prop.name}
                          className="w-14 h-14 rounded-md object-cover shrink-0 border border-[#D9E0E6] shadow-2xs"
                          onError={() => {
                            setImgErrors((prev) => ({ ...prev, [prop.id]: true }))
                          }}
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] flex flex-col items-center justify-center text-[#8C9BA8] shrink-0"
                          title="No image available"
                        >
                          <Building2 className="w-5 h-5 text-[#8C9BA8]" />
                          <span className="text-[9px] font-medium text-[#8C9BA8] leading-none mt-1">
                            No image
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/owner/properties/${prop.id}`}
                          className="font-semibold text-[#243447] hover:text-[#315A7D] transition-colors line-clamp-1"
                        >
                          {prop.name}
                        </Link>
                        <p className="flex items-center gap-1 text-xs text-[#5B6875] mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0 text-[#5B6875]" />
                          <span className="truncate">
                            {prop.locationDisplay || 'Location not set'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Type & Specs (Bedrooms, Bathrooms, Area) */}
                  <td className="py-4 px-4 min-w-[160px]">
                    <span className="inline-block font-medium text-[#243447] text-xs px-2 py-0.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] mb-1">
                      {formatPropertyType(prop.type || prop.propertyType)}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6875]">
                      {prop.bedroomDisplay && (
                        <span className="flex items-center gap-1" title="Bedrooms">
                          <Bed className="w-3.5 h-3.5 text-[#5B6875]" /> {prop.bedroomDisplay}
                        </span>
                      )}
                      {prop.bathroomDisplay && (
                        <span className="flex items-center gap-1" title="Bathrooms">
                          <Bath className="w-3.5 h-3.5 text-[#5B6875]" /> {prop.bathroomDisplay}
                        </span>
                      )}
                      {prop.totalArea ? (
                        <span className="flex items-center gap-1" title="Total Area">
                          <Maximize2 className="w-3 h-3 text-[#5B6875]" /> {Number(prop.totalArea).toLocaleString('en-IN')} sqft
                        </span>
                      ) : null}
                      {!prop.bedroomDisplay && !prop.bathroomDisplay && !prop.totalArea && (
                        <span className="text-[11px] text-[#5B6875]/70 italic">
                          Layout not configured
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Occupancy Units & Explicit Status Breakdown */}
                  <td className="py-4 px-4 min-w-[160px]">
                    {prop.totalUnits === 0 ? (
                      <div className="text-xs text-[#5B6875]">
                        <span className="font-medium text-[#5B6875]">No units configured</span>
                        <p className="text-[11px] text-[#5B6875]/70 mt-0.5">Add units to track</p>
                      </div>
                    ) : prop.totalUnits == null || prop.occupiedUnits == null || prop.occupancyRate == null || prop.vacantUnits == null ? (
                      <div className="text-xs text-[#5B6875]">
                        <span className="font-medium text-[#5B6875]">Unit data unavailable</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-between text-xs mb-1">
                          <span className="font-semibold text-[#243447]">
                            {prop.occupiedUnits} / {prop.totalUnits} Units
                          </span>
                          <span className="text-[11px] text-[#5B6875] font-medium">
                            {prop.occupancyRate}%
                          </span>
                        </div>
                        <div className="w-full bg-[#F7F8FA] border border-[#D9E0E6] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              prop.occupancyRate >= 90
                                ? 'bg-[#3F7D58]'
                                : prop.occupancyRate >= 50
                                ? 'bg-[#315A7D]'
                                : 'bg-[#B7791F]'
                            }`}
                            style={{ width: `${prop.occupancyRate}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#5B6875] mt-1 font-medium">
                          <span>{prop.vacantUnits} vacant</span>
                          {prop.reservedUnits > 0 && <span>&bull; {prop.reservedUnits} res.</span>}
                          {prop.maintenanceUnits > 0 && <span>&bull; {prop.maintenanceUnits} maint.</span>}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Rent (Clean without duplicate "/ mo") */}
                  <td className="py-4 px-4 whitespace-nowrap min-w-[130px]">
                    {prop.rentDisplay ? (
                      <>
                        <span className="font-bold text-[#243447]">
                          {prop.rentDisplay}
                        </span>
                        <span className="text-xs text-[#5B6875] font-normal"> / mo</span>
                        {prop.depositDisplay && (
                          <p className="text-[11px] text-[#5B6875] mt-0.5">
                            {prop.depositDisplay} dep
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-[#5B6875]">
                        <span className="font-medium text-[#5B6875]">Rent not set</span>
                        <p className="text-[11px] text-[#5B6875]/70 mt-0.5">Configure in units</p>
                      </div>
                    )}
                  </td>

                  {/* Status Badge / Selector */}
                  <td className="py-4 px-4 whitespace-nowrap min-w-[140px]">
                    {onStatusChange && prop.status ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Change property status"
                          value={prop.status}
                          disabled={prop.submittedForApproval || prop.status === 'OCCUPIED' || updatingStatusId === prop.id || updatingStatusId === prop.propertyId}
                          onChange={(e) => onStatusChange(prop.id, e.target.value)}
                          className="text-xs font-semibold rounded-md border border-[#D9E0E6] bg-white text-[#243447] py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[#315A7D] cursor-pointer hover:border-[#315A7D] transition-colors disabled:opacity-60"
                        >
                          {CANONICAL_PROPERTY_STATUSES.map((st) => (
                            <option key={st} value={st} disabled={(st === 'OCCUPIED' && prop.status !== 'OCCUPIED') || (st === 'DRAFT' && prop.status !== 'DRAFT') || (prop.status === 'DRAFT' && st !== 'DRAFT')}>
                              {st === 'DRAFT' && prop.submittedForApproval
                                ? 'Pending administrator review'
                                : st === 'NOT_AVAILABLE'
                                ? 'Not available'
                                : st.charAt(0) + st.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        {(updatingStatusId === prop.id || updatingStatusId === prop.propertyId) && (
                          <Loader size="xs" />
                        )}
                      </div>
                    ) : prop.status ? (
                      <StatusBadge status={prop.status} size="sm" />
                    ) : (
                      <span className="text-xs text-[#5B6875]">Status unavailable</span>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap min-w-[140px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link to={`/owner/properties/${prop.id}`}>
                        <button
                          type="button"
                          aria-label="View property details"
                          title="View Details"
                          className="p-1.5 rounded-md text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>

                      <Link to={`/owner/properties/${prop.id}/edit`}>
                        <button
                          type="button"
                          aria-label="Edit property"
                          title="Edit Property"
                          className="p-1.5 rounded-md text-[#5B6875] hover:text-[#B7791F] hover:bg-[#FEF7EC] transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </Link>

                      {onDelete && (
                        <button
                          type="button"
                          aria-label="Delete property"
                          title="Delete Property"
                          disabled={deletingId === prop.id || deletingId === prop.propertyId}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to remove "${prop.name}" from your portfolio?`
                              )
                            ) {
                              onDelete(prop.id)
                            }
                          }}
                          className="p-1.5 rounded-md text-[#5B6875] hover:text-[#B94A48] hover:bg-[#FDF2F2] transition-colors disabled:opacity-50"
                        >
                          {deletingId === prop.id || deletingId === prop.propertyId ? (
                            <Loader size="xs" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
