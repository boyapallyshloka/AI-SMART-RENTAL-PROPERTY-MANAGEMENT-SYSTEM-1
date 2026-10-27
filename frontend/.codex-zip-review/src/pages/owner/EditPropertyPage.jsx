import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import OwnerPropertyForm from '../../components/properties/OwnerPropertyForm'
import {
  getPropertyById,
  updateProperty,
  buildPropertyRequestPayload,
  mapBackendPropertyToUi,
} from '../../api/propertyApi'
import { Button, EmptyState, Loader } from '../../components/ui'
import { ArrowLeft, Building2, Edit, AlertCircle } from 'lucide-react'

export default function EditPropertyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [isLoadingProperty, setIsLoadingProperty] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fetchProperty = async () => {
    if (!id) return
    setIsLoadingProperty(true)
    setError(null)
    try {
      const response = await getPropertyById(id)
      const data = response?.data || response
      if (data && (data.propertyId || data.id)) {
        setProperty(mapBackendPropertyToUi(data))
      } else {
        setProperty(null)
      }
    } catch (err) {
      console.error(`Failed to load property details for ID ${id}:`, err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load property details. Please try again.'
      setError(errorMsg)
      setProperty(null)
    } finally {
      setIsLoadingProperty(false)
    }
  }

  useEffect(() => {
    fetchProperty()
  }, [id])

  if (isLoadingProperty) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle="Edit Property"
      >
        <div className="max-w-3xl mx-auto py-24 flex flex-col items-center justify-center">
          <Loader size="xl" text="Loading property details..." center />
        </div>
      </DashboardLayout>
    )
  }

  if (!property) {
    return (
      <DashboardLayout
        defaultRole="owner"
        activeItem="properties"
        pageTitle="Edit Property"
      >
        <div className="max-w-3xl mx-auto py-12">
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title={error ? 'Failed to Load Property' : 'Property Not Found'}
            message={error || `We could not find any property matching ID "${id}".`}
            action={
              <div className="flex items-center gap-3">
                {error && (
                  <Button variant="primary" onClick={fetchProperty}>
                    Retry
                  </Button>
                )}
                <Link to="/owner/properties">
                  <Button variant={error ? 'outline' : 'primary'} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back to Properties
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  const handleSubmit = async (updatedData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const payload = buildPropertyRequestPayload(updatedData)
      await updateProperty(id, payload)
      navigate(`/owner/properties/${id}`, {
        state: { toastMessage: 'Property updated successfully.' },
      })
    } catch (err) {
      console.error('Failed to update property:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update property. Please check your inputs and try again.'
      setError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="properties"
      pageTitle={`Edit ${property.name}`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875]">
          <Link
            to="/owner/properties"
            className="hover:text-[#315A7D] transition-colors"
          >
            Properties
          </Link>
          <span>/</span>
          <Link
            to={`/owner/properties/${property.id}`}
            className="hover:text-[#315A7D] transition-colors truncate max-w-[200px]"
          >
            {property.name}
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-semibold">Edit</span>
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
              <Edit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                Edit Property Details
              </h1>
              <p className="text-xs sm:text-sm text-[#5B6875] mt-0.5">
                Update specifications, rent pricing, amenities, and media assets
              </p>
            </div>
          </div>
        </div>

        {/* Form Pre-populated */}
        <OwnerPropertyForm
          initialData={property}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/owner/properties/${property.id}`)}
          isLoading={isSubmitting}
          submitLabel="Save Changes"
        />
      </div>
    </DashboardLayout>
  )
}
