import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import {
  getMyAgreements,
  getAgreementById,
  getAgreementDocument,
} from '../../api/agreementApi'
import { getMyApplications } from '../../api/applicationApi'
import { formatCurrency } from '../../utils/currency'
import {
  Button,
  StatusBadge,
  EmptyState,
  Loader,
  Select,
} from '../../components/ui'
import {
  FileText,
  Download,
  Building2,
  Calendar,
  IndianRupee,
  Clock,
  Shield,
  User,
  Info,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  RefreshCw,
  Home,
  DoorOpen,
} from 'lucide-react'

// Date Formatter
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

export default function TenantAgreementPage() {
  const { user } = useAuth()
  const [agreements, setAgreements] = useState([])
  const [selectedAgreementId, setSelectedAgreementId] = useState(null)
  const [selectedAgreement, setSelectedAgreement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // Load real agreements belonging to the authenticated tenant
  const loadTenantAgreements = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice('')

    try {
      // Fetch agreements and submitted applications concurrently
      const [agreementsRes, appsRes] = await Promise.allSettled([
        getMyAgreements(),
        getMyApplications(),
      ])

      if (agreementsRes.status === 'rejected') {
        throw agreementsRes.reason
      }

      const rawAgreements = Array.isArray(agreementsRes.value)
        ? agreementsRes.value
        : agreementsRes.value?.data || []

      const rawApps =
        appsRes.status === 'fulfilled'
          ? Array.isArray(appsRes.value)
            ? appsRes.value
            : appsRes.value?.data || []
          : []

      // Build lookup map for application metadata
      const appMap = new Map()
      rawApps.forEach((a) => {
        if (a && a.applicationId) {
          appMap.set(Number(a.applicationId), a)
        }
      })

      // Enrich agreements with real tenant/property/unit information
      const enriched = rawAgreements.map((agr) => {
        const app = agr.applicationId ? appMap.get(Number(agr.applicationId)) : null
        const tenantDisplayName =
          app?.tenantName ||
          (user?.firstName
            ? `${user.firstName} ${user.lastName || ''}`.trim()
            : user?.name || 'Tenant')

        return {
          ...agr,
          id: agr.agreementId,
          agreementNumber: `AGR-${String(agr.agreementId).padStart(4, '0')}`,
          propertyName:
            app?.propertyName ||
            agr.propertyName ||
            (agr.propertyId
              ? `Property #${agr.propertyId}`
              : null),
          unit: app?.unitNumber
            ? `Unit #${app.unitNumber}`
            : agr.unitId
            ? `Unit #${agr.unitId}`
            : 'Entire property',
          buildingName: app?.buildingName || null,
          tenantName: tenantDisplayName,
          tenantEmail: app?.tenantEmail || user?.email || '',
          status: agr.status ?? null,
        }
      })

      setAgreements(enriched)

      // Set default selected agreement (prioritize ACTIVE agreement, else first available)
      if (enriched.length > 0) {
        const active =
          enriched.find(
            (a) => String(a.status).toUpperCase() === 'ACTIVE'
          ) || enriched[0]

        setSelectedAgreementId(active.agreementId)
        setSelectedAgreement(active)
      } else {
        setSelectedAgreementId(null)
        setSelectedAgreement(null)
      }
    } catch (err) {
      console.error('Failed to load tenant agreements:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load your lease agreements from the server.'
      )
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadTenantAgreements()
  }, [loadTenantAgreements])

  // Handle switching selected agreement when multiple exist
  const handleSelectAgreement = async (id) => {
    const agrIdNum = Number(id)
    setSelectedAgreementId(agrIdNum)
    setNotice('')

    const found = agreements.find(
      (a) => Number(a.agreementId) === agrIdNum
    )
    if (found) {
      setSelectedAgreement(found)
      try {
        // Fetch detailed agreement record by ID
        const fresh = await getAgreementById(agrIdNum)
        const freshData = fresh?.data || fresh
        if (freshData) {
          setSelectedAgreement((prev) => ({
            ...prev,
            ...freshData,
            agreementNumber: `AGR-${String(freshData.agreementId).padStart(4, '0')}`,
            status: freshData.status || prev.status,
          }))
        }
      } catch (err) {
        console.warn(`Could not refresh agreement details #${agrIdNum}:`, err)
      }
    }
  }

  // Handle document PDF download
  const handleDownload = async () => {
    if (!selectedAgreement) return
    const agrId = selectedAgreement.agreementId

    if (!selectedAgreement.agreementDocument) {
      setNotice(
        'No digital agreement document has been uploaded for this lease yet. Contact your property manager if you require a signed copy.'
      )
      return
    }

    setIsDownloading(true)
    setNotice('')

    try {
      const blob = await getAgreementDocument(agrId)
      if (!blob || blob.size === 0) {
        setNotice('Agreement document is currently unavailable.')
        return
      }

      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/pdf' })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `lease-agreement-${agrId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download agreement document:', err)
      const status = err?.response?.status || err?.status
      if (status === 404) {
        setNotice('Official lease document PDF is not yet available on the server.')
      } else {
        setNotice(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to download agreement document.'
        )
      }
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="agreement"
      pageTitle="Lease Agreement"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Notice Banner */}
        {notice && (
          <div className="p-4 rounded-xl bg-[#EAF2F7] border border-[#C2D8E8] text-[#315A7D] text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-[#315A7D] shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-[#315A7D] hover:text-[#274B68] font-bold px-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTenantAgreements}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#243447]">
              My Lease Agreement
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Review your official residential lease terms, payment schedules, and tenure conditions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadTenantAgreements}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>

            {selectedAgreement && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                isLoading={isDownloading}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Agreement
              </Button>
            )}
          </div>
        </div>

        {/* Agreement Selector (shown if tenant has multiple agreements) */}
        {agreements.length > 1 && (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-semibold text-[#243447]">
              Select Lease Agreement ({agreements.length} total on record):
            </div>
            <div className="w-full sm:w-80">
              <Select
                value={String(selectedAgreementId)}
                options={agreements.map((a) => ({
                  value: String(a.agreementId),
                  label: `${a.agreementNumber} · ${a.propertyName} (${a.status})`,
                }))}
                onChange={(e) => handleSelectAgreement(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 shadow-xs flex justify-center">
            <Loader text="Loading your lease agreement..." size="md" center />
          </div>
        ) : !selectedAgreement ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-8 shadow-xs">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-[#315A7D]" />}
              title="No Lease Agreement Found"
              message="You do not currently have an active or drafted residential lease agreement on record. Lease agreements are generated by the property owner once a rental application is approved."
              action={
                <Link to="/tenant/applications">
                  <Button variant="primary" leftIcon={<FileCheck className="w-4 h-4" />}>
                    View My Applications
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          /* Agreement Details View */
          <div className="space-y-6">
            {/* Agreement Summary Header Card */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9E0E6] pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-[#243447]">
                        {selectedAgreement.agreementNumber}
                      </h2>
                      <StatusBadge status={selectedAgreement.status} size="sm" />
                    </div>
                    <p className="text-xs text-[#5B6875] mt-0.5">
                      Primary Tenant: {selectedAgreement.tenantName}{' '}
                      {selectedAgreement.tenantEmail && `(${selectedAgreement.tenantEmail})`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleDownload}
                    isLoading={isDownloading}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download Agreement
                  </Button>
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] block mb-1">
                    Monthly Rent
                  </span>
                  <span className="text-xl font-bold text-[#315A7D]">
                    {formatCurrency(selectedAgreement.monthlyRent)}
                  </span>
                  <span className="text-[11px] text-[#5B6875] block mt-0.5">
                    {selectedAgreement.dueDay == null ? 'Due day unavailable' : `Due day ${selectedAgreement.dueDay} of month`}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] block mb-1">
                    Security Deposit
                  </span>
                  <span className="text-xl font-bold text-[#243447]">
                    {formatCurrency(selectedAgreement.securityDeposit)}
                  </span>
                  <span className="text-[11px] text-[#3F7D58] font-medium block mt-0.5">
                    Refundable Deposit
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] block mb-1">
                    Lease Term
                  </span>
                  <span className="text-sm font-bold text-[#243447] block mt-1">
                    {formatDate(selectedAgreement.startDate)}
                  </span>
                  <span className="text-[11px] text-[#5B6875] block">
                    to {formatDate(selectedAgreement.endDate)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6875] block mb-1">
                    Notice Period
                  </span>
                  <span className="text-xl font-bold text-[#243447]">
                    {selectedAgreement.noticePeriodDays != null
                      ? `${selectedAgreement.noticePeriodDays} days`
                      : '30 days'}
                  </span>
                  <span className="text-[11px] text-[#5B6875] block mt-0.5">
                    Prior to Move-Out
                  </span>
                </div>
              </div>
            </div>

            {/* Property & Leased Unit Specifications */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <Building2 className="w-4 h-4 text-[#315A7D]" />
                Leased Property & Unit Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-xs text-[#5B6875] block mb-1 flex items-center gap-1">
                    <Home className="w-3.5 h-3.5 text-[#315A7D]" />
                    Property Name
                  </span>
                  <p className="font-semibold text-[#243447] text-base">
                    {selectedAgreement.propertyName}
                  </p>
                  {selectedAgreement.buildingName && (
                    <span className="text-xs text-[#5B6875]">
                      {selectedAgreement.buildingName}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-xs text-[#5B6875] block mb-1 flex items-center gap-1">
                    <DoorOpen className="w-3.5 h-3.5 text-[#315A7D]" />
                    Designated Unit
                  </span>
                  <p className="font-semibold text-[#243447] text-base">
                    {selectedAgreement.unit}
                  </p>
                </div>
              </div>
            </div>

            {/* Occupancy Dates & Financial Schedule */}
            <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
                <Calendar className="w-4 h-4 text-[#315A7D]" />
                Occupancy Dates & Contract Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                  <span className="text-[#5B6875] font-medium block">
                    Move-In Date
                  </span>
                  <p className="font-bold text-[#243447] text-sm">
                    {formatDate(selectedAgreement.moveInDate)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                  <span className="text-[#5B6875] font-medium block">
                    Move-Out Date
                  </span>
                  <p className="font-bold text-[#243447] text-sm">
                    {formatDate(selectedAgreement.moveOutDate)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                  <span className="text-[#5B6875] font-medium block">
                    Rent Due Day
                  </span>
                  <p className="font-bold text-[#243447] text-sm">
                    {selectedAgreement.dueDay
                      ? `${selectedAgreement.dueDay}th of the month`
                      : '1st of the month'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] space-y-1">
                  <span className="text-[#5B6875] font-medium block">
                    Agreement Status
                  </span>
                  <div className="mt-0.5">
                    <StatusBadge status={selectedAgreement.status} size="sm" />
                  </div>
                </div>
              </div>

              {selectedAgreement.termsAndConditions && (
                <div className="mt-4 p-4 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                  <span className="text-xs font-semibold text-[#243447] block mb-1">
                    Terms, Provisions & Special Clauses
                  </span>
                  <p className="text-xs sm:text-sm text-[#5B6875] leading-relaxed whitespace-pre-line">
                    {selectedAgreement.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
