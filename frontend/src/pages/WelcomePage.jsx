import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Building2, MapPin, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import PublicLayout from '../layouts/PublicLayout'
import goldenHourCity from '../assets/dashboard-city-golden-hour.png'
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
  const [featuredIndex, setFeaturedIndex] = useState(0)
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

  useEffect(() => {
    setFeaturedIndex(0)
  }, [sortedProperties])

  useEffect(() => {
    if (sortedProperties.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      setFeaturedIndex((index) => (index + 1) % sortedProperties.length)
    }, 5500)
    return () => window.clearInterval(timer)
  }, [sortedProperties.length])

  const featuredProperty = sortedProperties[featuredIndex] || null
  const featuredImage = [
    featuredProperty?.imageUrl,
    typeof featuredProperty?.primaryImage === 'string'
      ? featuredProperty.primaryImage
      : featuredProperty?.primaryImage?.imageUrl,
    featuredProperty?.images?.find?.((image) => image?.isPrimary)?.imageUrl,
    typeof featuredProperty?.images?.[0] === 'string'
      ? featuredProperty.images[0]
      : featuredProperty?.images?.[0]?.imageUrl,
    featuredProperty?.imageUrls?.[0],
  ].find((image) => typeof image === 'string' && image.trim()) || ''
  const featuredAddress = featuredProperty?.address || featuredProperty?.propertyAddress || {}
  const featuredCity = featuredProperty?.city ||
    featuredAddress?.city ||
    (typeof featuredProperty?.location === 'string'
      ? featuredProperty.location
      : [featuredProperty?.location?.area, featuredProperty?.location?.city].filter(Boolean).join(', '))
  const featuredRent = Number(featuredProperty?.monthlyRent)

  const scrollToListings = () => {
    document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth' })
  }

  const changeFeaturedProperty = (direction) => {
    if (sortedProperties.length < 2) return
    setFeaturedIndex((index) => (index + direction + sortedProperties.length) % sortedProperties.length)
  }

  const resetFilters = () => setFilters(INITIAL_FILTERS)

  return (
    <PublicLayout>
      <main>
        <section className="relative isolate flex min-h-screen items-center overflow-hidden bg-[#30251F] pt-24 pb-10 sm:pt-28 lg:pt-28 lg:pb-12">
          <img
            src={goldenHourCity}
            alt="Modern apartment towers in warm golden-hour light"
            className="absolute inset-0 -z-20 h-full w-full scale-[1.02] object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-[#261F19]/20" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(39,30,25,.62)_0%,rgba(58,42,31,.42)_42%,rgba(86,57,35,.08)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(37,28,23,.42),rgba(49,36,27,.04)_48%,rgba(44,32,24,.08)_100%)]" />
          <div className="pointer-events-none absolute -right-20 top-10 -z-10 h-80 w-80 rounded-full border border-white/15 lg:right-[8%] lg:top-16 lg:h-[30rem] lg:w-[30rem]" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-12 lg:px-12 lg:py-10">
            <div className="max-w-2xl animate-[fade-in_700ms_ease-out_both]">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90 shadow-lg backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-[#D7E8C8]" /> A smarter way to rent
              </p>
              <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.5rem]">
                Find a home that feels like <span className="text-[#D7E8C8]">you.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
                Explore thoughtfully managed homes, compare the details, and find the right place for your next chapter.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToListings}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-[#3F7D58] px-6 py-3 text-sm font-bold text-white shadow-xl shadow-black/25 transition-all hover:-translate-y-0.5 hover:bg-[#315F46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#30251F]"
                >
                  Explore homes <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center rounded-full border border-white/55 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/80 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/85">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#D7E8C8]" /> Browse before signing in</span>
                <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#D7E8C8]" /> {isLoading ? 'Available homes' : `${sortedProperties.length} homes to explore`}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[430px] animate-[fade-in_900ms_ease-out_both] lg:ml-auto lg:mr-2">
              <div className="absolute -inset-4 rounded-[2rem] bg-[#F5D7AA]/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-[#F4EBDD]/80 bg-[#F4EBDD]/95 p-2 shadow-2xl shadow-[#241A14]/35 backdrop-blur-md">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#E8DDCD]" role="region" aria-label="Featured available homes" aria-roledescription="carousel">
                  {featuredProperty ? (
                    <>
                      <img
                        key={featuredProperty.propertyId ?? featuredProperty.id ?? featuredIndex}
                        src={featuredImage || goldenHourCity}
                        alt={featuredProperty.propertyName || featuredProperty.name || 'Featured rental home'}
                        className="h-full w-full animate-[fade-in_500ms_ease-out_both] object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#2A211B]/75 to-transparent" />
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#3F7D58] shadow-lg">
                        <Sparkles className="h-3.5 w-3.5" /> Featured home
                      </span>
                      <span className="absolute bottom-4 left-4 inline-flex max-w-[65%] items-center gap-1.5 truncate text-xs font-semibold text-white">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> {featuredCity || 'Explore this home'}
                      </span>
                      {sortedProperties.length > 1 && (
                        <>
                          <button type="button" onClick={() => changeFeaturedProperty(-1)} aria-label="Previous featured home" className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-[#30251F]/45 text-white shadow-sm backdrop-blur transition hover:bg-[#30251F]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => changeFeaturedProperty(1)} aria-label="Next featured home" className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-[#30251F]/45 text-white shadow-sm backdrop-blur transition hover:bg-[#30251F]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                            <ArrowRight className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-4 right-4 flex items-center gap-1.5" aria-label={`Home ${featuredIndex + 1} of ${sortedProperties.length}`}>
                            {sortedProperties.map((property, index) => (
                              <button
                                key={property.propertyId ?? property.id ?? index}
                                type="button"
                                onClick={() => setFeaturedIndex(index)}
                                aria-label={`Show home ${index + 1}: ${property.propertyName || property.name || 'Available home'}`}
                                aria-current={index === featuredIndex ? 'true' : undefined}
                                className={`h-2 rounded-full transition-all ${index === featuredIndex ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/85'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-[#6F5C49]">
                      <Building2 className="h-10 w-10 text-[#9A7B5B]" />
                      <p className="text-sm font-semibold">{isLoading ? 'Finding available homes…' : 'New homes will appear here as they’re listed.'}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 px-3 pb-2 pt-4 sm:px-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A6959]">{String(featuredProperty?.propertyType || '').replace(/_/g, ' ') || (isLoading ? 'Available rentals' : 'Public listings')}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-[#243447]">
                      {featuredProperty?.propertyName || featuredProperty?.name || (isLoading ? 'Finding homes for you…' : 'No available homes yet')}
                    </h2>
                  </div>
                  {Number.isFinite(featuredRent) && featuredRent > 0 && (
                    <p className="shrink-0 text-right text-sm font-bold text-[#243447]">
                      ₹{featuredRent.toLocaleString('en-IN')}<span className="ml-1 text-[10px] font-medium text-[#7A6959]">/mo</span>
                    </p>
                  )}
                </div>
                {featuredProperty && (
                  <button
                    type="button"
                    onClick={() => navigate(`/properties/${featuredProperty.propertyId ?? featuredProperty.id}`, { state: { publicFilters: filters } })}
                    className="mx-3 mb-3 inline-flex items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-[#315F46] transition-colors hover:text-[#243447] sm:mx-4"
                  >
                    View this home <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#30251F]/45 to-transparent" />
        </section>

        <section
          id="property-listings"
          className="scroll-mt-20 border-y border-[#E3E8DF] bg-white"
          aria-labelledby="property-listings-title"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12 lg:py-16">
            <header className="mb-7 flex flex-col gap-3 border-b border-[#E3E8DF] pb-5 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="border-l-2 border-[#3F7D58] pl-4">
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
