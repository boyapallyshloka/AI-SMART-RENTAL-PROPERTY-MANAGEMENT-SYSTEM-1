import React, { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Select,
  Textarea,
} from '../ui'
import {
  mapPropertyTypeToBackend,
  mapFurnishingStatusToBackend,
  mapParkingAvailableToBackend,
} from '../../api/propertyApi'
import {
  Building2,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react'

const AMENITY_OPTIONS = [
  'Parking',
  'Lift',
  'Gym',
  'Security',
  'Power Backup',
  'Air Conditioning',
  'Wi-Fi',
]

const PROPERTY_TYPE_OPTIONS = [
  { label: 'Apartment', value: 'APARTMENT' },
  { label: 'House', value: 'HOUSE' },
  { label: 'Villa', value: 'VILLA' },
  { label: 'PG (Paying Guest)', value: 'PG' },
  { label: 'Hostel', value: 'HOSTEL' },
  { label: 'Commercial', value: 'COMMERCIAL' },
]

const FURNISHING_STATUS_OPTIONS = [
  { label: 'Unfurnished', value: 'UNFURNISHED' },
  { label: 'Semi-Furnished', value: 'SEMI_FURNISHED' },
  { label: 'Fully Furnished', value: 'FULLY_FURNISHED' },
]

const PARKING_OPTIONS = [
  { label: 'Available (Yes)', value: 'true' },
  { label: 'Not Available (No)', value: 'false' },
]

/**
 * OwnerPropertyForm Component
 * Contract-aligned form supporting create and update for backend PropertyRequest
 *
 * Backend Supported Fields (7 only):
 * 1. propertyName (string, required)
 * 2. propertyType (enum: APARTMENT, HOUSE, VILLA, PG, HOSTEL, COMMERCIAL, required)
 * 3. description (string, optional)
 * 4. totalArea (double, non-negative, optional)
 * 5. furnishingStatus (enum: UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED, optional)
 * 6. parkingAvailable (boolean, required)
 * 7. yearBuilt (integer, non-negative, optional)
 *
 * Excluded from form & submission:
 * - bedrooms, bathrooms, monthlyRent, securityDeposit (legacy fields)
 * - ownerId, status, propertyId/id (system/lifecycle fields)
 */
export default function OwnerPropertyForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save Property',
}) {
  const getInitialFormData = (data) => {
    const rawType = data?.propertyType || data?.type
    const mappedType = rawType ? mapPropertyTypeToBackend(rawType) : 'APARTMENT'

    const rawFurnishing = data?.furnishingStatus || data?.furnishing
    const mappedFurnishing = rawFurnishing
      ? mapFurnishingStatusToBackend(rawFurnishing)
      : 'UNFURNISHED'

    let mappedParking = 'false'
    if (data?.parkingAvailable != null) {
      mappedParking =
        data.parkingAvailable === true || data.parkingAvailable === 'true' ? 'true' : 'false'
    } else if (data?.parking != null) {
      mappedParking = mapParkingAvailableToBackend(data.parking) ? 'true' : 'false'
    } else if (Array.isArray(data?.amenities)) {
      const hasParking = data.amenities.some((a) => {
        const name = typeof a === 'string' ? a : a?.amenityName
        return String(name || '').trim().toLowerCase() === 'parking'
      })
      if (hasParking) {
        mappedParking = 'true'
      }
    }

    const rawYear = data?.yearBuilt != null ? data.yearBuilt : data?.year

    return {
      propertyName: data?.propertyName || data?.name || '',
      name: data?.propertyName || data?.name || '',
      propertyType: mappedType,
      type: mappedType,
      description: data?.description || '',
      totalArea:
        data?.totalArea != null
          ? String(data.totalArea)
          : data?.area != null
          ? String(data.area)
          : '',
      area:
        data?.totalArea != null
          ? String(data.totalArea)
          : data?.area != null
          ? String(data.area)
          : '',
      furnishingStatus: mappedFurnishing,
      furnishing: mappedFurnishing,
      parkingAvailable: mappedParking,
      parking: mappedParking,
      yearBuilt: rawYear != null ? String(rawYear) : '',
      year: rawYear != null ? String(rawYear) : '',
    }
  }

  const getInitialAmenities = (data) => {
    const list = Array.isArray(data?.amenities)
      ? data.amenities
          .map((amenity) =>
            typeof amenity === 'string' ? amenity : amenity?.amenityName
          )
          .filter(Boolean)
      : []

    const hasParkingOption =
      data?.parkingAvailable === true ||
      data?.parkingAvailable === 'true' ||
      data?.parking === true ||
      data?.parking === 'true'

    if (hasParkingOption && !list.some((name) => name.toLowerCase() === 'parking')) {
      return [...list, 'Parking']
    }
    return list
  }

  const [formData, setFormData] = useState(() => getInitialFormData(initialData))
  const [errors, setErrors] = useState({})
  const [selectedAmenities, setSelectedAmenities] = useState(() => getInitialAmenities(initialData))

  useEffect(() => {
    if (initialData) {
      setFormData(getInitialFormData(initialData))
      setSelectedAmenities(getInitialAmenities(initialData))
    }
  }, [initialData])

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }
      // Keep aliases in sync
      if (field === 'propertyName') updated.name = value
      if (field === 'name') updated.propertyName = value
      if (field === 'propertyType') updated.type = value
      if (field === 'type') updated.propertyType = value
      if (field === 'totalArea') updated.area = value
      if (field === 'area') updated.totalArea = value
      if (field === 'furnishingStatus') updated.furnishing = value
      if (field === 'furnishing') updated.furnishingStatus = value
      if (field === 'parkingAvailable') updated.parking = value
      if (field === 'parking') updated.parkingAvailable = value
      if (field === 'yearBuilt') updated.year = value
      if (field === 'year') updated.yearBuilt = value
      return updated
    })

    if (field === 'parkingAvailable' || field === 'parking') {
      setSelectedAmenities((prev) => {
        const hasParking = prev.some((name) => name.toLowerCase() === 'parking')
        if (value === 'true' && !hasParking) return [...prev, 'Parking']
        if (value !== 'true' && hasParking) {
          return prev.filter((name) => name.toLowerCase() !== 'parking')
        }
        return prev
      })
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = () => {
    const errs = {}

    const nameVal = (formData.propertyName || formData.name || '').trim()
    if (!nameVal) {
      errs.propertyName = 'Property name is required'
      errs.name = 'Property name is required'
    }

    if (!formData.propertyType && !formData.type) {
      errs.propertyType = 'Property type is required'
    }

    const areaVal = formData.totalArea !== '' ? formData.totalArea : formData.area
    if (areaVal !== '' && areaVal != null) {
      const areaNum = Number(areaVal)
      if (isNaN(areaNum) || areaNum < 0) {
        errs.totalArea = 'Total area cannot be negative'
        errs.area = 'Total area cannot be negative'
      }
    }

    const yearVal = formData.yearBuilt !== '' ? formData.yearBuilt : formData.year
    if (yearVal !== '' && yearVal != null) {
      const yearNum = Number(yearVal)
      if (isNaN(yearNum) || yearNum < 0 || !Number.isInteger(yearNum)) {
        errs.yearBuilt = 'Year built must be a non-negative integer'
        errs.year = 'Year built must be a non-negative integer'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Prevent duplicate submissions while in flight
    if (isLoading) return
    if (!validate()) return

    const rawPayload = {
      propertyName: (formData.propertyName || formData.name || '').trim(),
      propertyType: formData.propertyType || formData.type,
      description: (formData.description || '').trim() || undefined,
      totalArea:
        formData.totalArea !== '' && formData.totalArea != null && !isNaN(Number(formData.totalArea))
          ? Number(formData.totalArea)
          : formData.area !== '' && formData.area != null && !isNaN(Number(formData.area))
          ? Number(formData.area)
          : undefined,
      furnishingStatus: formData.furnishingStatus || formData.furnishing || undefined,
      parkingAvailable:
        formData.parkingAvailable === true || formData.parkingAvailable === 'true',
      yearBuilt:
        formData.yearBuilt !== '' && formData.yearBuilt != null && !isNaN(Number(formData.yearBuilt))
          ? parseInt(formData.yearBuilt, 10)
          : formData.year !== '' && formData.year != null && !isNaN(Number(formData.year))
          ? parseInt(formData.year, 10)
          : undefined,
    }

    // Filter out undefined fields so the payload strictly contains ONLY defined PropertyRequest fields
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([_, v]) => v !== undefined)
    )

    onSubmit(
      initialData
        ? payload
        : { ...payload, amenities: selectedAmenities }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* 1. General Property Information */}
      <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-[#D9E0E6] pb-4">
          <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#315A7D]" />
            General Property Information
          </h2>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Basic identity and classification for your property listing
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-1">
            <Input
              label="Property Name"
              placeholder="e.g. Sunset Palms Residences"
              value={formData.propertyName}
              onChange={(e) => handleChange('propertyName', e.target.value)}
              error={errors.propertyName || errors.name}
              required
            />
          </div>

          <div className="sm:col-span-1">
            <Select
              label="Property Type"
              options={PROPERTY_TYPE_OPTIONS}
              value={formData.propertyType}
              onChange={(e) => handleChange('propertyType', e.target.value)}
              error={errors.propertyType}
              required
            />
          </div>
        </div>
      </div>

      {/* 2. Specifications & Features */}
      <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-[#D9E0E6] pb-4">
          <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#315A7D]" />
            Property Specifications
          </h2>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Dimensions, construction year, furnishing status, and parking accommodations
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Input
            label="Total Area (Sq Ft)"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 1200"
            value={formData.totalArea}
            onChange={(e) => handleChange('totalArea', e.target.value)}
            error={errors.totalArea || errors.area}
          />

          <Input
            label="Year Built"
            type="number"
            min="1800"
            max={new Date().getFullYear() + 1}
            step="1"
            placeholder="e.g. 2022"
            value={formData.yearBuilt}
            onChange={(e) => handleChange('yearBuilt', e.target.value)}
            error={errors.yearBuilt}
            helperText="Year property was constructed"
          />

          <Select
            label="Furnishing Status"
            options={FURNISHING_STATUS_OPTIONS}
            value={formData.furnishingStatus}
            onChange={(e) => handleChange('furnishingStatus', e.target.value)}
          />

          <Select
            label="Parking Available"
            options={PARKING_OPTIONS}
            value={formData.parkingAvailable}
            onChange={(e) => handleChange('parkingAvailable', e.target.value)}
          />
        </div>
      </div>

      {/* Amenities are associated after the property is created. */}
      {!initialData && (
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#D9E0E6] pb-4">
            <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#315A7D]" />
              Amenities &amp; Facilities
            </h2>
            <p className="text-xs text-[#5B6875] mt-0.5">
              Select the facilities available at this property. You can change them later.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AMENITY_OPTIONS.map((amenity) => {
              const checked = selectedAmenities.some(
                (name) => name.toLowerCase() === amenity.toLowerCase()
              )
              return (
                <label
                  key={amenity}
                  className="flex items-center gap-3 rounded-xl border border-[#D9E0E6] p-3 text-sm text-[#243447] cursor-pointer hover:border-[#315A7D]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLoading}
                    onChange={(event) => {
                      if (amenity === 'Parking') {
                        handleChange('parkingAvailable', event.target.checked ? 'true' : 'false')
                        return
                      }
                      setSelectedAmenities((prev) =>
                        event.target.checked
                          ? [...prev.filter((name) => name.toLowerCase() !== amenity.toLowerCase()), amenity]
                          : prev.filter((name) => name.toLowerCase() !== amenity.toLowerCase())
                      )
                    }}
                    className="h-4 w-4 accent-[#315A7D]"
                  />
                  <span>{amenity}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Description */}
      <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-[#D9E0E6] pb-4">
          <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#315A7D]" />
            Property Description
          </h2>
          <p className="text-xs text-[#5B6875] mt-0.5">
            Detailed overview of property architecture, features, and leasing highlights
          </p>
        </div>

        <Textarea
          label="Description"
          rows={4}
          placeholder="Describe property architecture, neighborhood perks, proximity to transit, and unique architectural features..."
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
