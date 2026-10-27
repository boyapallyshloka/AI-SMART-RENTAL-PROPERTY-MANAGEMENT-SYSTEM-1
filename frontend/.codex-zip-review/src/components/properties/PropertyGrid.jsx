import React from 'react'
import PropertyCard from './PropertyCard'
import {
  SearchX,
  ArrowUpDown,
  LayoutGrid,
  RotateCcw,
} from 'lucide-react'

/**
 * Enterprise PropertyGrid Component for SmartEstate
 * Renders a responsive grid of property cards or a helpful empty state.
 *
 * @param {Object} props
 * @param {Array} props.properties - List of filtered properties
 * @param {Function} [props.onSelectProperty] - Callback when property is clicked
 * @param {string} [props.sortBy] - Current sort key
 * @param {Function} [props.onSortChange] - Callback when sort changes
 * @param {Function} [props.onResetFilters] - Callback to reset all filters
 * @param {Array} [props.favoriteIds=[]] - Array of property IDs marked as favorites
 * @param {Function} [props.onToggleFavorite] - Callback for toggling favorite
 * @param {boolean} [props.isLoading=false] - Loading indicator
 */
export default function PropertyGrid({
  properties = [],
  onSelectProperty,
  sortBy = 'ai_match',
  onSortChange,
  onResetFilters,
  favoriteIds = [],
  onToggleFavorite,
  isLoading = false,
}) {
  // Loading State handler
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E6]">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="rounded-lg border border-[#D9E0E6] bg-white overflow-hidden shadow-2xs animate-pulse"
            >
              <div className="aspect-[16/10] w-full bg-[#EAF2F7]" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-100 rounded w-full" />
                <div className="flex justify-between pt-2 border-t border-[#D9E0E6]">
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty State handler
  if (!isLoading && properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#D9E0E6] bg-white p-10 sm:p-12 text-center my-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#EAF2F7] text-[#315A7D] mb-3">
          <SearchX className="h-6 w-6" />
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-[#243447]">
          No matching properties found
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-[#5B6875]">
          We couldn’t find any rental listings matching your filter criteria.
          Try adjusting your budget, expanding locations, or clearing your active filters.
        </p>

        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#315A7D] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#274B68] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All Filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Results Bar & Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#D9E0E6]">
        <div>
          <h2 className="text-base sm:text-lg font-serif font-bold text-[#243447] flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[#315A7D]" />
            <span>Available Rentals</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
              {properties.length} {properties.length === 1 ? 'listing' : 'listings'}
            </span>
          </h2>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Ranked with personalized tenant preferences and market indicators
          </p>
        </div>

        {/* Sort selector */}
        {onSortChange && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-[#5B6875] font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5B6875]" />
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 rounded-md border border-[#D9E0E6] bg-white text-[#243447] focus:outline-none focus:border-[#315A7D] cursor-pointer"
            >
              <option value="ai_match">Recommended Match</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="bedrooms_desc">Most Bedrooms</option>
              <option value="area_desc">Largest Area</option>
            </select>
          </div>
        )}
      </div>

      {/* Responsive Property Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {properties.map((property) => (
          <PropertyCard
            key={property.propertyId ?? property.id}
            property={property}
            onSelect={onSelectProperty}
            isFavorite={favoriteIds.includes(property.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  )
}
