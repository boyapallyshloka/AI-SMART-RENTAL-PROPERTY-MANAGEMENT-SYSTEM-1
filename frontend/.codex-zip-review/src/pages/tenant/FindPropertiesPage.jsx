import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Input, Select, StatusBadge, EmptyState, Loader } from '../../components/ui'
import {
  Search,
  Building2,
  Building,
  Home,
  MapPin,
  Sparkles,
  ArrowRight,
  IndianRupee,
  Bed,
  Bath,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { getAvailableUnits, getAvailableProperties } from '../../api/unitApi'
import { getTenantRentalContext } from '../../api/buildingApi'
import { useAuth } from '../../context/AuthContext'

export default function FindPropertiesPage() {
  const { user } = useAuth()

  // Tenant current rental context (for separation & visual clarity)
  const [myRental, setMyRental] = useState(null)

  // Discovery dataset (Strictly VACANT units, excluding occupied units and tenant's current residence)
  const [availableUnits, setAvailableUnits] = useState([])
  const [availableProperties, setAvailableProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadDiscoveryData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const [rental, units, props] = await Promise.all([
        getTenantRentalContext(user),
        getAvailableUnits(user),
        getAvailableProperties(user),
      ])
      setMyRental(rental)
      setAvailableUnits(units || [])
      setAvailableProperties(props || [])
    } catch (err) {
      console.error('Error loading discovery properties:', err)
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load available properties. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDiscoveryData()
  }, [user])

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProperty, setSelectedProperty] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedBedrooms, setSelectedBedrooms] = useState('all')
  const [maxRent, setMaxRent] = useState('all')
  const [activeTab, setActiveTab] = useState('units') // 'units' | 'communities'

  const minimumAvailableRent = useMemo(() => {
    const rents = availableUnits
      .map((unit) => Number(unit.monthlyRent))
      .filter((rent) => Number.isFinite(rent) && rent > 0)
    return rents.length ? Math.min(...rents) : null
  }, [availableUnits])

  // Property Filter Options
  const propertyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Managed Communities' },
      ...availableProperties.map((p) => ({
        value: p.property.id,
        label: p.property.name,
      })),
    ]
  }, [availableProperties])

  // Filtered Vacant Units
  const filteredUnits = useMemo(() => {
    return availableUnits.filter((unit) => {
      const prop = unit.floor?.building?.property
      const bld = unit.floor?.building

      // Search query filter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        q === '' ||
        unit.unitNumber.toLowerCase().includes(q) ||
        (unit.description && unit.description.toLowerCase().includes(q)) ||
        (bld?.buildingName && bld.buildingName.toLowerCase().includes(q)) ||
        (prop?.name && prop.name.toLowerCase().includes(q)) ||
        (prop?.city && prop.city.toLowerCase().includes(q)) ||
        (prop?.address && prop.address.toLowerCase().includes(q))

      // Property filter
      const matchesProperty =
        selectedProperty === 'all' || prop?.id === selectedProperty

      // Unit type filter
      const matchesType =
        selectedType === 'all' || unit.unitType === selectedType

      // Bedrooms filter
      const matchesBedrooms =
        selectedBedrooms === 'all' ||
        (selectedBedrooms === '3+'
          ? unit.bedrooms >= 3
          : String(unit.bedrooms) === selectedBedrooms)

      // Max rent filter
      const matchesRent =
        maxRent === 'all' || unit.monthlyRent <= Number(maxRent)

      return (
        matchesSearch &&
        matchesProperty &&
        matchesType &&
        matchesBedrooms &&
        matchesRent
      )
    })
  }, [
    availableUnits,
    searchQuery,
    selectedProperty,
    selectedType,
    selectedBedrooms,
    maxRent,
  ])

  // Filtered Properties for Communities tab
  const filteredProperties = useMemo(() => {
    return availableProperties.filter((p) => {
      if (selectedProperty !== 'all' && p.property.id !== selectedProperty) {
        return false
      }
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        p.property.name.toLowerCase().includes(q) ||
        p.property.city.toLowerCase().includes(q) ||
        p.property.address.toLowerCase().includes(q) ||
        p.buildings.some((b) => b.buildingName.toLowerCase().includes(q))
      )
    })
  }, [availableProperties, selectedProperty, searchQuery])

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedProperty('all')
    setSelectedType('all')
    setSelectedBedrooms('all')
    setMaxRent('all')
  }

  // Active filters count
  const hasActiveFilters =
    searchQuery !== '' ||
    selectedProperty !== 'all' ||
    selectedType !== 'all' ||
    selectedBedrooms !== 'all' ||
    maxRent !== 'all'

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="find-properties"
      pageTitle="Find Properties"
    >
      <div className="space-y-6 pb-12">
        {/* 1. Hero Header Banner */}
        <div className="rounded-lg bg-[#315A7D] p-6 sm:p-8 text-white border border-[#274B68] shadow-xs">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#274B68] text-[#EAF2F7] border border-[#315A7D]">
              <Sparkles className="w-3.5 h-3.5 text-[#EAF2F7]" />
              <span>Rental Property Discovery</span>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-white">
              Find Your Next Home
            </h1>

            <p className="text-xs sm:text-sm text-[#EAF2F7]/90 leading-relaxed">
              Browse properties and vacant units currently returned by SmartEstate.
            </p>

            {/* Quick Metrics Bar */}
            <div className="pt-3 flex flex-wrap gap-4 sm:gap-6 text-xs text-[#EAF2F7] border-t border-[#274B68]">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-[#EAF2F7]" />
                <span>
                  <strong className="text-white font-semibold">{errorMessage ? '—' : availableUnits.length}</strong> Vacant Units
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#EAF2F7]" />
                <span>
                  <strong className="text-white font-semibold">{errorMessage ? '—' : availableProperties.length}</strong> Communities
                </span>
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-[#EAF2F7]" />
                <span>
                  {errorMessage ? 'Rent unavailable' : minimumAvailableRent != null ? (
                    <>From <strong className="text-white font-semibold">₹{minimumAvailableRent.toLocaleString('en-IN')}</strong>/mo</>
                  ) : (
                    'Rent not available'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F4B4B4] text-[#8A2E2C] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#8A2E2C] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadDiscoveryData}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* 2. Visual Separation: Current Rental Notice (if active lease exists) */}
        {myRental?.property && (
          <div className="p-4 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-[#243447]">
                  Currently Renting:{' '}
                  <span className="text-[#315A7D] font-bold">
                    {myRental.property.name || myRental.property.propertyName}
                  </span>
                  {myRental.leaseSummary?.unitNumber && ` • Unit ${myRental.leaseSummary.unitNumber}`}
                </p>
                <p className="text-[#5B6875] mt-0.5">
                  The listings below represent other vacant units and properties available for lease across our portfolio.
                </p>
              </div>
            </div>

            <Link to="/tenant/buildings" className="shrink-0">
              <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View My Rental Property
              </Button>
            </Link>
          </div>
        )}

        {/* 3. Search and Filtering Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-[#D9E0E6] shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Input
                placeholder="Search by property, building, city, or unit number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F7F8FA] border border-[#D9E0E6] rounded-md shrink-0 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('units')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === 'units'
                    ? 'bg-white text-[#315A7D] shadow-2xs border border-[#D9E0E6]/80'
                    : 'text-[#5B6875] hover:text-[#243447]'
                }`}
              >
                Available Units ({filteredUnits.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('communities')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  activeTab === 'communities'
                    ? 'bg-white text-[#315A7D] shadow-2xs border border-[#D9E0E6]/80'
                    : 'text-[#5B6875] hover:text-[#243447]'
                }`}
              >
                Communities ({filteredProperties.length})
              </button>
            </div>
          </div>

          {/* Granular Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#D9E0E6]/70">
            {/* Property Select */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] mb-1">
                Property Complex
              </label>
              <Select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                options={propertyOptions}
              />
            </div>

            {/* Unit Type Select */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] mb-1">
                Unit Type
              </label>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { value: 'all', label: 'All Unit Types' },
                  { value: 'APARTMENT', label: 'Apartment' },
                  { value: 'ROOM', label: 'Single Room' },
                ]}
              />
            </div>

            {/* Bedrooms Select */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] mb-1">
                Bedrooms
              </label>
              <Select
                value={selectedBedrooms}
                onChange={(e) => setSelectedBedrooms(e.target.value)}
                options={[
                  { value: 'all', label: 'Any Bedrooms' },
                  { value: '1', label: '1 Bedroom' },
                  { value: '2', label: '2 Bedrooms' },
                  { value: '3+', label: '3+ Bedrooms' },
                ]}
              />
            </div>

            {/* Max Budget Select */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] mb-1">
                Max Monthly Rent
              </label>
              <Input
                type="number"
                min="0"
                value={maxRent === 'all' ? '' : maxRent}
                onChange={(e) => setMaxRent(e.target.value || 'all')}
                placeholder="Any budget"
              />
            </div>
          </div>

          {/* Active Filter Clear Helper */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-[#D9E0E6]/70 text-xs">
              <span className="text-[#5B6875]">
                Showing {filteredUnits.length} vacant {filteredUnits.length === 1 ? 'unit' : 'units'} matching criteria
              </span>
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[#315A7D] hover:underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* 4. Results Display */}
        {isLoading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader text="Loading available properties and vacant units..." size="md" center />
          </div>
        ) : activeTab === 'units' ? (
          /* Available Units Grid */
          filteredUnits.length === 0 ? (
            <EmptyState
              icon={<Home className="w-8 h-8 text-[#5B6875]" />}
              title="No available units match your filters"
              description="Try broadening your price range, adjusting bedroom filters, or selecting all properties."
              action={
                hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={handleResetFilters}>
                    Reset Filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredUnits.map((unit) => {
                const floor = unit.floor
                const building = floor?.building
                const property = building?.property
                const myPropId = myRental?.property?.propertyId ?? myRental?.property?.id
                const thisPropId = property?.propertyId ?? property?.id
                const isCurrentComplex = Boolean(myPropId && thisPropId && String(myPropId) === String(thisPropId))

                return (
                  <div
                    key={unit.unitId}
                    className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col justify-between hover:border-[#315A7D]/50 transition-colors"
                  >
                    <div className="space-y-3.5">
                      {/* Top Header: Type & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#315A7D] px-2 py-0.5 rounded bg-[#EAF2F7] border border-[#D9E0E6]/80">
                            {unit.unitType}
                          </span>
                          <h2 className="font-serif text-xl font-bold text-[#243447] mt-1.5">
                            Unit {unit.unitNumber}
                          </h2>
                        </div>

                        <StatusBadge status="VACANT" size="sm" />
                      </div>

                      {/* Location Hierarchy */}
                      <div className="space-y-1 text-xs text-[#5B6875] pt-1">
                        <div className="flex items-center gap-1.5 font-semibold text-[#243447]">
                          <Building className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                          <span className="truncate">{building?.buildingName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Building2 className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span className="truncate">{property?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#5B6875]">
                          <MapPin className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span>{property?.city}, {property?.state}</span>
                        </div>
                      </div>

                      {/* Current Community Callout */}
                      {isCurrentComplex && (
                        <div className="p-2 rounded bg-[#EAF2F7]/70 border border-[#D9E0E6] text-[11px] text-[#315A7D] font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                          <span>Located in your current community complex</span>
                        </div>
                      )}

                      {/* Financials & Specifications */}
                      <div className="pt-3 border-t border-[#D9E0E6] space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-[#5B6875]">Monthly Rent</span>
                            <div className="text-lg font-bold text-[#243447]">
                              ₹{Number(unit.monthlyRent).toLocaleString('en-IN')}
                              <span className="text-xs font-normal text-[#5B6875]">/mo</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-[#5B6875]">Deposit</span>
                            <div className="text-xs font-semibold text-[#5B6875]">
                              ₹{Number(unit.securityDeposit).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* Specs row */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/70">
                            <p className="text-[10px] uppercase font-semibold text-[#5B6875]">Area</p>
                            <p className="font-bold text-[#243447] mt-0.5">{unit.area} sq ft</p>
                          </div>
                          <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/70">
                            <p className="text-[10px] uppercase font-semibold text-[#5B6875]">Beds</p>
                            <p className="font-bold text-[#243447] mt-0.5">{unit.bedrooms}</p>
                          </div>
                          <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/70">
                            <p className="text-[10px] uppercase font-semibold text-[#5B6875]">Baths</p>
                            <p className="font-bold text-[#243447] mt-0.5">{unit.bathrooms}</p>
                          </div>
                        </div>
                      </div>

                      {/* Description Preview */}
                      {unit.description && (
                        <p className="text-xs text-[#5B6875] line-clamp-2 leading-relaxed">
                          {unit.description}
                        </p>
                      )}
                    </div>

                    {/* Discovery Actions (Read-Only) */}
                    <div className="pt-4 mt-4 border-t border-[#D9E0E6] flex items-center justify-between gap-2">
                      <Link to={`/tenant/buildings/${building?.buildingId}`}>
                        <Button size="sm" variant="outline">
                          View Building
                        </Button>
                      </Link>

                      <Link to={`/tenant/units/${unit.unitId}`}>
                        <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          View Unit
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Communities & Buildings Grid */
          filteredProperties.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-8 h-8 text-[#5B6875]" />}
              title="No communities match your filters"
              description="Try adjusting your search criteria."
              action={
                hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={handleResetFilters}>
                    Reset Filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-5">
              {filteredProperties.map((p) => {
                const myPropId = myRental?.property?.propertyId ?? myRental?.property?.id
                const thisPropId = p.property.propertyId ?? p.property.id
                const isCurrentComplex = Boolean(myPropId && thisPropId && String(myPropId) === String(thisPropId))

                return (
                  <div
                    key={p.property.id}
                    className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-4 hover:border-[#315A7D]/40 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#D9E0E6] pb-4">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                            {p.property.type}
                          </span>
                          {isCurrentComplex && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                              Your Current Complex
                            </span>
                          )}
                        </div>
                        <h2 className="font-serif text-xl font-bold text-[#243447]">
                          {p.property.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-[#5B6875]">
                          <MapPin className="w-3.5 h-3.5 text-[#315A7D]" />
                          <span>{p.property.address}, {p.property.city}, {p.property.state} {p.property.zipCode}</span>
                        </div>
                        {p.property.description && (
                          <p className="text-xs text-[#5B6875] pt-1 leading-relaxed">
                            {p.property.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                        <div className="px-3.5 py-2 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-center">
                          <p className="text-[10px] uppercase font-semibold text-[#5B6875]">Available</p>
                          <p className="text-lg font-bold text-[#315A7D]">
                            {p.vacantUnitsCount} {p.vacantUnitsCount === 1 ? 'Unit' : 'Units'}
                          </p>
                        </div>
                        <div className="px-3.5 py-2 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-center">
                          <p className="text-[10px] uppercase font-semibold text-[#5B6875]">Rent From</p>
                          <p className="text-lg font-bold text-[#243447]">₹{Number(p.minRent).toLocaleString('en-IN')}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProperty(p.property.id)
                            setActiveTab('units')
                          }}
                        >
                          View Units ({p.vacantUnitsCount})
                        </Button>
                      </div>
                    </div>

                    {/* Buildings in this community */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
                        Buildings in this Community
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {p.buildings.map((b) => (
                          <div
                            key={b.buildingId}
                            className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] flex flex-col justify-between space-y-3"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm text-[#243447]">
                                  {b.buildingName}
                                </h4>
                                <span className="text-[11px] font-semibold text-[#315A7D]">
                                  {b.vacantUnitsCount} Vacant
                                </span>
                              </div>
                              <p className="text-xs text-[#5B6875] mt-1">
                                {b.totalFloors} Floors &bull; {b.totalUnits} Units Total
                              </p>
                            </div>

                            <div className="pt-2 border-t border-[#D9E0E6]/70 flex items-center justify-between">
                              <span className="text-[11px] text-[#5B6875] font-mono">
                                ID: {b.buildingId}
                              </span>
                              <Link to={`/tenant/buildings/${b.buildingId}`}>
                                <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3 h-3" />}>
                                  Explore Building
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  )
}
