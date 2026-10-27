import React, { useState, useEffect } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Input, Select, EmptyState, Loader } from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Building,
  Building2,
  Plus,
  Search,
  ArrowRight,
  Pencil,
  Trash2,
  Home,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import {
  getAllBuildings,
  getBuildingsForManager,
  getBuildingsByProperty,
  deleteBuilding,
} from '../../api/buildingApi'
import { getMyProperties, getManagerAssignedProperties } from '../../api/propertyApi'
import { resolveTenantRentalContext } from '../../utils/tenantRentalHelper'
import {
  ROLES,
  isPropertyOwner,
  isPropertyManager,
  isTenant as isTenantRole,
} from '../../utils/roles'

export default function BuildingsPage() {
  const { user } = useAuth()
  const isOwner = isPropertyOwner(user?.role)
  const isTenant = isTenantRole(user?.role)
  const isManager = isPropertyManager(user?.role)
  const canManage = isOwner
  const basePath = isTenant ? '/tenant' : '/owner'

  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryPropertyId = searchParams.get('propertyId')

  const [myRental, setMyRental] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [ownerProperties, setOwnerProperties] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [propertyFilter, setPropertyFilter] = useState(queryPropertyId || 'all')
  const [toastMessage, setToastMessage] = useState(
    location.state?.toastMessage || location.state?.toast || ''
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadBuildings = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      if (isTenant) {
        setMyRental(null)
        setBuildings([])

        const context = await resolveTenantRentalContext({ forceRefresh: true })
        if (!context) {
          setMyRental(null)
          setBuildings([])
          return
        }

        setMyRental(context.myRental)
        setBuildings(context.buildings)
      } else if (isManager) {
        // Manager data source connects to real assigned properties:
        try {
          const propsRes = await getManagerAssignedProperties()
          const propsList = Array.isArray(propsRes?.data)
            ? propsRes.data
            : Array.isArray(propsRes)
            ? propsRes
            : []
          setOwnerProperties(propsList)

          const targetProps =
            propertyFilter && propertyFilter !== 'all'
              ? propsList.filter((p) => String(p.propertyId || p.id) === String(propertyFilter))
              : propsList

          const buildingArrays = await Promise.all(
            targetProps.map(async (p) => {
              try {
                const bRes = await getBuildingsByProperty(p.propertyId || p.id)
                const list = Array.isArray(bRes?.data)
                  ? bRes.data
                  : Array.isArray(bRes)
                  ? bRes
                  : []
                return list.map((b) => ({
                  ...b,
                  propertyName: p.propertyName || p.name,
                  propertyId: p.propertyId || p.id,
                }))
              } catch (err) {
                console.warn(`Failed loading buildings for manager property ${p.propertyId || p.id}:`, err)
                return []
              }
            })
          )
          setBuildings(buildingArrays.flat())
        } catch (managerErr) {
          console.error('Failed loading manager properties and buildings:', managerErr)
          setErrorMessage(
            managerErr?.response?.data?.message ||
              managerErr?.message ||
              'Failed to load buildings for assigned properties.'
          )
          setBuildings([])
        }
      } else {
        // Owner data source connects to real backend:
        try {
          const propsRes = await getMyProperties()
          const propsList = Array.isArray(propsRes?.data)
            ? propsRes.data
            : Array.isArray(propsRes)
            ? propsRes
            : []
          setOwnerProperties(propsList)

          const targetProps =
            propertyFilter && propertyFilter !== 'all'
              ? propsList.filter((p) => String(p.propertyId || p.id) === String(propertyFilter))
              : propsList

          const buildingArrays = await Promise.all(
            targetProps.map(async (p) => {
              try {
                const bRes = await getBuildingsByProperty(p.propertyId || p.id)
                const list = Array.isArray(bRes?.data)
                  ? bRes.data
                  : Array.isArray(bRes)
                  ? bRes
                  : []
                return list.map((b) => ({
                  ...b,
                  propertyName: p.propertyName || p.name,
                  propertyId: p.propertyId || p.id,
                }))
              } catch (err) {
                console.warn(`Failed loading buildings for property ${p.propertyId || p.id}:`, err)
                return []
              }
            })
          )
          setBuildings(buildingArrays.flat())
        } catch (ownerErr) {
          console.error('Failed loading owner properties and buildings:', ownerErr)
          setErrorMessage(
            ownerErr?.response?.data?.message ||
              ownerErr?.message ||
              'Failed to load buildings for your properties.'
          )
        }
      }
    } catch (err) {
      console.error('Error loading buildings:', err)
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load rental property and buildings. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.toastMessage || location.state?.toast) {
      setToastMessage(location.state.toastMessage || location.state.toast)
      window.history.replaceState({}, document.title)
      const timer = setTimeout(() => setToastMessage(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  useEffect(() => {
    if (queryPropertyId) {
      setPropertyFilter(queryPropertyId)
    }
  }, [queryPropertyId])

  useEffect(() => {
    loadBuildings()
  }, [isTenant, user?.email, propertyFilter])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    setErrorMessage('')
    try {
      await deleteBuilding(deleteTarget.buildingId)
      setBuildings((prev) =>
        prev.filter((b) => b.buildingId !== deleteTarget.buildingId)
      )
      setToastMessage(
        `Building "${deleteTarget.buildingName}" was deleted successfully.`
      )
      setDeleteTarget(null)
      setTimeout(() => setToastMessage(''), 4000)
    } catch (err) {
      console.error('Failed to delete building:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to delete building. Please try again.'
      setErrorMessage(errorMsg)
      setTimeout(() => setErrorMessage(''), 5000)
    } finally {
      setIsDeleting(false)
    }
  }

  // Format address for tenant rental card
  const formattedAddress = myRental?.property
    ? [
        myRental.property.address,
        myRental.property.city,
        myRental.property.state,
        myRental.property.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  // Extract unique properties for filter
  const uniqueProperties = Array.from(
    new Set(buildings.map((b) => b.propertyId || b.property?.id).filter(Boolean))
  ).map((id) => {
    const found = buildings.find((b) => (b.propertyId || b.property?.id) === id)
    return { value: String(id), label: found.propertyName || found.property?.name || `Property #${id}` }
  })

  const propertyFilterOptions = isOwner && ownerProperties.length > 0
    ? [
        { value: 'all', label: 'All Associated Properties' },
        ...ownerProperties.map((p) => ({
          value: String(p.propertyId || p.id),
          label: p.propertyName || p.name,
        })),
      ]
    : [
        { value: 'all', label: 'All Associated Properties' },
        ...uniqueProperties,
      ]

  // Filtered buildings
  const filteredBuildings = buildings.filter((b) => {
    const propName = b.propertyName || b.property?.name || ''
    const matchesSearch =
      searchQuery.trim() === '' ||
      b.buildingName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      propName.toLowerCase().includes(searchQuery.toLowerCase())

    const bPropId = String(b.propertyId || b.property?.id || '')
    const matchesProperty =
      propertyFilter === 'all' || bPropId === String(propertyFilter)

    return matchesSearch && matchesProperty
  })

  return (
    <DashboardLayout
      defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
      activeItem="buildings"
      pageTitle={isTenant ? 'My Rental Property' : 'Buildings'}
    >
      <div className="space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3.5 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage('')}
              className="text-[#2A583B] hover:text-[#1c3c28] text-base leading-none px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-[#B94A48] text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B94A48]" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="text-[#B94A48] hover:text-[#8C3836] text-base leading-none px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Page Content: Tenant View vs Owner/Manager View */}
        {isTenant ? (
          isLoading ? (
            <div className="py-16 flex justify-center bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs">
              <Loader size="lg" text="Loading your rental property details..." center />
            </div>
          ) : errorMessage ? (
            <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
              <EmptyState
                icon={<AlertCircle className="w-8 h-8 text-[#B94A48]" />}
                title="Failed to Load Rental Property"
                description={errorMessage}
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={loadBuildings}
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                  >
                    Retry
                  </Button>
                }
              />
            </div>
          ) : !myRental ? (
            <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
              <EmptyState
                icon={<Home className="w-8 h-8 text-[#5B6875]" />}
                title="No Active Rental Property"
                description="You do not currently have an active lease or approved rental agreement associated with your account. Once your rental agreement is active, your leased property and community buildings will appear here."
                action={
                  <Link to="/tenant/find-properties">
                    <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Browse Available Properties
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Rental Summary Card */}
              <div className="rounded-lg bg-white border border-[#D9E0E6] p-6 shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E0E6] pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8] mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                      <span>Your Current Rental Property</span>
                    </div>
                    <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                      {myRental.property.name}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-[#5B6875] mt-1.5 flex-wrap">
                      <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                      {formattedAddress && (
                        <>
                          <span>{formattedAddress}</span>
                          <span>&bull;</span>
                        </>
                      )}
                      {myRental.leaseSummary?.unitNumber && (
                        <>
                          <span className="font-semibold text-[#243447]">
                            Unit {myRental.leaseSummary.unitNumber}
                          </span>
                          <span>&bull;</span>
                        </>
                      )}
                      <span className="text-[#2A583B] font-semibold">
                        {myRental.leaseSummary?.status || 'Active Lease'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {myRental.currentUnitId && (
                      <Link to={`/tenant/units/${myRental.currentUnitId}`}>
                        <Button size="sm" variant="primary">
                          View My Leased Unit
                        </Button>
                      </Link>
                    )}
                    <Link to="/tenant/find-properties">
                      <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Find Other Properties
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Hierarchy Breadcrumb Indicator */}
                <div className="flex items-center gap-2 text-xs text-[#5B6875] flex-wrap">
                  <span className="font-semibold text-[#243447]">Hierarchy:</span>
                  <span className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#D9E0E6] font-medium text-[#315A7D]">
                    My Rental Property
                  </span>
                  <span>&rarr;</span>
                  <span className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#D9E0E6] font-medium text-[#243447]">
                    Community Buildings ({buildings.length})
                  </span>
                  <span>&rarr;</span>
                  <span className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#D9E0E6] text-[#5B6875]">
                    Floors
                  </span>
                  <span>&rarr;</span>
                  <span className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#D9E0E6] text-[#5B6875]">
                    Units
                  </span>
                </div>
              </div>

              {/* Search Bar for Community Buildings */}
              <div className="bg-white p-4 rounded-lg border border-[#D9E0E6] shadow-2xs">
                <Input
                  placeholder="Search community buildings by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
                />
              </div>

              {/* Buildings Grid for Tenant */}
              {filteredBuildings.length === 0 ? (
                <EmptyState
                  icon={<Building className="w-8 h-8 text-[#5B6875]" />}
                  title="No community buildings found"
                  description={
                    searchQuery
                      ? 'No community buildings matched your active search query.'
                      : 'No community buildings are registered under your rental property.'
                  }
                  action={
                    searchQuery ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSearchQuery('')}
                      >
                        Reset Search
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredBuildings.map((building) => (
                    <div
                      key={building.buildingId}
                      className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col justify-between hover:border-[#315A7D]/40 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="font-semibold text-base text-[#243447] truncate">
                              {building.buildingName}
                            </h2>
                            {building.propertyName && (
                              <div className="flex items-center gap-1.5 text-xs text-[#5B6875] mt-0.5">
                                <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                                <span className="truncate">{building.propertyName}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#274B68] border border-[#D9E0E6]">
                              {building.totalFloors ?? '—'} Floors &bull; {building.totalUnits ?? '—'} Units
                            </span>
                            {building.buildingId === myRental?.currentBuilding?.buildingId && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                                Your Residence Tower
                              </span>
                            )}
                          </div>
                        </div>

                        {building.description && (
                          <p className="text-xs text-[#5B6875] leading-relaxed line-clamp-2">
                            {building.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-[#D9E0E6] text-xs text-[#5B6875] flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] truncate mr-2">
                            <Home className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span className="truncate">{building.propertyName || myRental.property.name}</span>
                          </span>
                          <span className="text-[11px] font-mono text-[#5B6875] shrink-0">
                            ID: {building.buildingId}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#D9E0E6] flex items-center justify-end">
                        <Link to={`/tenant/buildings/${building.buildingId}`}>
                          <Button
                            size="sm"
                            variant="primary"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          /* Owner / Manager View */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9E0E6] pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D]">
                    <Building className="w-4 h-4" />
                  </div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight text-[#243447]">
                    Buildings
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
                  Manage your residential complexes, multi-floor towers, and associated unit inventories.
                </p>
              </div>

              {canManage && (
                <Link to="/owner/buildings/new">
                  <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                    Add Building
                  </Button>
                </Link>
              )}
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-lg border border-[#D9E0E6] shadow-2xs flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Input
                  placeholder="Search buildings by name, property, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
                />
              </div>

              <div className="w-full sm:w-64">
                <Select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  options={propertyFilterOptions}
                />
              </div>
            </div>

            {/* Buildings Grid */}
            {isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="lg" text="Loading buildings..." center />
              </div>
            ) : filteredBuildings.length === 0 ? (
              <EmptyState
                icon={<Building className="w-8 h-8 text-[#5B6875]" />}
                title="No buildings found"
                description={
                  searchQuery || propertyFilter !== 'all'
                    ? 'No buildings matched your active search query or property filter.'
                    : 'No buildings registered in your portfolio yet.'
                }
                action={
                  searchQuery || propertyFilter !== 'all' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('')
                        setPropertyFilter('all')
                      }}
                    >
                      Reset Filters
                    </Button>
                  ) : canManage ? (
                    <Link to="/owner/buildings/new">
                      <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                        Add First Building
                      </Button>
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredBuildings.map((building) => (
                  <div
                    key={building.buildingId}
                    className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col justify-between hover:border-[#315A7D]/40 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Top Meta: Building Title & Floors/Units Tag */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="font-semibold text-base text-[#243447] truncate">
                            {building.buildingName}
                          </h2>
                          {(building.propertyName || building.property?.name) && (
                            <div className="flex items-center gap-1.5 text-xs text-[#5B6875] mt-0.5">
                              <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                              <span className="truncate">{building.propertyName || building.property?.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EAF2F7] text-[#274B68] border border-[#D9E0E6]">
                            {building.totalFloors ?? '—'} Floors &bull; {building.totalUnits ?? '—'} Units
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {building.description && (
                        <p className="text-xs text-[#5B6875] leading-relaxed line-clamp-2">
                          {building.description}
                        </p>
                      )}

                      {/* Property Location Tag */}
                      <div className="pt-2 border-t border-[#D9E0E6] text-xs text-[#5B6875] flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] truncate mr-2">
                          <Home className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                          <span className="truncate">{building.propertyName || building.property?.name || 'Associated Property'}</span>
                        </span>
                        <span className="text-[11px] font-mono text-[#5B6875] shrink-0">
                          ID: {building.buildingId}
                        </span>
                      </div>
                    </div>

                    {/* Actions: View (All Roles), Edit & Delete (Owner Only) */}
                    <div
                      className={`pt-4 mt-4 border-t border-[#D9E0E6] flex items-center ${
                        canManage ? 'justify-between' : 'justify-end'
                      } gap-2 flex-wrap sm:flex-nowrap`}
                    >
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Link to={`/owner/buildings/${building.buildingId}/edit`}>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Pencil className="w-3.5 h-3.5" />}
                            >
                              Edit
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#B94A48]" />}
                            onClick={() =>
                              setDeleteTarget({
                                buildingId: building.buildingId,
                                buildingName: building.buildingName,
                              })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      )}

                      <Link to={`${basePath}/buildings/${building.buildingId}`}>
                        <Button
                          size="sm"
                          variant="primary"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delete Confirmation Modal (Owner Only) */}
            {canManage && (
              <DeleteConfirmModal
                isOpen={Boolean(deleteTarget)}
                onClose={() => !isDeleting && setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                isLoading={isDeleting}
                title="Delete Building"
                itemName={deleteTarget?.buildingName}
                consequenceMessage={
                  deleteTarget &&
                  `Deleting this building will also permanently remove all floors and units registered within it.`
                }
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
