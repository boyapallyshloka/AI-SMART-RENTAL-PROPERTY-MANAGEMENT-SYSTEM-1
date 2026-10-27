import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, StatusBadge, EmptyState, Loader } from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Home,
  ArrowLeft,
  IndianRupee,
  Bed,
  Bath,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  CheckCircle2,
  Sparkles,
  Search,
  AlertCircle,
} from 'lucide-react'
import {
  getUnitById,
  deleteUnit,
} from '../../api/unitApi'
import { formatCurrency } from '../../utils/currency'
import { getTenantUnitDetails } from '../../utils/tenantRentalHelper'
import { useAuth } from '../../context/AuthContext'
import {
  ROLES,
  isPropertyOwner,
  isPropertyManager,
  isTenant as isTenantRole,
} from '../../utils/roles'

export default function UnitDetailsPage() {
  const { unitId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const isOwner = isPropertyOwner(user?.role)
  const isTenant = isTenantRole(user?.role)
  const isManager = isPropertyManager(user?.role)
  const canManage = isOwner
  const basePath = isTenant ? '/tenant' : '/owner'

  const [myRental, setMyRental] = useState(null)
  const [unit, setUnit] = useState(null)
  const isCurrentRentedUnit =
    isTenant &&
    (String(unitId) === String(myRental?.currentUnitId) ||
      String(unit?.unitId) === String(myRental?.currentUnitId))

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    const incomingToast = location.state?.toastMessage || location.state?.toast
    if (incomingToast) {
      setToastMessage(incomingToast)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const loadUnit = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      let u = null
      if (isTenant) {
        const tenantData = await getTenantUnitDetails(unitId)
        u = tenantData.unit
        setMyRental(tenantData.myRental)
      } else {
        const res = await getUnitById(unitId)
        const raw = res?.data ?? res ?? null
        if (raw) {
          const uFloorId = raw.floorId ?? raw.floor?.floorId ?? raw.floor?.id
          const uFloorName = raw.floorName ?? raw.floor?.floorName ?? raw.floor?.name
          const uFloorNumber = raw.floorNumber ?? raw.floor?.floorNumber ?? raw.floor?.number
          const uBuildingId = raw.buildingId ?? raw.floor?.building?.buildingId ?? raw.floor?.building?.id
          const uBuildingName = raw.buildingName ?? raw.floor?.building?.buildingName ?? raw.floor?.building?.name
          const uPropertyId = raw.propertyId ?? raw.floor?.building?.property?.propertyId ?? raw.floor?.building?.property?.id
          const uPropertyName = raw.propertyName ?? raw.floor?.building?.property?.name ?? raw.floor?.building?.property?.propertyName

          u = {
            ...raw,
            id: raw.unitId ?? raw.id,
            unitId: raw.unitId ?? raw.id,
            unitNumber: raw.unitNumber ?? raw.number ?? '',
            unitType: raw.unitType ?? raw.type ?? null,
            status: raw.status ?? null,
            monthlyRent: raw.monthlyRent ?? raw.rent ?? null,
            securityDeposit: raw.securityDeposit ?? raw.deposit ?? null,
            area: raw.area ?? null,
            bedrooms: raw.bedrooms ?? null,
            bathrooms: raw.bathrooms ?? null,
            description: raw.description ?? '',
            floorId: uFloorId,
            floorName: uFloorName,
            floorNumber: uFloorNumber,
            buildingId: uBuildingId,
            buildingName: uBuildingName,
            propertyId: uPropertyId,
            propertyName: uPropertyName,
            floor: raw.floor ?? (uFloorId ? {
              floorId: uFloorId,
              id: uFloorId,
              floorName: uFloorName,
              floorNumber: uFloorNumber,
              building: raw.floor?.building ?? (uBuildingId ? {
                buildingId: uBuildingId,
                id: uBuildingId,
                buildingName: uBuildingName,
                property: raw.floor?.building?.property ?? (uPropertyId ? {
                  propertyId: uPropertyId,
                  id: uPropertyId,
                  name: uPropertyName,
                  propertyName: uPropertyName,
                } : null),
              } : null),
            } : null),
          }
        }
      }
      setUnit(u)
    } catch (err) {
      console.error('Error loading unit:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to load unit details. Please try again.'
      setErrorMessage(errorMsg)
      setUnit(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUnit()
  }, [unitId])

  const handleDeleteConfirm = async () => {
    if (!unit || !canManage) return
    try {
      await deleteUnit(unit.unitId)
      const targetBId = unit.buildingId || unit.floor?.buildingId || unit.floor?.building?.buildingId
      const targetFId = unit.floorId || unit.floor?.floorId
      const backUrl =
        targetBId && targetFId
          ? `${basePath}/buildings/${targetBId}/floors/${targetFId}`
          : unit.propertyId
          ? `/owner/properties/${unit.propertyId}`
          : `${basePath}/properties`

      navigate(backUrl, {
        state: { toastMessage: `Unit "${unit.unitNumber}" was deleted.` },
      })
    } catch (err) {
      console.error('Failed to delete unit:', err)
      setErrorMessage(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete unit. Please try again.'
      )
      setIsDeleteModalOpen(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Loading Unit Details..."
      >
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader text="Loading unit details..." />
        </div>
      </DashboardLayout>
    )
  }

  if (errorMessage) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Error Loading Unit"
      >
        <div className="space-y-6">
          <Link to={`${basePath}/buildings`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Buildings
            </Button>
          </Link>
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 text-center space-y-4 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#FDF2F2] flex items-center justify-center text-[#B94A48] mx-auto border border-[#F8D7DA]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#243447]">Failed to Load Unit</h3>
              <p className="text-xs text-[#5B6875] mt-1">{errorMessage}</p>
            </div>
            <Button size="sm" variant="primary" onClick={loadUnit}>
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!unit) {
    return (
      <DashboardLayout
        defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
        activeItem={isOwner ? 'properties' : 'buildings'}
        pageTitle="Unit Details"
      >
        <div className="space-y-6">
          <Link to={`${basePath}/buildings`}>
            <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Buildings
            </Button>
          </Link>
          <EmptyState
            icon={<Home className="w-8 h-8 text-[#5B6875]" />}
            title="Unit Not Found"
            description={`No unit found matching ID "${unitId}".`}
            action={
              <Link to={`${basePath}/buildings`}>
                <Button size="sm" variant="primary">
                  {isTenant ? 'Back to My Rental Property' : 'View All Buildings'}
                </Button>
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    )
  }

  const targetFloorId = unit.floorId || unit.floor?.floorId || unit.floor?.id
  const targetFloorName = unit.floorName || unit.floor?.floorName || unit.floor?.name
  const targetBuildingId = unit.buildingId || unit.floor?.buildingId || unit.floor?.building?.buildingId || unit.floor?.building?.id
  const targetBuildingName = unit.buildingName || unit.floor?.buildingName || unit.floor?.building?.buildingName || unit.floor?.building?.name
  const targetPropertyId = unit.propertyId || unit.floor?.building?.propertyId || unit.floor?.building?.property?.propertyId
  const targetPropertyName = unit.propertyName || unit.floor?.building?.propertyName || unit.floor?.building?.property?.name

  const backDestination =
    targetBuildingId && targetFloorId
      ? `${basePath}/buildings/${targetBuildingId}/floors/${targetFloorId}`
      : targetPropertyId
      ? `/owner/properties/${targetPropertyId}`
      : `${basePath}/properties`

  const backLabel = targetFloorName ? `Back to ${targetFloorName}` : 'Back to Floor'

  return (
    <DashboardLayout
      defaultRole={isTenant ? ROLES.TENANT : isManager ? ROLES.PROPERTY_MANAGER : ROLES.PROPERTY_OWNER}
      activeItem={isOwner ? 'properties' : 'buildings'}
      pageTitle={`Unit ${unit.unitNumber}`}
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
              {targetPropertyId && (
                <>
                  <span>/</span>
                  <Link
                    to={`/owner/properties/${targetPropertyId}`}
                    className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
                  >
                    {targetPropertyName || `Property #${targetPropertyId}`}
                  </Link>
                </>
              )}
            </>
          )}
          {targetBuildingId && (
            <>
              <span>/</span>
              <Link
                to={`${basePath}/buildings/${targetBuildingId}`}
                className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
              >
                {targetBuildingName || `Building #${targetBuildingId}`}
              </Link>
            </>
          )}
          {targetBuildingId && targetFloorId && (
            <>
              <span>/</span>
              <Link
                to={`${basePath}/buildings/${targetBuildingId}/floors/${targetFloorId}`}
                className="hover:text-[#315A7D] transition-colors font-medium text-[#5B6875]"
              >
                {targetFloorName || `Floor #${targetFloorId}`}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[#243447] font-semibold">
            Unit {unit.unitNumber}
          </span>
        </div>

        {/* Top Navigation & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={backDestination}>
              <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                {backLabel}
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

          {/* Actions: Edit, Delete (Owner Only) */}
          {canManage && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Link to={`/owner/units/${unit.unitId}/edit`}>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Pencil className="w-3.5 h-3.5" />}
                >
                  Edit Unit
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#B94A48]" />}
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete Unit
              </Button>
            </div>
          )}
        </div>

        {/* Tenant Status Context Banner */}
        {isCurrentRentedUnit && (
          <div className="p-4 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0" />
              <span>
                This is your active leased residence
                {myRental?.leaseSummary?.endDate ? ` • Leased until ${myRental.leaseSummary.endDate}` : ''}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-white text-[#2A583B] border border-[#C6DEC8] text-[11px] font-bold self-start sm:self-auto">
              Your Current Rental
            </span>
          </div>
        )}

        {isTenant && !isCurrentRentedUnit && unit.status === 'VACANT' && (
          <div className="p-3.5 rounded-lg bg-[#EAF2F7] border border-[#C2D8E8] text-[#274B68] text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#315A7D] shrink-0" />
              <span>Available Vacant Unit &bull; Open for Lease Discovery</span>
            </div>
            <Link to="/tenant/find-properties" className="text-[#315A7D] hover:underline font-semibold text-xs">
              &larr; Back to Find Properties
            </Link>
          </div>
        )}

        {/* Unit Header Card */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#315A7D] px-2 py-0.5 rounded bg-[#EAF2F7] border border-[#D9E0E6]">
                  {unit.unitType || '—'}
                </span>
                <span className="text-xs text-[#5B6875] font-mono">
                  ID: {unit.unitId}
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
                Unit {unit.unitNumber}
              </h1>
              {(targetBuildingName || targetFloorName) && (
                <p className="text-xs text-[#5B6875]">
                  {targetBuildingName} {targetBuildingName && targetFloorName ? '•' : ''} {targetFloorName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={unit.status} size="md" />
            </div>
          </div>
        </div>

        {/* Detail Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Unit Overview */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <Home className="w-4 h-4 text-[#315A7D]" />
              <h2 className="font-semibold text-sm text-[#243447]">Unit Overview</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Unit Number</p>
                <p className="font-bold text-sm text-[#243447] mt-0.5">{unit.unitNumber}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Unit Type</p>
                <p className="font-bold text-sm text-[#243447] mt-0.5">{unit.unitType || '—'}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Status</p>
                <div className="mt-1">
                  <StatusBadge status={unit.status} size="sm" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Area</p>
                <p className="font-bold text-sm text-[#243447] mt-0.5">{unit.area == null ? '—' : `${unit.area} sq ft`}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <MapPin className="w-4 h-4 text-[#315A7D]" />
              <h2 className="font-semibold text-sm text-[#243447]">Location Hierarchy</h2>
            </div>

            <div className="space-y-3 text-xs">
              {targetPropertyName && (
                <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70 flex items-center justify-between">
                  <div>
                    <p className="text-[#5B6875] font-medium">Property</p>
                    <p className="font-bold text-sm text-[#243447] mt-0.5">{targetPropertyName}</p>
                  </div>
                  {targetPropertyId && (
                    <Link
                      to={`/owner/properties/${targetPropertyId}`}
                      className="text-xs text-[#315A7D] font-semibold hover:underline flex items-center gap-1"
                    >
                      <Building2 className="w-4 h-4 text-[#315A7D] shrink-0" />
                    </Link>
                  )}
                </div>
              )}

              {targetBuildingName && (
                <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70 flex items-center justify-between">
                  <div>
                    <p className="text-[#5B6875] font-medium">Building</p>
                    <p className="font-bold text-sm text-[#243447] mt-0.5">{targetBuildingName}</p>
                  </div>
                  {targetBuildingId && (
                    <Link
                      to={`${basePath}/buildings/${targetBuildingId}`}
                      className="text-xs text-[#315A7D] font-semibold hover:underline"
                    >
                      View Building
                    </Link>
                  )}
                </div>
              )}

              {targetFloorName && (
                <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70 flex items-center justify-between">
                  <div>
                    <p className="text-[#5B6875] font-medium">Floor</p>
                    <p className="font-bold text-sm text-[#243447] mt-0.5">
                      {targetFloorName} {unit.floorNumber != null ? `(Floor ${unit.floorNumber})` : ''}
                    </p>
                  </div>
                  {targetBuildingId && targetFloorId && (
                    <Link
                      to={`${basePath}/buildings/${targetBuildingId}/floors/${targetFloorId}`}
                      className="text-xs text-[#315A7D] font-semibold hover:underline"
                    >
                      View Floor
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Rental & Financials */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <IndianRupee className="w-4 h-4 text-[#315A7D]" />
              <h2 className="font-semibold text-sm text-[#243447]">Rental &amp; Financials</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Monthly Rent</p>
                <p className="font-bold text-base text-[#243447] mt-0.5">
                  {formatCurrency(unit.monthlyRent)}
                  <span className="text-xs font-normal text-[#5B6875]">/mo</span>
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70">
                <p className="text-[#5B6875] font-medium">Security Deposit</p>
                <p className="font-bold text-base text-[#243447] mt-0.5">
                  {formatCurrency(unit.securityDeposit)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Room Details */}
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
              <Bed className="w-4 h-4 text-[#315A7D]" />
              <h2 className="font-semibold text-sm text-[#243447]">Room Details</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0">
                  <Bed className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[#5B6875] font-medium">Bedrooms</p>
                  <p className="font-bold text-base text-[#243447] mt-0.5">{unit.bedrooms ?? '—'}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0">
                  <Bath className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[#5B6875] font-medium">Bathrooms</p>
                  <p className="font-bold text-base text-[#243447] mt-0.5">{unit.bathrooms ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Description */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-5 shadow-2xs space-y-3">
          <h2 className="font-semibold text-sm text-[#243447] border-b border-[#D9E0E6] pb-3">
            Description
          </h2>
          <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed">
            {unit.description || 'No description provided for this unit.'}
          </p>
        </div>

        {/* Delete Unit Modal */}
        {canManage && (
          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Unit"
            itemName={`Unit ${unit.unitNumber}`}
            consequenceMessage="This will permanently delete this rental unit record."
          />
        )}
      </div>
    </DashboardLayout>
  )
}
