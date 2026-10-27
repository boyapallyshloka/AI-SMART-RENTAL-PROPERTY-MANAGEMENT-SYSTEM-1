import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import OwnerPropertyForm from '../../components/properties/OwnerPropertyForm'
import { createProperty, buildPropertyRequestPayload } from '../../api/propertyApi'
import {
  addAmenityToProperty,
  createAmenity,
  getAllAmenities,
} from '../../api/amenityApi'
import { ArrowLeft, Building2, AlertCircle } from 'lucide-react'

export default function AddPropertyPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (data) => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const selectedAmenities = Array.isArray(data.amenities) ? data.amenities : []
      const payload = buildPropertyRequestPayload(data)
      const response = await createProperty(payload)
      const created = response?.data || response
      const createdId = created?.propertyId || created?.id
      if (createdId) {
        const amenityFailures = []

        if (selectedAmenities.length > 0) {
          try {
            const amenitiesResponse = await getAllAmenities()
            const existingAmenities = Array.isArray(amenitiesResponse)
              ? [...amenitiesResponse]
              : Array.isArray(amenitiesResponse?.data)
              ? [...amenitiesResponse.data]
              : []

            for (const amenityName of selectedAmenities) {
              try {
                let amenity = existingAmenities.find(
                  (item) =>
                    String(item?.amenityName || '').trim().toLowerCase() ===
                    amenityName.trim().toLowerCase()
                )

                if (!amenity) {
                  try {
                    const createResponse = await createAmenity({ amenityName })
                    amenity = createResponse?.data || createResponse
                    if (amenity) existingAmenities.push(amenity)
                  } catch (createErr) {
                    // A matching amenity may have been created concurrently; recheck before failing.
                    const refreshedResponse = await getAllAmenities()
                    const refreshedAmenities = Array.isArray(refreshedResponse)
                      ? refreshedResponse
                      : refreshedResponse?.data || []
                    amenity = refreshedAmenities.find(
                      (item) =>
                        String(item?.amenityName || '').trim().toLowerCase() ===
                        amenityName.trim().toLowerCase()
                    )
                    if (!amenity) throw createErr
                  }
                }

                const amenityId = amenity?.amenityId || amenity?.id
                if (!amenityId) throw new Error(`No ID returned for ${amenityName}`)
                await addAmenityToProperty(createdId, amenityId)
              } catch (amenityErr) {
                console.error(`Failed to attach ${amenityName} to new property:`, amenityErr)
                amenityFailures.push(amenityName)
              }
            }
          } catch (amenitiesLoadErr) {
            console.error('Failed to load amenities for the new property:', amenitiesLoadErr)
            amenityFailures.push(...selectedAmenities)
          }
        }

        const uniqueFailures = [...new Set(amenityFailures)]
        let toastMessage = ''
        let toastType = 'success'

        if (uniqueFailures.length > 0) {
          toastType = 'warning'
          toastMessage = `Property "${payload.propertyName || 'New Property'}" was created, but failed to attach ${uniqueFailures.length} amenity (${uniqueFailures.join(', ')}). These amenities were NOT saved to the property. You can retry attaching them from the Amenities section.`
        } else {
          toastMessage = selectedAmenities.length > 0
            ? `Property "${payload.propertyName || 'New Property'}" created successfully with all ${selectedAmenities.length} selected amenities attached.`
            : `Property "${payload.propertyName || 'New Property'}" created successfully.`
        }

        navigate(`/owner/properties/${createdId}`, {
          state: {
            toastMessage,
            toastType,
            amenityFailures: uniqueFailures.length > 0 ? uniqueFailures : undefined,
          },
        })
      } else {
        throw new Error('Property was created, but no valid property ID was returned by the server.')
      }
    } catch (err) {
      console.error('Failed to create property:', err)
      const validationMsgs =
        err?.data?.messages && typeof err.data.messages === 'object'
          ? Object.values(err.data.messages).join('. ')
          : null
      const errorMsg =
        validationMsgs ||
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to publish property. Please check your inputs and try again.'
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="properties"
      pageTitle="Add Property"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875]">
          <Link
            to="/owner/properties"
            className="inline-flex items-center gap-1 hover:text-[#315A7D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Properties</span>
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            Add New Property
          </span>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 font-bold ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Header */}
        <div className="border-b border-[#D9E0E6] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#315A7D] text-white shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                Add New Property
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                Register a new rental building, condo, or single-family residence
              </p>
            </div>
          </div>
        </div>

        {/* Property Form */}
        <OwnerPropertyForm
          onSubmit={handleSubmit}
          onCancel={() => navigate('/owner/properties')}
          isLoading={isLoading}
          submitLabel="Publish Property"
        />
      </div>
    </DashboardLayout>
  )
}
