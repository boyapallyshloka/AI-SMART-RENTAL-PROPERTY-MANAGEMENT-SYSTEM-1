import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, Input, EmptyState, Loader } from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Building,
  Building2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  Search,
  Lock,
  Info,
} from 'lucide-react'
import {
  getBuildingById,
  deleteBuilding,
} from '../../api/buildingApi'
import {
  getFloorsByBuilding,
  getFloorById,
  createFloor,
  updateFloor,
  deleteFloor,
  formatFloorRequest,
} from '../../api/floorApi'
import {
  getUnitsByFloor,
} from '../../api/unitApi'
import { getTenantBuildingDetails } from '../../utils/tenantRentalHelper'
import {
  ROLES,
  isPropertyOwner,
  isPropertyManager,
  isTenant as isTenantRole,
} from '../../utils/roles'

export default function BuildingDetailsPage() {
  const { user } = useAuth()
  const isOwner = isPropertyOwner(user?.role)
  const isTenant = isTenantRole(user?.role)
  const isManager = isPropertyManager(user?.role)
  const canManage = isOwner
  const basePath = isTenant ? '/tenant' : '/owner'

  const [myRental, setMyRental] = useState(null)

  const { buildingId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [building, setBuilding] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [floors, setFloors] = useState([])
  const [floorUnitsMap, setFloorUnitsMap] = useState({})
  const [toastMessage, setToastMessage] = useState('')

  // Modals state
  const [isDeleteBuildingOpen, setIsDeleteBuildingOpen] = useState(false)
  const [isDeletingBuilding, setIsDeletingBuilding] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [floorDeleteTarget, setFloorDeleteTarget] = useState(null)
  const [isDeletingFloor, setIsDeletingFloor] = useState(false)
  const [floorModalData, setFloorModalData] = useState(null) // { mode: 'add' | 'edit', floorId?: string, floorName: string, floorNumber: string, buildingId?: number, isLoadingFloor?: boolean }
  const [floorFormErrors, setFloorFormErrors] = useState({})
  const [isSubmittingFloor, setIsSubmittingFloor] = useState(false)
  const [floorModalError, setFloorModalError] = useState('')

  useEffect(() => {
    const incomingToast = location.state?.toastMessage || location.state?.toast
    if (incomingToast) {
      setToastMessage(incomingToast)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const loadData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      let b = null
      let flrs = []

      if (isTenant) {
        const tenantData = await getTenantBuildingDetails(buildingId)
        b = tenantData.building
        flrs = tenantData.floors
        setFloorUnitsMap(tenantData.floorUnitsMap || {})
        setMyRental(tenantData.myRental)
      } else {
        const res = await getBuildingById(buildingId)
        b = res?.data || res || null
        if (b) {
          try {
            const fRes = await getFloorsByBuilding(buildingId)
            const flrList = Array.isArray(fRes?.data)
              ? fRes.data
              : Array.isArray(fRes)
              ? fRes
              : []
            flrs = flrList.map((f) => ({
              ...f,
              id: f.floorId ?? f.id,
              floorId: f.floorId ?? f.id,
              name: f.floorName ?? f.name,
              floorName: f.floorName ?? f.name,
              floorNumber: f.floorNumber ?? f.number ?? null,
              buildingId: f.buildingId ?? buildingId,
              buildingName: f.buildingName ?? b.buildingName,
              propertyId: f.propertyId ?? b.propertyId,
              propertyName: f.propertyName ?? b.propertyName,
            }))
          } catch (floorErr) {
            console.error('Failed to load floors for building:', floorErr)
            flrs = []
          }
        }
      }

      setBuilding(b)
      setFloors(flrs || [])

      if (!isTenant && flrs && flrs.length > 0) {
        const unitsEntries = await Promise.all(
          flrs.map(async (f) => {
            const uList = await getUnitsByFloor(f.floorId)
            const resolvedUnits = uList?.data ?? uList ?? []
            return [f.floorId, Array.isArray(resolvedUnits) ? resolvedUnits : []]
          })
        )
        setFloorUnitsMap(Object.fromEntries(unitsEntries))
      } else if (!isTenant) {
        setFloorUnitsMap({})
      }
    } catch (err) {
      console.error('Error loading building details:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to load building details. Please try again.'
      setErrorMessage(errorMsg)
      setBuilding(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [buildingId])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Delete Building handler
  const handleConfirmDeleteBuilding = async () => {
    if (!building || !canManage || isDeletingBuilding) return
    setIsDeletingBuilding(true)
    setErrorMessage('')
    try {
      await deleteBuilding(building.buildingId)
      setIsDeleteBuildingOpen(false)
      const targetRedirect = isOwner && (building.propertyId || building.property?.id)
        ? `/owner/properties/${building.propertyId || building.property?.id}`
        : `${basePath}/buildings`
      navigate(targetRedirect, {
        state: {
          toastMessage: `Building "${building.buildingName}" was deleted successfully.`,
        },
      })
    } catch (err) {
      console.error('Failed to delete building:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to delete building. Please try again.'
      setErrorMessage(errorMsg)
      setIsDeleteBuildingOpen(false)
      setTimeout(() => setErrorMessage(''), 6000)
    } finally {
      setIsDeletingBuilding(false)
    }
  }

  // Delete Floor handler
  const handleConfirmDeleteFloor = async () => {
    if (!floorDeleteTarget || !canManage || isDeletingFloor) return
    setIsDeletingFloor(true)
    setErrorMessage('')
    try {
      await deleteFloor(floorDeleteTarget.floorId)
      setFloorDeleteTarget(null)
      await loadData()
      showToast(`Floor "${floorDeleteTarget.floorName}" was deleted successfully.`)
    } catch (err) {
      console.error('Failed to delete floor:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to delete floor. Please try again.'
      setErrorMessage(errorMsg)
      setFloorDeleteTarget(null)
      setTimeout(() => setErrorMessage(''), 6000)
    } finally {
      setIsDeletingFloor(false)
    }
  }

  // Floor form modal handlers
  const handleOpenAddFloor = () => {
    const nextNumber = floors.length > 0 ? Math.max(...floors.map((f) => f.floorNumber)) + 1 : 1
    setFloorModalData({
      mode: 'add',
      floorName: `Floor ${nextNumber}`,
      floorNumber: String(nextNumber),
      buildingId: building.buildingId,
      isLoadingFloor: false,
    })
    setFloorFormErrors({})
    setFloorModalError('')
  }

  const handleOpenEditFloor = async (floor) => {
    setFloorModalData({
      mode: 'edit',
      floorId: floor.floorId,
      floorName: floor.floorName || '',
      floorNumber: String(floor.floorNumber ?? ''),
      buildingId: floor.buildingId || building.buildingId,
      isLoadingFloor: true,
    })
    setFloorFormErrors({})
    setFloorModalError('')

    try {
      const res = await getFloorById(floor.floorId)
      const freshFloor = res?.data || res
      if (freshFloor) {
        setFloorModalData((prev) =>
          prev && prev.floorId === floor.floorId
            ? {
                ...prev,
                floorName: freshFloor.floorName ?? prev.floorName,
                floorNumber: String(freshFloor.floorNumber ?? prev.floorNumber),
                buildingId: freshFloor.buildingId ?? prev.buildingId,
                isLoadingFloor: false,
              }
            : prev
        )
      } else {
        setFloorModalData((prev) => (prev ? { ...prev, isLoadingFloor: false } : null))
      }
    } catch (err) {
      console.warn('Failed to fetch fresh floor for edit:', err)
      setFloorModalData((prev) => (prev ? { ...prev, isLoadingFloor: false } : null))
    }
  }

  const handleFloorSubmit = async (e) => {
    e.preventDefault()
    if (isSubmittingFloor || floorModalData?.isLoadingFloor) return

    const errs = {}
    const trimmedName = (floorModalData.floorName || '').trim()

    if (!trimmedName) {
      errs.floorName = 'Floor name is required.'
    }

    const rawFloorNumber = floorModalData.floorNumber
    const num = Number(rawFloorNumber)
    if (
      rawFloorNumber === '' ||
      rawFloorNumber === null ||
      rawFloorNumber === undefined ||
      isNaN(num) ||
      !Number.isInteger(num)
    ) {
      errs.floorNumber = 'Floor number must be an integer.'
    } else if (num < 0) {
      errs.floorNumber = 'Floor number cannot be negative.'
    }

    const targetBuildingId = Number(floorModalData.buildingId || building?.buildingId)
    if (!targetBuildingId || isNaN(targetBuildingId) || targetBuildingId <= 0) {
      errs.buildingId = 'Valid building ID is required.'
    }

    if (Object.keys(errs).length > 0) {
      setFloorFormErrors(errs)
      return
    }

    setIsSubmittingFloor(true)
    setFloorModalError('')

    try {
      const payload = formatFloorRequest({
        floorName: trimmedName,
        floorNumber: num,
        buildingId: targetBuildingId,
      })

      if (floorModalData.mode === 'add') {
        await createFloor(payload)
        showToast(`Added "${trimmedName}" successfully.`)
      } else {
        await updateFloor(floorModalData.floorId, payload)
        showToast(`Updated "${trimmedName}" successfully.`)
      }

      setFloorModalData(null)
      await loadData()
    } catch (err) {
      console.error('Failed to save floor:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        (floorModalData.mode === 'add'
          ? 'Failed to create floor. Please check the values and try again.'
          : 'Failed to update floor. Please check the values and try again.')
      setFloorModalError(errorMsg)
    } finally {
      setIsSubmittingFloor(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Loading Building Details..."
      >
        <div className="max-w-3xl mx-auto py-24 flex flex-col items-center justify-center">
          <Loader size="xl" text="Loading building details..." center />
        </div>
      </DashboardLayout>
    )
  }

  if (errorMessage && !building) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Error Loading Building"
      >
        <div className="space-y-6">
          <Link to={isOwner ? '/owner/properties' : `${basePath}/buildings`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              {isOwner ? 'Back to Properties' : isTenant ? 'Back to My Rental Property' : 'Back to Buildings'}
            </Button>
          </Link>
          <div className="p-6 rounded-xl bg-white border border-[#D9E0E6] text-center space-y-4 shadow-xs max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-[#B94A48] mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#243447]">Failed to Load Building</h3>
              <p className="text-xs text-[#5B6875] mt-1">{errorMessage}</p>
            </div>
            <Button size="sm" variant="primary" onClick={loadData}>
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!building) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Building Not Found"
      >
        <div className="space-y-6">
          <Link to={isOwner ? '/owner/properties' : `${basePath}/buildings`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              {isOwner ? 'Back to Properties' : isTenant ? 'Back to My Rental Property' : 'Back to Buildings'}
            </Button>
          </Link>
          <EmptyState
            icon={<Building className="w-8 h-8 text-[#5B6875]" />}
            title="Building Not Found"
            description={`No building found matching ID "${buildingId}".`}
            action={
              <Link to={isOwner ? '/owner/properties' : `${basePath}/buildings`}>
                <Button size="sm" variant="primary">
                  {isOwner ? 'View Properties' : isTenant ? 'View My Rental Property' : 'View All Buildings'}
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  const allUnitsCount =
    building.totalUnits != null
      ? building.totalUnits
      : building.units != null
      ? building.units
      : 0

  return (
    <DashboardLayout
      defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
      activeItem={isOwner ? 'properties' : 'buildings'}
      pageTitle={building.buildingName}
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

        {/* Hierarchy Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#5B6875] flex-wrap">
          {isTenant ? (
            <Link
              to="/tenant/buildings"
              className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
            >
              My Rental Property
            </Link>
          ) : (
            <>
              <Link
                to="/owner/properties"
                className="hover:text-[#315A7D] transition-colors"
              >
                Properties
              </Link>
              {(building.propertyId || building.property?.id) && (
                <>
                  <span>/</span>
                  <Link
                    to={`/owner/properties/${building.propertyId || building.property?.id}`}
                    className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
                  >
                    {building.propertyName || building.property?.name || `Property #${building.propertyId || building.property?.id}`}
                  </Link>
                </>
              )}
            </>
          )}
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            {building.buildingName}
          </span>
        </div>

        {/* Back Navigation Bar & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={
                isOwner && (building.propertyId || building.property?.id)
                  ? `/owner/properties/${building.propertyId || building.property?.id}`
                  : `${basePath}/buildings`
              }
            >
              <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                {isOwner && (building.propertyId || building.property?.id)
                  ? `Back to Property: ${building.propertyName || building.property?.name || 'Property Details'}`
                  : isTenant
                  ? 'Back to My Rental Property'
                  : 'Back to Buildings'}
              </Button>
            </Link>
            {isTenant && (
              <Link to="/tenant/find-properties">
                <Button size="sm" variant="outline" leftIcon={<Search className="w-3.5 h-3.5" />}>
                  Find Other Properties
                </Button>
              </Link>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Link to={`/owner/buildings/${building.buildingId}/edit`}>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Pencil className="w-3.5 h-3.5" />}
                >
                  Edit Building
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#B94A48]" />}
                onClick={() => setIsDeleteBuildingOpen(true)}
              >
                Delete Building
              </Button>
            </div>
          )}
        </div>

        {/* Building Overview Card */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#D9E0E6] pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] mb-2">
                <Building className="w-3.5 h-3.5" />
                <span>
                  {isTenant
                    ? 'Your Community Complex'
                    : 'Building Overview'}
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                {building.buildingName}
              </h1>
              {(building.propertyName || building.property?.name) && (
                <div className="flex items-center gap-2 text-xs text-[#5B6875] mt-1.5 flex-wrap">
                  <Building2 className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                  <span>
                    Associated Property:{' '}
                    <strong className="text-[#243447] font-semibold">
                      {building.propertyName || building.property?.name}
                    </strong>
                  </span>
                  {(building.propertyId || building.property?.id) && (
                    <>
                      <span>&bull;</span>
                      {isTenant ? (
                        <Link
                          to="/tenant/buildings"
                          className="text-[#315A7D] hover:underline font-semibold"
                        >
                          View Property Overview
                        </Link>
                      ) : (
                        <Link
                          to={`/owner/properties/${building.propertyId || building.property?.id}`}
                          className="text-[#315A7D] hover:underline font-semibold"
                        >
                          View Property Details
                        </Link>
                      )}
                    </>
                  )}
                  {building.property?.address && (
                    <>
                      <span>&bull;</span>
                      <span>
                        {building.property.address}, {building.property.city}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-center">
                <p className="text-xs uppercase font-semibold tracking-wider text-[#5B6875]">Floors</p>
                <p className="text-xl font-bold text-[#243447]">{building.totalFloors ?? '—'}</p>
              </div>
              <div className="px-3.5 py-2 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-center">
                <p className="text-xs uppercase font-semibold tracking-wider text-[#5B6875]">Units</p>
                <p className="text-xl font-bold text-[#315A7D]">{building.totalUnits ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {building.description && (
            <div className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
              <p className="font-medium text-[#243447] mb-1">Description</p>
              <p>{building.description}</p>
            </div>
          )}
        </div>

        {/* Floors Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#243447]">
                Floors in this Building
              </h2>
              <p className="text-xs text-[#5B6875]">
                Manage floor levels, inspect assigned units, or add a new floor.
              </p>
            </div>

            {canManage && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenAddFloor}
              >
                Add Floor
              </Button>
            )}
          </div>

          {floors.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-8 h-8 text-[#5B6875]" />}
              title="No floors registered"
              description="There are currently no floors registered in this building."
              action={
                canManage ? (
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleOpenAddFloor}
                  >
                    Add First Floor
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {floors.map((floor) => {
                const floorUnits = floorUnitsMap[floor.floorId] || []
                return (
                  <div
                    key={floor.floorId}
                    className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col justify-between hover:border-[#315A7D]/40 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#315A7D] block">
                            Floor {floor.floorNumber}
                          </span>
                          <h3 className="font-semibold text-base text-[#243447] mt-0.5">
                            {floor.floorName}
                          </h3>
                        </div>

                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EAF2F7] text-[#274B68] border border-[#D9E0E6]">
                          {floorUnits.length} Units
                        </span>
                      </div>

                      <p className="text-xs text-[#5B6875]">
                        {floorUnits.length > 0
                          ? `${floorUnits.map((u) => u.unitNumber).join(', ')}`
                          : 'No units assigned yet'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#D9E0E6] space-y-2">
                      <div
                        className={`flex items-center ${
                          canManage ? 'justify-between' : 'justify-end'
                        } gap-2 flex-wrap sm:flex-nowrap`}
                      >
                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Pencil className="w-3 h-3" />}
                              onClick={() => handleOpenEditFloor(floor)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Trash2 className="w-3 h-3 text-[#B94A48]" />}
                              onClick={() =>
                                setFloorDeleteTarget({
                                  floorId: floor.floorId,
                                  floorName: floor.floorName,
                                  unitsCount: floorUnits.length,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        )}

                        <Link
                          to={`${basePath}/buildings/${building.buildingId}/floors/${floor.floorId}`}
                        >
                          <Button
                            size="sm"
                            variant="primary"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            View Floor
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Management Modals (Owner Only) */}
        {canManage && (
          <>
            {/* Delete Building Modal */}
            <DeleteConfirmModal
              isOpen={isDeleteBuildingOpen}
              onClose={() => !isDeletingBuilding && setIsDeleteBuildingOpen(false)}
              onConfirm={handleConfirmDeleteBuilding}
              isLoading={isDeletingBuilding}
              title="Delete Building"
              itemName={building.buildingName}
              consequenceMessage={`This will permanently delete this building along with all of its registered floors and units.`}
            />

            {/* Delete Floor Modal */}
            <DeleteConfirmModal
              isOpen={Boolean(floorDeleteTarget)}
              onClose={() => !isDeletingFloor && setFloorDeleteTarget(null)}
              onConfirm={handleConfirmDeleteFloor}
              title="Delete Floor"
              itemName={floorDeleteTarget?.floorName}
              consequenceMessage={
                floorDeleteTarget &&
                `This will permanently remove this floor and all ${floorDeleteTarget.unitsCount ?? 0} units registered on it.`
              }
              isLoading={isDeletingFloor}
            />

            {/* Add / Edit Floor Modal */}
            {floorModalData && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
                role="dialog"
                aria-modal="true"
              >
                <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-[#EAF2F7] text-[#315A7D]">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#243447]">
                          {floorModalData.mode === 'add' ? 'Add Floor' : 'Edit Floor'}
                        </h3>
                        <p className="text-xs text-[#5B6875] truncate max-w-xs">
                          {building.buildingName}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => !isSubmittingFloor && setFloorModalData(null)}
                      disabled={isSubmittingFloor}
                      className="text-[#5B6875] hover:text-[#243447] p-1 rounded-md disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {floorModalError && (
                    <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] flex items-start gap-2.5 text-xs text-[#B94A48] animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong className="font-semibold block">Submission Error</strong>
                        <span>{floorModalError}</span>
                      </div>
                    </div>
                  )}

                  {floorModalData.isLoadingFloor ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <Loader size="md" text="Loading floor details..." center />
                    </div>
                  ) : (
                    <form onSubmit={handleFloorSubmit} className="space-y-4">
                      {floorModalData.mode === 'add' ? (
                        <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[#5B6875]">Target Building:</span>
                            <strong className="text-[#243447] font-semibold">{building.buildingName}</strong>
                          </div>
                          <p className="text-[#315A7D] text-[11px] flex items-center gap-1 mt-1">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            Floor will be created under this building.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[#5B6875]">Target Building:</span>
                            <strong className="text-[#243447] font-semibold">{building.buildingName}</strong>
                          </div>
                          <p className="text-[#856404] text-[11px] flex items-center gap-1 mt-1">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            Floor building association cannot be modified once created.
                          </p>
                        </div>
                      )}

                      <Input
                        label="Floor Name"
                        placeholder="e.g. Ground Floor, 2nd Floor, Penthouse"
                        value={floorModalData.floorName}
                        onChange={(e) =>
                          setFloorModalData((prev) => ({ ...prev, floorName: e.target.value }))
                        }
                        error={floorFormErrors.floorName}
                        disabled={isSubmittingFloor}
                        required
                      />

                      <Input
                        label="Floor Number (Integer Level)"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 0, 1, 2, 3"
                        value={floorModalData.floorNumber}
                        onChange={(e) =>
                          setFloorModalData((prev) => ({ ...prev, floorNumber: e.target.value }))
                        }
                        error={floorFormErrors.floorNumber}
                        disabled={isSubmittingFloor}
                        required
                      />

                      <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setFloorModalData(null)}
                          disabled={isSubmittingFloor}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={isSubmittingFloor}
                          leftIcon={isSubmittingFloor ? <Loader size="xs" /> : <Save className="w-4 h-4" />}
                        >
                          {isSubmittingFloor
                            ? 'Saving...'
                            : floorModalData.mode === 'add'
                            ? 'Create Floor'
                            : 'Save Changes'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
