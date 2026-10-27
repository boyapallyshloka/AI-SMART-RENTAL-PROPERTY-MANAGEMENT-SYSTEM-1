import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, StatusBadge, Loader, EmptyState } from '../../components/ui'
import {
  Building2,
  CreditCard,
  Wrench,
  CheckCircle2,
  FileText,
  Search,
  RotateCcw,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { resolveTenantRentalContext } from '../../utils/tenantRentalHelper'
import { getMyInvoices } from '../../api/invoiceApi'
import { getMaintenanceRequests } from '../../api/maintenanceApi'
import { formatCurrency } from '../../utils/currency'
import ownerHeroBg from '../../assets/owner-hero-bg.jpg'

export default function TenantDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [myRental, setMyRental] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  const [sourceAvailability, setSourceAvailability] = useState({
    rental: false,
    invoices: false,
    maintenance: false,
  })

  const loadDashboardData = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [rentalRes, invRes, maintRes] = await Promise.allSettled([
        resolveTenantRentalContext(),
        getMyInvoices(),
        getMaintenanceRequests(),
      ])

      const rentalAvailable = rentalRes.status === 'fulfilled'
      setMyRental(rentalAvailable ? rentalRes.value?.myRental || null : null)

      const loadedInvoices =
        invRes.status === 'fulfilled'
          ? Array.isArray(invRes.value?.data)
            ? invRes.value.data
            : Array.isArray(invRes.value)
            ? invRes.value
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

      const invoicesAvailable =
        invRes.status === 'fulfilled' &&
        (Array.isArray(invRes.value?.data) || Array.isArray(invRes.value))
      const maintenanceAvailable =
        maintRes.status === 'fulfilled' &&
        (Array.isArray(maintRes.value?.data) || Array.isArray(maintRes.value))

      setInvoices(loadedInvoices)
      setMaintenanceRequests(loadedMaint)
      setSourceAvailability({
        rental: rentalAvailable,
        invoices: invoicesAvailable,
        maintenance: maintenanceAvailable,
      })
    } catch (err) {
      console.error('Failed to load tenant dashboard data:', err)
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load dashboard data. Please try again.'
      )
      setSourceAvailability({ rental: false, invoices: false, maintenance: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Derived metrics from real data
  const tenantDisplayName = user?.name || user?.username || 'Tenant'
  const activeProperty = myRental?.property?.name || myRental?.property?.propertyName || null
  const activeUnit = myRental?.leaseSummary?.unitNumber || null
  const leaseStatus = myRental?.leaseSummary?.status || null

  const openMaintenanceCount = maintenanceRequests.filter((m) =>
    ['OPEN', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS'].includes(
      String(m.status || '').toUpperCase()
    )
  ).length

  const pendingInvoices = invoices.filter((inv) =>
    ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(String(inv.status || '').toUpperCase())
  )
  const pendingBalances = pendingInvoices.map((inv) => {
    const amount = inv.remainingAmount ?? inv.balanceDue ?? inv.totalAmount ?? inv.amount
    return amount == null || amount === '' || !Number.isFinite(Number(amount))
      ? null
      : Number(amount)
  })
  const pendingBalance = pendingBalances.some((amount) => amount == null)
    ? null
    : pendingBalances.reduce((sum, amount) => sum + amount, 0)

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="dashboard"
      pageTitle="Tenant Dashboard"
    >
      <div className="space-y-6">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#991B1B] shrink-0" />
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
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 shadow-xs flex justify-center">
            <Loader text="Loading tenancy dashboard..." size="md" center />
          </div>
        ) : (
          <>
            {/* Hero / Header Section with Residential Community Framing */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#D9E2EC] shadow-xs bg-cover bg-center min-h-[140px] sm:min-h-[170px] flex items-center"
              style={{ backgroundImage: `url(${ownerHeroBg})` }}
            >
              {/* Soft luminous gradient overlay to ensure contrast and highlight the center sky while framing side buildings */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/75 to-white/92 backdrop-blur-[0.5px]" />

              <div className="relative z-10 px-6 sm:px-10 py-8 max-w-3xl">
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B2B4A]">
                  Welcome back, {tenantDisplayName}!
                </h1>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                title="Current Residence"
                value={!sourceAvailability.rental ? '—' : activeUnit ? `Unit ${activeUnit}` : 'No Lease'}
                subtitle={!sourceAvailability.rental ? 'Rental information unavailable' : activeProperty || 'No active rental agreement'}
                change={!sourceAvailability.rental ? null : leaseStatus ? `Status: ${leaseStatus}` : null}
                icon={<Building2 className="w-5 h-5 text-[#315A7D]" />}
                iconBg="bg-[#EBF2F7] border-[#D9E2EC]"
              />
              <MetricCard
                title="Billing Status"
                value={!sourceAvailability.invoices || pendingBalance == null ? '—' : pendingBalance > 0 ? formatCurrency(pendingBalance) : 'Settled'}
                subtitle={
                  !sourceAvailability.invoices
                    ? 'Invoice information unavailable'
                    : pendingInvoices.length > 0
                    ? `${pendingInvoices.length} unpaid invoice(s)`
                    : 'No outstanding balance'
                }
                change={!sourceAvailability.invoices ? null : invoices.length > 0 ? `${invoices.length} total invoice records` : 'No invoices on record'}
                icon={<CreditCard className="w-5 h-5 text-[#2E7D5B]" />}
                iconBg="bg-[#EAF5EF] border-[#D0E7D9]"
              />
              <MetricCard
                title="Maintenance"
                value={sourceAvailability.maintenance ? `${openMaintenanceCount} Open` : '—'}
                subtitle={
                  !sourceAvailability.maintenance
                    ? 'Maintenance information unavailable'
                    : openMaintenanceCount > 0
                    ? 'Repair tickets in progress'
                    : 'All service tickets resolved'
                }
                change={sourceAvailability.maintenance ? `${maintenanceRequests.length} total requests submitted` : null}
                icon={<Wrench className="w-5 h-5 text-[#B7791F]" />}
                iconBg="bg-[#FEF6EC] border-[#FAD7B2]"
              />
            </div>

            {/* Recent Records & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment / Invoice History */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-4">
                  <div>
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1B2B4A]">
                      Rent Invoices
                    </h2>
                    <p className="text-xs text-[#64748B] mt-0.5">Recent statements and payment records</p>
                  </div>
                  <Link to="/tenant/payments">
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View Payments
                    </Button>
                  </Link>
                </div>

                {!sourceAvailability.invoices ? (
                  <div className="rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] p-4 text-sm text-[#8A5B16]">
                    Invoice information could not be loaded from the backend. Use Retry above to try again.
                  </div>
                ) : invoices.length === 0 ? (
                  <EmptyState
                    icon={<CreditCard className="w-7 h-7 text-[#5B6875]" />}
                    title="No invoices found"
                    description="You do not have any rent invoices issued to your account."
                  />
                ) : (
                  <div className="divide-y divide-[#EDF2F7]">
                    {invoices.slice(0, 4).map((inv) => {
                      const invId = inv.invoiceId || inv.id
                      const amount = inv.amount ?? inv.totalAmount ?? null

                      return (
                        <div
                          key={invId}
                          className="py-3.5 flex items-start justify-between gap-3 text-sm hover:bg-[#F8FAFC]/80 px-2 rounded-xl transition-colors -mx-2"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#EAF5EF] border border-[#D0E7D9] flex items-center justify-center shrink-0 mt-0.5">
                              <CreditCard className="w-4 h-4 text-[#2E7D5B]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1B2B4A] text-xs">
                                Invoice #{invId}
                              </p>
                              <p className="text-[11px] text-[#64748B]">
                                Due {inv.dueDate || 'Date unavailable'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-semibold text-xs text-[#1B2B4A] block">
                              {formatCurrency(amount)}
                            </span>
                            <StatusBadge status={inv.status} size="xs" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Tenant Actions Panel */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs space-y-5 flex flex-col justify-between">
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1B2B4A]">
                    Tenant Actions
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">Quick access to tenancy services</p>
                  <div className="space-y-2.5 mt-4">
                    <Link to="/tenant/maintenance/new" className="block">
                      <Button
                        variant="primary"
                        className="w-full justify-start rounded-xl"
                        leftIcon={<Wrench className="w-4 h-4" />}
                      >
                        Submit Maintenance Request
                      </Button>
                    </Link>
                    <Link to="/tenant/agreement" className="block">
                      <Button
                        variant="secondary"
                        className="w-full justify-start rounded-xl"
                        leftIcon={<FileText className="w-4 h-4" />}
                      >
                        View Signed Lease Document
                      </Button>
                    </Link>
                    <Link to="/tenant/properties" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-start rounded-xl"
                        leftIcon={<Search className="w-4 h-4" />}
                      >
                        Explore Available Listings
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EDF2F7]">
                  <div className="p-3.5 rounded-xl bg-[#F0F5FA] border border-[#D9E2EC] text-xs">
                    <p className="font-semibold text-[#1B2B4A] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#315A7D]" />
                      Maintenance Status
                    </p>
                    <p className="text-[#64748B] mt-1.5 leading-relaxed font-normal">
                      {openMaintenanceCount > 0
                        ? `You have ${openMaintenanceCount} active service request(s) open.`
                        : 'No pending maintenance issues reported.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function MetricCard({ title, value, subtitle, change, icon, iconBg = 'bg-[#EBF2F7] border-[#D9E2EC]' }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2B4A] font-sans">{value}</p>
        <p className="text-xs text-[#64748B] mt-1 font-medium">{subtitle}</p>
      </div>
      {change && (
        <div className="pt-3 border-t border-[#EDF2F7]">
          <span className="text-xs font-semibold text-[#315A7D]">{change}</span>
        </div>
      )}
    </div>
  )
}

