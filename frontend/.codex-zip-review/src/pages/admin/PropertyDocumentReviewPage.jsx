import React, { useCallback, useEffect, useState } from 'react'
import { Button, EmptyState, Loader } from '../../components/ui'
import {
  getPendingPropertyDocuments,
  approvePropertyDocument,
  rejectPropertyDocument,
  downloadPropertyDocumentForAdmin,
  PROPERTY_DOCUMENT_TYPE_LABELS,
} from '../../api/propertyDocumentApi'
import {
  CheckCircle2,
  ExternalLink,
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  XCircle,
  Building2,
  User,
  Mail,
  AlertTriangle,
  X,
  Search,
  ShieldCheck,
} from 'lucide-react'

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const formatDate = (isoString) => {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PropertyDocumentReviewPage({ onDecision } = {}) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Processing states
  const [busyDocId, setBusyDocId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  // Rejection modal
  const [rejectingDoc, setRejectingDoc] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false)

  // Approval confirm modal
  const [approvingDoc, setApprovingDoc] = useState(null)
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getPendingPropertyDocuments()
      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : []
      setDocuments(data)
    } catch (err) {
      console.error('Failed to load pending property documents:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load pending property documents'
      )
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleApproveConfirm = async () => {
    if (!approvingDoc || isSubmittingApproval) return
    setIsSubmittingApproval(true)
    setError('')
    try {
      await approvePropertyDocument(approvingDoc.documentId)
      setDocuments((prev) =>
        prev.filter((d) => d.documentId !== approvingDoc.documentId)
      )
      setNotice(
        `Approved ${PROPERTY_DOCUMENT_TYPE_LABELS[approvingDoc.documentType] || approvingDoc.documentType} for property "${approvingDoc.propertyName}".`
      )
      setApprovingDoc(null)
      await onDecision?.()
    } catch (err) {
      console.error('Failed to approve property document:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to approve property document'
      )
    } finally {
      setIsSubmittingApproval(false)
    }
  }

  const handleOpenReject = (doc) => {
    setRejectingDoc(doc)
    setRejectionReason('')
    setRejectionError('')
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!rejectingDoc || isSubmittingRejection) return
    if (!rejectionReason.trim()) {
      setRejectionError('Rejection reason is required so the property owner can fix the issue.')
      return
    }

    setIsSubmittingRejection(true)
    setRejectionError('')
    try {
      await rejectPropertyDocument(rejectingDoc.documentId, rejectionReason.trim())
      setDocuments((prev) =>
        prev.filter((d) => d.documentId !== rejectingDoc.documentId)
      )
      setNotice(
        `Rejected ${PROPERTY_DOCUMENT_TYPE_LABELS[rejectingDoc.documentType] || rejectingDoc.documentType} for property "${rejectingDoc.propertyName}".`
      )
      setRejectingDoc(null)
      setRejectionReason('')
      await onDecision?.()
    } catch (err) {
      console.error('Failed to reject property document:', err)
      setRejectionError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to submit rejection decision'
      )
    } finally {
      setIsSubmittingRejection(false)
    }
  }

  const handleDownload = async (doc) => {
    if (downloadingId) return
    setDownloadingId(doc.documentId)
    try {
      const response = await downloadPropertyDocumentForAdmin(doc.documentId)
      const blob = response?.data || response
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc.fileName || `property-doc-${doc.documentId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download document:', err)
      if (doc.documentUrl) {
        window.open(doc.documentUrl, '_blank', 'noopener,noreferrer')
      } else {
        alert('Failed to download document. Please try again.')
      }
    } finally {
      setDownloadingId(null)
    }
  }

  // Filter documents by search query
  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const propName = (doc.propertyName || '').toLowerCase()
    const ownerName = (doc.ownerName || '').toLowerCase()
    const ownerEmail = (doc.ownerEmail || '').toLowerCase()
    const fileName = (doc.fileName || '').toLowerCase()
    const docType = (doc.documentType || '').toLowerCase()
    return (
      propName.includes(q) ||
      ownerName.includes(q) ||
      ownerEmail.includes(q) ||
      fileName.includes(q) ||
      docType.includes(q)
    )
  })

  // Group pending documents by Property
  const propertyGroups = Object.values(
    filteredDocs.reduce((acc, doc) => {
      const key = String(doc.propertyId)
      if (!acc[key]) {
        acc[key] = {
          propertyId: doc.propertyId,
          propertyName: doc.propertyName,
          ownerId: doc.ownerId,
          ownerName: doc.ownerName,
          ownerEmail: doc.ownerEmail,
          documents: [],
        }
      }
      acc[key].documents.push(doc)
      return acc
    }, {})
  )

  return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#243447]">
                Property Document Verification
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#315A7D] text-white">
                {documents.length} Pending
              </span>
            </div>
            <p className="mt-1 text-sm text-[#5B6875]">
              Verify title deeds and proof of ownership uploaded by property owners before properties can be published.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadDocuments}
              isLoading={loading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Notices and Alerts */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#F4B4B4] bg-[#FDF2F2] p-4 text-sm text-[#8A2E2C] flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-[#8A2E2C] hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-[#C6DEC8] bg-[#EDF7EE] p-4 text-sm text-[#2A583B] flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-[#2A583B] hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Bar & Summary Card */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#D9E0E6] shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5B6875] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by property, owner, or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#D9E0E6] focus:outline-none focus:ring-2 focus:ring-[#315A7D]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5B6875]">
            <FileCheck2 className="w-4 h-4 text-[#315A7D]" />
            <span className="font-semibold text-[#243447]">
              {loading
                ? 'Loading reviews…'
                : `${documents.length} document${documents.length === 1 ? '' : 's'} across ${propertyGroups.length} propert${propertyGroups.length === 1 ? 'y' : 'ies'}`}
            </span>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 text-center">
            <Loader size="lg" />
            <p className="mt-2 text-sm text-[#5B6875]">Loading pending property documents...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && propertyGroups.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-12 text-center shadow-sm">
            <EmptyState
              icon={<ShieldCheck className="w-12 h-12 text-[#315A7D]/40" />}
              title="All Caught Up!"
              description={
                searchQuery
                  ? 'No pending property documents match your search criteria.'
                  : 'There are no property documents pending review right now. All submissions have been processed.'
              }
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Clear Search
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadDocuments} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                    Check Again
                  </Button>
                )
              }
            />
          </div>
        )}

        {/* Grouped Property Review Cards */}
        {!loading && propertyGroups.length > 0 && (
          <div className="space-y-6">
            {propertyGroups.map((group) => (
              <div
                key={group.propertyId}
                className="bg-white rounded-2xl border border-[#D9E0E6] shadow-sm overflow-hidden"
              >
                {/* Property Header */}
                <div className="p-5 bg-[#F7F8FA] border-b border-[#D9E0E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-base text-[#243447]">
                          {group.propertyName || `Property #${group.propertyId}`}
                        </h2>
                        <span className="text-xs font-mono text-[#5B6875] px-2 py-0.5 rounded bg-white border border-[#D9E0E6]">
                          ID: {group.propertyId}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]">
                          {group.documents.length} pending review{group.documents.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#5B6875] mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#315A7D]" />
                          Owner: <strong>{group.ownerName || 'Unknown Owner'}</strong>
                        </span>
                        {group.ownerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-[#5B6875]" />
                            {group.ownerEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents List */}
                <div className="divide-y divide-[#D9E0E6]">
                  {group.documents.map((doc) => {
                    const typeLabel =
                      PROPERTY_DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType
                    const isTitleDeed = doc.documentType === 'TITLE_DEED'

                    return (
                      <div
                        key={doc.documentId}
                        className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F7F8FA]/40 transition-colors"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 rounded-xl bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6] shrink-0 mt-0.5">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#243447]">
                                {typeLabel}
                              </span>
                              {isTitleDeed && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#315A7D] text-white">
                                  Required for Publishing
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]">
                                Pending Review
                              </span>
                            </div>
                            <p className="text-xs text-[#5B6875] font-mono break-all">
                              {doc.fileName}
                              {doc.fileSize ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                              {doc.contentType ? ` • ${doc.contentType}` : ''}
                            </p>
                            <p className="text-[11px] text-[#5B6875]">
                              Uploaded on {formatDate(doc.uploadedAt)}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                          {doc.documentUrl && (
                            <a
                              href={doc.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#D9E0E6] bg-white text-[#243447] hover:bg-[#F7F8FA] hover:text-[#315A7D] transition-colors"
                              title="Inspect document securely in a new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.documentId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#D9E0E6] bg-white text-[#243447] hover:bg-[#F7F8FA] hover:text-[#315A7D] transition-colors disabled:opacity-50"
                            title="Download document file"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>

                          <button
                            type="button"
                            onClick={() => setApprovingDoc(doc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#2A583B] bg-[#2A583B] text-white hover:bg-[#1f422c] transition-colors shadow-sm"
                            title="Approve this property document"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReject(doc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#8A2E2C] bg-[#8A2E2C] text-white hover:bg-[#6e2422] transition-colors shadow-sm"
                            title="Reject this property document with reason"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approval Confirmation Modal */}
        {approvingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#243447]">
                    Approve Property Document
                  </h3>
                  <p className="text-xs text-[#5B6875]">Confirm verification approval</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1.5">
                <p>
                  <strong>Property:</strong> {approvingDoc.propertyName}
                </p>
                <p>
                  <strong>Document:</strong>{' '}
                  {PROPERTY_DOCUMENT_TYPE_LABELS[approvingDoc.documentType] || approvingDoc.documentType}
                </p>
                <p>
                  <strong>File:</strong> {approvingDoc.fileName}
                </p>
                <p>
                  <strong>Owner:</strong> {approvingDoc.ownerName} ({approvingDoc.ownerEmail})
                </p>
              </div>

              <p className="text-xs text-[#5B6875] leading-relaxed">
                By approving this document, you confirm that ownership proof has been verified. If this is a required title deed, the property will become eligible for public listing (Available / Published).
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApprovingDoc(null)}
                  disabled={isSubmittingApproval}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApproveConfirm}
                  isLoading={isSubmittingApproval}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirm Approval
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal with Mandatory Reason */}
        {rejectingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
              <div className="flex items-center justify-between p-5 border-b border-[#D9E0E6] bg-[#FDF2F2]">
                <div className="flex items-center gap-2.5 text-[#8A2E2C]">
                  <XCircle className="w-5 h-5" />
                  <h3 className="font-semibold text-base">
                    Reject Property Document
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectingDoc(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
                <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1">
                  <p>
                    <strong>Property:</strong> {rejectingDoc.propertyName}
                  </p>
                  <p>
                    <strong>Document:</strong>{' '}
                    {PROPERTY_DOCUMENT_TYPE_LABELS[rejectingDoc.documentType] || rejectingDoc.documentType}
                  </p>
                  <p>
                    <strong>File:</strong> {rejectingDoc.fileName}
                  </p>
                  <p>
                    <strong>Owner:</strong> {rejectingDoc.ownerName}
                  </p>
                </div>

                {rejectionError && (
                  <div className="p-3 rounded-lg border border-[#F4B4B4] bg-[#FDF2F2] text-xs text-[#8A2E2C]">
                    {rejectionError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#243447] mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value)
                      if (rejectionError) setRejectionError('')
                    }}
                    placeholder="Explain clearly why this document was rejected (e.g. illegible photocopy, missing municipal seal, owner name mismatch, expired certificate)..."
                    className="w-full text-xs rounded-xl border border-[#D9E0E6] p-3 focus:outline-none focus:ring-2 focus:ring-[#8A2E2C] text-[#243447]"
                    disabled={isSubmittingRejection}
                  />
                  <p className="text-[11px] text-[#5B6875] mt-1">
                    This reason will be visible to the property owner so they can replace and resubmit the document.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D9E0E6]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectingDoc(null)}
                    disabled={isSubmittingRejection}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingRejection}
                    disabled={!rejectionReason.trim() || isSubmittingRejection}
                    className="bg-[#8A2E2C] hover:bg-[#6e2422] border-[#8A2E2C]"
                    leftIcon={<XCircle className="w-4 h-4" />}
                  >
                    Reject Document
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  )
}
