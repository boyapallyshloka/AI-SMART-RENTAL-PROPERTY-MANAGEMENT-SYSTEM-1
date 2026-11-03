
import React, { useState, useEffect } from 'react'
import {
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Sparkles,
  Heart,
  Car,
  Sofa,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Building2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { resolveImageUrl } from '../../api/propertyApi'
import { getPublicImagesByProperty } from '../../api/propertyImageApi'

/**
 * Enterprise PropertyCard Component for SmartEstate
 * Displays key details of a rental property for tenant browsing.
 * Strictly adheres to backend Property contract.
 *
 * Supports multiple property images with carousel navigation.
 */

export default function PropertyCard({
  property = {},
  onSelect,
  isFavorite: controlledFavorite,
  onToggleFavorite,
  showFavorite = true,
}) {
  const [internalFavorite, setInternalFavorite] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [loadedPropertyImages, setLoadedPropertyImages] = useState([])

  const isFav =
    controlledFavorite !== undefined ? controlledFavorite : internalFavorite

  const {
    id,
    propertyId,
    name,
    propertyName,
    propertyType,
    type,
    city,
    location,
    address,
    monthlyRent,
    bedrooms,
    bathrooms,
    area,
    totalArea,
    furnishing,
    furnishingStatus,
    parking,
    parkingAvailable,
    yearBuilt,
    status,
    availabilityStatus,
    imageUrl,
    images,
    deposit,
    securityDeposit,
    aiMatchScore,
    matchCriteria,
    approxDistanceKm,
    availableUnitsCount,
  } = property

  const realId = propertyId ?? id
  const displayName = propertyName || name || 'Unnamed Property'
  const displayType = propertyType || type

  const handleFavoriteClick = (e) => {
    e.stopPropagation()

    if (onToggleFavorite) {
      onToggleFavorite(realId)
    } else {
      setInternalFavorite(!internalFavorite)
    }
  }

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(property)
    }
  }

  // Extract a valid image URL from a string or image object
  const extractImageUrl = (image) => {
    if (typeof image === 'string' && image.trim()) {
      return image.trim()
    }

    if (image && typeof image === 'object') {
      const candidate =
        image.imageUrl ||
        image.url ||
        image.src ||
        image.imagePath

      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }

    return ''
  }

  // Collect all supported image sources
  const imageSources = [
    property.primaryImage,
    imageUrl,
    ...(Array.isArray(images) ? images : []),
    ...(Array.isArray(property.imageUrls) ? property.imageUrls : []),
    ...(Array.isArray(property.photos) ? property.photos : []),
    ...(Array.isArray(property.propertyImages)
      ? property.propertyImages
      : []),
  ]

  // Put the image marked as primary first
  const primaryImage = imageSources.find(
    (image) =>
      image &&
      typeof image === 'object' &&
      Boolean(image.isPrimary)
  )

  const orderedImages = primaryImage
    ? [
        primaryImage,
        ...imageSources.filter((image) => image !== primaryImage),
      ]
    : imageSources

  const suppliedImageUrls = [
    ...new Set(
      orderedImages
        .map(extractImageUrl)
        .filter(Boolean)
        .map(resolveImageUrl)
        .filter(Boolean)
    ),
  ]

  // Public listing responses may provide only a cover image. Load the public
  // gallery in that case so the card carousel can show the property's photos.
  useEffect(() => {
    let cancelled = false
    setLoadedPropertyImages([])

    if (!realId || suppliedImageUrls.length > 1) {
      return () => {
        cancelled = true
      }
    }

    getPublicImagesByProperty(realId)
      .then((result) => {
        if (cancelled) return
        const records = Array.isArray(result) ? result : result?.data || []
        setLoadedPropertyImages(Array.isArray(records) ? records : [])
      })
      .catch(() => {
        // Keep the listing's cover image when the public gallery is unavailable.
      })

    return () => {
      cancelled = true
    }
  }, [realId, suppliedImageUrls.length])

  // Merge the listing cover and gallery results, preserving the primary image
  // first and avoiding duplicate URLs.
  const propertyImages = [
    ...new Set(
      [...orderedImages, ...loadedPropertyImages]
        .map(extractImageUrl)
        .filter(Boolean)
        .map(resolveImageUrl)
        .filter(Boolean)
    ),
  ]

  // Current image displayed in the carousel
  const displayImg = propertyImages[currentImageIndex] || ''

  // Reset carousel when property or image count changes
  useEffect(() => {
    setCurrentImageIndex(0)
    setImageError(false)
  }, [realId, propertyImages.length])

  // Reset image error when navigating to another image
  useEffect(() => {
    setImageError(false)
  }, [displayImg])

  // Previous image navigation
  const showPreviousImage = (e) => {
    e.stopPropagation()

    if (propertyImages.length <= 1) return

    setCurrentImageIndex((previousIndex) =>
      previousIndex === 0
        ? propertyImages.length - 1
        : previousIndex - 1
    )
  }

  // Next image navigation
  const showNextImage = (e) => {
    e.stopPropagation()

    if (propertyImages.length <= 1) return

    setCurrentImageIndex((previousIndex) =>
      previousIndex === propertyImages.length - 1
        ? 0
        : previousIndex + 1
    )
  }

  // Availability / Status
  const rawStatus = status || availabilityStatus || ''

  const isAvailable =
    rawStatus === 'AVAILABLE' || rawStatus === 'Available Now'

  const displayStatus = rawStatus
    ? rawStatus === 'AVAILABLE'
      ? 'Available'
      : rawStatus
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  // Unit-level financials
  const hasRent = monthlyRent !== undefined && monthlyRent !== null

  const formattedRent = hasRent
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(monthlyRent)
    : null

  const depVal = deposit ?? securityDeposit

  // Real specifications
  const displayArea = totalArea ?? area
  const hasBeds = bedrooms !== undefined && bedrooms !== null
  const hasBaths = bathrooms !== undefined && bathrooms !== null

  const hasArea =
    displayArea !== undefined &&
    displayArea !== null &&
    Number(displayArea) > 0

  const hasYear = yearBuilt !== undefined && yearBuilt !== null

  const displayLocation = location || address || city || ''

  // Furnishing and Parking
  const displayFurnishing = furnishingStatus || furnishing

  const displayParking =
    parkingAvailable != null
      ? parkingAvailable
        ? 'Parking Available'
        : 'No Parking'
      : parking

  return (
    <div
      onClick={handleCardClick}
      className="group flex flex-col overflow-hidden rounded-lg border border-[#E3E8DF] bg-white shadow-2xs hover:shadow-sm hover:border-[#3F7D58]/40 transition-all cursor-pointer"
    >
      {/* Property Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#EDF4ED]">
        {displayImg && !imageError ? (
          <img
            src={displayImg}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-[#F7F7F1] p-4 text-center select-none">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EDF4ED] text-[#3F7D58] mb-1.5 shadow-2xs border border-[#E3E8DF]">
              <Building2 className="w-5 h-5 text-[#3F7D58]" />
            </div>

            <span className="text-xs font-medium text-[#5B6875] truncate max-w-[180px]">
              {displayName}
            </span>
          </div>
        )}

        {/* Image Carousel Navigation */}
        {propertyImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPreviousImage}
              aria-label="Previous property image"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#315F46] shadow-md hover:bg-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={showNextImage}
              aria-label="Next property image"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#315F46] shadow-md hover:bg-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-2.5 right-2.5 z-20 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
              {currentImageIndex + 1} / {propertyImages.length}
            </div>
          </>
        )}

        {/* Top Floating Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10">
          {/* Availability Status Badge */}
          {displayStatus ? (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium backdrop-blur-xs ${
                isAvailable
                  ? 'bg-white text-[#2A583B] border border-[#C6DEC8] shadow-2xs'
                  : 'bg-white text-[#8A5B16] border border-[#F4E2B6] shadow-2xs'
              }`}
            >
              {isAvailable ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
              ) : (
                <Calendar className="w-3.5 h-3.5 text-[#B7791F]" />
              )}

              <span>{displayStatus}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Favorite Toggle Button */}
          {showFavorite && (
            <button
              type="button"
              onClick={handleFavoriteClick}
              aria-label={
                isFav ? 'Remove from favorites' : 'Save to favorites'
              }
              className="p-1.5 rounded-md bg-white border border-[#E3E8DF] text-[#5B6875] hover:text-[#B94A48] hover:bg-white transition-colors shadow-2xs"
            >
              <Heart
                className={`w-4 h-4 ${
                  isFav ? 'fill-[#B94A48] text-[#B94A48]' : ''
                }`}
              />
            </button>
          )}
        </div>

        {/* Bottom Property Type Pill */}
        {displayType && (
          <div className="absolute bottom-2.5 left-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#3F7D58] text-white text-[11px] font-medium capitalize shadow-2xs">
              {displayType.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-4 space-y-3">
        {/* Rent & Price */}
        {hasRent && (
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-[#3F7D58]">
                {formattedRent}
              </span>

              <span className="text-xs text-[#5B6875] font-medium">
                / month
              </span>
            </div>

            {depVal != null && (
              <span className="text-[11px] text-[#5B6875] bg-[#F7F7F1] border border-[#E3E8DF] px-2 py-0.5 rounded-md">
                Dep: ₹{Number(depVal).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        )}

        {/* Title and Location */}
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-[#111820] line-clamp-1 group-hover:text-[#3F7D58] transition-colors">
            {displayName}
          </h3>

          {displayLocation && (
            <p className="flex items-center gap-1 text-xs text-[#5B6875] mt-0.5 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
              <span>{displayLocation}</span>
            </p>
          )}
        </div>

        {/* Key Features Grid */}
        {(hasBeds || hasBaths || hasArea || hasYear) && (
          <div className="flex flex-wrap items-center gap-1.5 py-2 border-y border-[#E3E8DF] text-xs text-[#5B6875]">
            {hasBeds && (
              <div className="flex-1 min-w-[70px] flex items-center gap-1.5 justify-center bg-[#F7F7F1] py-1.5 px-2 rounded-md">
                <Bed className="w-3.5 h-3.5 text-[#5B6875]" />

                <span className="font-medium text-[#111820]">
                  {bedrooms === 0 ? 'Studio' : `${bedrooms} Beds`}
                </span>
              </div>
            )}

            {hasBaths && (
              <div className="flex-1 min-w-[70px] flex items-center gap-1.5 justify-center bg-[#F7F7F1] py-1.5 px-2 rounded-md">
                <Bath className="w-3.5 h-3.5 text-[#5B6875]" />

                <span className="font-medium text-[#111820]">
                  {bathrooms} Baths
                </span>
              </div>
            )}

            {hasArea && (
              <div className="flex-1 min-w-[70px] flex items-center gap-1.5 justify-center bg-[#F7F7F1] py-1.5 px-2 rounded-md">
                <Maximize2 className="w-3.5 h-3.5 text-[#5B6875]" />

                <span className="font-medium text-[#111820]">
                  {displayArea} sqft
                </span>
              </div>
            )}

            {hasYear && !hasBeds && (
              <div className="flex-1 min-w-[70px] flex items-center gap-1.5 justify-center bg-[#F7F7F1] py-1.5 px-2 rounded-md">
                <Calendar className="w-3.5 h-3.5 text-[#5B6875]" />

                <span className="font-medium text-[#111820]">
                  Built {yearBuilt}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Secondary Details & Optional AI Match Score */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5B6875] flex-wrap">
            {displayFurnishing &&
              displayFurnishing !== 'UNFURNISHED' && (
                <span className="inline-flex items-center gap-1 bg-[#F7F7F1] border border-[#E3E8DF] px-2 py-0.5 rounded capitalize">
                  <Sofa className="w-3 h-3 text-[#5B6875]" />

                  {displayFurnishing.replace(/_/g, ' ').toLowerCase()}
                </span>
              )}

            {displayParking &&
              displayParking !== 'None' &&
              displayParking !== 'No Parking' && (
                <span className="inline-flex items-center gap-1 bg-[#F7F7F1] border border-[#E3E8DF] px-2 py-0.5 rounded">
                  <Car className="w-3 h-3 text-[#5B6875]" />

                  {displayParking}
                </span>
              )}
          </div>

          {/* AI Match Score */}
          {aiMatchScore !== undefined && aiMatchScore !== null && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EDF4ED] text-[#3F7D58] border border-[#3F7D58]/30 shrink-0">
              <Sparkles className="w-3 h-3 text-[#3F7D58]" />

              <span>{aiMatchScore}% Match</span>
            </div>
          )}
        </div>

        {/* Real Match Badges & Distance */}
        {((Array.isArray(matchCriteria) && matchCriteria.length > 0) ||
          (approxDistanceKm != null && approxDistanceKm > 0) ||
          (availableUnitsCount != null && availableUnitsCount > 0)) && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {Array.isArray(matchCriteria) &&
              matchCriteria.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]"
                >
                  {tag} Match
                </span>
              ))}

            {approxDistanceKm != null && approxDistanceKm > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F7F7F1] text-[#5B6875] border border-[#E3E8DF]">
                ~{approxDistanceKm} km
              </span>
            )}

            {availableUnitsCount != null && availableUnitsCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EDF4ED] text-[#3F7D58] border border-[#E3E8DF]">
                {availableUnitsCount}{' '}
                {availableUnitsCount === 1 ? 'unit' : 'units'} left
              </span>
            )}
          </div>
        )}

        {/* Card Footer / View Details */}
        <div className="pt-2 mt-auto flex items-center justify-between border-t border-[#E3E8DF]">
          <span className="text-xs font-semibold text-[#3F7D58] flex items-center gap-1 group-hover:text-[#315F46] transition-colors">
            View Listing

            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>


        </div>
      </div>
    </div>
  )
}
