import React, { useState } from 'react'
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Building2,
  MapPin,
  IndianRupee,
  Bed,
  Sofa,
  Car,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
export const filterOptions = {
  propertyTypes: [
    { value: 'All Types', label: 'All Types' },
    { value: 'APARTMENT', label: 'Apartment' },
    { value: 'HOUSE', label: 'Independent House' },
    { value: 'VILLA', label: 'Villa' },
    { value: 'PG', label: 'Paying Guest (PG)' },
    { value: 'HOSTEL', label: 'Hostel' },
    { value: 'COMMERCIAL', label: 'Commercial Space' },
  ],
  bedrooms: [
    { label: 'Any Beds', value: 'all' },
    { label: 'Studio (0)', value: '0' },
    { label: '1 Bed', value: '1' },
    { label: '2 Beds', value: '2' },
    { label: '3 Beds', value: '3' },
    { label: '4 Beds', value: '4' },
  ],
  furnishing: ['All Furnishing', 'Furnished', 'Semi-Furnished', 'Unfurnished'],
  parking: ['All Parking', 'Parking Available'],
  priceRanges: [
    { label: 'Any Budget', min: 0, max: Infinity },
    { label: 'Under ₹2,000', min: 0, max: 2000 },
    { label: '₹2,000 - ₹3,000', min: 2000, max: 3000 },
    { label: '₹3,000 - ₹4,000', min: 3000, max: 4000 },
    { label: '₹4,000+', min: 4000, max: Infinity },
  ],
}

/**
 * Enterprise PropertyFilter Component for SmartEstate
 * Provides comprehensive filtering controls for tenants browsing properties.
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFilterChange - Callback when any filter changes
 * @param {Function} props.onResetFilters - Callback to reset all filters
 * @param {number} props.totalResults - Number of matched properties
 */
