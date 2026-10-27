import React, { useEffect, useState } from 'react'
import { ExternalLink, FileText, LoaderCircle } from 'lucide-react'
import { getTenantDocuments } from '../../api/tenantDocumentApi'

const labelForType = (value) => (value || 'OTHER').replaceAll('_', ' ')

export default function TenantDocumentsCard({ tenantId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(Boolean(tenantId))
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!tenantId) {
      setDocuments([])
      setLoading(false)
      setError('Tenant ID is not included in the application record.')
      return () => { active = false }
    }

    setLoading(true)
    setError('')
    getTenantDocuments(tenantId)
      .then((result) => { if (active) setDocuments(Array.isArray(result) ? result : []) })
      .catch((err) => {
        if (!active) return
        const status = err?.status || err?.response?.status
        setError(status === 403
          ? 'Your account is not authorized by the backend to view this tenant’s documents.'
          : err?.message || 'Could not load the tenant’s documents.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [tenantId])

  return (
    <section className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
      <h2 className="text-base font-semibold text-[#243447] flex items-center gap-2 border-b border-[#D9E0E6] pb-3">
        <FileText className="w-4 h-4 text-[#315A7D]" /> Supporting Documents
      </h2>
      {loading ? (
        <p className="text-sm text-[#5B6875] flex items-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin" /> Loading documents…</p>
      ) : error ? (
        <p className="text-sm text-[#8A2E2C]">{error}</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-[#5B6875]">No uploaded documents were found for this tenant.</p>
      ) : (
        <ul className="divide-y divide-[#E7EBEF]">
          {documents.map((document) => (
            <li key={document.documentId} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#243447] truncate">{document.fileName || labelForType(document.documentType)}</p>
                <p className="text-xs text-[#5B6875]">{labelForType(document.documentType)} · {document.verificationStatus || 'Pending'}</p>
              </div>
              {document.documentUrl ? (
                <a href={document.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#315A7D] hover:underline">
                  View document <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : <span className="text-xs text-[#8A2E2C]">Document link unavailable</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
