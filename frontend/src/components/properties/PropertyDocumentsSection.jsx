import React, { useState, useEffect, useCallback } from 'react'
import {
  getPropertyDocuments,
  uploadPropertyDocument,
  deletePropertyDocument,
  downloadPropertyDocument,
  getPropertyPublishEligibility,
  PROPERTY_DOCUMENT_TYPES,
  PROPERTY_DOCUMENT_TYPE_LABELS,
  PROPERTY_DOCUMENT_STATUSES,
} from '../../api/propertyDocumentApi'
import { Button, Loader, EmptyState } from '../ui'
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Download,
  RotateCcw,
  Plus,
  X,
  FileCheck2,
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

export default function PropertyDocumentsSection({
  propertyId,
  propertyStatus,
  onEligibilityChange,
}) {
  const [documents, setDocuments] = useState([])
  const [eligibility, setEligibility] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [documentType, setDocumentType] = useState(PROPERTY_DOCUMENT_TYPES.TITLE_DEED)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [resubmittingDoc, setResubmittingDoc] = useState(null)

  // Action states
  const [deletingId, setDeletingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const showToast = (message, type = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const loadData = useCallback(async () => {
    if (!propertyId) return
    setIsLoading(true)
    setError(null)
    try {
      const [docsRes, eligRes] = await Promise.all([
        getPropertyDocuments(propertyId),
        getPropertyPublishEligibility(propertyId),
      ])

      const docList = Array.isArray(docsRes)
        ? docsRes
        : Array.isArray(docsRes?.data)
        ? docsRes.data
        : []
      setDocuments(docList)

      const eligData = eligRes?.data || eligRes || null
      setEligibility(eligData)
      if (onEligibilityChange) {
        onEligibilityChange(eligData)
      }
    } catch (err) {
      console.error('Failed to load property documents or eligibility:', err)
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load property documents'
      )
    } finally {
      setIsLoading(false)
    }
  }, [propertyId, onEligibilityChange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenUpload = (preselectedType = null, replacingDoc = null) => {
    setDocumentType(preselectedType || PROPERTY_DOCUMENT_TYPES.TITLE_DEED)
    setSelectedFile(null)
    setUploadError(null)
    setResubmittingDoc(replacingDoc)
    setIsUploadModalOpen(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    setUploadError(null)
    if (!file) {
      setSelectedFile(null)
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setUploadError('Document size must not exceed 10 MB')
      setSelectedFile(null)
      return
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setUploadError('Only PDF, JPG, JPEG, and PNG files are accepted')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setUploadError('Please select a document file')
      return
    }
    if (!documentType) {
      setUploadError('Please choose a document type')
      return
    }

    setIsUploading(true)
    setUploadError(null)
    try {
      // If replacing a rejected document, remove the old one first
      if (resubmittingDoc && resubmittingDoc.status === 'REJECTED') {
        try {
          await deletePropertyDocument(propertyId, resubmittingDoc.documentId)
        } catch (delErr) {
          console.warn('Could not auto-remove rejected document before replacement:', delErr)
        }
      }

      await uploadPropertyDocument(propertyId, selectedFile, documentType)
      showToast('Document uploaded successfully and queued for Super Admin review.')
      setIsUploadModalOpen(false)
      setSelectedFile(null)
      setResubmittingDoc(null)
      await loadData()
    } catch (err) {
      console.error('Failed to upload document:', err)
      setUploadError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to upload property document. Please try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (doc) => {
    if (deletingId) return
    const isRejected = doc.status === 'REJECTED'
    const confirmMsg = isRejected
      ? `Remove this rejected ${PROPERTY_DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType} document?`
      : `Delete ${doc.fileName}? This will cancel the pending review.`

    if (!window.confirm(confirmMsg)) return

    setDeletingId(doc.documentId)
    try {
      await deletePropertyDocument(propertyId, doc.documentId)
      showToast('Document removed successfully.')
      await loadData()
    } catch (err) {
      console.error('Failed to delete document:', err)
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to delete property document.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (doc) => {
    if (downloadingId) return
    setDownloadingId(doc.documentId)
    try {
      const response = await downloadPropertyDocument(propertyId, doc.documentId)
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
      // Fallback: If blob download fails, attempt to open presigned URL
      if (doc.documentUrl) {
        window.open(doc.documentUrl, '_blank', 'noopener,noreferrer')
      } else {
        alert('Failed to download document. Please try again.')
      }
    } finally {
      setDownloadingId(null)
    }
  }

  const isEligible = eligibility?.eligible === true
  const isPublicStatus = propertyStatus === 'AVAILABLE'

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-fade-in ${
            toastType === 'success'
              ? 'bg-[#EDF7EE] border-[#C6DEC8] text-[#2A583B]'
              : 'bg-[#FDF2F2] border-[#F4B4B4] text-[#8A2E2C]'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Verification & Publication Eligibility Banner */}
      <div
        className={`rounded-2xl border p-5 shadow-sm transition-all ${
          isEligible
            ? 'bg-[#EDF7EE]/60 border-[#C6DEC8]'
            : 'bg-[#FEF7EC]/70 border-[#F4E2B6]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                isEligible
                  ? 'bg-[#2A583B] text-white'
                  : 'bg-[#8A5B16] text-white'
              }`}
            >
              {isEligible ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[#243447]">
                  {isEligible
                    ? 'Property Document Verification: Approved'
                    : 'Property Document Verification: Action Required'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isEligible
                      ? 'bg-[#2A583B] text-white'
                      : 'bg-[#8A5B16] text-white'
                  }`}
                >
                  {isEligible ? 'Publishing Allowed' : 'Publishing Locked'}
                </span>
              </div>
              <p className="text-sm text-[#5B6875] mt-1 leading-relaxed">
                {isEligible
                  ? 'Required proof of ownership has been verified and approved by an administrator. This property is fully eligible for public tenant browsing (Available / Published).'
                  : 'Proof of Ownership (Title Deed) must be uploaded and approved by a Super Administrator before this property can be made Available or Published to tenants.'}
              </p>
              {!isEligible && eligibility?.reasons && eligibility.reasons.length > 0 && (
                <ul className="mt-2 text-xs text-[#8A5B16] space-y-1 list-disc list-inside">
                  {eligibility.reasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant={isEligible ? 'outline' : 'primary'}
            onClick={() => handleOpenUpload()}
            className="flex-shrink-0 self-start sm:self-auto"
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        </div>
      </div>

      {/* Document Management Header & Actions */}
      <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D9E0E6]">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#243447] flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#315A7D]" />
              Property Documents
            </h3>
            <p className="text-xs text-[#5B6875] mt-0.5">
              Upload deed, tax proofs, and permits for admin review. Documents are stored in secure private storage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleOpenUpload()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Document
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
            <Loader size="md" />
            <p className="text-xs text-[#5B6875]">Loading property documents...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="my-6 p-4 rounded-xl border border-[#F4B4B4] bg-[#FDF2F2] text-[#8A2E2C] text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load documents</p>
              <p className="text-xs mt-0.5">{error}</p>
              <Button
                variant="outline"
                size="xs"
                onClick={loadData}
                className="mt-2 text-xs"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && documents.length === 0 && (
          <div className="py-10 text-center">
            <EmptyState
              icon={<FileText className="w-10 h-10 text-[#5B6875]/50" />}
              title="No property documents uploaded"
              description="Upload your Title Deed or Proof of Ownership to initiate administrative review and unlock property publication."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenUpload(PROPERTY_DOCUMENT_TYPES.TITLE_DEED)}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Upload Proof of Ownership
                </Button>
              }
            />
          </div>
        )}

        {/* Documents Table / Cards */}
        {!isLoading && !error && documents.length > 0 && (
          <div className="divide-y divide-[#D9E0E6] mt-2">
            {documents.map((doc) => {
              const isApproved = doc.status === PROPERTY_DOCUMENT_STATUSES.APPROVED
              const isPending = doc.status === PROPERTY_DOCUMENT_STATUSES.PENDING
              const isRejected = doc.status === PROPERTY_DOCUMENT_STATUSES.REJECTED
              const typeLabel = PROPERTY_DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType

              return (
                <div key={doc.documentId} className="py-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                          isApproved
                            ? 'bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]'
                            : isPending
                            ? 'bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]'
                            : 'bg-[#FDF2F2] text-[#8A2E2C] border border-[#F4B4B4]'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#243447]">
                            {typeLabel}
                          </span>
                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isApproved
                                ? 'bg-[#EDF7EE] text-[#2A583B] border border-[#C6DEC8]'
                                : isPending
                                ? 'bg-[#FEF7EC] text-[#8A5B16] border border-[#F4E2B6]'
                                : 'bg-[#FDF2F2] text-[#8A2E2C] border border-[#F4B4B4]'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isPending && <Clock className="w-3.5 h-3.5" />}
                            {isRejected && <XCircle className="w-3.5 h-3.5" />}
                            {isApproved
                              ? 'Approved'
                              : isPending
                              ? 'Pending Review'
                              : 'Rejected'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5B6875] mt-1 font-mono break-all">
                          {doc.fileName}
                          {doc.fileSize ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                          {doc.uploadedAt ? ` • Uploaded ${formatDate(doc.uploadedAt)}` : ''}
                        </p>
                        {doc.reviewedAt && (
                          <p className="text-[11px] text-[#5B6875] mt-0.5">
                            Reviewed by {doc.reviewedByName || 'Super Admin'} on {formatDate(doc.reviewedAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      {doc.documentUrl && (
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#D9E0E6] bg-white text-[#243447] hover:bg-[#F7F8FA] hover:text-[#315A7D] transition-colors"
                          title="Open document securely in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.documentId}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#D9E0E6] bg-white text-[#243447] hover:bg-[#F7F8FA] hover:text-[#315A7D] transition-colors disabled:opacity-50"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>

                      {isRejected && (
                        <button
                          type="button"
                          onClick={() => handleOpenUpload(doc.documentType, doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#315A7D] bg-[#315A7D] text-white hover:bg-[#24435E] transition-colors"
                          title="Upload a corrected document to replace this rejected one"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Replace & Resubmit
                        </button>
                      )}

                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.documentId}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rejection Reason Banner */}
                  {isRejected && (
                    <div className="ml-0 sm:ml-12 p-3 rounded-xl border border-[#F4B4B4] bg-[#FDF2F2] text-xs text-[#8A2E2C] space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Super Admin Rejection Reason:</span>
                      </div>
                      <p className="pl-5 text-sm">
                        {doc.rejectionReason || 'No specific reason provided by administrator.'}
                      </p>
                      <p className="pl-5 text-[11px] text-[#8A2E2C]/80 mt-1">
                        Click "Replace & Resubmit" to upload a revised copy addressing these concerns.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D9E0E6] shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-[#D9E0E6] bg-[#F7F8FA]">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#315A7D]" />
                <h3 className="font-semibold text-base text-[#243447]">
                  {resubmittingDoc ? 'Replace & Resubmit Property Document' : 'Upload Property Document'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {resubmittingDoc && (
                <div className="p-3 rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] text-xs text-[#8A5B16]">
                  <strong>Replacing previous rejected file:</strong> {resubmittingDoc.fileName}
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-lg border border-[#F4B4B4] bg-[#FDF2F2] text-xs text-[#8A2E2C]">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#243447] mb-1">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full text-sm rounded-lg border border-[#D9E0E6] bg-white text-[#243447] py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#315A7D]"
                  disabled={isUploading || !!resubmittingDoc}
                >
                  {Object.entries(PROPERTY_DOCUMENT_TYPES).map(([key, val]) => (
                    <option key={key} value={val}>
                      {PROPERTY_DOCUMENT_TYPE_LABELS[val] || val}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5B6875] mt-1">
                  {documentType === PROPERTY_DOCUMENT_TYPES.TITLE_DEED
                    ? 'Required: Upload registered sale deed, conveyance deed, or patta in your name.'
                    : 'Optional supporting documents to accelerate property verification.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243447] mb-1">
                  Document File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="block w-full text-xs text-[#5B6875] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EAF2F7] file:text-[#315A7D] hover:file:bg-[#D9E0E6] cursor-pointer"
                />
                <p className="text-[11px] text-[#5B6875] mt-1">
                  Supported formats: PDF, JPG, PNG up to 10 MB. Files are stored securely and kept private.
                </p>
              </div>

              {selectedFile && (
                <div className="p-3 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] text-xs space-y-1">
                  <div className="font-semibold text-[#243447] flex items-center justify-between">
                    <span>{selectedFile.name}</span>
                    <span className="text-[#5B6875] font-normal">{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D9E0E6]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUploading}
                  disabled={!selectedFile || isUploading}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  {isUploading ? 'Uploading...' : 'Submit for Review'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
