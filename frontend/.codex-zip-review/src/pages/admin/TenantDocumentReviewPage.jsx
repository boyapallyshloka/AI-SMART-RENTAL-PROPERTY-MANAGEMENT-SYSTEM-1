import React, { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button, EmptyState, Loader } from '../../components/ui'
import { getAllTenants } from '../../api/tenantApi'
import { getTenantDocuments, updateTenantDocumentVerification } from '../../api/tenantDocumentApi'
import { CheckCircle2, ExternalLink, FileCheck2, FileText, RefreshCw, UserRound, XCircle } from 'lucide-react'

const asList = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.content)) return value.content
  return []
}

const tenantName = (tenant) =>
  [tenant.firstName, tenant.lastName].filter(Boolean).join(' ') || tenant.email || `Tenant #${tenant.tenantId}`

const formatType = (value) => String(value || 'OTHER').replaceAll('_', ' ')

export default function TenantDocumentReviewPage() {
  const [pendingDocuments, setPendingDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [failedTenantLoads, setFailedTenantLoads] = useState(0)
  const [busyDocument, setBusyDocument] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPendingDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const tenants = asList(await getAllTenants())
      const pending = []
      let failures = 0
      let nextIndex = 0
      const workerCount = Math.min(5, tenants.length)
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < tenants.length) {
          const tenant = tenants[nextIndex++]
          try {
            const documents = asList(await getTenantDocuments(tenant.tenantId))
            documents
              .filter((document) => document.verificationStatus === 'PENDING')
              .forEach((document) => pending.push({ ...document, tenant }))
          } catch (loadError) {
            failures += 1
            console.warn(`Could not load documents for tenant #${tenant.tenantId}:`, loadError)
          }
        }
      }))
      pending.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())
      setPendingDocuments(pending)
      setFailedTenantLoads(failures)
    } catch (loadError) {
      setPendingDocuments([])
      setError(loadError?.message || 'Could not load tenant document reviews.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPendingDocuments()
  }, [loadPendingDocuments])

  const reviewDocument = async (item, status) => {
    const key = `${item.tenantId}-${item.documentId}`
    if (busyDocument) return
    setBusyDocument({ key, status })
    setError('')
    setNotice('')
    try {
      await updateTenantDocumentVerification(item.tenantId, item.documentId, status)
      setPendingDocuments((current) => current.filter(
        (document) => !(document.tenantId === item.tenantId && document.documentId === item.documentId)
      ))
      setNotice(`${item.fileName || formatType(item.documentType)} for ${tenantName(item.tenant)} marked ${status.toLowerCase()}.`)
    } catch (reviewError) {
      setError(reviewError?.message || `Could not mark the document ${status.toLowerCase()}.`)
    } finally {
      setBusyDocument(null)
    }
  }

  const tenantGroups = Object.values(pendingDocuments.reduce((groups, item) => {
    const key = String(item.tenantId)
    if (!groups[key]) {
      groups[key] = { tenantId: item.tenantId, tenant: item.tenant, documents: [] }
    }
    groups[key].documents.push(item)
    return groups
  }, {}))

  return (
    <DashboardLayout defaultRole="admin" activeItem="tenant-document-review" pageTitle="Tenant Document Review">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-[28px] font-bold text-[#243447]">Tenant Document Review</h1>
            <p className="mt-1 text-sm text-[#5B6875]">Review uploaded identity and income documents across tenant profiles.</p>
          </div>
          <Button variant="outline" onClick={loadPendingDocuments} isLoading={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </div>

        {error && <div role="alert" className="rounded-lg border border-[#F4B4B4] bg-[#FDF2F2] p-3 text-sm text-[#8A2E2C]">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-[#C6DEC8] bg-[#EDF7EE] p-3 text-sm text-[#2A583B]">{notice}</div>}
        {failedTenantLoads > 0 && (
          <div role="status" className="rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] p-3 text-sm text-[#8A5B16]">
            Could not check documents for {failedTenantLoads} tenant profile{failedTenantLoads === 1 ? '' : 's'}. Refresh to retry.
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-[#D9E0E6] bg-white p-4">
          <FileCheck2 className="h-5 w-5 text-[#315A7D]" />
            <span className="text-[13px] font-semibold text-[#243447]">
            {loading ? 'Checking tenant profiles…' : `${pendingDocuments.length} pending document${pendingDocuments.length === 1 ? '' : 's'} across ${tenantGroups.length} tenant${tenantGroups.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center rounded-xl border border-[#D9E0E6] bg-white p-12">
            <Loader text="Loading pending tenant documents…" size="md" center />
          </div>
        ) : pendingDocuments.length === 0 ? (
          <div className="rounded-xl border border-[#D9E0E6] bg-white p-8">
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-[#3F7D58]" />}
              title={failedTenantLoads ? 'Some reviews could not be checked' : 'No pending document reviews'}
              message={failedTenantLoads ? 'Refresh after resolving the tenant document API errors.' : 'All currently accessible tenant documents have been reviewed.'}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {tenantGroups.map((group) => (
              <section key={group.tenantId} className="overflow-hidden rounded-xl border border-[#B8CAD9] bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#315A7D] bg-[#EAF2F7] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#315A7D] text-white">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#315A7D]">Tenant</p>
                      <h2 className="text-base font-bold text-[#243447]">{tenantName(group.tenant)}</h2>
                      <p className="text-xs text-[#5B6875]">{group.tenant.email || '—'} <span className="mx-1">·</span> Tenant #{group.tenantId}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#E5C77F] bg-white px-3 py-1.5 text-xs font-semibold text-[#77500D]">
                    {group.documents.length} pending document{group.documents.length === 1 ? '' : 's'}
                  </span>
                </header>
                <div className="space-y-3 bg-[#F6F8FA] p-4 sm:p-5">
                  <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5B6875]">Documents to review</h3>
                  {group.documents.map((item) => {
                    const key = `${item.tenantId}-${item.documentId}`
                    return (
                      <article key={key} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#D9E0E6] bg-white p-4 shadow-[0_1px_2px_rgba(36,52,71,0.05)]">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F0F4F7] text-[#315A7D]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="break-words text-[13px] font-semibold text-[#243447]">{item.fileName || 'Uploaded document'}</p>
                            <p className="mt-1 text-xs font-medium text-[#315A7D]">{formatType(item.documentType)}</p>
                            {item.uploadedAt && <p className="mt-1 text-xs text-[#748291]">Uploaded {new Date(item.uploadedAt).toLocaleString()}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                          {item.documentUrl ? (
                            <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[#D9E0E6] px-3 py-2 text-xs font-semibold text-[#315A7D] hover:bg-[#F7F8FA]">
                              View document <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : <span className="text-xs text-[#8A2E2C]">File link unavailable</span>}
                          <Button size="sm" variant="primary" disabled={busyDocument != null} isLoading={busyDocument?.key === key && busyDocument.status === 'VERIFIED'} onClick={() => reviewDocument(item, 'VERIFIED')} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>Verify</Button>
                          <Button size="sm" variant="danger" disabled={busyDocument != null} isLoading={busyDocument?.key === key && busyDocument.status === 'REJECTED'} onClick={() => reviewDocument(item, 'REJECTED')} leftIcon={<XCircle className="h-3.5 w-3.5" />}>Reject</Button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
