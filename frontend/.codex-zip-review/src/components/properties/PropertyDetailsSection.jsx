import React from 'react'
import {
  Bed,
  Bath,
  Maximize2,
  Calendar,
  CheckCircle2,
  Car,
  Sofa,
  Building,
  Building2,
  Layers,
  MapPin,
  Wifi,
  Waves,
  Dumbbell,
  Dog,
  Zap,
  Key,
  Flame,
  Coffee,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react'

// Helper to map amenity names to Lucide icons
function getAmenityIcon(amenityName = '') {
  const lower = String(amenityName).toLowerCase()
  if (lower.includes('wifi') || lower.includes('internet')) {
    return <Wifi className="w-4 h-4 text-indigo-500" />
  }
  if (lower.includes('pool') || lower.includes('swim')) {
    return <Waves className="w-4 h-4 text-cyan-500" />
  }
  if (lower.includes('fitness') || lower.includes('gym')) {
    return <Dumbbell className="w-4 h-4 text-amber-500" />
  }
  if (lower.includes('pet') || lower.includes('dog') || lower.includes('cat')) {
    return <Dog className="w-4 h-4 text-emerald-500" />
  }
  if (lower.includes('ev') || lower.includes('charging') || lower.includes('solar') || lower.includes('power')) {
    return <Zap className="w-4 h-4 text-yellow-500" />
  }
  if (lower.includes('smart') || lower.includes('keyless') || lower.includes('lock') || lower.includes('security')) {
    return <Key className="w-4 h-4 text-[#315A7D]" />
  }
  if (lower.includes('bbq') || lower.includes('fire') || lower.includes('grill') || lower.includes('kitchen')) {
    return <Flame className="w-4 h-4 text-rose-500" />
  }
  if (lower.includes('lounge') || lower.includes('coworking') || lower.includes('coffee') || lower.includes('clubhouse')) {
    return <Coffee className="w-4 h-4 text-amber-600" />
  }
  return <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" />
}

// Currency formatter matching INR specification
const formatInr = (amount) => {
  if (amount == null || isNaN(Number(amount))) return null
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Enterprise PropertyDetailsSection Component for SmartEstate
 * Displays structured real backend data:
 * - Property Overview & Specs (from details.property)
 * - Real Address (from details.address)
 * - Real Amenities (from details.amenities)
 * - Buildings -> Floors -> Units Hierarchy with Unit-level Rent, Deposit, Beds/Baths
 * - Unit Apply Action for seamless Phase 3 application workflow integration
 *
 * @param {Object} props
 * @param {Object} [props.property] - PropertyResponse
 * @param {Object} [props.address] - PropertyAddressResponse
 * @param {Array} [props.amenities] - List of AmenityResponse
 * @param {Array} [props.buildings] - List of BuildingDetailsResponse
 * @param {Function} [props.onSelectUnit] - Unit application callback
 */
export default function PropertyDetailsSection({
  property: rawProp = {},
  address: propAddress = null,
  amenities: propAmenities = null,
  buildings: propBuildings = null,
  onSelectUnit,
}) {
  // Support either normalized props or nested wrapper object
  const property = rawProp?.property || rawProp || {}
  const address = propAddress || rawProp?.address || null
  const amenities = Array.isArray(propAmenities)
    ? propAmenities
    : Array.isArray(rawProp?.amenities)
    ? rawProp.amenities
    : []
  const buildings = Array.isArray(propBuildings)
    ? propBuildings
    : Array.isArray(rawProp?.buildings)
    ? rawProp.buildings
    : []

  const {
    propertyType,
    type,
    totalArea,
    area,
    bedrooms,
    bathrooms,
    totalFloors,
    yearBuilt,
    furnishingStatus,
    furnishing,
    parkingAvailable,
    parking,
    status,
    description,
  } = property

  // Specs
  const displayType = (propertyType || type || '').replace(/_/g, ' ')
  const displayArea = totalArea ?? area
  const isDirectRental = ['HOUSE', 'VILLA'].includes(String(propertyType || type || '').toUpperCase())
  const displayFurnishing = (furnishingStatus || furnishing || '').replace(/_/g, ' ')
  const displayParking =
    parkingAvailable != null
      ? parkingAvailable
        ? 'Available'
        : 'None'
      : parking
  const displayStatus = status
    ? status === 'AVAILABLE'
      ? 'Available'
      : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  // Address fields
  const hasAddress =
    address &&
    (address.addressLine1 ||
      address.addressLine2 ||
      address.area ||
      address.city ||
      address.state ||
      address.pincode)

  return (
    <div className="space-y-8">
      {/* 1. Key Property Specifications Grid */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs">
        <h3 className="text-base font-bold text-[#243447] mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-[#315A7D]" />
          <span>Property Overview & Specifications</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayType && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#315A7D]" /> Property Type
              </span>
              <p className="text-sm font-bold text-[#243447] capitalize">
                {displayType}
              </p>
            </div>
          )}

          {displayArea != null && Number(displayArea) > 0 && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-[#315A7D]" /> Total Area
              </span>
              <p className="text-sm font-bold text-[#243447]">
                {displayArea} sq ft
              </p>
            </div>
          )}

          {isDirectRental && bedrooms != null && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Bed className="w-4 h-4 text-[#315A7D]" /> Bedrooms / BHK
              </span>
              <p className="text-sm font-bold text-[#243447]">
                {Number(bedrooms) === 0 ? 'Studio' : `${bedrooms} BHK`}
              </p>
            </div>
          )}

          {isDirectRental && bathrooms != null && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Bath className="w-4 h-4 text-[#315A7D]" /> Bathrooms
              </span>
              <p className="text-sm font-bold text-[#243447]">{bathrooms}</p>
            </div>
          )}

          {isDirectRental && totalFloors != null && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#315A7D]" /> Total Floors
              </span>
              <p className="text-sm font-bold text-[#243447]">{totalFloors}</p>
            </div>
          )}

          {displayFurnishing && displayFurnishing !== 'UNFURNISHED' && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Sofa className="w-4 h-4 text-[#315A7D]" /> Furnishing
              </span>
              <p className="text-sm font-bold text-[#243447] capitalize">
                {displayFurnishing.toLowerCase()}
              </p>
            </div>
          )}

          {displayParking && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Car className="w-4 h-4 text-[#315A7D]" /> Parking
              </span>
              <p className="text-sm font-bold text-[#243447]">
                {displayParking}
              </p>
            </div>
          )}

          {yearBuilt != null && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#315A7D]" /> Year Built
              </span>
              <p className="text-sm font-bold text-[#243447]">
                {yearBuilt}
              </p>
            </div>
          )}

          {displayStatus && (
            <div className="p-3.5 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
              <span className="text-xs text-[#5B6875] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" /> Status
              </span>
              <p className="text-sm font-bold text-[#3F7D58]">
                {displayStatus}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Address & Location Details */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs space-y-3">
        <h3 className="text-base font-bold text-[#243447] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#315A7D]" />
          <span>Location & Address</span>
        </h3>

        {hasAddress ? (
          <div className="p-4 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] space-y-2 text-xs">
            {address.addressLine1 && (
              <p className="font-semibold text-sm text-[#243447]">
                {address.addressLine1}
              </p>
            )}
            {address.addressLine2 && (
              <p className="text-[#5B6875]">{address.addressLine2}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[#5B6875]">
              {address.area && (
                <span>
                  <strong>Area:</strong> {address.area}{' '}
                  {address.areaType ? `(${address.areaType.replace(/_/g, ' ')})` : ''}
                </span>
              )}
              {address.city && (
                <span>
                  <strong>City:</strong> {address.city}
                </span>
              )}
              {address.state && (
                <span>
                  <strong>State:</strong> {address.state}
                </span>
              )}
              {address.pincode && (
                <span>
                  <strong>Pincode:</strong> {address.pincode}
                </span>
              )}
              {address.country && (
                <span>
                  <strong>Country:</strong> {address.country}
                </span>
              )}
            </div>

            {(address.latitude != null || address.longitude != null) && (
              <p className="text-[11px] text-[#5B6875] pt-1 font-mono">
                Coordinates: {address.latitude}, {address.longitude}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-md bg-[#F7F8FA] border border-dashed border-[#D9E0E6] text-xs text-[#5B6875] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#5B6875]" />
            <span>Address details are not currently available for this property.</span>
          </div>
        )}
      </div>

      {/* 3. Description Section */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs space-y-3">
        <h3 className="text-base font-bold text-[#243447]">
          About This Property
        </h3>
        <p className="text-sm text-[#5B6875] leading-relaxed">
          {description || 'No detailed description has been provided for this property listing.'}
        </p>
      </div>

      {/* 4. Real Amenities & Features */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#243447] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#315A7D]" />
            <span>Amenities & Facilities</span>
          </h3>
        </div>

        {amenities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {amenities.map((item, idx) => {
              const name = item?.amenityName || (typeof item === 'string' ? item : 'Amenity')
              const desc = item?.description
              return (
                <div
                  key={item?.amenityId || idx}
                  className="flex items-start gap-3 p-3 rounded-md border border-[#D9E0E6] bg-[#F7F8FA]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#315A7D] border border-[#D9E0E6] shadow-2xs shrink-0 mt-0.5">
                    {getAmenityIcon(name)}
                  </div>
                  <div>
                    <p className="text-xs text-[#243447] font-semibold">{name}</p>
                    {desc && <p className="text-[11px] text-[#5B6875] mt-0.5">{desc}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-4 rounded-md bg-[#F7F8FA] border border-dashed border-[#D9E0E6] text-xs text-[#5B6875] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#5B6875]" />
            <span>No specific amenities are currently recorded for this property.</span>
          </div>
        )}
      </div>

      {/* Apartment buildings use the hierarchy below; houses and villas are rented directly. */}
      {!isDirectRental && <div className="rounded-lg border border-[#D9E0E6] bg-white p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-4">
          <div>
            <h3 className="text-base font-bold text-[#243447] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#315A7D]" />
              <span>Buildings & Units</span>
            </h3>
            <p className="text-xs text-[#5B6875] mt-0.5">
              Explore building layouts, floor configurations, and apply for available units.
            </p>
          </div>
        </div>

        {buildings.length > 0 ? (
          <div className="space-y-6">
            {buildings.map((bItem, bIdx) => {
              const bld = bItem?.building || bItem || {}
              const bName = bld.buildingName || bld.name || `Building ${bIdx + 1}`
              const bDesc = bld.description
              const bFloors = Array.isArray(bItem?.floors) ? bItem.floors : []

              return (
                <div
                  key={bld.buildingId || bld.id || bIdx}
                  className="rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] p-5 space-y-4"
                >
                  {/* Building Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D9E0E6]">
                    <div>
                      <h4 className="font-bold text-sm text-[#243447] flex items-center gap-2">
                        <Building className="w-4 h-4 text-[#315A7D]" />
                        {bName}
                      </h4>
                      {bDesc && <p className="text-xs text-[#5B6875] mt-0.5">{bDesc}</p>}
                    </div>
                    {/* ONLY display totalFloors if explicitly supplied by backend BuildingResponse */}
                    {bld.totalFloors != null && (
                      <div className="flex items-center gap-2 text-xs text-[#5B6875]">
                        <span className="bg-white px-2 py-0.5 rounded border border-[#D9E0E6]">
                          {bld.totalFloors} Floors
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Floors & Units */}
                  {bFloors.length > 0 ? (
                    <div className="space-y-4">
                      {bFloors.map((fItem, fIdx) => {
                        const fl = fItem?.floor || fItem || {}
                        const fName =
                          fl.floorName ||
                          (fl.floorNumber != null ? `Floor ${fl.floorNumber}` : `Floor ${fIdx + 1}`)
                        const fUnits = Array.isArray(fItem?.units) ? fItem.units : []

                        return (
                          <div
                            key={fl.floorId || fl.id || fIdx}
                            className="bg-white rounded-md border border-[#D9E0E6] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-[#315A7D] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-[#315A7D]" />
                                {fName}
                              </h5>
                            </div>

                            {/* Units Grid */}
                            {fUnits.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                {fUnits.map((uItem, uIdx) => {
                                  const u = uItem?.unit || uItem || {}
                                  const rentFormatted = formatInr(u.monthlyRent)
                                  const depFormatted = formatInr(u.securityDeposit)
                                  const isVacant = u.status === 'VACANT' || u.status === 'AVAILABLE'

                                  return (
                                    <div
                                      key={u.unitId || u.id || uIdx}
                                      className="p-3.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] space-y-2.5 flex flex-col justify-between"
                                    >
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-sm text-[#243447]">
                                            Unit {u.unitNumber || `#${uIdx + 1}`}
                                          </span>
                                          {u.status && (
                                            <span
                                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                                isVacant
                                                  ? 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]'
                                                  : 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]'
                                              }`}
                                            >
                                              {u.status}
                                            </span>
                                          )}
                                        </div>

                                        {/* Unit-level Specs */}
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5B6875]">
                                          {u.unitType && (
                                            <span className="capitalize">{u.unitType.toLowerCase()}</span>
                                          )}
                                          {u.bedrooms != null && (
                                            <span className="flex items-center gap-1">
                                              <Bed className="w-3.5 h-3.5 text-[#315A7D]" />
                                              {u.bedrooms === 0 ? 'Studio' : `${u.bedrooms} Bed${u.bedrooms > 1 ? 's' : ''}`}
                                            </span>
                                          )}
                                          {u.bathrooms != null && (
                                            <span className="flex items-center gap-1">
                                              <Bath className="w-3.5 h-3.5 text-[#315A7D]" />
                                              {u.bathrooms} Bath{u.bathrooms > 1 ? 's' : ''}
                                            </span>
                                          )}
                                          {u.area != null && (
                                            <span className="flex items-center gap-1">
                                              <Maximize2 className="w-3.5 h-3.5 text-[#315A7D]" />
                                              {u.area} sq ft
                                            </span>
                                          )}
                                        </div>

                                        {u.description && (
                                          <p className="text-[11px] text-[#5B6875] line-clamp-2">
                                            {u.description}
                                          </p>
                                        )}
                                      </div>

                                      {/* Unit-level Pricing & Apply Action */}
                                      <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between gap-2">
                                        <div>
                                          {rentFormatted ? (
                                            <div>
                                              <span className="font-extrabold text-sm text-[#315A7D]">
                                                {rentFormatted}
                                              </span>
                                              <span className="text-[10px] text-[#5B6875]"> / mo</span>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-[#5B6875]">Rent on request</span>
                                          )}
                                          {depFormatted && (
                                            <p className="text-[10px] text-[#5B6875]">
                                              Deposit: {depFormatted}
                                            </p>
                                          )}
                                        </div>

                                        {/* Phase 3: Unit Apply Action */}
                                        {onSelectUnit && (
                                          <button
                                            type="button"
                                            onClick={() => onSelectUnit(u)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#315A7D] hover:bg-[#274B68] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
                                          >
                                            <span>Apply</span>
                                            <ArrowRight className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-[#5B6875]">
                                No units configured on this floor yet.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5B6875]">
                      No floor structures recorded for this building.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-4 rounded-md bg-[#F7F8FA] border border-dashed border-[#D9E0E6] text-xs text-[#5B6875] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#5B6875]" />
            <span>No building or unit structures are currently listed under this property.</span>
          </div>
        )}
      </div>}
    </div>
  )
}
