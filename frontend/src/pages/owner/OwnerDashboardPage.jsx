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
  const featuredProperty = properties[0]
  const featuredPropertyName = featuredProperty?.propertyName || featuredProperty?.name || 'Your property portfolio'
  const featuredPropertyImage = featuredProperty?.imageUrl ||
    featuredProperty?.primaryImage?.imageUrl ||
    (typeof featuredProperty?.primaryImage === 'string' ? featuredProperty.primaryImage : '') ||
    featuredProperty?.images?.find?.((image) => image?.isPrimary)?.imageUrl ||
    featuredProperty?.images?.[0]?.imageUrl || ownerHeroBg
  const featuredPropertyLocation = featuredProperty?.locationDisplay || featuredProperty?.fullLocation ||
    [featuredProperty?.area, featuredProperty?.city].filter(Boolean).join(', ')

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
          <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-10 shadow-sm flex justify-center">
            <Loader text="Loading property portfolio..." size="md" center />
          </div>
        ) : (
          <>
            <section className="grid overflow-hidden rounded-2xl border border-[#E2D5C1] bg-[#F8F1E6]/95 shadow-sm md:min-h-[220px] md:grid-cols-[1fr_0.9fr]" aria-label="Portfolio highlights">
              <div className="flex flex-col items-start justify-center px-6 py-7 sm:px-9">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#3F7D58]">Owner overview</p>
                <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-[#111820] sm:text-3xl">
                  Welcome back, {ownerDisplayName}
                </h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[#657168]">
                  A clear view of your homes, rental income, and what needs your attention.
                </p>
                <Link to="/owner/properties" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#3F7D58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#315F46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3F7D58] focus-visible:ring-offset-2">
                  View properties <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="relative min-h-[190px] overflow-hidden bg-[#111820] md:min-h-full">
                <img src={featuredPropertyImage} alt={featuredPropertyName} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#182B3C]/85 via-[#182B3C]/10 to-transparent md:bg-gradient-to-l md:from-transparent md:via-[#182B3C]/10 md:to-[#182B3C]/50" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">Featured property</p>
                  <h2 className="mt-1 font-serif text-xl font-semibold">{featuredPropertyName}</h2>
                  {featuredPropertyLocation && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/85"><MapPin className="h-3.5 w-3.5" />{featuredPropertyLocation}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Summary Metrics: Compact 4-Card Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <MetricCard
                title="Total Properties"
                value={totalProperties == null ? '—' : `${totalProperties} ${totalProperties === 1 ? 'Property' : 'Properties'}`}
                subtitle={`${totalUnits ?? '—'} units configured`}
                icon={<Building2 className="w-4 h-4 text-[#3F7D58]" />}
                iconBg="bg-[#EDF4ED] border-[#E3E8DF]"
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
                icon={<CreditCard className="w-4 h-4 text-[#3F7D58]" />}
                iconBg="bg-[#EDF4ED] border-[#E3E8DF]"
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
              <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E9EDE5] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#111820]">
                      My Properties
                    </h2>
                    <p className="text-xs text-[#657168]">Current real estate assets</p>
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
                  <div className="divide-y divide-[#E9EDE5]">
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
                        <div key={propId} className="py-2.5 flex items-center gap-3 text-sm hover:bg-[#F1E8DA] px-1.5 rounded-lg transition-colors -mx-1.5">
                          {imageUrl ? (
                            <img src={imageUrl} alt={propName} className="h-14 w-16 rounded-lg border border-[#E3E8DF] object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-14 w-16 rounded-lg border border-[#E2D5C1] bg-[#F0E5D5] flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-[#3F7D58]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pr-3">
                            <Link
                              to={`/owner/properties/${propId}`}
                              className="font-semibold text-[#111820] hover:text-[#3F7D58] transition-colors truncate block text-xs sm:text-sm"
                            >
                              {propName}
                            </Link>
                            <p className="text-[11px] text-[#657168] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                              <span className="truncate">{addressStr}</span>
                              {prop.totalUnits != null && !['HOUSE', 'VILLA'].includes(String(propertyType).toUpperCase()) && (
                                <span className="shrink-0 text-[#94A3B8]">&bull; {prop.totalUnits} units</span>
                              )}
                            </p>
                          </div>
                          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F0E5D5] text-[#315F46] border border-[#E2D5C1] shrink-0">
                            {propertyType}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 2. Quick Actions Panel */}
              <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="border-b border-[#E9EDE5] pb-3">
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#111820]">
                      Quick Actions
                    </h2>
                    <p className="text-xs text-[#657168] mt-0.5">Common property tasks</p>
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

                <div className="pt-3 border-t border-[#E9EDE5]">
                  <div className="p-3 rounded-lg bg-[#F0E5D5] border border-[#E2D5C1] text-xs">
                    <p className="font-semibold text-[#111820] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                      Portfolio Status
                    </p>
                    <p className="text-[#657168] mt-1 leading-normal">
                      {openMaintenance > 0
                        ? `${openMaintenance} maintenance ticket(s) currently open.`
                        : 'All maintenance requests resolved.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Recent Maintenance Requests (Max 3 Items) */}
              <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E9EDE5] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#111820]">
                      Recent Maintenance Requests
                    </h2>
                    <p className="text-xs text-[#657168]">Latest repair tickets from tenants</p>
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
                  <div className="divide-y divide-[#E9EDE5]">
                    {recentMaintenance.slice(0, 3).map((ticket) => {
                      const tId = ticket.requestId || ticket.id
                      const requestDate = ticket.requestedDate || ticket.submittedDate || ticket.createdAt
                      const dateStr = requestDate ? new Date(requestDate).toLocaleDateString() : 'Date unavailable'

                      return (
                        <div key={tId} className="py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-[#F1E8DA] px-1.5 rounded-lg transition-colors -mx-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#F0E5D5] border border-[#E2D5C1] flex items-center justify-center shrink-0">
                              <Wrench className="w-3.5 h-3.5 text-[#3F7D58]" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/owner/maintenance/${tId}`}
                                className="font-semibold text-[#111820] text-xs sm:text-sm hover:text-[#3F7D58] truncate block transition-colors"
                              >
                                #{tId} &bull; {ticket.category || 'Maintenance'}: {ticket.description || 'Details unavailable'}
                              </Link>
                              <p className="text-[11px] text-[#657168] mt-0.5">
                                Submitted {dateStr}
                              </p>
                            </div>
                          </div>
                          {ticket.status ? <StatusBadge status={ticket.status} size="xs" /> : <span className="text-[10px] text-[#657168]">Status unavailable</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 4. Rent Invoices (Max 3 Items) */}
              <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E9EDE5] pb-3">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-[#111820]">
                      Rent Invoices
                    </h2>
                    <p className="text-xs text-[#657168]">Recent billing records</p>
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
                  <div className="divide-y divide-[#E9EDE5]">
                    {recentInvoices.slice(0, 3).map((inv) => {
                      const invId = inv.invoiceId || inv.id
                      const amount = Number(inv.amount || inv.totalAmount || 0)

                      return (
                        <div key={invId} className="py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-[#F1E8DA] px-1.5 rounded-lg transition-colors -mx-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#EAF5EF] border border-[#D0E7D9] flex items-center justify-center shrink-0">
                              <CreditCard className="w-3.5 h-3.5 text-[#2E7D5B]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#111820] text-xs sm:text-sm">
                                Invoice #{invId}
                              </p>
                              <p className="text-[11px] text-[#657168]">
                              Due {inv.dueDate || 'Date unavailable'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-xs sm:text-sm text-[#111820] block mb-0.5">
                              {inv.amount != null || inv.totalAmount != null ? formatCurrency(amount) : '—'}
                            </span>
                            {inv.status ? <StatusBadge status={inv.status} size="xs" /> : <span className="text-[10px] text-[#657168]">Status unavailable</span>}
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

function MetricCard({ title, value, subtitle, icon, iconBg = 'bg-[#EDF4ED] border-[#E3E8DF]' }) {
  return (
    <div className="rounded-xl border border-[#E2D5C1] bg-[#F8F1E6]/95 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B6875] truncate mr-1">{title}</span>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      <div className="mt-2">
        <p className="text-lg sm:text-xl font-bold tracking-tight text-[#111820] font-sans truncate">{value}</p>
        <p className="text-[11px] text-[#657168] mt-0.5 font-medium truncate">{subtitle}</p>
      </div>
    </div>
  )
}

