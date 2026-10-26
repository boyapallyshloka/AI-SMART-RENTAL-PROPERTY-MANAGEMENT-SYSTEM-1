import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import PropertySummaryCard from '../../components/properties/PropertySummaryCard'
import OwnerPropertyTable from '../../components/properties/OwnerPropertyTable'
import {
  getOwnerPropertiesWithDetails,
  mapOwnerPropertyDetailsToUi,
  mapBackendPropertyToUi,
  deleteProperty,
  updatePropertyStatus,
  PROPERTY_TYPES,
  CANONICAL_PROPERTY_STATUSES,
} from '../../api/propertyApi'
import { Button, Input, Select, Loader } from '../../components/ui'
import {
  Plus,
  Search,
  Filter,
  RotateCcw,
  Building,
  Building2,
  AlertCircle,
} from 'lucide-react'

export { mapOwnerPropertyDetailsToUi, mapBackendPropertyToUi }

export default function PropertiesPage() {
  const location = useLocation()
  const [properties, setProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [toastMessage, setToastMessage] = useState(
    location.state?.toastMessage || ''
  )
  const [deletingId, setDeletingId] = useState(null)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  useEffect(() => {
    if (location.state?.toastMessage) {
      setToastMessage(location.state.toastMessage)
      const timer = setTimeout(() => setToastMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  const loadProperties = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getOwnerPropertiesWithDetails()
      setProperties(data)
    } catch (err) {
      console.error('Failed to load owner properties from backend:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load properties from server. Please try again.'
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProperties()
  }, [])

  const handleDelete = async (id) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await deleteProperty(id)
      setProperties((prev) =>
        prev.filter((item) => item.id !== id && item.propertyId !== id)
      )
      setToastMessage('Property deleted successfully.')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err) {
      console.error('Failed to delete property:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete property. Please try again.'
      setError(errorMsg)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    if (updatingStatusId) return
    setUpdatingStatusId(id)
    try {
      await updatePropertyStatus(id, newStatus)
      setProperties((prev) =>
        prev.map((item) =>
          item.id === id || item.propertyId === id
            ? { ...item, status: newStatus }
            : item
        )
      )
      setToastMessage(`Property status updated to ${newStatus}.`)
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err) {
      console.error('Failed to update property status:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update property status. Please try again.'
      setError(errorMsg)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  // Filtered properties
  const filteredProperties = properties.filter((item) => {
    const name = (item.name || item.propertyName || '').toLowerCase()
    const address = (item.address || item.addressLine1 || '').toLowerCase()
    const area = (item.area || '').toLowerCase()
    const city = (item.city || '').toLowerCase()
    const state = (item.state || '').toLowerCase()
    const fullLocation = (item.fullLocation || item.locationDisplay || '').toLowerCase()
    const query = searchQuery.trim().toLowerCase()

    const matchesSearch =
      query === '' ||
      name.includes(query) ||
      address.includes(query) ||
      area.includes(query) ||
      city.includes(query) ||
      state.includes(query) ||
      fullLocation.includes(query)

    const matchesType =
      typeFilter === 'all' ||
      (item.type || '').toLowerCase() === typeFilter.toLowerCase() ||
      (item.propertyType || '').toLowerCase() === typeFilter.toLowerCase()

    const matchesStatus =
      statusFilter === 'all' ||
      (item.status || '').toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesType && matchesStatus
  })

  const hasActiveFilters =
    searchQuery !== '' || typeFilter !== 'all' || statusFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const typeOptions = [
    { value: 'all', label: 'All Property Types' },
    ...Object.values(PROPERTY_TYPES).map((t) => ({
      value: t,
      label: t.charAt(0) + t.slice(1).toLowerCase(),
    })),
  ]

  const statusFilterOptions = [
    { value: 'all', label: 'All Statuses' },
    ...CANONICAL_PROPERTY_STATUSES.map((s) => ({
      value: s,
      label:
        s === 'UNDER_MAINTENANCE'
          ? 'Under Maintenance'
          : s.charAt(0) + s.slice(1).toLowerCase(),
    })),
  ]

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="properties"
      pageTitle="Properties"
    >
      <div className="space-y-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage('')}
              className="text-[#2A583B] hover:text-[#1d3d29]"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadProperties}
              className="text-xs font-semibold underline text-red-700 hover:text-red-900 ml-4 shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
              Properties
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Manage real estate listings, occupancy rates, and rental units
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/owner/properties/add">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                Add Property
              </Button>
            </Link>
          </div>
        </div>

        {/* Portfolio KPI Summary */}
        <PropertySummaryCard properties={properties} />

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 sm:p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search by property name, address, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
              />
            </div>

            <div>
              <Select
                options={typeOptions}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  options={statusFilterOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset all filters"
                  aria-label="Reset all filters"
                  className="p-2.5 rounded-lg border border-[#D9E0E6] text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#5B6875] pt-1 border-t border-[#D9E0E6]">
            <span>
              Showing{' '}
              <strong className="text-[#243447]">
                {filteredProperties.length}
              </strong>{' '}
              of {properties.length} properties
            </span>
            {hasActiveFilters && (
              <span className="text-[#315A7D] font-medium">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Properties Table / Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
            <Loader size="lg" text="Loading properties..." center />
          </div>
        ) : (
          <OwnerPropertyTable
            properties={filteredProperties}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            deletingId={deletingId}
            updatingStatusId={updatingStatusId}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
