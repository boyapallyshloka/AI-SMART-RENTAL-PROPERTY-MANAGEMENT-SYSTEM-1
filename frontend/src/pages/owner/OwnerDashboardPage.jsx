import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, StatusBadge, Loader, EmptyState } from '../../components/ui'
import {
  Building2,
  Users,
  IndianRupee,
  Wrench,
  Plus,
  ArrowRight,
  CreditCard,
  FileText,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  MapPin,
} from 'lucide-react'
import { getOwnerPropertiesWithDetails } from '../../api/propertyApi'
import { getMaintenanceRequests } from '../../api/maintenanceApi'
import { getInvoices } from '../../api/invoiceApi'
import { formatCurrency } from '../../utils/currency'
import ownerHeroBg from '../../assets/owner-hero-bg.jpg'

export default function OwnerDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [properties, setProperties] = useState([])
  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  const [invoices, setInvoices] = useState([])
  const [dataAvailability, setDataAvailability] = useState({ properties: false, maintenance: false, invoices: false })

  const loadDashboardData = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [propsRes, maintRes, invRes] = await Promise.allSettled([
        getOwnerPropertiesWithDetails(),
        getMaintenanceRequests(),
        getInvoices(),
      ])

      const availability = {
        properties: propsRes.status === 'fulfilled',
        maintenance: maintRes.status === 'fulfilled',
        invoices: invRes.status === 'fulfilled',
      }
      setDataAvailability(availability)
      const unavailableSources = Object.entries(availability)
        .filter(([, isAvailable]) => !isAvailable)
        .map(([source]) => source === 'maintenance' ? 'maintenance requests' : source)
      if (unavailableSources.length) {
        setErrorMessage(`Unable to load ${unavailableSources.join(', ')}. Related dashboard values are unavailable.`)
      }

      const loadedProps =
        propsRes.status === 'fulfilled'
          ? Array.isArray(propsRes.value?.data)
            ? propsRes.value.data
            : Array.isArray(propsRes.value)
            ? propsRes.value
            : []
          : []

      const loadedMaint =
        maintRes.status === 'fulfilled'
          ? Array.isArray(maintRes.value?.data)
            ? maintRes.value.data
            : Array.isArray(maintRes.value)
            ? maintRes.value
            : []
          : []

      const loadedInvoices =
        invRes.status === 'fulfilled'
          ? Array.isArray(invRes.value?.data)
            ? invRes.value.data
            : Array.isArray(invRes.value)
            ? invRes.value
            : []
          : []

      setProperties(loadedProps)
      setMaintenanceRequests(loadedMaint)
      setInvoices(loadedInvoices)
    } catch (err) {
      console.error('Failed to load owner dashboard data:', err)
      setDataAvailability({ properties: false, maintenance: false, invoices: false })
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load dashboard data. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Derived metrics from real backend data
  const totalProperties = dataAvailability.properties ? properties.length : null
  const unitCountsAvailable = dataAvailability.properties && (
    properties.length === 0 || properties.every((property) =>
      property.totalUnits != null && Number.isFinite(Number(property.totalUnits))
    )
  )
  const totalUnits = unitCountsAvailable
    ? properties.reduce((sum, property) => sum + Number(property.totalUnits), 0)
    : null
  const openMaintenance = dataAvailability.maintenance ? maintenanceRequests.filter((m) =>
    ['OPEN', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS'].includes(
      String(m.status || '').toUpperCase()
    )
  ).length : null

  const paidInvoices = dataAvailability.invoices ? invoices.filter(
    (inv) => String(inv.status || '').toUpperCase() === 'PAID'
  ) : []
  const revenueAvailable = dataAvailability.invoices && paidInvoices.every((invoice) =>
    (invoice.amount != null || invoice.totalAmount != null) &&
    Number.isFinite(Number(invoice.amount ?? invoice.totalAmount))
  )
  const totalRevenue = revenueAvailable
    ? paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? invoice.totalAmount), 0)
    : null

  const ownerDisplayName = user?.name || user?.username || 'Owner'

  // Sort recent requests by date when available, preserving order if dates are missing
  const recentMaintenance = useMemo(() => {
    return [...maintenanceRequests].sort((a, b) => {
      const dateA = new Date(a.requestedDate || a.submittedDate || a.createdAt || 0).getTime()
      const dateB = new Date(b.requestedDate || b.submittedDate || b.createdAt || 0).getTime()
      if (isNaN(dateA) || isNaN(dateB) || dateA === dateB) return 0
      return dateB - dateA
    })
  }, [maintenanceRequests])

  // Sort recent invoices by date when available, preserving order if dates are missing
  const recentInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt || a.issueDate || 0).getTime()
      const dateB = new Date(b.dueDate || b.createdAt || b.issueDate || 0).getTime()
      if (isNaN(dateA) || isNaN(dateB) || dateA === dateB) return 0
      return dateB - dateA
    })
  }, [invoices])

  return (
    <DashboardLayout
      defaultRole="owner"
      activeItem="dashboard"
      pageTitle="Owner Dashboard"
    >
      <div className="space-y-5">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#991B1B] shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadDashboardData}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 shadow-2xs flex justify-center">
            <Loader text="Loading property portfolio..." size="md" center />
          </div>
        ) : (
          <>
            {/* Compact Welcome Section with Architectural Framing */}
            <div
              className="relative overflow-hidden rounded-xl border border-[#D9E2EC] shadow-2xs bg-cover bg-center min-h-[72px] sm:min-h-[80px] flex items-center"
              style={{ backgroundImage: `url(${ownerHeroBg})` }}
            >
              {/* Luminous overlay for high text contrast without overwhelming height */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/94 via-white/80 to-white/94 backdrop-blur-[0.5px]" />

              <div className="relative z-10 px-5 sm:px-6 py-3.5">
                <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#1B2B4A]">
                  Welcome back, {ownerDisplayName}!
                </h1>
              </div>
            </div>

            {/* Summary Metrics: Compact 4-Card Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <MetricCard
                title="Total Properties"
                value={totalProperties == null ? '—' : `${totalProperties} ${totalProperties === 1 ? 'Property' : 'Properties'}`}
                subtitle={`${totalUnits ?? '—'} units configured`}
                icon={<Building2 className="w-4 h-4 text-[#315A7D]" />}
                iconBg="bg-[#EBF2F7] border-[#D9E2EC]"
              />
              <MetricCard
                title="Revenue Collected"
                value={totalRevenue == null ? '—' : formatCurrency(totalRevenue)}
                subtitle={dataAvailability.invoices ? `${paidInvoices.length} settled invoices` : 'Invoice data unavailable'}
                icon={<IndianRupee className="w-4 h-4 text-[#2E7D5B]" />}
                iconBg="bg-[#EAF5EF] border-[#D0E7D9]"
              />
              <MetricCard
                title="Invoices Issued"
                value={dataAvailability.invoices ? `${invoices.length} Total` : '—'}
                subtitle={dataAvailability.invoices ? `${invoices.length - paidInvoices.length} pending settlement` : 'Invoice data unavailable'}
                icon={<CreditCard className="w-4 h-4 text-[#315A7D]" />}
                iconBg="bg-[#EBF2F7] border-[#D9E2EC]"
              />
              <MetricCard
                title="Open Maintenance"
                value={openMaintenance == null ? '—' : `${openMaintenance} Tickets`}
                subtitle="Requires service action"
                icon={<Wrench className="w-4 h-4 text-[#B7791F]" />}
                iconBg="bg-[#FEF6EC] border-[#FAD7B2]"
              />
            </div>

            {/* Main Balanced 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 1. My Properties Preview (Max 3 Items) */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#1B2B4A]">
                      My Properties
                    </h2>
                    <p className="text-xs text-[#64748B]">Current real estate assets</p>
                  </div>
                  <Link to="/owner/properties">
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View All Properties
                    </Button>
                  </Link>
                </div>

                {!dataAvailability.properties ? (
                  <EmptyState icon={<Building2 className="w-7 h-7 text-[#5B6875]" />} title="Property data unavailable" description="The backend did not return property records. Retry to load your portfolio." />
                ) : properties.length === 0 ? (
                  <EmptyState
                    icon={<Building2 className="w-7 h-7 text-[#5B6875]" />}
                    title="No properties registered yet"
                    description="Add your first property to configure buildings, floors, and rental units."
                    action={
                      <Link to="/owner/properties/add">
                        <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                          Add Property
                        </Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="divide-y divide-[#EDF2F7]">
                    {properties.slice(0, 3).map((prop) => {
                      const propId = prop.propertyId || prop.id
                      const propName = prop.propertyName || prop.name || 'Untitled Property'
                      const addressStr = prop.locationDisplay || prop.fullLocation || [
                        prop.addressLine1 || (typeof prop.address === 'string' ? prop.address : ''),
                        prop.addressLine2,
                        prop.area,
                        prop.city,
                        prop.state,
                        prop.pincode,
                      ].filter(Boolean).join(', ') || 'Location not set'
                      const imageUrl = prop.imageUrl || prop.images?.find?.((image) => image?.isPrimary)?.imageUrl || prop.images?.[0]?.imageUrl
                      const propertyType = prop.propertyType || prop.type || 'Type unavailable'

                      return (
                        <div key={propId} className="py-2.5 flex items-center gap-3 text-sm hover:bg-[#F8FAFC] px-1.5 rounded-lg transition-colors -mx-1.5">
                          {imageUrl ? (
                            <img src={imageUrl} alt={propName} className="h-14 w-16 rounded-lg border border-[#D9E0E6] object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-14 w-16 rounded-lg border border-[#D9E0E6] bg-[#F0F5FA] flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-[#315A7D]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pr-3">
                            <Link
                              to={`/owner/properties/${propId}`}
                              className="font-semibold text-[#1B2B4A] hover:text-[#315A7D] transition-colors truncate block text-xs sm:text-sm"
                            >
                              {propName}
                            </Link>
                            <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                              <span className="truncate">{addressStr}</span>
                              {prop.totalUnits != null && !['HOUSE', 'VILLA'].includes(String(propertyType).toUpperCase()) && (
                                <span className="shrink-0 text-[#94A3B8]">&bull; {prop.totalUnits} units</span>
                              )}
                            </p>
                          </div>
                          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F0F5FA] text-[#315A7D] border border-[#D9E2EC] shrink-0">
                            {propertyType}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 2. Quick Actions Panel */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                <div>
                  <div className="border-b border-[#EDF2F7] pb-3">
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#1B2B4A]">
                      Quick Actions
                    </h2>
                    <p className="text-xs text-[#64748B] mt-0.5">Common property tasks</p>
                  </div>
                  <div className="space-y-2 mt-3.5">
                    <Link to="/owner/properties/add" className="block">
                      <Button size="sm" variant="primary" className="w-full justify-start rounded-lg text-xs" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                        Add New Property
                      </Button>
                    </Link>
                    <Link to="/owner/agreements/new" className="block">
                      <Button size="sm" variant="secondary" className="w-full justify-start rounded-lg text-xs" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                        Create Lease Agreement
                      </Button>
                    </Link>
                    <Link to="/owner/maintenance" className="block">
                      <Button size="sm" variant="secondary" className="w-full justify-start rounded-lg text-xs" leftIcon={<Wrench className="w-3.5 h-3.5" />}>
                        View Maintenance Tickets
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EDF2F7]">
                  <div className="p-3 rounded-lg bg-[#F0F5FA] border border-[#D9E2EC] text-xs">
                    <p className="font-semibold text-[#1B2B4A] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#315A7D]" />
                      Portfolio Status
                    </p>
                    <p className="text-[#64748B] mt-1 leading-normal">
                      {openMaintenance > 0
                        ? `${openMaintenance} maintenance ticket(s) currently open.`
                        : 'All maintenance requests resolved.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Recent Maintenance Requests (Max 3 Items) */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#1B2B4A]">
                      Recent Maintenance Requests
                    </h2>
                    <p className="text-xs text-[#64748B]">Latest repair tickets from tenants</p>
                  </div>
                  <Link to="/owner/maintenance">
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View All Tickets
                    </Button>
                  </Link>
                </div>

                {!dataAvailability.maintenance ? (
                  <EmptyState icon={<Wrench className="w-7 h-7 text-[#5B6875]" />} title="Maintenance data unavailable" description="The backend did not return maintenance requests." />
                ) : recentMaintenance.length === 0 ? (
                  <EmptyState
                    icon={<Wrench className="w-7 h-7 text-[#5B6875]" />}
                    title="No maintenance requests"
                    description="No tickets have been submitted by tenants yet."
                  />
                ) : (
                  <div className="divide-y divide-[#EDF2F7]">
                    {recentMaintenance.slice(0, 3).map((ticket) => {
                      const tId = ticket.requestId || ticket.id
                      const requestDate = ticket.requestedDate || ticket.submittedDate || ticket.createdAt
                      const dateStr = requestDate ? new Date(requestDate).toLocaleDateString() : 'Date unavailable'

                      return (
                        <div key={tId} className="py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-[#F8FAFC] px-1.5 rounded-lg transition-colors -mx-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#F0F5FA] border border-[#D9E2EC] flex items-center justify-center shrink-0">
                              <Wrench className="w-3.5 h-3.5 text-[#315A7D]" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/owner/maintenance/${tId}`}
                                className="font-semibold text-[#1B2B4A] text-xs sm:text-sm hover:text-[#315A7D] truncate block transition-colors"
                              >
                                #{tId} &bull; {ticket.category || 'Maintenance'}: {ticket.description || 'Details unavailable'}
                              </Link>
                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                Submitted {dateStr}
                              </p>
                            </div>
                          </div>
                          {ticket.status ? <StatusBadge status={ticket.status} size="xs" /> : <span className="text-[10px] text-[#64748B]">Status unavailable</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 4. Rent Invoices (Max 3 Items) */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#1B2B4A]">
                      Rent Invoices
                    </h2>
                    <p className="text-xs text-[#64748B]">Recent billing records</p>
                  </div>
                  <Link to="/owner/payments">
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View Invoices
                    </Button>
                  </Link>
                </div>

                {!dataAvailability.invoices ? (
                  <EmptyState icon={<FileText className="w-7 h-7 text-[#5B6875]" />} title="Invoice data unavailable" description="The backend did not return invoice records." />
                ) : recentInvoices.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-7 h-7 text-[#5B6875]" />}
                    title="No invoices generated"
                    description="Invoices will appear once created for active leases."
                  />
                ) : (
                  <div className="divide-y divide-[#EDF2F7]">
                    {recentInvoices.slice(0, 3).map((inv) => {
                      const invId = inv.invoiceId || inv.id
                      const amount = Number(inv.amount || inv.totalAmount || 0)

                      return (
                        <div key={invId} className="py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-[#F8FAFC] px-1.5 rounded-lg transition-colors -mx-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#EAF5EF] border border-[#D0E7D9] flex items-center justify-center shrink-0">
                              <CreditCard className="w-3.5 h-3.5 text-[#2E7D5B]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1B2B4A] text-xs sm:text-sm">
                                Invoice #{invId}
                              </p>
                              <p className="text-[11px] text-[#64748B]">
                              Due {inv.dueDate || 'Date unavailable'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-xs sm:text-sm text-[#1B2B4A] block mb-0.5">
                              {inv.amount != null || inv.totalAmount != null ? formatCurrency(amount) : '—'}
                            </span>
                            {inv.status ? <StatusBadge status={inv.status} size="xs" /> : <span className="text-[10px] text-[#64748B]">Status unavailable</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function MetricCard({ title, value, subtitle, icon, iconBg = 'bg-[#EBF2F7] border-[#D9E2EC]' }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B6875] truncate mr-1">{title}</span>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      <div className="mt-2">
        <p className="text-lg sm:text-xl font-bold tracking-tight text-[#1B2B4A] font-sans truncate">{value}</p>
        <p className="text-[11px] text-[#64748B] mt-0.5 font-medium truncate">{subtitle}</p>
      </div>
    </div>
  )
}