export default function PropertyFilter({
  filters = {},
  onFilterChange,
  onResetFilters,
  totalResults,
  availableCities = [],
  showAiMatchFilter = true,
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const cityOptions = [...new Set(availableCities
    .map((city) => String(city || '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const selectedCity = filters.city || 'All Locations'
  if (selectedCity !== 'All Locations' && !cityOptions.includes(selectedCity)) {
    cityOptions.unshift(selectedCity)
  }

  // Calculate number of active filters (excluding defaults)
  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (!val) return false
    if (key === 'city' && val === 'All Locations') return false
    if (key === 'propertyType' && val === 'All Types') return false
    if (key === 'bedrooms' && val === 'all') return false
    if (key === 'furnishing' && val === 'All Furnishing') return false
    if (key === 'parking' && val === 'All Parking') return false
    if (key === 'minAiScore' && Number(val) === 0) return false
    return true
  }).length

  const handleTextChange = (e) => {
    onFilterChange({ ...filters, searchQuery: e.target.value })
  }

  const handleFieldChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value })
  }

  const clearSearch = () => {
    onFilterChange({ ...filters, searchQuery: '' })
  }

  return (
    <div className="space-y-4">
      {/* Primary Search & Quick Filter Bar */}
      <div className="rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Query Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6875]" />
            <input
              type="text"
              aria-label="Search properties"
              value={filters.searchQuery || ''}
              onChange={handleTextChange}
              placeholder="Search by neighborhood, city, or property name..."
              className="w-full pl-9 pr-9 py-2 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-[#243447] text-sm placeholder:text-[#5B6875]/70 focus:outline-none focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] transition-colors"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Dropdown: Location */}
          <div className="relative min-w-[160px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6875] pointer-events-none" />
            <select
              aria-label="Filter by location"
              value={filters.city || 'All Locations'}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-[#243447] text-sm focus:outline-none focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] appearance-none cursor-pointer"
            >
              <option value="All Locations">All Locations</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6875] pointer-events-none" />
          </div>

          {/* Quick Dropdown: Property Type */}
          <div className="relative min-w-[150px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6875] pointer-events-none" />
            <select
              aria-label="Filter by property type"
              value={filters.propertyType || 'All Types'}
              onChange={(e) => handleFieldChange('propertyType', e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-[#243447] text-sm focus:outline-none focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] appearance-none cursor-pointer"
            >
              {filterOptions.propertyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6875] pointer-events-none" />
          </div>

          {/* Toggle Advanced Filters Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(!isMobileOpen)
                setShowAdvanced(!showAdvanced)
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                activeCount > 0 || showAdvanced
                  ? 'border-[#315A7D] bg-[#EAF2F7] text-[#315A7D]'
                  : 'border-[#D9E0E6] bg-[#F7F8FA] text-[#5B6875] hover:bg-[#EAF2F7]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="flex items-center justify-center w-4.5 h-4.5 rounded bg-[#315A7D] text-white text-[10px] font-bold">
                  {activeCount}
                </span>
              )}
            </button>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                title="Reset all filters"
                className="p-2 rounded-md border border-[#D9E0E6] text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Advanced Filters Section */}
        <div
          className={`${
            showAdvanced || isMobileOpen ? 'block' : 'hidden'
          } pt-4 mt-4 border-t border-[#D9E0E6] transition-all`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Budget / Rent Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-[#3F7D58]" />
                Monthly Rent
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5B6875]">
                    ₹
                  </span>
                  <input
                    type="number"
                    aria-label="Minimum monthly rent"
                    min="0"
                    step="100"
                    placeholder="Min"
                    value={filters.minRent || ''}
                    onChange={(e) => handleFieldChange('minRent', e.target.value)}
                    className="w-full pl-6 pr-2 py-1.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-xs text-[#243447] focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
                  />
                </div>
                <span className="text-[#5B6875] text-xs">-</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5B6875]">
                    ₹
                  </span>
                  <input
                    type="number"
                    aria-label="Maximum monthly rent"
                    min="0"
                    step="100"
                    placeholder="Max"
                    value={filters.maxRent || ''}
                    onChange={(e) => handleFieldChange('maxRent', e.target.value)}
                    className="w-full pl-6 pr-2 py-1.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-xs text-[#243447] focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Bedrooms Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                <Bed className="w-3.5 h-3.5 text-[#5B6875]" />
                Bedrooms
              </label>
              <div className="grid grid-cols-3 gap-1">
                {filterOptions.bedrooms.map((bed) => {
                  const isSelected = (filters.bedrooms || 'all') === bed.value
                  return (
                    <button
                      key={bed.value}
                      type="button"
                      onClick={() => handleFieldChange('bedrooms', bed.value)}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#315A7D] text-white font-semibold'
                          : 'bg-[#F7F8FA] border border-[#D9E0E6] text-[#5B6875] hover:bg-[#EAF2F7]'
                      }`}
                    >
                      {bed.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Furnishing Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                <Sofa className="w-3.5 h-3.5 text-[#5B6875]" />
                Furnishing
              </label>
              <select
                aria-label="Filter by furnishing"
                value={filters.furnishing || 'All Furnishing'}
                onChange={(e) => handleFieldChange('furnishing', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-xs text-[#243447] focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
              >
                {filterOptions.furnishing.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Parking Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#5B6875] flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-[#5B6875]" />
                Parking
              </label>
              <select
                aria-label="Filter by parking availability"
                value={filters.parking || 'All Parking'}
                onChange={(e) => handleFieldChange('parking', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-[#D9E0E6] bg-[#F7F8FA] text-xs text-[#243447] focus:bg-white focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D]"
              >
                {filterOptions.parking.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Match Score Minimum Option (Clean, Restrained) */}
          {showAiMatchFilter && <div className="mt-4 pt-3 border-t border-[#D9E0E6] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#315A7D]" />
              <span className="font-semibold text-[#5B6875]">
                AI Match Score Minimum:
              </span>
              <div className="inline-flex rounded-md bg-[#F7F8FA] border border-[#D9E0E6] p-0.5">
                {[
                  { label: 'All Matches', value: 0 },
                  { label: '80%+', value: 80 },
                  { label: '90%+ Top Match', value: 90 },
                ].map((tier) => {
                  const isCurrent = Number(filters.minAiScore || 0) === tier.value
                  return (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() => handleFieldChange('minAiScore', tier.value)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        isCurrent
                          ? 'bg-white text-[#315A7D] font-semibold shadow-2xs border border-[#D9E0E6]'
                          : 'text-[#5B6875] hover:text-[#243447]'
                      }`}
                    >
                      {tier.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reset Shortcut */}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs text-[#B94A48] hover:text-[#8A2E2C] font-medium flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Clear all filters ({activeCount})
              </button>
            )}
          </div>}
        </div>
      </div>
    </div>
  )
}
