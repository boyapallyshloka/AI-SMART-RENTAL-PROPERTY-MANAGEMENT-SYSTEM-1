import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import {
  getMaintenanceRequests,
  updateMaintenanceStatus,
  getMaintenanceWorkers,
  getMaintenanceAssignments,
  createMaintenanceAssignment,
  predictMaintenance,
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
  formatCategoryLabel,
  formatPriorityLabel,
  formatStatusLabel,
  getPriorityBadgeClass,
} from '../../api/maintenanceApi'
import {
  getManagerAssignedProperties,
  getManagerAssignedPropertyDetails,
} from '../../api/propertyApi'
import {
  getApplicationsForUnit,
  getApplicationsForProperty,
  getApplicationById,
} from '../../api/applicationApi'
import axiosClient from '../../api/axiosClient'
import {
  Button,
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Loader,
  Textarea,
} from '../../components/ui'
import {
  Wrench,
  ArrowLeft,
  Building2,
  ListFilter,
  CheckCircle2,
  Users,
  History,
  Info,
  Layers,
  Search,
  RotateCcw,
  Calendar,
  AlertCircle,
  Eye,
  Clock,
  HardHat,
  Sparkles,
  DollarSign,
  Activity,
  X,
  UserPlus,
} from 'lucide-react'

/**
 * Normalizes property names into Title Case for clean user-facing presentation.
 * Example: "pooja apartments" -> "Pooja Apartments"
 */
const formatPropertyName = (name) => {
  if (!name || typeof name !== 'string') return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : ''
        )
        .join('-')
    )
    .join(' ')
}

