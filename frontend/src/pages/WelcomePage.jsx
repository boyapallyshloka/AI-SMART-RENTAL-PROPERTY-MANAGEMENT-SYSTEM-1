import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Building2, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import PublicLayout from '../layouts/PublicLayout'
import propertyImage from '../assets/owner-hero-bg.jpg'
import PropertyFilter from '../components/properties/PropertyFilter'
import PropertyGrid from '../components/properties/PropertyGrid'
import { getPublicProperties, searchPublicProperties } from '../api/publicPropertyApi'

const INITIAL_FILTERS = {
  searchQuery: '',
  city: 'All Locations',
  propertyType: 'All Types',
  minRent: '',
  maxRent: '',
  bedrooms: 'all',
  furnishing: 'All Furnishing',
  parking: 'All Parking',
  minAiScore: 0,
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.searchQuery.trim() ||
    filters.city !== 'All Locations' ||
    filters.propertyType !== 'All Types' ||
    filters.minRent !== '' ||
    filters.maxRent !== '' ||
    filters.bedrooms !== 'all' ||
    filters.furnishing !== 'All Furnishing' ||
    filters.parking !== 'All Parking'
  )
}

function sortProperties(properties, sortBy) {
  const sorted = [...properties]
  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0))
    case 'price_desc':
      return sorted.sort((a, b) => (b.monthlyRent || 0) - (a.monthlyRent || 0))
    case 'bedrooms_desc':
      return sorted.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0))
    case 'area_desc':
      return sorted.sort((a, b) => (b.totalArea || b.area || 0) - (a.totalArea || a.area || 0))
    default:
      return sorted.sort((a, b) => (b.propertyId || b.id || 0) - (a.propertyId || a.id || 0))
  }
}

export default function WelcomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [filters, setFilters] = useState(() => ({
    ...INITIAL_FILTERS,
    ...(location.state?.publicFilters || {}),
  }))
  const [sortBy, setSortBy] = useState('newest')
  const [properties, setProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProperties = useCallback(async (currentFilters) => {
    setIsLoading(true)
    setError(null)
    try {
      const results = hasActiveFilters(currentFilters)
        ? await searchPublicProperties(currentFilters)
        : await getPublicProperties()
      setProperties(Array.isArray(results) ? results : [])
    } catch (requestError) {
      const status = requestError?.status
      setError(
        status === 401 || status === 403
          ? `The public listing endpoint returned ${status}. The backend must allow unauthenticated GET access to available properties.`
          : requestError?.message || 'Unable to load properties right now. Please try again.'
      )
      setProperties([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const delay = filters.searchQuery.trim() ? 300 : 0
    const timer = setTimeout(() => loadProperties(filters), delay)
    return () => clearTimeout(timer)
  }, [filters, loadProperties])

  useEffect(() => {
    if (location.hash === '#property-listings') {
      document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash])

  const availableCities = useMemo(() => {
    const cities = properties
      .map((property) => property.city || property.address?.city || property.propertyAddress?.city)
      .map((city) => String(city || '').trim())
      .filter(Boolean)
    return [...new Set(cities)].sort((a, b) => a.localeCompare(b))
  }, [properties])

  const sortedProperties = useMemo(
    () => sortProperties(properties, sortBy),
    [properties, sortBy]
  )

  const scrollToListings = () => {
    document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth' })
  }

  const resetFilters = () => setFilters(INITIAL_FILTERS)

  return (
    <PublicLayout>
      <main>
        <section className="relative isolate flex min-h-[min(720px,calc(100svh-64px))] items-center overflow-hidden bg-[#243447]">
          <img
            src={propertyImage}
            alt="Contemporary apartments surrounded by landscaped gardens"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#172B3A]/90 via-[#172B3A]/65 to-[#172B3A]/15" />
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
            <div className="max-w-2xl animate-[fade-in_700ms_ease-out_both]">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                <MapPin className="h-4 w-4" /> A smarter way to rent
              </p>
              <h1 className="font-serif text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Find a place that feels like yours.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
                SmartEstate brings thoughtfully managed rental homes and clear property details together, so your next move starts with confidence.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToListings}
                  className="inline-flex min-h-12 items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-bold text-[#243447] shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#243447]"
                >
                  Find Properties <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center rounded-md border border-white/55 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Existing user? Sign in
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-2 text-sm text-white/80">
                <ShieldCheck className="h-4 w-4 text-[#B8D7C2]" />
                <span>Explore public listings before creating an account</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#172B3A]/45 to-transparent" />
        </section>

        <section
          id="property-listings"
          className="scroll-mt-20 border-y border-[#D9E0E6] bg-white"
          aria-labelledby="property-listings-title"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12 lg:py-16">
            <header className="mb-7 flex flex-col gap-3 border-b border-[#D9E0E6] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#3F7D58]">
                  <Building2 className="h-4 w-4" /> SmartEstate Listings
                </p>
                <h2 id="property-listings-title" className="font-serif text-3xl font-semibold text-[#243447] sm:text-4xl">
                  Find a home
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5B6875]">
                  Explore available rental properties and narrow your search by location, type, and monthly rent.
                </p>
              </div>
              <p className="text-sm font-medium text-[#5B6875]" aria-live="polite">
                {isLoading ? 'Loading listings…' : `${sortedProperties.length} ${sortedProperties.length === 1 ? 'property' : 'properties'}`}
              </p>
            </header>

            <div className="space-y-6">
              <PropertyFilter
                filters={filters}
                onFilterChange={setFilters}
                onResetFilters={resetFilters}
                totalResults={sortedProperties.length}
                availableCities={availableCities}
                showAiMatchFilter={false}
              />

              {error && (
                <div className="flex flex-col gap-3 rounded-md border border-[#F8B4B4] bg-[#FDF2F2] p-4 text-sm text-[#9B1C1C] sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadProperties(filters)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#B94A48] px-3 py-2 text-xs font-semibold text-white hover:bg-[#8A2E2C]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try again
                  </button>
                </div>
              )}

              {!error && (
                <PropertyGrid
                  properties={sortedProperties}
                  onSelectProperty={(property) => {
                    const propertyId = property.propertyId ?? property.id
                    navigate(`/properties/${propertyId}`, { state: { publicFilters: filters } })
                  }}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onResetFilters={resetFilters}
                  isLoading={isLoading}
                  showFavorites={false}
                  showPersonalizedSort={false}
                />
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:px-12" aria-label="SmartEstate benefits">
          <div className="border-l-2 border-[#3F7D58] pl-4">
            <h2 className="font-serif text-lg font-semibold">A clearer search</h2>
            <p className="mt-1 text-sm leading-6 text-[#5B6875]">Compare available homes by location, type, and monthly rent.</p>
          </div>
          <div className="border-l-2 border-[#315A7D] pl-4">
            <h2 className="font-serif text-lg font-semibold">Details that matter</h2>
            <p className="mt-1 text-sm leading-6 text-[#5B6875]">Review listing photos, features, and property information in one place.</p>
          </div>
          <div className="border-l-2 border-[#B7791F] pl-4">
            <h2 className="font-serif text-lg font-semibold">Ready when you are</h2>
            <p className="mt-1 text-sm leading-6 text-[#5B6875]">Sign in when you are ready to apply or manage your rental.</p>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}