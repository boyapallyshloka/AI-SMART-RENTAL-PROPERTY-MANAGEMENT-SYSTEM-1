import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, StatusBadge, EmptyState, Input, Loader } from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Layers,
  Building,
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Home,
  CheckCircle2,
  Save,
  X,
  Search,
  AlertCircle,
  Lock,
  Info,
} from 'lucide-react'
import {
  getBuildingById,
} from '../../api/buildingApi'
import {
  getFloorById,
  updateFloor,
  deleteFloor,
  formatFloorRequest,
} from '../../api/floorApi'
import {
  getUnitsByFloor,
  deleteUnit,
} from '../../api/unitApi'
import { getTenantFloorDetails } from '../../utils/tenantRentalHelper'
import { formatCurrency } from '../../utils/currency'
import {
  ROLES,
  isPropertyOwner,
  isPropertyManager,
  isTenant as isTenantRole,
} from '../../utils/roles'

export default function FloorDetailsPage() {
  const { user } = useAuth()
  const isOwner = isPropertyOwner(user?.role)
  const isTenant = isTenantRole(user?.role)
  const isManager = isPropertyManager(user?.role)
  const canManage = isOwner
  const basePath = isTenant ? '/tenant' : '/owner'

  const [myRental, setMyRental] = useState(null)

  const { buildingId, floorId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [floor, setFloor] = useState(null)
  const [building, setBuilding] = useState(null)
  const [units, setUnits] = useState([])
  const [toastMessage, setToastMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const incomingToast = location.state?.toastMessage || location.state?.toast
    if (incomingToast) {
      showToast(incomingToast)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Modals state
  const [isEditFloorOpen, setIsEditFloorOpen] = useState(false)
  const [editFloorName, setEditFloorName] = useState('')
  const [editFloorNumber, setEditFloorNumber] = useState('')
  const [floorFormErrors, setFloorFormErrors] = useState({})
  const [isSubmittingFloor, setIsSubmittingFloor] = useState(false)
  const [floorModalError, setFloorModalError] = useState('')
  const [isFloorModalLoading, setIsFloorModalLoading] = useState(false)

  const [isDeleteFloorOpen, setIsDeleteFloorOpen] = useState(false)
  const [isDeletingFloor, setIsDeletingFloor] = useState(false)
  const [unitDeleteTarget, setUnitDeleteTarget] = useState(null)

  const loadData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      let flr = null
      let bld = null
      let unitList = []

      if (isTenant) {
        const tenantData = await getTenantFloorDetails(buildingId, floorId)
        flr = tenantData.floor
        bld = tenantData.building
        unitList = tenantData.units
        setMyRental(tenantData.myRental)
      } else {
        // Real Backend Floor Read Flow (Owner & Manager)
        const res = await getFloorById(floorId)
        const rawFlr = res?.data || res || null
        if (rawFlr) {
          flr = {
            ...rawFlr,
            id: rawFlr.floorId ?? rawFlr.id,
            floorId: rawFlr.floorId ?? rawFlr.id,
            name: rawFlr.floorName ?? rawFlr.name,
            floorName: rawFlr.floorName ?? rawFlr.name,
            floorNumber: rawFlr.floorNumber ?? rawFlr.number ?? null,
            buildingId: rawFlr.buildingId ?? buildingId,
            buildingName: rawFlr.buildingName,
            propertyId: rawFlr.propertyId,
            propertyName: rawFlr.propertyName,
          }

          const bId = flr.buildingId || buildingId
          if (bId) {
            try {
              const bRes = await getBuildingById(bId)
              bld = bRes?.data || bRes || null
            } catch (bErr) {
              console.warn('Could not load building info for floor:', bErr)
              bld = null
            }
          }
          const uRes = await getUnitsByFloor(floorId)
          const rawUnits = uRes?.data ?? uRes ?? []
          unitList = Array.isArray(rawUnits)
            ? rawUnits.map((u) => ({
                ...u,
                id: u.unitId ?? u.id,
                unitId: u.unitId ?? u.id,
                unitNumber: u.unitNumber ?? u.number ?? '',
                unitType: u.unitType ?? u.type ?? null,
                status: u.status ?? null,
                monthlyRent: u.monthlyRent ?? u.rent ?? null,
                securityDeposit: u.securityDeposit ?? u.deposit ?? null,
                area: u.area ?? null,
                bedrooms: u.bedrooms ?? null,
                bathrooms: u.bathrooms ?? null,
                description: u.description ?? '',
                floorId: u.floorId ?? flr.floorId ?? floorId,
                floorName: u.floorName ?? flr.floorName,
                floorNumber: u.floorNumber ?? flr.floorNumber,
                buildingId: u.buildingId ?? flr.buildingId,
                buildingName: u.buildingName ?? flr.buildingName,
                propertyId: u.propertyId ?? flr.propertyId,
                propertyName: u.propertyName ?? flr.propertyName,
              }))
            : []
        }
      }

      setFloor(flr)
      if (flr) {
        setBuilding(bld)
        setUnits(unitList || [])
        setEditFloorName(flr.floorName)
        setEditFloorNumber(String(flr.floorNumber))
      }
    } catch (err) {
      console.error('Error loading floor details:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to load floor details. Please try again.'
      setErrorMessage(errorMsg)
      setFloor(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [buildingId, floorId])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Delete Floor Handler
  const handleConfirmDeleteFloor = async () => {
    if (!floor || !canManage || isDeletingFloor) return
    setIsDeletingFloor(true)
    setErrorMessage('')
    try {
      await deleteFloor(floor.floorId)
      setIsDeleteFloorOpen(false)
      navigate(`${basePath}/buildings/${building?.buildingId || buildingId}`, {
        state: {
          toastMessage: `Floor "${floor.floorName}" was deleted successfully.`,
        },
      })
    } catch (err) {
      console.error('Failed to delete floor:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to delete floor. Please try again.'
      setErrorMessage(errorMsg)
      setIsDeleteFloorOpen(false)
      setTimeout(() => setErrorMessage(''), 6000)
    } finally {
      setIsDeletingFloor(false)
    }
  }

  // Delete Unit Handler
  const handleConfirmDeleteUnit = async () => {
    if (!unitDeleteTarget || !canManage) return
    try {
      await deleteUnit(unitDeleteTarget.unitId)
      await loadData()
      showToast(`Unit "${unitDeleteTarget.unitNumber}" was deleted.`)
      setUnitDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete unit:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to delete unit. Please try again.'
      setErrorMessage(errorMsg)
      setUnitDeleteTarget(null)
    }
  }

  // Open Edit Floor Modal & refresh details
  const handleOpenEditFloor = async () => {
    setIsEditFloorOpen(true)
    setFloorFormErrors({})
    setFloorModalError('')
    setIsFloorModalLoading(true)
    if (floor) {
      setEditFloorName(floor.floorName || '')
      setEditFloorNumber(String(floor.floorNumber ?? ''))
    }
    try {
      const res = await getFloorById(floorId)
      const freshFloor = res?.data || res
      if (freshFloor) {
        setEditFloorName(freshFloor.floorName ?? '')
        setEditFloorNumber(String(freshFloor.floorNumber ?? ''))
      }
    } catch (err) {
      console.warn('Could not re-fetch floor before edit:', err)
    } finally {
      setIsFloorModalLoading(false)
    }
  }

  // Edit Floor Submit
  const handleFloorSubmit = async (e) => {
    e.preventDefault()
    if (isSubmittingFloor || isFloorModalLoading) return
    const errs = {}

    const trimmedName = editFloorName.trim()
    if (!trimmedName) {
      errs.floorName = 'Floor name is required.'
    }

    const num = Number(editFloorNumber)
    if (
      editFloorNumber === '' ||
      editFloorNumber === null ||
      editFloorNumber === undefined ||
      isNaN(num) ||
      !Number.isInteger(num)
    ) {
      errs.floorNumber = 'Floor number must be an integer.'
    } else if (num < 0) {
      errs.floorNumber = 'Floor number cannot be negative.'
    }

    const targetBuildingId = Number(floor?.buildingId || building?.buildingId || buildingId)
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

      await updateFloor(floor.floorId, payload)
      showToast('Floor updated successfully.')
      setIsEditFloorOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to update floor:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to update floor. Please check the values and try again.'
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
        pageTitle="Loading Floor Details..."
      >
        <div className="max-w-3xl mx-auto py-24 flex flex-col items-center justify-center">
          <Loader size="xl" text="Loading floor details..." center />
        </div>
      </DashboardLayout>
    )
  }

  if (errorMessage && !floor) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Error Loading Floor"
      >
        <div className="space-y-6">
          <Link to={`${basePath}/buildings/${buildingId}`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Building
            </Button>
          </Link>
          <div className="p-6 rounded-xl bg-white border border-[#D9E0E6] text-center space-y-4 shadow-xs max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-center text-[#B94A48] mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#243447]">Failed to Load Floor</h3>
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

  if (!floor) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Floor Not Found"
      >
        <div className="space-y-6">
          <Link to={`${basePath}/buildings/${buildingId}`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Building
            </Button>
          </Link>
          <EmptyState
            icon={<Layers className="w-8 h-8 text-[#5B6875]" />}
            title="Floor Not Found"
            description={`No floor found matching ID "${floorId}".`}
            action={
              <Link to={`${basePath}/buildings`}>
                <Button size="sm" variant="primary">
                  {isTenant ? 'Back to My Rental Property' : 'Back to Buildings'}
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  const buildingName =
    floor.buildingName || building?.buildingName || floor.building?.buildingName || 'Building'
  const propertyName =
    floor.propertyName || building?.propertyName || building?.property?.name || ''

  return (
    <DashboardLayout
      defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
      activeItem={isOwner ? 'properties' : 'buildings'}
      pageTitle={`${floor.floorName} - ${buildingName}`}
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
              {(floor.propertyId || building?.propertyId || building?.property?.id) && (
                <>
                  <span>/</span>
                  <Link
                    to={`/owner/properties/${floor.propertyId || building?.propertyId || building?.property?.id}`}
                    className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
                  >
                    {propertyName || `Property #${floor.propertyId || building?.propertyId || building?.property?.id}`}
                  </Link>
                </>
              )}
            </>
          )}
          <span>/</span>
          <Link
            to={`${basePath}/buildings/${buildingId}`}
            className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
          >
            {buildingName}
          </Link>
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            {floor.floorName}
          </span>
        </div>

        {/* Back Navigation Bar & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`${basePath}/buildings/${buildingId}`}>
              <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to {buildingName}
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
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Pencil className="w-3.5 h-3.5" />}
                onClick={handleOpenEditFloor}
              >
                Edit Floor
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#B94A48]" />}
                onClick={() => setIsDeleteFloorOpen(true)}
              >
                Delete Floor
              </Button>
            </div>
          )}
        </div>

        {/* Floor Overview Header Card */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>Floor Overview</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                {floor.floorName}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[#5B6875] mt-1.5 flex-wrap">
                <Building className="w-3.5 h-3.5 text-[#315A7D] shrink-0" />
                <span>
                  Building:{' '}
                  <strong className="text-[#243447] font-semibold">
                    {buildingName}
                  </strong>
                </span>
                <span>&bull;</span>
                <span>Level {floor.floorNumber}</span>
                {propertyName && (
                  <>
                    <span>&bull;</span>
                    <span>
                      Property: <strong className="text-[#243447]">{propertyName}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-center">
                <p className="text-xs uppercase font-semibold tracking-wider text-[#5B6875]">Units</p>
                <p className="text-xl font-bold text-[#315A7D]">{units.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Units Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#243447]">
                Units on this Floor
              </h2>
              <p className="text-xs text-[#5B6875]">
                List of registered rental units, rooms, and occupancy statuses.
              </p>
            </div>

            {canManage && (
              <Link
                to={`/owner/buildings/${buildingId}/floors/${floorId}/units/new`}
              >
                <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                  Add Unit
                </Button>
              </Link>
            )}
          </div>

          {units.length === 0 ? (
            <EmptyState
              icon={<Home className="w-8 h-8 text-[#5B6875]" />}
              title="No units on this floor"
              description="No rental units or rooms are registered on this floor yet."
              action={
                canManage ? (
                  <Link
                    to={`/owner/buildings/${buildingId}/floors/${floorId}/units/new`}
                  >
                    <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                      Add First Unit
                    </Button>
                  </Link>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {units.map((unit) => (
                <div
                  key={unit.unitId}
                  className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs flex flex-col justify-between hover:border-[#315A7D]/40 transition-colors"
                >
                  <div className="space-y-3.5">
                    {/* Header: Unit Number, Status, Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#5B6875]">
                            {unit.unitType || '—'}
                          </span>
                          {isTenant && String(unit.unitId) === String(myRental?.currentUnitId) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                              Your Leased Unit
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg text-[#243447] mt-0.5">
                          Unit {unit.unitNumber}
                        </h3>
                      </div>

                      <StatusBadge status={unit.status} size="sm" />
                    </div>

                    {/* Rent & Specifications */}
                    <div className="pt-2 border-t border-[#D9E0E6] space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-[#5B6875]">Monthly Rent</span>
                        <span className="text-base font-bold text-[#243447]">
                          {formatCurrency(unit.monthlyRent)}
                          <span className="text-xs font-normal text-[#5B6875]">/mo</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/60">
                          <p className="text-[10px] uppercase text-[#5B6875] font-semibold">Area</p>
                          <p className="text-xs font-bold text-[#243447] mt-0.5">{unit.area == null ? '—' : `${unit.area} sq ft`}</p>
                        </div>

                        <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/60">
                          <p className="text-[10px] uppercase text-[#5B6875] font-semibold">Beds</p>
                          <p className="text-xs font-bold text-[#243447] mt-0.5">{unit.bedrooms ?? '—'}</p>
                        </div>

                        <div className="p-2 rounded bg-[#F7F8FA] border border-[#D9E0E6]/60">
                          <p className="text-[10px] uppercase text-[#5B6875] font-semibold">Baths</p>
                          <p className="text-xs font-bold text-[#243447] mt-0.5">{unit.bathrooms ?? '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description preview */}
                    {unit.description && (
                      <p className="text-xs text-[#5B6875] line-clamp-2 leading-relaxed">
                        {unit.description}
                      </p>
                    )}
                  </div>

                  {/* Actions: View (All Roles), Edit & Delete (Owner Only) */}
                  <div
                    className={`pt-4 mt-4 border-t border-[#D9E0E6] flex items-center ${
                      canManage ? 'justify-between' : 'justify-end'
                    } gap-2 flex-wrap sm:flex-nowrap`}
                  >
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <Link to={`/owner/units/${unit.unitId}/edit`}>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Pencil className="w-3 h-3" />}
                          >
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Trash2 className="w-3 h-3 text-[#B94A48]" />}
                          onClick={() =>
                            setUnitDeleteTarget({
                              unitId: unit.unitId,
                              unitNumber: unit.unitNumber,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    )}

                    <Link to={`${basePath}/units/${unit.unitId}`}>
                      <Button
                        size="sm"
                        variant="primary"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        View Unit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Management Modals (Owner Only) */}
        {canManage && (
          <>
            {/* Delete Floor Modal */}
            <DeleteConfirmModal
              isOpen={isDeleteFloorOpen}
              onClose={() => !isDeletingFloor && setIsDeleteFloorOpen(false)}
              onConfirm={handleConfirmDeleteFloor}
              title="Delete Floor"
              itemName={floor.floorName}
              consequenceMessage={`Deleting this floor will permanently remove all ${units.length} units registered on it.`}
              isLoading={isDeletingFloor}
            />

            {/* Delete Unit Modal */}
            <DeleteConfirmModal
              isOpen={Boolean(unitDeleteTarget)}
              onClose={() => setUnitDeleteTarget(null)}
              onConfirm={handleConfirmDeleteUnit}
              title="Delete Unit"
              itemName={`Unit ${unitDeleteTarget?.unitNumber}`}
              consequenceMessage="This will permanently delete this rental unit from the building floor plan."
            />

            {/* Edit Floor Modal */}
            {isEditFloorOpen && (
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
                        <h3 className="text-base font-bold text-[#243447]">Edit Floor</h3>
                        <p className="text-xs text-[#5B6875] truncate max-w-xs">{buildingName}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => !isSubmittingFloor && setIsEditFloorOpen(false)}
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

                  {isFloorModalLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <Loader size="md" text="Loading floor details..." center />
                    </div>
                  ) : (
                    <form onSubmit={handleFloorSubmit} className="space-y-4">
                      <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#5B6875]">Target Building:</span>
                          <strong className="text-[#243447] font-semibold">{buildingName}</strong>
                        </div>
                        <p className="text-[#856404] text-[11px] flex items-center gap-1 mt-1">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          Floor building association cannot be modified once created.
                        </p>
                      </div>

                      <Input
                        label="Floor Name"
                        placeholder="e.g. Ground Floor, 2nd Floor"
                        value={editFloorName}
                        onChange={(e) => setEditFloorName(e.target.value)}
                        error={floorFormErrors.floorName}
                        disabled={isSubmittingFloor}
                        required
                      />

                      <Input
                        label="Floor Number (Integer Level)"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 0, 1, 2"
                        value={editFloorNumber}
                        onChange={(e) => setEditFloorNumber(e.target.value)}
                        error={floorFormErrors.floorNumber}
                        disabled={isSubmittingFloor}
                        required
                      />

                      <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditFloorOpen(false)}
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
                          {isSubmittingFloor ? 'Saving...' : 'Save Changes'}
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