export default function ManagerMaintenancePage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'history' | 'all'
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Cache/lookup maps for Property Name and Unit Number
  const [propertyMap, setPropertyMap] = useState({})
  const [unitMap, setUnitMap] = useState({})

  // Selected Ticket human-readable details for Modal
  const [modalPropertyName, setModalPropertyName] = useState('')
  const [modalUnitNumber, setModalUnitNumber] = useState('')
  const [modalTenantName, setModalTenantName] = useState('')

  // Worker assignment inside manager modal
  const [availableWorkers, setAvailableWorkers] = useState([])
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [ticketAssignments, setTicketAssignments] = useState({})

  // Predictive analytics state inside manager modal
  const [modalPrediction, setModalPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)

  // Batch-resolve human-readable property names and unit numbers for manager assigned properties
  const enrichPropertiesAndUnits = async (tickets) => {
    if (!Array.isArray(tickets) || tickets.length === 0) return

    const uniquePropertyIds = [
      ...new Set(tickets.map((t) => t.propertyId).filter(Boolean)),
    ]

    const newPropertyMap = {}
    const newUnitMap = {}
    const assignedPropertyIdSet = new Set()

    // 1. Pre-populate from ticket fields if already provided by backend
    tickets.forEach((t) => {
      if (t.propertyId && t.propertyName) {
        newPropertyMap[String(t.propertyId)] = t.propertyName
      }
      if (t.unitId && t.unitNumber) {
        newUnitMap[String(t.unitId)] = String(t.unitNumber)
      }
    })

    // 2. Query GET /api/property-manager/properties (getManagerAssignedProperties)
    try {
      const propRes = await getManagerAssignedProperties()
      const propList = Array.isArray(propRes?.data)
        ? propRes.data
        : Array.isArray(propRes)
          ? propRes
          : []
      propList.forEach((p) => {
        const pid = p.propertyId || p.id
        const pname = p.propertyName || p.name || p.title
        if (pid && pname) {
          newPropertyMap[String(pid)] = pname
          assignedPropertyIdSet.add(String(pid))
        }
      })
    } catch (err) {
      console.warn('Could not load manager properties list for maintenance lookup:', err)
    }

    setPropertyMap((prev) => ({ ...prev, ...newPropertyMap }))

    // 3. For assigned properties, fetch property details to resolve Unit Number
    const targetPropertyIds = uniquePropertyIds.filter((pid) =>
      assignedPropertyIdSet.has(String(pid))
    )

    if (targetPropertyIds.length > 0) {
      await Promise.allSettled(
        targetPropertyIds.map(async (propertyId) => {
          try {
            const details = await getManagerAssignedPropertyDetails(propertyId)
            if (details) {
              if (Array.isArray(details?.buildings)) {
                for (const b of details.buildings) {
                  if (Array.isArray(b?.floors)) {
                    for (const f of b.floors) {
                      if (Array.isArray(f?.units)) {
                        for (const u of f.units) {
                          if (u?.unitId != null && u?.unitNumber) {
                            newUnitMap[String(u.unitId)] = String(u.unitNumber)
                          }
                        }
                      }
                    }
                  }
                }
              }
              if (Array.isArray(details?.units)) {
                for (const u of details.units) {
                  if (u?.unitId != null && u?.unitNumber) {
                    newUnitMap[String(u.unitId)] = String(u.unitNumber)
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`Could not load details for assigned property ${propertyId}:`, err)
          }
        })
      )
    }

    setPropertyMap((prev) => ({ ...prev, ...newPropertyMap }))
    setUnitMap((prev) => ({ ...prev, ...newUnitMap }))
  }

  const fetchTickets = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const [ticketsData, workersData, assignmentsData] = await Promise.allSettled([
        getMaintenanceRequests(),
        getMaintenanceWorkers(),
        getMaintenanceAssignments(),
      ])

      if (ticketsData.status === 'fulfilled' && Array.isArray(ticketsData.value)) {
        setRequests(ticketsData.value)
        enrichPropertiesAndUnits(ticketsData.value)
      } else {
        setRequests([])
      }

      if (workersData.status === 'fulfilled' && Array.isArray(workersData.value)) {
        setAvailableWorkers(workersData.value)
        if (workersData.value.length > 0) {
          setSelectedWorkerId(String(workersData.value[0].workerId || workersData.value[0].id))
        }
      }

      if (assignmentsData.status === 'fulfilled' && Array.isArray(assignmentsData.value)) {
        const map = {}
        assignmentsData.value.forEach((a) => {
          const reqId = a.maintenanceRequest?.requestId || a.maintenanceRequest?.id
          if (reqId) map[reqId] = a
        })
        setTicketAssignments(map)
      }
    } catch (err) {
      setErrorMessage(
        err?.message || 'Unable to retrieve maintenance requests from backend.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  // Load human-readable details for property, unit, and tenant when modal opens
  const loadTicketEntities = async (ticketData) => {
    if (!ticketData) return

    setModalPropertyName(ticketData.propertyName || propertyMap[ticketData.propertyId] || '')
    setModalUnitNumber(
      ticketData.unitNumber
        ? String(ticketData.unitNumber)
        : unitMap[ticketData.unitId]
          ? String(unitMap[ticketData.unitId])
          : ''
    )
    setModalTenantName(ticketData.tenantName || '')

    const { propertyId, unitId, tenantId } = ticketData

    // 1. Property and Unit resolution via manager-authorized endpoints
    if (propertyId) {
      try {
        let details = null
        try {
          details = await getManagerAssignedPropertyDetails(propertyId)
        } catch (detailsErr) {
          try {
            const myProps = await getManagerAssignedProperties()
            const list = Array.isArray(myProps?.data)
              ? myProps.data
              : Array.isArray(myProps)
                ? myProps
                : []
            const matchedProp = list.find(
              (p) => String(p.propertyId || p.id) === String(propertyId)
            )
            if (matchedProp) {
              const pName = matchedProp.propertyName || matchedProp.name || matchedProp.title
              if (pName) {
                setModalPropertyName((prev) => prev || pName)
                setPropertyMap((prev) => ({ ...prev, [propertyId]: pName }))
              }
            }
          } catch (fallbackErr) {
            // Ignore
          }
        }

        if (details) {
          const propName =
            details?.property?.propertyName ||
            details?.propertyName ||
            details?.property?.name ||
            details?.name ||
            details?.title
          if (propName) {
            setModalPropertyName(propName)
            setPropertyMap((prev) => ({ ...prev, [propertyId]: propName }))
          }

          if (unitId) {
            let foundUnitNum = null
            if (Array.isArray(details?.buildings)) {
              for (const b of details.buildings) {
                if (Array.isArray(b?.floors)) {
                  for (const f of b.floors) {
                    if (Array.isArray(f?.units)) {
                      for (const u of f.units) {
                        if (String(u?.unitId) === String(unitId)) {
                          foundUnitNum = u.unitNumber
                          break
                        }
                      }
                    }
                    if (foundUnitNum) break
                  }
                }
                if (foundUnitNum) break
              }
            }

            if (!foundUnitNum && Array.isArray(details?.units)) {
              const uMatch = details.units.find(
                (u) => String(u?.unitId) === String(unitId)
              )
              if (uMatch?.unitNumber) {
                foundUnitNum = uMatch.unitNumber
              }
            }

            if (foundUnitNum) {
              setModalUnitNumber(String(foundUnitNum))
              setUnitMap((prev) => ({ ...prev, [unitId]: String(foundUnitNum) }))
            }
          }
        }
      } catch (err) {
        console.warn('Could not load manager property details:', err)
      }
    }

    // 2. Tenant name resolution using manager-authorized application and agreement APIs
    const resolveTenantName = async () => {
      // 2a. Check applications submitted for this unit
      if (unitId) {
        try {
          const unitApps = await getApplicationsForUnit(unitId)
          const list = Array.isArray(unitApps?.data)
            ? unitApps.data
            : Array.isArray(unitApps)
              ? unitApps
              : []
          if (list.length > 0) {
            const match = list.find((a) => String(a.tenantId) === String(tenantId))
            if (match?.tenantName) {
              if (match.unitNumber) {
                setModalUnitNumber((prev) => prev || String(match.unitNumber))
                setUnitMap((prev) => ({ ...prev, [unitId]: String(match.unitNumber) }))
              }
              if (match.propertyName) {
                setModalPropertyName((prev) => prev || match.propertyName)
                if (propertyId) setPropertyMap((prev) => ({ ...prev, [propertyId]: match.propertyName }))
              }
              return match.tenantName
            }
            const approved = list.find((a) => a.status === 'APPROVED' && a.tenantName)
            if (approved?.tenantName) {
              if (approved.unitNumber) {
                setModalUnitNumber((prev) => prev || String(approved.unitNumber))
                setUnitMap((prev) => ({ ...prev, [unitId]: String(approved.unitNumber) }))
              }
              if (approved.propertyName) {
                setModalPropertyName((prev) => prev || approved.propertyName)
                if (propertyId) setPropertyMap((prev) => ({ ...prev, [propertyId]: approved.propertyName }))
              }
              return approved.tenantName
            }
            const first = list.find((a) => a.tenantName)
            if (first?.tenantName) {
              if (first.unitNumber) {
                setModalUnitNumber((prev) => prev || String(first.unitNumber))
                setUnitMap((prev) => ({ ...prev, [unitId]: String(first.unitNumber) }))
              }
              return first.tenantName
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // 2b. Check applications submitted for this property
      if (propertyId) {
        try {
          const propApps = await getApplicationsForProperty(propertyId)
          const list = Array.isArray(propApps?.data)
            ? propApps.data
            : Array.isArray(propApps)
              ? propApps
              : []
          if (list.length > 0) {
            const match = list.find(
              (a) => String(a.tenantId) === String(tenantId) && a.tenantName
            )
            if (match?.tenantName) {
              if (match.unitNumber && unitId) {
                setModalUnitNumber((prev) => prev || String(match.unitNumber))
                setUnitMap((prev) => ({ ...prev, [unitId]: String(match.unitNumber) }))
              }
              return match.tenantName
            }
            if (unitId) {
              const unitMatch = list.find(
                (a) => String(a.unitId) === String(unitId) && a.tenantName
              )
              if (unitMatch?.tenantName) {
                if (unitMatch.unitNumber) {
                  setModalUnitNumber((prev) => prev || String(unitMatch.unitNumber))
                  setUnitMap((prev) => ({ ...prev, [unitId]: String(unitMatch.unitNumber) }))
                }
                return unitMatch.tenantName
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // 2c. Check active rental agreements
      try {
        const agrs = await axiosClient.get('/rental-agreements')
        const agrList = Array.isArray(agrs?.data)
          ? agrs.data
          : Array.isArray(agrs)
            ? agrs
            : []
        const match = agrList.find(
          (a) =>
            (tenantId && String(a.tenantId) === String(tenantId)) ||
            (unitId && String(a.unitId) === String(unitId))
        )
        if (match?.applicationId) {
          const app = await getApplicationById(match.applicationId)
          if (app?.tenantName) return app.tenantName
        }
      } catch (e) {
        // Fallback
      }

      return null
    }

    resolveTenantName()
      .then((resolvedName) => {
        if (resolvedName) {
          setModalTenantName(resolvedName)
        }
      })
      .catch((err) => {
        console.warn('Could not resolve tenant name for manager view:', err)
      })
  }

  const handleOpenTicketModal = async (ticket) => {
    setSelectedTicket(ticket)
    setModalPrediction(null)
    setAssignmentError('')
    loadTicketEntities(ticket)

    if (ticket?.propertyId) {
      setPredictionLoading(true)
      try {
        const pred = await predictMaintenance(ticket.propertyId, ticket.unitId)
        setModalPrediction(pred)
      } catch (e) {
        // Silently ignore if prediction telemetry unavailable
      } finally {
        setPredictionLoading(false)
      }
    }
  }

  const displayModalPropertyName =
    formatPropertyName(modalPropertyName) ||
    (selectedTicket?.propertyId ? `Property #${selectedTicket.propertyId}` : '—')

  const displayModalUnitNumber =
    modalUnitNumber !== null && modalUnitNumber !== undefined && String(modalUnitNumber).trim()
      ? `Unit ${String(modalUnitNumber).trim().replace(/^Unit\s*/i, '')}`
      : selectedTicket?.unitId
        ? `Unit #${selectedTicket.unitId}`
        : '—'

  const displayModalTenantName =
    modalTenantName?.trim() ||
    (selectedTicket?.tenantId ? `Tenant #${selectedTicket.tenantId}` : '—')

  const handleModalStatusChange = async (newStatus) => {
    if (!selectedTicket) return
    const ticketId = selectedTicket.requestId || selectedTicket.id
    try {
      await updateMaintenanceStatus(ticketId, newStatus)
      setSelectedTicket((prev) => ({ ...prev, status: newStatus }))
      setRequests((prev) =>
        prev.map((r) =>
          (r.requestId || r.id) === ticketId ? { ...r, status: newStatus } : r
        )
      )
      setSuccessMessage(`Ticket #${ticketId} status updated to ${formatStatusLabel(newStatus)}.`)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to update status.')
    }
  }

  const handleModalAssignWorker = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !selectedWorkerId) return

    const ticketId = selectedTicket.requestId || selectedTicket.id
    setIsAssigning(true)
    setAssignmentError('')
    try {
      const payload = {
        maintenanceRequest: { requestId: Number(ticketId) },
        worker: { workerId: Number(selectedWorkerId) },
        status: 'ASSIGNED',
        notes: assignmentNotes.trim() || undefined,
      }
      const newAssignment = await createMaintenanceAssignment(payload)
      setTicketAssignments((prev) => ({ ...prev, [ticketId]: newAssignment }))

      // Transition ticket status to ASSIGNED if needed
      await updateMaintenanceStatus(ticketId, 'ASSIGNED')
      setSelectedTicket((prev) => ({ ...prev, status: 'ASSIGNED' }))
      setRequests((prev) =>
        prev.map((r) =>
          (r.requestId || r.id) === ticketId ? { ...r, status: 'ASSIGNED' } : r
        )
      )

      setSuccessMessage('Technician dispatched successfully.')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setAssignmentError(err?.message || 'Failed to dispatch technician.')
    } finally {
      setIsAssigning(false)
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All' },
    ...MAINTENANCE_STATUSES.map((st) => ({
      value: st,
      label: formatStatusLabel(st),
    })),
  ]

  const priorityOptions = [
    { value: 'all', label: 'All' },
    ...MAINTENANCE_PRIORITIES.map((pr) => ({
      value: pr,
      label: `${formatPriorityLabel(pr)} Priority`,
    })),
  ]

  const filteredRequests = requests.filter((req) => {
    const reqStatus = String(req.status || '').toUpperCase()
    const isPast = reqStatus === 'COMPLETED' || reqStatus === 'CANCELLED'

    if (activeTab === 'active' && isPast) return false
    if (activeTab === 'history' && !isPast) return false

    const query = searchQuery.toLowerCase().trim()
    const ticketStr = String(req.requestId || req.id || '').toLowerCase()
    const desc = (req.description || '').toLowerCase()
    const cat = (req.category || '').toLowerCase()

    const matchesSearch =
      query === '' ||
      ticketStr.includes(query) ||
      desc.includes(query) ||
      cat.includes(query)

    const matchesStatus =
      statusFilter === 'all' || reqStatus === statusFilter.toUpperCase()

    const reqPriority = String(req.priority || '').toUpperCase()
    const matchesPriority =
      priorityFilter === 'all' || reqPriority === priorityFilter.toUpperCase()

    return matchesSearch && matchesStatus && matchesPriority
  })

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  const activeCount = requests.filter(
    (r) => String(r.status || '').toUpperCase() !== 'COMPLETED' && String(r.status || '').toUpperCase() !== 'CANCELLED'
  ).length

  const historyCount = requests.filter(
    (r) => String(r.status || '').toUpperCase() === 'COMPLETED' || String(r.status || '').toUpperCase() === 'CANCELLED'
  ).length

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="maintenance"
      pageTitle="Maintenance & Service Requests"
    >
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">

            <div>
              <h1 className="text-2xl font-bold text-[#243447]">
                Maintenance
              </h1>

              <p className="text-sm text-[#5B6875] mt-1">
                Manage maintenance requests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchTickets}
              disabled={loading}
            >
              Refresh
            </Button>

          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              className="text-[#3F7D58] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F4B4B4] text-[#8A2E2C] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#8A2E2C] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-[#8A2E2C] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-[#D9E0E6] pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-semibold transition-colors rounded-lg border flex items-center gap-2 ${activeTab === 'active'
              ? 'bg-[#3157AD] text-white shadow-xs'
              : 'text-[#5B6875] hover:text-[#3157AD] hover:bg-[#F7F8FA]'
              }`}
          >
            <Clock className="w-4 h-4" />

            <span>Active</span>

            <span
              className={`px-1.5 py-0.5 font-bold rounded-full text-[10px] ${activeTab === 'active'
                ? 'bg-white/20 text-white'
                : 'bg-[#EAF2F7] text-[#315A7D]'
                }`}
            >
              {activeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold transition-colors rounded-lg border flex items-center gap-2 ${activeTab === 'history'
              ? 'bg-[#3157AD] text-white shadow-xs'
              : 'text-[#5B6875] hover:text-[#3157AD] hover:bg-[#F7F8FA]'
              }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
            <span
              className={`px-1.5 py-0.5 font-bold rounded-full text-[10px] ${activeTab === 'history'
                ? 'bg-white/20 text-white'
                : 'bg-[#EAF2F7] text-[#315A7D]'
                }`}
            >
              {historyCount}
            </span>
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 font-semibold text-xs transition-colors rounded-lg border flex items-center gap-2 ${activeTab === "all"
              ? 'bg-[#3157AD] text-white shadow-xs'
              : 'text-[#5B6875] hover:text-[#3157AD] hover:bg-[#F7F8FA]'
              }`}
          >

            <span>All</span>
            <span
              className={`px-1.5 py-0.5 font-bold rounded-full text-[10px] ${activeTab === "all"
                ? 'bg-white/20 text-white'
                : 'bg-[#EAF2F7] text-[#3157AD]'
                }`}
            >
              {requests.length}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-[#D9E0E6] p-4 bg-white shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket number, category, description..."
                className="w-full h-12 pl-11 pr-4 rounded-lg border border-[#D9E0E6] bg-white text-sm text-[#243447] placeholder:text-[#8A9AAF] outline-none focus:ring-2 focus:ring-[#3157AD]/20 focus:border-[#3157AD]"
              />
            </div>

            {/* Status */}
            <div className="w-full lg:w-[280px] shrink-0">
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  ...MAINTENANCE_STATUSES.map((st) => ({
                    value: st,
                    label: formatStatusLabel(st),
                  })),
                ]}
                value={statusFilter || 'all'}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-12"
              />
            </div>

            {/* Priority + Reset */}
            <div className="flex gap-3 w-full lg:w-[352px] shrink-0">
              <div className="flex-1 min-w-0">
                <Select
                  options={[
                    { value: 'all', label: 'All Priorities' },
                    ...MAINTENANCE_PRIORITIES.map((pr) => ({
                      value: pr,
                      label: formatPriorityLabel(pr),
                    })),
                  ]}
                  value={priorityFilter || 'all'}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full h-12"
                />
              </div>

              <button
                type="button"
                onClick={resetFilters}
                title="Reset filters"
                aria-label="Reset filters"
                className="h-12 w-12 rounded-lg border border-[#D9E0E6] text-[#64748B] hover:text-[#243447] hover:bg-[#F7F8FA] transition-colors shrink-0 flex items-center justify-center"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>


        {/* Table / Results */}
        {loading ? (
          <div className="bg-white rounded-xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading maintenance tickets..." size="md" center />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<Wrench className="w-8 h-8" />}
              title="No maintenance tickets found"
              message="No service requests match your criteria."
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#D9E0E6] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4 text-[#243447]">Ticket #</th>
                    <th className="py-3.5 px-4 text-[#243447]">Category</th>
                    <th className="py-3.5 px-4 text-[#243447]">Property & Unit</th>
                    <th className="py-3.5 px-4 text-[#243447]">Priority</th>
                    <th className="py-3.5 px-4 text-[#243447]">Assigned Worker</th>
                    <th className="py-3.5 px-4 text-[#243447]">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right text-[#243447]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {filteredRequests.map((req) => {
                    const ticketId = req.requestId || req.id
                    const assignmentObj = ticketAssignments[ticketId]

                    return (
                      <tr key={ticketId} className="hover:bg-[#F7F8FA]/80 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#315A7D] text-xs">
                          #{ticketId}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-xs font-medium">
                          {formatCategoryLabel(req.category)}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <span className="font-medium text-[#243447] block">
                            {formatPropertyName(propertyMap[req.propertyId]) || (req.propertyId ? `Property #${req.propertyId}` : '—')}
                          </span>
                          <span className="text-[#5B6875] text-[11px]">
                            {unitMap[req.unitId] ? `Unit ${String(unitMap[req.unitId]).replace(/^Unit\s*/i, '')}` : req.unitId ? `Unit #${req.unitId}` : ''}
                          </span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(
                              req.priority
                            )}`}
                          >
                            {formatPriorityLabel(req.priority)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs whitespace-nowrap">
                          {assignmentObj?.worker ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#243447]">
                              <HardHat className="w-3.5 h-3.5 text-[#315A7D]" />
                              {assignmentObj.worker.name}
                            </span>
                          ) : (
                            <span className="text-[#8A5B16] bg-[#FEF7EC] px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[#F4E2B6]">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <StatusBadge status={formatStatusLabel(req.status)} size="sm" />
                        </td>
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => handleOpenTicketModal(req)}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manager Ticket Action & Assignment Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-[#D9E0E6] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-[#243447] font-mono">
                    Ticket #{selectedTicket.requestId || selectedTicket.id}
                  </h3>
                  <StatusBadge status={formatStatusLabel(selectedTicket.status)} size="sm" />
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(
                      selectedTicket.priority
                    )}`}
                  >
                    {formatPriorityLabel(selectedTicket.priority)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-md text-[#5B6875] hover:text-[#243447]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#243447]">
                {/* Issue Details */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-2">
                  <span className="font-bold text-xs text-[#5B6875] uppercase tracking-wider block">
                    Description & Property Context
                  </span>
                  <p className="text-xs leading-relaxed">{selectedTicket.description || 'No description.'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#D9E0E6] text-xs">
                    <div className="flex items-center gap-1.5 text-[#243447]">
                      <Building2 className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                      <span className="text-[#5B6875]">Property:</span>
                      <strong className="font-semibold truncate">{displayModalPropertyName}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#243447]">
                      <span className="text-[#5B6875]">Unit:</span>
                      <strong className="font-semibold">{displayModalUnitNumber}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#243447]">
                      <Users className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                      <span className="text-[#5B6875]">Tenant:</span>
                      <strong className="font-semibold truncate">{displayModalTenantName}</strong>
                    </div>
                  </div>
                  {selectedTicket.imageUrl && (
                    <div className="pt-2 border-t border-[#D9E0E6] space-y-1">
                      <span className="font-semibold text-[11px] text-[#5B6875] block">
                        Attached Issue Photo:
                      </span>
                      <div className="rounded-lg border border-[#D9E0E6] overflow-hidden bg-white p-1.5 flex justify-center max-h-48">
                        <img
                          src={selectedTicket.imageUrl}
                          alt="Issue attachment"
                          className="w-full h-auto object-contain max-h-44 rounded-md"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Prediction Quick Strip if Available */}
                {modalPrediction && (
                  <div className="p-3.5 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] space-y-1 text-xs">
                    <span className="font-bold text-[#315A7D] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#315A7D]" /> AI Risk Forecast:
                    </span>
                    <p className="text-[#243447]">
                      Risk Level: <strong>{modalPrediction.maintenance_risk?.risk_level || '—'}</strong> &bull; Failure Probability: <strong>{modalPrediction.maintenance_risk?.probability == null ? '—' : `${(Number(modalPrediction.maintenance_risk.probability) * 100).toFixed(1)}%`}</strong> &bull; Forecasted Cost: <strong>{modalPrediction.next_month_maintenance_cost == null ? '—' : `₹${Number(modalPrediction.next_month_maintenance_cost).toFixed(2)}`}</strong>
                    </p>
                  </div>
                )}

                {/* Status Update Actions */}
                <div className="p-4 rounded-xl border border-[#D9E0E6] space-y-2">
                  <span className="font-bold text-xs text-[#5B6875] uppercase tracking-wider block">
                    Operational Status Transition
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {MAINTENANCE_STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleModalStatusChange(st)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${String(selectedTicket.status).toUpperCase() === st
                          ? 'bg-[#315A7D] text-white border-[#315A7D]'
                          : 'bg-[#F7F8FA] text-[#243447] border-[#D9E0E6] hover:bg-[#EAF2F7]'
                          }`}
                      >
                        {formatStatusLabel(st)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Worker Assignment Form */}
                <form
                  onSubmit={handleModalAssignWorker}
                  className="p-4 rounded-xl border border-[#D9E0E6] space-y-3"
                >
                  <span className="font-bold text-xs text-[#5B6875] uppercase tracking-wider block flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-[#315A7D]" />
                    Dispatch Technician / Contractor
                  </span>

                  {assignmentError && (
                    <p className="text-xs text-[#8A2E2C]">{assignmentError}</p>
                  )}

                  <div>
                    <label className="block mb-1 font-semibold text-[#5B6875]">Select Technician</label>
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-[#D9E0E6] text-xs bg-[#F7F8FA]"
                    >
                      {availableWorkers.map((w) => (
                        <option key={w.workerId || w.id} value={w.workerId || w.id}>
                          {w.name || '—'} ({w.specialization || '—'}) - {w.phone || '—'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-semibold text-[#5B6875]">Assignment Notes</label>
                    <Textarea
                      placeholder="Special instructions for service contractor..."
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isAssigning}
                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  >
                    Confirm Dispatch & Assignment
                  </Button>
                </form>
              </div>

              <div className="p-4 border-t border-[#D9E0E6] bg-[#F7F8FA] flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
