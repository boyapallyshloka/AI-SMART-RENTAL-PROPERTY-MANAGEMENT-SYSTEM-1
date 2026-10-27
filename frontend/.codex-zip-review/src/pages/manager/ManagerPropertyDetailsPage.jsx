import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import {
  getManagerAssignedPropertyById,
  getManagerAssignedPropertyDetails,
  updateManagerAssignedProperty,
  resolveImageUrl,
} from '../../api/propertyApi'
import {
  getImagesByProperty,
  uploadImage,
  updateImage,
  deleteImage,
} from '../../api/propertyImageApi'
import {
  getAddress,
} from '../../api/propertyAddressApi'
import {
  getBuildingsByProperty,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from '../../api/buildingApi'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
  Input,
  Select,
  Textarea,
} from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Building2,
  ArrowLeft,
  ArrowRight,
  Edit,
  MapPin,
  Maximize2,
  Car,
  Sofa,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  X,
  Save,
  Layers,
  Info,
  ShieldCheck,
  Building,
  Image as ImageIcon,
  Upload,
  Star,
  Lock,
} from 'lucide-react'

// Formatters
const formatPropertyType = (type) => {
  if (!type) return '—'
  const str = String(type).replace(/_/g, ' ').toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const formatFurnishing = (furnishing) => {
  if (!furnishing) return '—'
  const upper = String(furnishing).toUpperCase()
  switch (upper) {
    case 'FULLY_FURNISHED':
      return 'Fully Furnished'
    case 'SEMI_FURNISHED':
      return 'Semi-Furnished'
    case 'UNFURNISHED':
      return 'Unfurnished'
    default:
      return String(furnishing).replace(/_/g, ' ')
  }
}

export default function ManagerPropertyDetailsPage() {
  const { propertyId } = useParams()
  const navigate = useNavigate()

  // State
  const [property, setProperty] = useState(null)
  const [address, setAddress] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // Edit Property Modal
  const [isEditPropertyOpen, setIsEditPropertyOpen] = useState(false)
  const [propertyForm, setPropertyForm] = useState({
    propertyName: '',
    propertyType: '',
    description: '',
    totalArea: '',
    furnishingStatus: '',
    parkingAvailable: '',
    yearBuilt: '',
  })
  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false)
  const [propertyUpdateError, setPropertyUpdateError] = useState(null)

  // Edit Address Modal
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const [addressForm, setAddressForm] = useState({
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
  })
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false)
  const [addressUpdateError, setAddressUpdateError] = useState(null)

  // Building Management Modals
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState(null)
  const [buildingForm, setBuildingForm] = useState({
    buildingName: '',
    totalFloors: '',
    description: '',
  })
  const [isSubmittingBuilding, setIsSubmittingBuilding] = useState(false)
  const [buildingModalError, setBuildingModalError] = useState(null)
  const [deletingBuilding, setDeletingBuilding] = useState(null)
  const [isDeletingBuilding, setIsDeletingBuilding] = useState(false)

  // Property Photos & Media State
  const [images, setImages] = useState([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [isUpdatingImageId, setIsUpdatingImageId] = useState(null)
  const [isDeletingImageId, setIsDeletingImageId] = useState(null)

  // Load Property Details & Hierarchy
  const loadData = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch assigned property response
      const propData = await getManagerAssignedPropertyById(propertyId)
      setProperty(propData)

      // Initialize Edit Form
      setPropertyForm({
        propertyName: propData.propertyName || '',
        propertyType: propData.propertyType || '',
        description: propData.description || '',
        totalArea: propData.totalArea != null ? String(propData.totalArea) : '',
        furnishingStatus: propData.furnishingStatus || '',
        parkingAvailable: propData.parkingAvailable == null ? '' : String(Boolean(propData.parkingAvailable)),
        yearBuilt: propData.yearBuilt != null ? String(propData.yearBuilt) : '',
      })

      // 2. Fetch full property details for address & images if available
      try {
        const detailsRes = await getManagerAssignedPropertyDetails(propertyId)
        const details = detailsRes?.data || detailsRes
        if (Array.isArray(details?.images)) {
          setImages(details.images)
          if (details.images.length > 0 && selectedImageIndex >= details.images.length) {
            setSelectedImageIndex(0)
          }
        }
        if (details?.address) {
          setAddress(details.address)
          setAddressForm({
            addressLine1: details.address.addressLine1 || '',
            addressLine2: details.address.addressLine2 || '',
            area: details.address.area || '',
            city: details.address.city || '',
            state: details.address.state || '',
            country: details.address.country || 'India',
            pincode: details.address.pincode || '',
          })
        }
      } catch (detErr) {
        // Fallback to getAddress
        try {
          const addrRes = await getAddress(propertyId)
          const addr = addrRes?.data || addrRes
          if (addr && (addr.addressId || addr.addressLine1)) {
            setAddress(addr)
            setAddressForm({
              addressLine1: addr.addressLine1 || '',
              addressLine2: addr.addressLine2 || '',
              area: addr.area || '',
              city: addr.city || '',
              state: addr.state || '',
              country: addr.country || 'India',
              pincode: addr.pincode || '',
            })
          }
        } catch {
          // Address may not be set yet or requires owner role
        }
      }

      // 3. Fetch Buildings belonging to property
      try {
        const bRes = await getBuildingsByProperty(propertyId)
        const bList = Array.isArray(bRes?.data)
          ? bRes.data
          : Array.isArray(bRes)
          ? bRes
          : []
        setBuildings(bList)
      } catch (bErr) {
        console.warn('Could not load buildings for property:', bErr)
        setBuildings([])
      }
    } catch (err) {
      console.error('Failed to load manager property details:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to load assigned property details. Please verify your permissions.'
      )
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Load fresh property images
  const loadImages = async () => {
    if (!propertyId) return
    setIsLoadingImages(true)
    try {
      const res = await getImagesByProperty(propertyId)
      const data = Array.isArray(res) ? res : res?.data || []
      setImages(data)
      if (data.length > 0 && selectedImageIndex >= data.length) {
        setSelectedImageIndex(0)
      }
    } catch {
      try {
        const detailsRes = await getManagerAssignedPropertyDetails(propertyId)
        const details = detailsRes?.data || detailsRes
        if (Array.isArray(details?.images)) {
          setImages(details.images)
        }
      } catch (err) {
        console.warn('Could not reload images:', err)
      }
    } finally {
      setIsLoadingImages(false)
    }
  }

  const handleUploadPhoto = async (e) => {
    const file = e.target?.files?.[0]
    if (!file || !propertyId || isUploadingImage) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WEBP, etc.)')
      return
    }
    setIsUploadingImage(true)
    setUploadError(null)
    try {
      await uploadImage(propertyId, {
        file,
        imageType: images.length === 0 ? 'PRIMARY' : 'GALLERY',
        isPrimary: images.length === 0,
      })
      await loadImages()
      showToast('Property photo uploaded successfully.')
    } catch (err) {
      console.error('Failed to upload photo:', err)
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload photo.'
      setUploadError(msg)
      alert(`Error: ${msg}`)
    } finally {
      setIsUploadingImage(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeletePhoto = async (imageId) => {
    if (!imageId || isDeletingImageId) return
    const confirmed = window.confirm('Are you sure you want to delete this property photo? This action cannot be undone.')
    if (!confirmed) return
    setIsDeletingImageId(imageId)
    try {
      await deleteImage(imageId)
      await loadImages()
      showToast('Property photo deleted successfully.')
    } catch (err) {
      console.error('Failed to delete photo:', err)
      alert(err?.response?.data?.message || 'Failed to delete photo.')
    } finally {
      setIsDeletingImageId(null)
    }
  }

  const handleSetPrimary = async (img) => {
    if (!img?.imageId || isUpdatingImageId || img.isPrimary) return
    setIsUpdatingImageId(img.imageId)
    try {
      await updateImage(img.imageId, {
        isPrimary: true,
        imageType: img.imageType || 'GALLERY',
      })
      await loadImages()
      showToast('Primary photo updated successfully.')
    } catch (err) {
      console.error('Failed to set primary photo:', err)
      alert(err?.response?.data?.message || 'Failed to update photo.')
    } finally {
      setIsUpdatingImageId(null)
    }
  }

  // Handle Edit Property Submit
  const handleSaveProperty = async (e) => {
    e?.preventDefault()
    if (!propertyId || isSubmittingProperty) return

    setIsSubmittingProperty(true)
    setPropertyUpdateError(null)

    // Form payload strictly matching backend PropertyRequest contract
    const payload = {
      propertyName: propertyForm.propertyName.trim(),
      propertyType: propertyForm.propertyType || undefined,
      description: propertyForm.description.trim() || undefined,
      totalArea: propertyForm.totalArea ? Number(propertyForm.totalArea) : undefined,
      furnishingStatus: propertyForm.furnishingStatus || undefined,
      parkingAvailable: propertyForm.parkingAvailable === ''
        ? undefined
        : propertyForm.parkingAvailable === 'true',
      yearBuilt: propertyForm.yearBuilt ? Number(propertyForm.yearBuilt) : undefined,
    }

    try {
      await updateManagerAssignedProperty(propertyId, payload)
      showToast('Property details updated successfully.')
      setIsEditPropertyOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to update property:', err)
      const status = err?.response?.status || err?.status
      if (status === 403) {
        setPropertyUpdateError(
          'You do not have permission to edit this property as it is not assigned to you.'
        )
      } else if (status === 404) {
        setPropertyUpdateError('Property not found or does not exist.')
      } else {
        setPropertyUpdateError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to update property. Please try again.'
        )
      }
    } finally {
      setIsSubmittingProperty(false)
    }
  }

  // Handle Edit Address Submit (Read-only for managers; address modifications require Property Owner role)
  const handleSaveAddress = (e) => {
    e?.preventDefault()
    setAddressUpdateError(
      'Notice: Property address updates require the Property Owner role. Managers cannot update address details with current permissions.'
    )
  }

  // Building Management Handlers
  const handleOpenAddBuilding = () => {
    setEditingBuilding(null)
    setBuildingForm({
      buildingName: '',
      totalFloors: '',
      description: '',
    })
    setBuildingModalError(null)
    setIsBuildingModalOpen(true)
  }

  const handleOpenEditBuilding = (b) => {
    setEditingBuilding(b)
    setBuildingForm({
      buildingName: b.buildingName || b.name || '',
      totalFloors: b.totalFloors != null ? String(b.totalFloors) : '',
      description: b.description || '',
    })
    setBuildingModalError(null)
    setIsBuildingModalOpen(true)
  }

  const handleSaveBuilding = async (e) => {
    e?.preventDefault()
    if (!propertyId || isSubmittingBuilding) return

    setIsSubmittingBuilding(true)
    setBuildingModalError(null)

    const payload = {
      buildingName: buildingForm.buildingName.trim(),
      totalFloors: buildingForm.totalFloors ? Number(buildingForm.totalFloors) : undefined,
      description: buildingForm.description.trim() || undefined,
      propertyId: Number(propertyId),
    }

    try {
      const bId = editingBuilding?.buildingId || editingBuilding?.id
      if (bId) {
        await updateBuilding(bId, payload)
        showToast('Building updated successfully.')
      } else {
        await createBuilding(payload)
        showToast('Building added successfully.')
      }
      setIsBuildingModalOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to save building:', err)
      setBuildingModalError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save building record.'
      )
    } finally {
      setIsSubmittingBuilding(false)
    }
  }

  const handleConfirmDeleteBuilding = async () => {
    const bId = deletingBuilding?.buildingId || deletingBuilding?.id
    if (!bId || isDeletingBuilding) return

    setIsDeletingBuilding(true)
    try {
      await deleteBuilding(bId)
      showToast('Building deleted successfully.')
      setDeletingBuilding(null)
      await loadData()
    } catch (err) {
      console.error('Failed to delete building:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to delete building.')
    } finally {
      setIsDeletingBuilding(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout
        defaultRole={ROLES.PROPERTY_MANAGER}
        activeItem="properties"
        pageTitle="Manager Property View"
      >
        <div className="py-20 flex justify-center">
          <Loader size="lg" text="Loading manager property details..." center />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !property) {
    return (
      <DashboardLayout
        defaultRole={ROLES.PROPERTY_MANAGER}
        activeItem="properties"
        pageTitle="Manager Property View"
      >
        <div className="space-y-4 max-w-2xl mx-auto py-12">
          <div className="p-6 rounded-xl bg-white border border-[#F8B4B4] shadow-xs space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#243447]">
                Unable to Load Assigned Property
              </h2>
              <p className="text-xs text-[#5B6875]">{error || 'Property not found'}</p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="primary" size="sm" onClick={loadData}>
                Retry
              </Button>
              <Link to="/manager/properties">
                <Button variant="secondary" size="sm">
                  Back to Assigned Properties
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="properties"
      pageTitle={`${property.propertyName || 'Property Details'} | Manager Property View`}
    >
      <div className="space-y-6 pb-16">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage('')}
              className="text-[#2A583B] hover:text-[#1E3E2A] font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/manager/properties"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#315A7D] hover:text-[#274B68] transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Assigned Properties</span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                Manager Property View
              </span>
              <span className="text-xs text-[#5B6875]">
                Read / Edit access for assigned property
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPropertyUpdateError(null)
                setIsEditPropertyOpen(true)
              }}
              leftIcon={<Edit className="w-4 h-4 text-[#315A7D]" />}
            >
              Edit Property
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddBuilding}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Building
            </Button>
          </div>
        </div>

        {/* Primary Property Info Banner */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E0E6] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-[#315A7D] bg-[#EAF2F7] px-2.5 py-0.5 rounded border border-[#D9E0E6]">
                  ID: #{property.propertyId}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#F7F8FA] text-[#5B6875] border border-[#D9E0E6]">
                  {formatPropertyType(property.propertyType)}
                </span>
                <StatusBadge status={property.status} size="sm" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                {property.propertyName || 'Unnamed Property'}
              </h1>
            </div>

            {property.ownerName && (
              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-0.5">
                <span className="text-[11px] uppercase font-bold text-[#5B6875] block tracking-wider">
                  Property Owner
                </span>
                <p className="font-bold text-[#243447] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#315A7D]" />
                  <span>{property.ownerName}</span>
                  {property.ownerId && (
                    <span className="font-mono text-[#5B6875] font-normal">
                      (#{property.ownerId})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875]">
              Description
            </h4>
            <p className="text-xs sm:text-sm text-[#243447] leading-relaxed">
              {property.description || 'No description provided for this assigned property.'}
            </p>
          </div>

          {/* Real Property Specifications Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875] mb-2.5">
              Property Specifications
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                <span className="text-[#5B6875] flex items-center gap-1.5 font-medium">
                  <Maximize2 className="w-3.5 h-3.5 text-[#315A7D]" />
                  Total Area
                </span>
                <p className="font-bold text-[#243447] text-sm">
                  {property.totalArea != null
                    ? `${Number(property.totalArea).toLocaleString('en-IN')} sq. ft.`
                    : '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                <span className="text-[#5B6875] flex items-center gap-1.5 font-medium">
                  <Sofa className="w-3.5 h-3.5 text-[#315A7D]" />
                  Furnishing
                </span>
                <p className="font-bold text-[#243447] text-sm">
                  {formatFurnishing(property.furnishingStatus)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                <span className="text-[#5B6875] flex items-center gap-1.5 font-medium">
                  <Car className="w-3.5 h-3.5 text-[#315A7D]" />
                  Parking
                </span>
                <p className="font-bold text-[#243447] text-sm">
                  {property.parkingAvailable == null ? 'Not specified' : property.parkingAvailable ? 'Available' : 'None'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                <span className="text-[#5B6875] flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-[#315A7D]" />
                  Year Built
                </span>
                <p className="font-bold text-[#243447] text-sm">
                  {property.yearBuilt != null ? String(property.yearBuilt) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Property Photos & Media Gallery */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E6] pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#315A7D]" />
              <h3 className="text-base font-bold text-[#243447]">
                Property Photos & Media
              </h3>
              {images.length > 0 && (
                <span className="text-xs text-[#5B6875] font-medium">
                  ({images.length} {images.length === 1 ? 'photo' : 'photos'})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D9E0E6] bg-white hover:bg-[#F7F8FA] text-xs font-semibold text-[#243447] cursor-pointer transition-colors shadow-2xs ${
                  isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploadingImage ? (
                  <Loader size="xs" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-[#315A7D]" />
                )}
                <span>{isUploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={handleUploadPhoto}
                />
              </label>
            </div>
          </div>

          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
              <span>{uploadError}</span>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-red-600 hover:text-red-800 font-bold"
              >
                &times;
              </button>
            </div>
          )}

          {isLoadingImages ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader size="md" text="Loading property photos..." center />
            </div>
          ) : images.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const currentImg = images[selectedImageIndex] || images[0]
                return (
                  <div className="relative rounded-2xl overflow-hidden aspect-video md:aspect-[21/9] max-h-[420px] bg-slate-900 border border-[#D9E0E6]">
                    <img
                      src={resolveImageUrl(currentImg?.imageUrl)}
                      alt={property.propertyName || 'Property photo'}
                      className="w-full h-full object-cover transition-all duration-300"
                    />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      {currentImg?.isPrimary && (
                        <span className="px-2.5 py-1 rounded-full bg-[#3F7D58] text-white text-xs font-semibold flex items-center gap-1 shadow-sm backdrop-blur-md">
                          <Star className="w-3 h-3 fill-current" />
                          Primary Photo
                        </span>
                      )}
                      {currentImg?.imageType && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-900/70 text-white text-xs backdrop-blur-md font-medium">
                          {currentImg.imageType}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/70 text-white text-xs backdrop-blur-md font-mono">
                      Photo {selectedImageIndex + 1} of {images.length}
                    </div>

                    {/* Actions */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      {!currentImg?.isPrimary && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="bg-white/90 hover:bg-white text-[#243447] border-white/40 backdrop-blur-md shadow-sm"
                          disabled={isUpdatingImageId === currentImg?.imageId}
                          onClick={() => handleSetPrimary(currentImg)}
                          leftIcon={
                            isUpdatingImageId === currentImg?.imageId ? (
                              <Loader size="xs" />
                            ) : (
                              <Star className="w-3 h-3 text-[#B7791F]" />
                            )
                          }
                        >
                          Make Primary
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        className="bg-white/90 hover:bg-red-50 text-red-600 border-white/40 backdrop-blur-md shadow-sm"
                        disabled={isDeletingImageId === currentImg?.imageId}
                        onClick={() => handleDeletePhoto(currentImg?.imageId)}
                        leftIcon={
                          isDeletingImageId === currentImg?.imageId ? (
                            <Loader size="xs" />
                          ) : (
                            <Trash2 className="w-3 h-3 text-red-500" />
                          )
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })()}

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.imageId || idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        selectedImageIndex === idx
                          ? 'border-[#315A7D] ring-2 ring-[#315A7D]/30'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={resolveImageUrl(img.imageUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {img.isPrimary && (
                        <span className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-[#3F7D58]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-[#D9E0E6] bg-[#F7F8FA] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EAF2F7] flex items-center justify-center mx-auto text-[#315A7D]">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#243447]">
                  No Property Photos Uploaded
                </p>
                <p className="text-xs text-[#5B6875] max-w-md mx-auto">
                  Upload photos to showcase this property to prospective tenants during browsing.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Property Address Section */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D]">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#243447]">
                  Property Address
                </h3>
                <span className="text-xs text-[#5B6875]">
                  Official location and postal details
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F0F4F8] text-[#5B6875] border border-[#D9E0E6]">
                <Lock className="w-3.5 h-3.5 text-[#5B6875]" />
                Read-Only
              </span>
              {address && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddressUpdateError(null)
                    setIsEditAddressOpen(true)
                  }}
                  leftIcon={<MapPin className="w-3.5 h-3.5 text-[#315A7D]" />}
                >
                  View Details
                </Button>
              )}
            </div>
          </div>

          {/* Manager Permission Note */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#F0F4F8] border border-[#D9E0E6] text-xs">
            <Info className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[#243447]">
                Address Management Restricted
              </p>
              <p className="text-[#5B6875]">
                Property address updates require the Property Owner role. Managers have read-only permissions to view address information and cannot modify it with current permissions.
              </p>
            </div>
          </div>

          {address ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5 sm:col-span-2">
                <span className="text-[#5B6875] font-semibold uppercase text-[10px] tracking-wider">
                  Address Line
                </span>
                <p className="text-sm font-semibold text-[#243447]">
                  {[address.addressLine1, address.addressLine2].filter(Boolean).join(', ')}
                </p>
              </div>

              {address.area && (
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                  <span className="text-[#5B6875] font-semibold uppercase text-[10px] tracking-wider">
                    Locality / Area
                  </span>
                  <p className="text-sm font-semibold text-[#243447]">{address.area}</p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                <span className="text-[#5B6875] font-semibold uppercase text-[10px] tracking-wider">
                  City & State
                </span>
                <p className="text-sm font-semibold text-[#243447]">
                  {[address.city, address.state].filter(Boolean).join(', ')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                <span className="text-[#5B6875] font-semibold uppercase text-[10px] tracking-wider">
                  Postal Code
                </span>
                <p className="text-sm font-semibold text-[#243447] font-mono">
                  {address.pincode || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                <span className="text-[#5B6875] font-semibold uppercase text-[10px] tracking-wider">
                  Country
                </span>
                <p className="text-sm font-semibold text-[#243447]">
                  {address.country || 'India'}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2 bg-[#F7F8FA] rounded-xl border border-dashed border-[#D9E0E6] p-6">
              <div className="w-10 h-10 rounded-full bg-[#EAF2F7] flex items-center justify-center mx-auto text-[#315A7D]">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-[#243447]">
                No Postal Address Registered
              </p>
              <p className="text-xs text-[#5B6875] max-w-sm mx-auto">
                No postal address is registered for this property yet. Address registration is restricted to the Property Owner role.
              </p>
            </div>
          )}
        </div>

        {/* Section 5: Buildings Hierarchy Section */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E6] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D]">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#243447]">
                  Property Buildings
                </h3>
                <span className="text-xs text-[#5B6875]">
                  Structural towers, floors, and unit blocks
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddBuilding}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Building
            </Button>
          </div>

          {buildings.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-8 h-8 text-[#5B6875]" />}
              title="No buildings registered"
              message="This property does not currently have any registered building structures. Add a building to configure floors and rental units."
              action={{
                label: 'Add Building',
                onClick: handleOpenAddBuilding,
                variant: 'primary',
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buildings.map((b) => {
                const bId = b.buildingId || b.id
                return (
                  <div
                    key={bId}
                    className="p-5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] hover:border-[#315A7D] transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#315A7D] bg-white px-2 py-0.5 rounded border border-[#D9E0E6]">
                            Building #{bId}
                          </span>
                          <h4 className="text-base font-bold text-[#243447] tracking-tight mt-1">
                            {b.buildingName || b.name || 'Unnamed Building'}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBuilding(b)}
                            className="p-1.5 rounded text-[#5B6875] hover:text-[#243447] hover:bg-white transition-colors"
                            title="Edit building"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingBuilding(b)}
                            className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-white transition-colors"
                            title="Delete building"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#5B6875] line-clamp-2">
                        {b.description || 'No building description provided.'}
                      </p>

                      <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between text-xs">
                        <span className="text-[#5B6875]">Total Floors:</span>
                        <span className="font-bold text-[#243447]">
                          {b.totalFloors != null ? b.totalFloors : '—'}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/manager/properties/${propertyId}/buildings/${bId}`}
                      className="block pt-1"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-between"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        View Building Details
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Property Modal */}
      {isEditPropertyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#315A7D]" />
                <h3 className="text-base font-bold text-[#243447]">
                  Edit Property Specifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPropertyOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {propertyUpdateError && (
              <div className="p-3.5 rounded-xl bg-[#FEF7EC] border border-[#F4E2B6] text-[#8A5B16] text-xs font-medium space-y-1">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B7791F]" />
                  <span>{propertyUpdateError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProperty} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Property Name *
                </label>
                <Input
                  value={propertyForm.propertyName}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({ ...prev, propertyName: e.target.value }))
                  }
                  required
                  placeholder="e.g. Meridian Plaza"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Property Type *
                  </label>
                  <Select
                    value={propertyForm.propertyType}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, propertyType: e.target.value }))
                    }
                    options={[
                      { label: 'Select property type', value: '' },
                      { label: 'Apartment', value: 'APARTMENT' },
                      { label: 'House', value: 'HOUSE' },
                      { label: 'Villa', value: 'VILLA' },
                      { label: 'PG', value: 'PG' },
                      { label: 'Hostel', value: 'HOSTEL' },
                      { label: 'Commercial', value: 'COMMERCIAL' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Total Area (sq. ft.)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={propertyForm.totalArea}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, totalArea: e.target.value }))
                    }
                    placeholder="e.g. 2400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Furnishing
                  </label>
                  <Select
                    value={propertyForm.furnishingStatus}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({
                        ...prev,
                        furnishingStatus: e.target.value,
                      }))
                    }
                    options={[
                      { label: 'Not specified', value: '' },
                      { label: 'Unfurnished', value: 'UNFURNISHED' },
                      { label: 'Semi-Furnished', value: 'SEMI_FURNISHED' },
                      { label: 'Fully Furnished', value: 'FULLY_FURNISHED' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Parking
                  </label>
                  <Select
                    value={propertyForm.parkingAvailable}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({
                        ...prev,
                        parkingAvailable: e.target.value,
                      }))
                    }
                    options={[
                      { label: 'Not specified', value: '' },
                      { label: 'Available (Yes)', value: 'true' },
                      { label: 'No Parking', value: 'false' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Year Built
                  </label>
                  <Input
                    type="number"
                    min="1800"
                    max={new Date().getFullYear()}
                    value={propertyForm.yearBuilt}
                    onChange={(e) =>
                      setPropertyForm((prev) => ({ ...prev, yearBuilt: e.target.value }))
                    }
                    placeholder="e.g. 2021"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Description
                </label>
                <Textarea
                  rows={3}
                  value={propertyForm.description}
                  onChange={(e) =>
                    setPropertyForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Overview of property listing, operational guidelines..."
                />
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditPropertyOpen(false)}
                  disabled={isSubmittingProperty}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingProperty}
                  leftIcon={isSubmittingProperty ? <Loader size="xs" /> : <Save className="w-3.5 h-3.5" />}
                >
                  {isSubmittingProperty ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Property Address Modal (Read-Only) */}
      {isEditAddressOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#315A7D]" />
                <h3 className="text-base font-bold text-[#243447]">
                  Property Address Details (Read-Only)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAddressOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note banner that managers cannot update it with current permissions */}
            <div className="p-3.5 rounded-xl bg-[#FEF7EC] border border-[#F4E2B6] text-[#8A5B16] text-xs font-medium space-y-1">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B7791F]" />
                <span>
                  Notice: Managers cannot update property address details with current permissions. Updating or registering an address requires the Property Owner role.
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Address Line 1
                </label>
                <Input
                  value={addressForm.addressLine1}
                  disabled
                  readOnly
                  placeholder="Street address, building number..."
                />
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Address Line 2
                </label>
                <Input
                  value={addressForm.addressLine2}
                  disabled
                  readOnly
                  placeholder="Apartment, suite, unit, floor..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Locality / Area
                  </label>
                  <Input
                    value={addressForm.area}
                    disabled
                    readOnly
                    placeholder="Locality / Area"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    City
                  </label>
                  <Input
                    value={addressForm.city}
                    disabled
                    readOnly
                    placeholder="City"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    State
                  </label>
                  <Input
                    value={addressForm.state}
                    disabled
                    readOnly
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Pincode
                  </label>
                  <Input
                    value={addressForm.pincode}
                    disabled
                    readOnly
                    placeholder="Pincode"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Country
                  </label>
                  <Input
                    value={addressForm.country}
                    disabled
                    readOnly
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditAddressOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled
                  aria-disabled="true"
                  title="Managers cannot update property address with current permissions"
                  className="opacity-50 cursor-not-allowed"
                  leftIcon={<Lock className="w-3.5 h-3.5" />}
                >
                  Save Address
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Building Modal */}
      {isBuildingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#315A7D]" />
                <h3 className="text-base font-bold text-[#243447]">
                  {editingBuilding ? 'Edit Building' : 'Add New Building'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBuildingModalOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {buildingModalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {buildingModalError}
              </div>
            )}

            <form onSubmit={handleSaveBuilding} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Building Name *
                </label>
                <Input
                  value={buildingForm.buildingName}
                  onChange={(e) =>
                    setBuildingForm((prev) => ({ ...prev, buildingName: e.target.value }))
                  }
                  required
                  placeholder="e.g. Tower A / Block 1"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Total Floors
                </label>
                <Input
                  type="number"
                  min="1"
                  value={buildingForm.totalFloors}
                  onChange={(e) =>
                    setBuildingForm((prev) => ({ ...prev, totalFloors: e.target.value }))
                  }
                  placeholder="e.g. 10"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Description
                </label>
                <Textarea
                  rows={3}
                  value={buildingForm.description}
                  onChange={(e) =>
                    setBuildingForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Structural details, entrance information..."
                />
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBuildingModalOpen(false)}
                  disabled={isSubmittingBuilding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingBuilding}
                  leftIcon={isSubmittingBuilding ? <Loader size="xs" /> : <Save className="w-3.5 h-3.5" />}
                >
                  {isSubmittingBuilding ? 'Saving...' : editingBuilding ? 'Update Building' : 'Create Building'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Building Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingBuilding)}
        onClose={() => !isDeletingBuilding && setDeletingBuilding(null)}
        onConfirm={handleConfirmDeleteBuilding}
        title="Delete Building"
        itemName={deletingBuilding?.buildingName || deletingBuilding?.name}
        consequenceMessage="This will permanently delete this building along with all of its associated floors and units."
        isLoading={isDeletingBuilding}
      />
    </DashboardLayout>
  )
}
