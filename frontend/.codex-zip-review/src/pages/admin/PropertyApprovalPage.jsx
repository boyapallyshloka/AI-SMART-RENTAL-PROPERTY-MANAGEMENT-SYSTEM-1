import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Download, FileText, RefreshCw } from 'lucide-react'
import { Button, EmptyState, Loader } from '../../components/ui'
import PropertyDocumentReviewPage from './PropertyDocumentReviewPage'
import {
  approveProperty,
  getPendingPropertyApprovals,
} from '../../api/propertyApi'
import {
  downloadPropertyDocumentForAdmin,
  getPropertyDocumentsForAdmin,
  PROPERTY_DOCUMENT_TYPE_LABELS,
} from '../../api/propertyDocumentApi'

const unwrapList = (response) => {
  const value = response?.data ?? response
  return Array.isArray(value) ? value : []
}

export default function PropertyApprovalPage() {
  const [properties, setProperties] = useState([])
  const [documentsByProperty, setDocumentsByProperty] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyPropertyId, setBusyPropertyId] = useState(null)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null)

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const submissions = unwrapList(await getPendingPropertyApprovals())
      const documents = await Promise.all(
        submissions.map(async (property) => [
          property.propertyId,
          unwrapList(await getPropertyDocumentsForAdmin(property.propertyId)),
        ])
      )
      setProperties(submissions)
      setDocumentsByProperty(Object.fromEntries(documents))
    } catch (loadError) {
      console.error('Failed to load property approval submissions:', loadError)
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'Failed to load pending property approvals.'
      )
      setProperties([])
      setDocumentsByProperty({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const handleApprove = async (property) => {
    if (busyPropertyId != null) return
    setBusyPropertyId(property.propertyId)
    setError('')
    setNotice('')
    try {
      await approveProperty(property.propertyId)
      setProperties((current) =>
        current.filter((item) => item.propertyId !== property.propertyId)
      )
      setNotice(`"${property.propertyName}" has been approved and is now published and available for rent.`)
    } catch (approveError) {
      console.error(`Failed to approve property ${property.propertyId}:`, approveError)
      setError(
        approveError?.response?.data?.message ||
          approveError?.message ||
          'The property could not be approved.'
      )
    } finally {
      setBusyPropertyId(null)
    }
  }

  const handleDownload = async (document) => {
    setDownloadingDocumentId(document.documentId)
    try {
      const response = await downloadPropertyDocumentForAdmin(document.documentId)
      const blob = response?.data || response
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.fileName || `property-document-${document.documentId}`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (downloadError) {
      console.error(`Failed to download property document ${document.documentId}:`, downloadError)
      setError(
        downloadError?.response?.data?.message ||
          downloadError?.message ||
          'The property document could not be downloaded.'
      )
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  return (
      <div id="property-review" className="scroll-mt-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#243447]">Property Review</h2>
            <p className="mt-1 text-sm text-[#5B6875]">
              Review submitted property details and approve them after the required documents are verified.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadSubmissions}
            isLoading={loading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center"><Loader size="lg" /></div>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-12 w-12 text-[#315A7D]/40" />}
            title="No pending property approvals"
            description="Submitted properties awaiting a final decision will appear here."
          />
        ) : (
          <div className="space-y-5">
            {properties.map((property) => {
              const documents = documentsByProperty[property.propertyId] || []
              const deedApproved = documents.some(
                (document) =>
                  document.documentType === 'TITLE_DEED' &&
                  document.status === 'APPROVED'
              )

              return (
                <article
                  key={property.propertyId}
                  className="rounded-xl border border-[#D9E0E6] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[#243447]">
                        {property.propertyName}
                      </h2>
                      <p className="mt-1 text-sm text-[#5B6875]">
                        Property ID: {property.propertyId} · Owner: {property.ownerName} (ID: {property.ownerId})
                      </p>
                      {property.description && (
                        <p className="mt-2 max-w-3xl text-sm text-[#5B6875]">
                          {property.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => handleApprove(property)}
                      disabled={!deedApproved || busyPropertyId != null}
                    >
                      {busyPropertyId === property.propertyId ? 'Approving…' : 'Approve property'}
                    </Button>
                  </div>

                  <dl className="mt-4 grid gap-3 border-t border-[#D9E0E6] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs text-[#5B6875]">Property type</dt>
                      <dd className="font-medium text-[#243447]">{property.propertyType || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5B6875]">Area</dt>
                      <dd className="font-medium text-[#243447]">
                        {property.totalArea != null ? `${property.totalArea} sq. ft.` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5B6875]">Monthly rent</dt>
                      <dd className="font-medium text-[#243447]">
                        {property.monthlyRent != null ? `₹${property.monthlyRent}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5B6875]">Security deposit</dt>
                      <dd className="font-medium text-[#243447]">
                        {property.securityDeposit != null ? `₹${property.securityDeposit}` : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-[#D9E0E6] pt-4">
                    <h3 className="text-sm font-semibold text-[#243447]">Uploaded documents</h3>
                    {documents.length === 0 ? (
                      <p className="mt-2 text-sm text-[#8A2E2C]">No documents are available for review.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-[#E7EBEF]">
                        {documents.map((document) => (
                          <li
                            key={document.documentId}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2 text-[#5B6875]">
                              <FileText className="h-4 w-4" />
                              {PROPERTY_DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}
                              {' — '}
                              {document.fileName} ({document.status})
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(document)}
                              disabled={downloadingDocumentId != null}
                              leftIcon={<Download className="h-3.5 w-3.5" />}
                            >
                              {downloadingDocumentId === document.documentId ? 'Downloading…' : 'Download'}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!deedApproved && (
                      <p className="mt-3 text-xs text-[#8A5B16]">
                        Approve the required title deed in{' '}
                        <Link className="font-semibold underline" to="/admin/owner-verification#property-document-verification">
                          property document review
                        </Link>{' '}
                        before approving this property.
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <section id="property-document-verification" className="ml-3 scroll-mt-6 space-y-4 border-l-2 border-[#D9E0E6] pl-4 sm:ml-5 sm:pl-6">
          <PropertyDocumentReviewPage onDecision={loadSubmissions} />
        </section>
      </div>
  )
}
