import React, { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import {
  getMaintenanceRequests,
  getMaintenanceRequestById,
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
  formatStatusLabel,
  formatPriorityLabel,
  formatCategoryLabel,
  getPriorityBadgeClass,
} from '../../api/maintenanceApi'
import {
  getPublicProperties,
  getPublicPropertyDetails,
} from '../../api/propertyApi'
import { getMyApplications } from '../../api/applicationApi'
import {
  Button,
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Loader,
} from '../../components/ui'
import {
  Wrench,
  Plus,
  Search,
  RotateCcw,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Info,
  Eye,
  X,
  ImageIcon,
} from 'lucide-react'

export default function TenantMaintenancePage() {
  const { user } = useAuth()
  const location = useLocation()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [propertyMap, setPropertyMap] = useState({})
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ''
  )
  const [fetchError, setFetchError] = useState('')

  // 🤖 1. Initialize our Push Notification URL Query Hook
  const [searchParams] = useSearchParams()

  const loadTenantRequests = async () => {
    setLoading(true)
    setFetchError('')

    try {
      // 1. Gather live property and unit infrastructure data streams from the server
      const [maintRes, publicPropsRes, appsRes] = await Promise.allSettled([
        getMaintenanceRequests(),
        getPublicProperties(),
        getMyApplications(),
      ])

      let allBackendRequests = []
      if (maintRes.status === 'fulfilled') {
        const val = maintRes.value
        allBackendRequests = Array.isArray(val)
          ? val
          : Array.isArray(val?.data)
            ? val.data
            : []
        setRequests(allBackendRequests)
      } else {
        const err = maintRes.reason
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Unable to load maintenance requests from the server.'
        setFetchError(msg)
        setRequests([])
      }

      // Build property ID -> Property Name mapping dictionaries
      const mapping = {}

      if (publicPropsRes.status === 'fulfilled') {
        const props = Array.isArray(publicPropsRes.value)
          ? publicPropsRes.value
          : Array.isArray(publicPropsRes.value?.data)
            ? publicPropsRes.value.data
            : []
        props.forEach((p) => {
          const pId = p.propertyId ?? p.id
          const pName = p.propertyName ?? p.name ?? p.title
          if (pId != null && pName) {
            mapping[String(pId)] = pName
            mapping[Number(pId)] = pName
          }
        })
      }

      if (appsRes.status === 'fulfilled') {
        const apps = Array.isArray(appsRes.value)
          ? appsRes.value
          : Array.isArray(appsRes.value?.data)
            ? appsRes.value.data
            : []
        apps.forEach((a) => {
          const pId = a.propertyId
          const pName = a.propertyName
          if (pId != null && pName) {
            mapping[String(pId)] = pName
            mapping[Number(pId)] = pName
          }
        })
      }

      // Resolve secondary missing properties in background thread pools
      const missingPropIds = [
        ...new Set(
          allBackendRequests
            .map((r) => r.propertyId)
            .filter((id) => id != null && !mapping[String(id)])
        ),
      ]

      if (missingPropIds.length > 0) {
        await Promise.allSettled(
          missingPropIds.map(async (id) => {
            try {
              const detailsRes = await getPublicPropertyDetails(id)
              const details = detailsRes?.data || detailsRes
              const name =
                details?.property?.propertyName ||
                details?.property?.name ||
                details?.propertyName ||
                details?.name
              if (name) {
                mapping[String(id)] = name
                mapping[Number(id)] = name
              }
            } catch (err) {
              // Ignore failure silences
            }
          })
        )
      }

      setPropertyMap(mapping)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load maintenance requests from the server.'
      setFetchError(msg)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  // 1. Trigger initial fetch sequence on component creation lifecycle mount
  useEffect(() => {
    loadTenantRequests()
  }, [])

  // 🤖 2. Notification Deep Link Parameter Interceptor Loop
  useEffect(() => {
    if (loading || requests.length === 0 || selectedTicket) return;

    const targetTicketId = searchParams.get('ticket');
    if (!targetTicketId) return;

    const matchedRequest = requests.find(req =>
      String(req.requestId || req.id || req.ticketNumber) === String(targetTicketId)
    );

    if (matchedRequest) {
      console.log(`🎯 Notification Deep Link: Auto-launching layout drawer for ticket: ${targetTicketId}`);
      setSelectedTicket(matchedRequest);
    }
  }, [loading, requests, searchParams, selectedTicket]);

  // 3. Resolve fallback properties dynamically for single active ticket layout drawers
  useEffect(() => {
    if (
      selectedTicket?.propertyId &&
      !propertyMap[String(selectedTicket.propertyId)]
    ) {
      const pId = selectedTicket.propertyId
      getPublicPropertyDetails(pId)
        .then((detailsRes) => {
          const details = detailsRes?.data || detailsRes
          const name =
            details?.property?.propertyName ||
            details?.property?.name ||
            details?.propertyName ||
            details?.name
          if (name) {
            setPropertyMap((prev) => ({
              ...prev,
              [String(pId)]: name,
              [Number(pId)]: name,
            }))
          }
        })
        .catch(() => { })
    }
  }, [selectedTicket, propertyMap])

  // 4. UI presentation utility hooks and filters
  const getPropertyDisplayName = (ticket) => {
    if (!ticket) return ''
    const pId = ticket.propertyId
    const name =
      (pId != null ? propertyMap[String(pId)] || propertyMap[Number(pId)] : null) ||
      ticket.propertyName ||
      ticket.property?.propertyName ||
      ticket.property?.name

    if (name && pId != null) {
      return `${name} (ID: ${pId})`
    }
    if (name) {
      return name
    }
    if (pId != null) {
      return `(ID: ${pId})`
    }
    return '—'
  }

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    ...MAINTENANCE_STATUSES.map((st) => ({
      value: st,
      label: formatStatusLabel(st),
    })),
  ]

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    ...MAINTENANCE_PRIORITIES.map((pr) => ({
      value: pr,
      label: `${formatPriorityLabel(pr)} Priority`,
    })),
  ]

  const filteredRequests = requests.filter((req) => {
    const query = searchQuery.toLowerCase().trim()
    const ticketIdStr = String(req.requestId || req.id || req.ticketNumber || '').toLowerCase()
    const desc = (req.description || '').toLowerCase()
    const cat = (req.category || '').toLowerCase()
    const propName = String(
      propertyMap[String(req.propertyId)] ||
      propertyMap[Number(req.propertyId)] ||
      req.propertyName ||
      ''
    ).toLowerCase()

    const matchesSearch =
      query === '' ||
      ticketIdStr.includes(query) ||
      desc.includes(query) ||
      cat.includes(query) ||
      propName.includes(query)

    const reqStatus = String(req.status || '').toUpperCase()
    const matchesStatus =
      statusFilter === 'all' || reqStatus === statusFilter.toUpperCase()

    const reqPriority = String(req.priority || '').toUpperCase()
    const matchesPriority =
      priorityFilter === 'all' || reqPriority === priorityFilter.toUpperCase()

    return matchesSearch && matchesStatus && matchesPriority
  })

  const hasActiveFilters =
    searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="maintenance"
      pageTitle="Maintenance"
    >
      <div className="space-y-6">
        {/* Success Message Banner */}
        {successMessage && (
          <div className="p-4 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] text-[#2A583B] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#3F7D58] shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              className="text-[#2A583B] hover:text-[#1D3E2A] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Notification Banner */}
        {fetchError && (
          <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F4B4B4] text-[#8A2E2C] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#8A2E2C] shrink-0" />
              <span>{fetchError}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadTenantRequests}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
              Maintenance Requests
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Track repairs, schedule service dispatches, and review technician resolution status
            </p>
          </div>

          <Link to="/tenant/maintenance/new">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Maintenance Request
            </Button>
          </Link>
        </div>

        {/* Search & Status Filter Bar */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search by ticket #, category, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
              />
            </div>

            <div>
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  options={priorityOptions}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset filters"
                  aria-label="Reset filters"
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
                {filteredRequests.length}
              </strong>{' '}
              of {requests.length} maintenance tickets
            </span>
            {hasActiveFilters && (
              <span className="text-[#315A7D] font-medium">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader text="Loading your maintenance requests..." size="md" center />
          </div>
        ) : filteredRequests.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
            <EmptyState
              icon={<Wrench className="w-8 h-8" />}
              title="No maintenance requests found"
              message={
                hasActiveFilters
                  ? 'No tickets match your search or filter criteria. Try resetting filters.'
                  : 'You do not have any open or previous maintenance repair requests on record.'
              }
              action={
                <Link to="/tenant/maintenance/new">
                  <Button
                    variant="primary"
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Create Maintenance Request
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          /* Maintenance Requests Table */
          <div className="bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3.5 pl-6 pr-4">Ticket #</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Submitted Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm">
                  {filteredRequests.map((req, index) => {
                    const ticketId = req.requestId || req.id || req.ticketNumber || '—'
                    const dateStr = req.requestedDate
                      ? new Date(req.requestedDate).toLocaleDateString()
                      : req.submittedDate || 'Date unavailable'

                    return (
                      <tr
                        key={req.requestId || req.id || req.ticketNumber || index}
                        className="hover:bg-[#F7F8FA] transition-colors"
                      >
                        {/* Ticket Number */}
                        <td className="py-4 pl-6 pr-4 font-mono font-semibold text-[#315A7D] text-xs whitespace-nowrap">
                          #{ticketId}
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#F7F8FA] text-[#243447] border border-[#D9E0E6]">
                            {formatCategoryLabel(req.category)}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-4 px-4 min-w-[200px] max-w-xs">
                          <p className="font-medium text-[#243447] text-xs truncate">
                            {req.description || 'No description provided'}
                          </p>
                        </td>

                        {/* Priority */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs border ${getPriorityBadgeClass(
                              req.priority
                            )}`}
                          >
                            {formatPriorityLabel(req.priority)}
                          </span>
                        </td>

                        {/* Submitted Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-[#5B6875]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#5B6875] shrink-0" />
                            <span>{dateStr}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <StatusBadge status={formatStatusLabel(req.status)} size="sm" />
                        </td>

                        {/* Actions: View Details */}
                        <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setSelectedTicket(req)}
                          >
                            View
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

        {/* Ticket Details Inspection Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
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
                  className="p-1 rounded-md text-[#5B6875] hover:text-[#243447] hover:bg-[#F7F8FA]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#5B6875] block">Category:</span>
                    <strong className="text-[#243447]">
                      {formatCategoryLabel(selectedTicket.category)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#5B6875] block">Submitted Date:</span>
                    <strong className="text-[#243447]">
                      {selectedTicket.requestedDate
                        ? new Date(selectedTicket.requestedDate).toLocaleString()
                        : selectedTicket.submittedDate || 'Date unavailable'}
                    </strong>
                  </div>
                </div>

                {(selectedTicket.propertyId != null || selectedTicket.propertyName) && (
                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-[#D9E0E6]">
                    <div>
                      <span className="text-[#5B6875] block">Property:</span>
                      <strong className="text-[#243447]">
                        {getPropertyDisplayName(selectedTicket)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Unit ID:</span>
                      <strong className="text-[#243447]">
                        {selectedTicket.unitId != null ? `#${selectedTicket.unitId}` : '—'}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#D9E0E6] space-y-1">
                  <span className="text-xs font-semibold text-[#243447] block">
                    Issue Description:
                  </span>
                  <p className="text-xs text-[#243447] leading-relaxed bg-[#F7F8FA] p-3 rounded-xl border border-[#D9E0E6]">
                    {selectedTicket.description || 'No description provided.'}
                  </p>
                </div>

                {selectedTicket.imageUrl && (
                  <div className="pt-2 border-t border-[#D9E0E6] space-y-1">
                    <span className="text-xs font-semibold text-[#243447] block">
                      Attached Photo:
                    </span>
                    <div className="rounded-xl border border-[#D9E0E6] overflow-hidden max-h-48 bg-[#F7F8FA] flex items-center justify-center">
                      <img
                        src={selectedTicket.imageUrl}
                        alt="Maintenance issue"
                        className="w-full h-auto object-contain max-h-48"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                )}

                {selectedTicket.costResponsibility && selectedTicket.cost != null && (
                  <div className="p-3 rounded-xl bg-[#EAF2F7] border border-[#D9E0E6] text-xs space-y-1 text-[#243447]">
                    <div className="font-bold">Maintenance cost allocation</div>
                    <p>{selectedTicket.costResponsibility === 'TENANT_PAID' ? 'Tenant responsible' : 'Owner responsible'}</p>
                    <p>Repair amount: ₹{Number(selectedTicket.cost).toLocaleString('en-IN')}</p>
                  </div>
                )}

                {selectedTicket.completedDate && (
                  <div className="p-3 rounded-xl bg-[#EDF7EE] border border-[#C6DEC8] text-xs space-y-1 text-[#2A583B]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-[#3F7D58]" />
                      <span>Ticket Completed</span>
                    </div>
                    <p>
                      Completed on: {new Date(selectedTicket.completedDate).toLocaleString()}
                    </p>
                    {selectedTicket.cost != null && (
                      <p>Total Repair Cost: ₹{Number(selectedTicket.cost).toLocaleString('en-IN')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#D9E0E6] bg-[#F7F8FA] flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTicket(null)}
                >
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