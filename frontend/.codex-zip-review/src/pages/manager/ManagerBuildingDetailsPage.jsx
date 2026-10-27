import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import {
  getBuildingById,
  updateBuilding,
  deleteBuilding,
} from '../../api/buildingApi'
import {
  getFloorsByBuilding,
  createFloor,
  updateFloor,
  deleteFloor,
} from '../../api/floorApi'
import {
  getUnitsByFloor,
  createUnit,
  updateUnit,
  deleteUnit,
  UNIT_TYPES,
  UNIT_STATUSES,
} from '../../api/unitApi'
import { getManagerAssignedPropertyById } from '../../api/propertyApi'
import { formatCurrency } from '../../utils/currency'
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
  Building,
  Building2,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Home,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Bed,
  Bath,
  Maximize2,
  IndianRupee,
  Shield,
  Eye,
} from 'lucide-react'

export default function ManagerBuildingDetailsPage() {
  const { propertyId, buildingId } = useParams()
  const navigate = useNavigate()

  // State
  const [property, setProperty] = useState(null)
  const [building, setBuilding] = useState(null)
  const [floors, setFloors] = useState([])
  const [floorUnits, setFloorUnits] = useState({}) // { [floorId]: Unit[] }
  const [expandedFloors, setExpandedFloors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // Modals state
  const [isEditBuildingOpen, setIsEditBuildingOpen] = useState(false)
  const [buildingForm, setBuildingForm] = useState({
    buildingName: '',
    totalFloors: '',
    description: '',
  })
  const [isSubmittingBuilding, setIsSubmittingBuilding] = useState(false)
  const [isDeletingBuilding, setIsDeletingBuilding] = useState(false)
  const [isDeleteBuildingConfirmOpen, setIsDeleteBuildingConfirmOpen] = useState(false)

  // Floor Modals
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false)
  const [editingFloor, setEditingFloor] = useState(null)
  const [floorForm, setFloorForm] = useState({
    floorName: '',
    floorNumber: '',
  })
  const [isSubmittingFloor, setIsSubmittingFloor] = useState(false)
  const [floorModalError, setFloorModalError] = useState(null)
  const [deletingFloor, setDeletingFloor] = useState(null)
  const [isDeletingFloor, setIsDeletingFloor] = useState(false)

  // Unit Modals
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false)
  const [targetFloorForUnit, setTargetFloorForUnit] = useState(null)
  const [editingUnit, setEditingUnit] = useState(null)
  const [viewingUnit, setViewingUnit] = useState(null)
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    unitType: 'APARTMENT',
    area: '',
    bedrooms: '1',
    bathrooms: '1',
    monthlyRent: '',
    securityDeposit: '',
    status: 'VACANT',
    description: '',
  })
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false)
  const [unitModalError, setUnitModalError] = useState(null)
  const [deletingUnit, setDeletingUnit] = useState(null)
  const [isDeletingUnit, setIsDeletingUnit] = useState(false)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Load Building, Property & Floors
  const loadData = useCallback(async () => {
    if (!buildingId) return
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch Building
      const bRes = await getBuildingById(buildingId)
      const bData = bRes?.data || bRes
      setBuilding(bData)
      setBuildingForm({
        buildingName: bData.buildingName || bData.name || '',
        totalFloors: bData.totalFloors != null ? String(bData.totalFloors) : '',
        description: bData.description || '',
      })

      // 2. Fetch Parent Property for breadcrumbs
      const effectivePropertyId = propertyId || bData.propertyId || bData.property?.id
      if (effectivePropertyId) {
        try {
          const propRes = await getManagerAssignedPropertyById(effectivePropertyId)
          setProperty(propRes)
        } catch {
          // Non-blocking
        }
      }

      // 3. Fetch Floors
      const fRes = await getFloorsByBuilding(buildingId)
      const fList = Array.isArray(fRes?.data) ? fRes.data : Array.isArray(fRes) ? fRes : []
      setFloors(fList)

      // Automatically expand all floors and fetch their units
      const unitsMap = {}
      const expandedMap = {}

      await Promise.all(
        fList.map(async (f) => {
          const fId = f.floorId || f.id
          expandedMap[fId] = true
          try {
            const uRes = await getUnitsByFloor(fId)
            const uList = Array.isArray(uRes?.data) ? uRes.data : Array.isArray(uRes) ? uRes : []
            unitsMap[fId] = uList
          } catch (uErr) {
            console.warn(`Could not load units for floor #${fId}:`, uErr)
            unitsMap[fId] = []
          }
        })
      )

      setFloorUnits(unitsMap)
      setExpandedFloors(expandedMap)
    } catch (err) {
      console.error('Failed to load building details:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load building details. Please check your permissions.'
      )
    } finally {
      setLoading(false)
    }
  }, [buildingId, propertyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Toggle Floor Expand
  const toggleFloorExpand = async (floorId) => {
    setExpandedFloors((prev) => {
      const next = { ...prev, [floorId]: !prev[floorId] }
      // If opening and units not loaded, load them
      if (next[floorId] && !floorUnits[floorId]) {
        getUnitsByFloor(floorId)
          .then((res) => {
            const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
            setFloorUnits((uPrev) => ({ ...uPrev, [floorId]: list }))
          })
          .catch(() => {})
      }
      return next
    })
  }

  // Building Edit & Delete Handlers
  const handleSaveBuilding = async (e) => {
    e?.preventDefault()
    if (!buildingId || isSubmittingBuilding) return

    setIsSubmittingBuilding(true)
    const payload = {
      buildingName: buildingForm.buildingName.trim(),
      totalFloors: buildingForm.totalFloors ? Number(buildingForm.totalFloors) : undefined,
      description: buildingForm.description.trim() || undefined,
      propertyId: Number(propertyId || building.propertyId),
    }

    try {
      await updateBuilding(buildingId, payload)
      showToast('Building updated successfully.')
      setIsEditBuildingOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to update building:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to update building.')
    } finally {
      setIsSubmittingBuilding(false)
    }
  }

  const handleConfirmDeleteBuilding = async () => {
    if (!buildingId || isDeletingBuilding) return
    setIsDeletingBuilding(true)
    try {
      await deleteBuilding(buildingId)
      showToast('Building deleted successfully.')
      navigate(`/manager/properties/${propertyId || building?.propertyId}`)
    } catch (err) {
      console.error('Failed to delete building:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to delete building.')
      setIsDeletingBuilding(false)
    }
  }

  // Floor Handlers
  const handleOpenAddFloor = () => {
    setEditingFloor(null)
    setFloorForm({
      floorName: `Floor ${floors.length + 1}`,
      floorNumber: String(floors.length + 1),
    })
    setFloorModalError(null)
    setIsFloorModalOpen(true)
  }

  const handleOpenEditFloor = (f) => {
    setEditingFloor(f)
    setFloorForm({
      floorName: f.floorName || f.name || '',
      floorNumber: f.floorNumber != null ? String(f.floorNumber) : '',
    })
    setFloorModalError(null)
    setIsFloorModalOpen(true)
  }

  const handleSaveFloor = async (e) => {
    e?.preventDefault()
    if (!buildingId || isSubmittingFloor) return

    setIsSubmittingFloor(true)
    setFloorModalError(null)

    const payload = {
      floorName: floorForm.floorName.trim(),
      floorNumber: Number(floorForm.floorNumber),
      buildingId: Number(buildingId),
    }

    try {
      const fId = editingFloor?.floorId || editingFloor?.id
      if (fId) {
        await updateFloor(fId, payload)
        showToast('Floor updated successfully.')
      } else {
        await createFloor(payload)
        showToast('Floor added successfully.')
      }
      setIsFloorModalOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to save floor:', err)
      setFloorModalError(
        err?.response?.data?.message || err?.message || 'Failed to save floor record.'
      )
    } finally {
      setIsSubmittingFloor(false)
    }
  }

  const handleConfirmDeleteFloor = async () => {
    const fId = deletingFloor?.floorId || deletingFloor?.id
    if (!fId || isDeletingFloor) return

    setIsDeletingFloor(true)
    try {
      await deleteFloor(fId)
      showToast('Floor deleted successfully.')
      setDeletingFloor(null)
      await loadData()
    } catch (err) {
      console.error('Failed to delete floor:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to delete floor.')
    } finally {
      setIsDeletingFloor(false)
    }
  }

  // Unit Handlers
  const handleOpenAddUnit = (floor) => {
    setTargetFloorForUnit(floor)
    setEditingUnit(null)
    setUnitForm({
      unitNumber: '',
      unitType: 'APARTMENT',
      area: '',
      bedrooms: '1',
      bathrooms: '1',
      monthlyRent: '',
      securityDeposit: '',
      status: 'VACANT',
      description: '',
    })
    setUnitModalError(null)
    setIsUnitModalOpen(true)
  }

  const handleOpenEditUnit = (u, floor) => {
    setTargetFloorForUnit(floor)
    setEditingUnit(u)
    setUnitForm({
      unitNumber: u.unitNumber || u.number || '',
      unitType: u.unitType || u.type || '',
      area: u.area != null ? String(u.area) : '',
      bedrooms: u.bedrooms != null ? String(u.bedrooms) : '',
      bathrooms: u.bathrooms != null ? String(u.bathrooms) : '',
      monthlyRent: u.monthlyRent != null ? String(u.monthlyRent) : '',
      securityDeposit: u.securityDeposit != null ? String(u.securityDeposit) : '',
      status: u.status || '',
      description: u.description || '',
    })
    setUnitModalError(null)
    setIsUnitModalOpen(true)
  }

  const handleSaveUnit = async (e) => {
    e?.preventDefault()
    const fId = targetFloorForUnit?.floorId || targetFloorForUnit?.id || editingUnit?.floorId
    if (!fId || isSubmittingUnit) return

    setIsSubmittingUnit(true)
    setUnitModalError(null)

    const payload = {
      unitNumber: unitForm.unitNumber.trim(),
      unitType: unitForm.unitType || undefined,
      area: unitForm.area ? Number(unitForm.area) : undefined,
      bedrooms: unitForm.bedrooms ? Number(unitForm.bedrooms) : undefined,
      bathrooms: unitForm.bathrooms ? Number(unitForm.bathrooms) : undefined,
      monthlyRent: Number(unitForm.monthlyRent),
      securityDeposit: Number(unitForm.securityDeposit),
      status: unitForm.status || undefined,
      description: unitForm.description.trim() || undefined,
      floorId: Number(fId),
    }

    try {
      const uId = editingUnit?.unitId || editingUnit?.id
      if (uId) {
        await updateUnit(uId, payload)
        showToast('Unit updated successfully.')
      } else {
        await createUnit(payload)
        showToast('Unit added successfully.')
      }
      setIsUnitModalOpen(false)
      await loadData()
    } catch (err) {
      console.error('Failed to save unit:', err)
      setUnitModalError(
        err?.response?.data?.message || err?.message || 'Failed to save rental unit.'
      )
    } finally {
      setIsSubmittingUnit(false)
    }
  }

  const handleConfirmDeleteUnit = async () => {
    const uId = deletingUnit?.unitId || deletingUnit?.id
    if (!uId || isDeletingUnit) return

    setIsDeletingUnit(true)
    try {
      await deleteUnit(uId)
      showToast('Unit deleted successfully.')
      setDeletingUnit(null)
      await loadData()
    } catch (err) {
      console.error('Failed to delete unit:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to delete unit.')
    } finally {
      setIsDeletingUnit(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout
        defaultRole={ROLES.PROPERTY_MANAGER}
        activeItem="properties"
        pageTitle="Manager Building View"
      >
        <div className="py-20 flex justify-center">
          <Loader size="lg" text="Loading building details..." center />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !building) {
    return (
      <DashboardLayout
        defaultRole={ROLES.PROPERTY_MANAGER}
        activeItem="properties"
        pageTitle="Manager Building View"
      >
        <div className="space-y-4 max-w-2xl mx-auto py-12">
          <div className="p-6 rounded-xl bg-white border border-[#F8B4B4] shadow-xs space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#243447]">
                Unable to Load Building
              </h2>
              <p className="text-xs text-[#5B6875]">{error || 'Building not found'}</p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="primary" size="sm" onClick={loadData}>
                Retry
              </Button>
              <Link to={`/manager/properties/${propertyId}`}>
                <Button variant="secondary" size="sm">
                  Return to Property
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const effectivePropertyId = propertyId || building.propertyId

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="properties"
      pageTitle={`${building.buildingName || 'Building Details'} | Manager Building View`}
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

        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to={`/manager/properties/${effectivePropertyId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#315A7D] hover:text-[#274B68] transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                Back to {property?.propertyName ? property.propertyName : 'Assigned Property'}
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                Manager Building View
              </span>
              <span className="text-xs text-[#5B6875]">
                Structural floors and rental unit management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditBuildingOpen(true)}
              leftIcon={<Pencil className="w-3.5 h-3.5 text-[#315A7D]" />}
            >
              Edit Building
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setIsDeleteBuildingConfirmOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            >
              Delete Building
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddFloor}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Floor
            </Button>
          </div>
        </div>

        {/* Building Overview Card */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E6] pb-3">
            <div className="space-y-0.5">
              <span className="font-mono text-[11px] font-bold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                Building #{building.buildingId || building.id}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#243447]">
                {building.buildingName || building.name || 'Unnamed Building'}
              </h1>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                <span className="text-[#5B6875] block text-[10px] uppercase font-bold tracking-wider">
                  Total Floors
                </span>
                <span className="font-bold text-sm text-[#243447]">
                  {building.totalFloors != null ? building.totalFloors : floors.length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                <span className="text-[#5B6875] block text-[10px] uppercase font-bold tracking-wider">
                  Parent Property
                </span>
                <Link
                  to={`/manager/properties/${effectivePropertyId}`}
                  className="font-bold text-sm text-[#315A7D] hover:underline"
                >
                  {property?.propertyName || `#${effectivePropertyId}`}
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B6875]">
              Description
            </h4>
            <p className="text-xs sm:text-sm text-[#243447] leading-relaxed">
              {building.description || 'No specific description provided for this building.'}
            </p>
          </div>
        </div>

        {/* Floors & Units Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#315A7D]" />
              <h2 className="text-lg font-bold text-[#243447]">
                Floors & Rental Units ({floors.length} Floors)
              </h2>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddFloor}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Floor
            </Button>
          </div>

          {floors.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-8 h-8 text-[#5B6875]" />}
              title="No floors configured"
              message="No floors have been registered for this building yet. Add a floor to begin configuring rental units."
              action={{
                label: 'Add First Floor',
                onClick: handleOpenAddFloor,
                variant: 'primary',
              }}
            />
          ) : (
            <div className="space-y-4">
              {floors.map((floor) => {
                const fId = floor.floorId || floor.id
                const isExpanded = Boolean(expandedFloors[fId])
                const units = floorUnits[fId] || []

                return (
                  <div
                    key={fId}
                    className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xs overflow-hidden"
                  >
                    {/* Floor Header Bar */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F8FA] border-b border-[#D9E0E6]">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleFloorExpand(fId)}
                      >
                        <button
                          type="button"
                          className="p-1 rounded text-[#5B6875] hover:text-[#243447] hover:bg-white transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#243447]">
                              {floor.floorName || floor.name || `Floor ${floor.floorNumber}`}
                            </h3>
                            <span className="font-mono text-[10px] font-bold text-[#315A7D] bg-white px-2 py-0.5 rounded border border-[#D9E0E6]">
                              Level {floor.floorNumber}
                            </span>
                          </div>
                          <span className="text-xs text-[#5B6875]">
                            {units.length} {units.length === 1 ? 'Unit' : 'Units'} registered
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleOpenAddUnit(floor)}
                          leftIcon={<Plus className="w-3.5 h-3.5 text-[#315A7D]" />}
                        >
                          Add Unit
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditFloor(floor)}
                          className="p-1.5 rounded text-[#5B6875] hover:text-[#243447] hover:bg-white border border-[#D9E0E6] transition-colors"
                          title="Edit floor"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFloor(floor)}
                          className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-white border border-red-200 transition-colors"
                          title="Delete floor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Floor Units Table / Grid */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-3">
                        {units.length === 0 ? (
                          <div className="py-6 text-center space-y-2">
                            <p className="text-xs text-[#5B6875]">
                              No units registered on this floor yet.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddUnit(floor)}
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                            >
                              Register Unit
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {units.map((unit) => {
                              const uId = unit.unitId || unit.id
                              return (
                                <div
                                  key={uId}
                                  className="p-4 rounded-xl bg-white border border-[#D9E0E6] hover:border-[#315A7D] transition-all space-y-3 shadow-2xs"
                                >
                                  {/* Unit Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] font-bold text-xs">
                                        <Home className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-bold text-[#243447]">
                                          Unit {unit.unitNumber || unit.number}
                                        </h4>
                                        <span className="text-[11px] text-[#5B6875]">
                                          {unit.unitType || unit.type || '—'}
                                        </span>
                                      </div>
                                    </div>
                                    <StatusBadge status={unit.status} size="xs" />
                                  </div>

                                  {/* Unit Metrics */}
                                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 bg-[#F7F8FA] rounded-lg p-2 border border-[#D9E0E6]">
                                    <div>
                                      <span className="text-[10px] text-[#5B6875] block uppercase">
                                        Rent
                                      </span>
                                      <span className="font-bold text-[#243447]">
                                        {unit.monthlyRent != null ? formatCurrency(unit.monthlyRent) : '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-[#5B6875] block uppercase">
                                        Deposit
                                      </span>
                                      <span className="font-semibold text-[#243447]">
                                        {unit.securityDeposit != null ? formatCurrency(unit.securityDeposit) : '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-[#5B6875] block uppercase">
                                        Area
                                      </span>
                                      <span className="font-semibold text-[#243447]">
                                        {unit.area != null ? `${unit.area} sqft` : '—'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Bed / Bath Specs */}
                                  <div className="flex items-center justify-between text-xs text-[#5B6875] pt-1">
                                    <span className="flex items-center gap-1">
                                      <Bed className="w-3.5 h-3.5 text-[#315A7D]" />
                                      {unit.bedrooms != null ? `${unit.bedrooms} Bed` : '—'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Bath className="w-3.5 h-3.5 text-[#315A7D]" />
                                      {unit.bathrooms != null ? `${unit.bathrooms} Bath` : '—'}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#5B6875]">
                                      #{uId}
                                    </span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="pt-2 border-t border-[#D9E0E6] flex items-center justify-between gap-1 text-xs">
                                    <Button
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => setViewingUnit(unit)}
                                      leftIcon={<Eye className="w-3 h-3" />}
                                    >
                                      Details
                                    </Button>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditUnit(unit, floor)}
                                        className="p-1 rounded text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA]"
                                        title="Edit unit"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingUnit(unit)}
                                        className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Delete unit"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Building Modal */}
      {isEditBuildingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <h3 className="text-base font-bold text-[#243447]">
                Edit Building Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditBuildingOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                />
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditBuildingOpen(false)}
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
                  {isSubmittingBuilding ? 'Saving...' : 'Update Building'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Building Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteBuildingConfirmOpen}
        onClose={() => !isDeletingBuilding && setIsDeleteBuildingConfirmOpen(false)}
        onConfirm={handleConfirmDeleteBuilding}
        title="Delete Building"
        itemName={building.buildingName || building.name}
        consequenceMessage="This will permanently remove this building and all of its associated floors and units."
        isLoading={isDeletingBuilding}
      />

      {/* Add / Edit Floor Modal */}
      {isFloorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <h3 className="text-base font-bold text-[#243447]">
                {editingFloor ? 'Edit Floor' : 'Add New Floor'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFloorModalOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {floorModalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {floorModalError}
              </div>
            )}

            <form onSubmit={handleSaveFloor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Floor Name *
                </label>
                <Input
                  value={floorForm.floorName}
                  onChange={(e) =>
                    setFloorForm((prev) => ({ ...prev, floorName: e.target.value }))
                  }
                  required
                  placeholder="e.g. Floor 1, Ground Floor"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Floor Number *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={floorForm.floorNumber}
                  onChange={(e) =>
                    setFloorForm((prev) => ({ ...prev, floorNumber: e.target.value }))
                  }
                  required
                  placeholder="e.g. 1"
                />
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsFloorModalOpen(false)}
                  disabled={isSubmittingFloor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingFloor}
                  leftIcon={isSubmittingFloor ? <Loader size="xs" /> : <Save className="w-3.5 h-3.5" />}
                >
                  {isSubmittingFloor ? 'Saving...' : editingFloor ? 'Update Floor' : 'Add Floor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Floor Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingFloor)}
        onClose={() => !isDeletingFloor && setDeletingFloor(null)}
        onConfirm={handleConfirmDeleteFloor}
        title="Delete Floor"
        itemName={deletingFloor?.floorName || deletingFloor?.name}
        consequenceMessage="This will permanently delete this floor and all units registered on it."
        isLoading={isDeletingFloor}
      />

      {/* Add / Edit Unit Modal */}
      {isUnitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#243447]">
                  {editingUnit ? `Edit Unit ${editingUnit.unitNumber}` : 'Add New Rental Unit'}
                </h3>
                <span className="text-xs text-[#5B6875]">
                  Floor: {targetFloorForUnit?.floorName || targetFloorForUnit?.name || 'Assigned Floor'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unitModalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {unitModalError}
              </div>
            )}

            <form onSubmit={handleSaveUnit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Unit Number *
                  </label>
                  <Input
                    value={unitForm.unitNumber}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, unitNumber: e.target.value }))
                    }
                    required
                    placeholder="e.g. 101"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Unit Type *
                  </label>
                  <Select
                    value={unitForm.unitType}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, unitType: e.target.value }))
                    }
                    options={[
                      { label: 'Select unit type', value: '' },
                      { label: 'Apartment', value: 'APARTMENT' },
                      { label: 'Room', value: 'ROOM' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Area (sq. ft.)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitForm.area}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, area: e.target.value }))
                    }
                    placeholder="e.g. 850"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Bedrooms
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={unitForm.bedrooms}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, bedrooms: e.target.value }))
                    }
                    placeholder="e.g. 2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Bathrooms
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={unitForm.bathrooms}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, bathrooms: e.target.value }))
                    }
                    placeholder="e.g. 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Monthly Rent (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitForm.monthlyRent}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, monthlyRent: e.target.value }))
                    }
                    required
                    placeholder="e.g. 25000"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#243447] mb-1">
                    Security Deposit (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitForm.securityDeposit}
                    onChange={(e) =>
                      setUnitForm((prev) => ({ ...prev, securityDeposit: e.target.value }))
                    }
                    required
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Status *
                </label>
                <Select
                  value={unitForm.status}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  options={[
                    { label: 'Select status', value: '' },
                    { label: 'Vacant', value: 'VACANT' },
                    { label: 'Occupied', value: 'OCCUPIED' },
                    { label: 'Reserved', value: 'RESERVED' },
                    { label: 'Maintenance', value: 'MAINTENANCE' },
                  ]}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#243447] mb-1">
                  Unit Description
                </label>
                <Textarea
                  rows={2}
                  value={unitForm.description}
                  onChange={(e) =>
                    setUnitForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Furnishings, balcony view, utility meters..."
                />
              </div>

              <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsUnitModalOpen(false)}
                  disabled={isSubmittingUnit}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingUnit}
                  leftIcon={isSubmittingUnit ? <Loader size="xs" /> : <Save className="w-3.5 h-3.5" />}
                >
                  {isSubmittingUnit ? 'Saving...' : editingUnit ? 'Update Unit' : 'Create Unit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Unit Details Modal */}
      {viewingUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold text-[#315A7D] bg-[#EAF2F7] px-2 py-0.5 rounded border border-[#D9E0E6]">
                  Unit #{viewingUnit.unitId || viewingUnit.id}
                </span>
                <h3 className="text-lg font-bold text-[#243447] mt-1">
                  Unit {viewingUnit.unitNumber || viewingUnit.number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingUnit(null)}
                className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                <span className="text-[#5B6875] font-semibold">Status:</span>
                <StatusBadge status={viewingUnit.status} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                  <span className="text-[#5B6875] text-[10px] uppercase font-bold">
                    Monthly Rent
                  </span>
                  <p className="text-sm font-bold text-[#243447]">
                    {viewingUnit.monthlyRent != null ? formatCurrency(viewingUnit.monthlyRent) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5">
                  <span className="text-[#5B6875] text-[10px] uppercase font-bold">
                    Security Deposit
                  </span>
                  <p className="text-sm font-bold text-[#243447]">
                    {viewingUnit.securityDeposit != null ? formatCurrency(viewingUnit.securityDeposit) : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5 text-center">
                  <span className="text-[#5B6875] text-[10px] uppercase font-bold block">
                    Type
                  </span>
                  <span className="font-semibold text-[#243447]">
                    {viewingUnit.unitType || '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5 text-center">
                  <span className="text-[#5B6875] text-[10px] uppercase font-bold block">
                    Bedrooms
                  </span>
                  <span className="font-semibold text-[#243447]">
                    {viewingUnit.bedrooms != null ? viewingUnit.bedrooms : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-0.5 text-center">
                  <span className="text-[#5B6875] text-[10px] uppercase font-bold block">
                    Bathrooms
                  </span>
                  <span className="font-semibold text-[#243447]">
                    {viewingUnit.bathrooms != null ? viewingUnit.bathrooms : '—'}
                  </span>
                </div>
              </div>

              {viewingUnit.area != null && (
                <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] flex justify-between">
                  <span className="text-[#5B6875] font-semibold">Total Area:</span>
                  <span className="font-bold text-[#243447]">{viewingUnit.area} sq. ft.</span>
                </div>
              )}

              {viewingUnit.description && (
                <div className="space-y-1">
                  <span className="text-[#5B6875] font-semibold uppercase text-[10px]">
                    Description
                  </span>
                  <p className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] text-[#243447] leading-relaxed">
                    {viewingUnit.description}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#D9E0E6] flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewingUnit(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Unit Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingUnit)}
        onClose={() => !isDeletingUnit && setDeletingUnit(null)}
        onConfirm={handleConfirmDeleteUnit}
        title="Delete Rental Unit"
        itemName={`Unit ${deletingUnit?.unitNumber || deletingUnit?.number}`}
        consequenceMessage="This will permanently delete this rental unit record."
        isLoading={isDeletingUnit}
      />
    </DashboardLayout>
  )
}
