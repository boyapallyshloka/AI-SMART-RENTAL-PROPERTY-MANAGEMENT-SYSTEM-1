import React, { useState, useEffect, useCallback } from 'react'
import { getPaymentRisk } from '../../api/paymentApi'
import { Loader, Button } from '../ui'
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Shield,
  RefreshCw,
  Info,
  Sparkles,
} from 'lucide-react'

/**
 * Format risk status into human-readable label
 */
const formatRiskStatus = (status) => {
  if (!status) return '—'
  return String(status).replace(/_/g, ' ')
}

/**
 * Format probability value (0.0 - 1.0 or 0 - 100) into clean percentage
 */
const formatProbability = (prob) => {
  if (prob == null || isNaN(Number(prob))) return null
  const num = Number(prob)
  if (num <= 1) {
    return `${(num * 100).toFixed(1)}%`
  }
  return `${num.toFixed(1)}%`
}

/**
 * Visual styling configuration based on risk status
 */
const getRiskStyle = (rawStatus) => {
  const normalized = String(rawStatus || '').toUpperCase()

  if (normalized.includes('LOW')) {
    return {
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      badgeClass: 'bg-emerald-100/80 text-emerald-800 border-emerald-300',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />,
    }
  }

  if (normalized.includes('MODERATE') || normalized.includes('MEDIUM')) {
    return {
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badgeClass: 'bg-amber-100/80 text-amber-800 border-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    }
  }

  if (normalized.includes('HIGH')) {
    return {
      textColor: 'text-rose-700',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      badgeClass: 'bg-rose-100/80 text-rose-800 border-rose-300',
      icon: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />,
    }
  }

  return {
    textColor: 'text-[#243447]',
    bgColor: 'bg-[#F7F8FA]',
    borderColor: 'border-[#D9E0E6]',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <Shield className="w-5 h-5 text-[#315A7D] shrink-0" />,
  }
}

/**
 * PaymentRiskAnalysisCard
 *
 * Decision-support card displaying M4 tenant payment-risk predictions.
 * Fetches data via GET /api/payments/payment-risk/{tenantId}.
 *
 * States:
 * - Loading: In-progress assessment spinner
 * - Result: Verified risk_status, risk_probability (as percentage), model & version
 * - Unavailable: Missing income or insufficient history (HTTP 400), with clear explanation and retry
 * - Error: Server/network failure with retry
 *
 * Decision Support Only: Includes prominent disclaimer and strictly avoids
 * automatic approval/rejection or status changes.
 *
 * @param {Object} props
 * @param {number|string} props.tenantId - Tenant ID from application record
 * @param {string} [props.className] - Optional extra CSS classes
 */
export default function PaymentRiskAnalysisCard({ tenantId, className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(tenantId))
  const [isUnavailable, setIsUnavailable] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState('')
  const [error, setError] = useState(null)

  const fetchRisk = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      setIsUnavailable(true)
      setUnavailableMessage('Analysis unavailable: No tenant profile linked to this rental application.')
      setData(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setIsUnavailable(false)
    setUnavailableMessage('')

    try {
      // Calls authenticated GET /api/payments/payment-risk/{tenantId}
      // Browser does NOT send payment history or model inputs
      const response = await getPaymentRisk(tenantId)

      const status = response?.risk_status || response?.riskStatus
      if (status) {
        setData(response)
        setIsUnavailable(false)
        setError(null)
      } else {
        setIsUnavailable(true)
        setUnavailableMessage('Analysis unavailable: Incomplete risk response returned by the server.')
        setData(null)
      }
    } catch (err) {
      console.warn(`[PaymentRisk] Evaluation response for tenant #${tenantId}:`, err)
      setData(null)
      const httpStatus = err?.status || err?.response?.status

      if (httpStatus === 400) {
        // Missing monthly income or insufficient payment history
        setIsUnavailable(true)
        const msg =
          err?.data?.message ||
          err?.message ||
          'Analysis unavailable: Tenant monthly income is required or payment history is insufficient for predictive risk modeling.'
        setUnavailableMessage(msg)
        setError(null)
      } else if (httpStatus === 404 || err?.isNotFound) {
        setIsUnavailable(true)
        setUnavailableMessage('Analysis unavailable: Tenant profile record not found on the server.')
        setError(null)
      } else {
        setIsUnavailable(false)
        setError(
          err?.message || 'Unable to connect to the payment-risk service. Please check your network or try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    fetchRisk()
  }, [fetchRisk])

  const rawStatus = data?.risk_status || data?.riskStatus
  const statusFormatted = formatRiskStatus(rawStatus)
  const rawProb = data?.risk_probability != null ? data.risk_probability : data?.riskProbability
  const probabilityFormatted = formatProbability(rawProb)
  const modelName = data?.model || 'M4 Payment Risk Model'
  const modelVersion = data?.model_version || data?.modelVersion || 'v1.0'
  const riskStyle = getRiskStyle(rawStatus)

  return (
    <div
      className={`bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4 ${className}`}
      data-testid="payment-risk-analysis-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#D9E0E6] pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#315A7D]" />
          <h2 className="text-base font-semibold text-[#243447]">
            Payment-Risk Analysis
          </h2>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#EAF2F7] text-[#315A7D] border border-[#315A7D]/20">
            Decision Support
          </span>
        </div>

        {!loading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRisk}
            title="Refresh payment-risk analysis"
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-[#5B6875]" />}
            className="text-xs text-[#5B6875] hover:text-[#243447] px-2 py-1"
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2">
          <Loader size="md" text="Evaluating tenant payment-risk..." center />
          <p className="text-xs text-[#5B6875]">
            Analyzing verified payment history and income ratios...
          </p>
        </div>
      )}

      {/* Unavailable State (e.g. HTTP 400: missing income or insufficient history) */}
      {!loading && isUnavailable && (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Analysis Unavailable
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {unavailableMessage ||
                  'Tenant monthly income is required or payment history is insufficient for predictive modeling.'}
              </p>
              <p className="text-[11px] text-[#5B6875] italic">
                Note: No guessed or mock risk is displayed. Review applicant financial and identity documents manually.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRisk}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs bg-white hover:bg-slate-50 border-amber-300 text-amber-900"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Error State (e.g. Network/Server 500 error) */}
      {!loading && !isUnavailable && error && (
        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Failed to Retrieve Risk Analysis
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed font-medium">
                {error}
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRisk}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs bg-white hover:bg-slate-50 border-rose-300 text-rose-900"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Result State */}
      {!loading && !isUnavailable && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Risk Status Indicator */}
            <div
              className={`p-4 rounded-xl border ${riskStyle.bgColor} ${riskStyle.borderColor} flex items-center justify-between`}
            >
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5B6875] block">
                  Predicted Risk Status
                </span>
                <div className="flex items-center gap-2">
                  {riskStyle.icon}
                  <span className={`text-lg font-bold tracking-tight ${riskStyle.textColor}`}>
                    {statusFormatted}
                  </span>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${riskStyle.badgeClass}`}
              >
                {statusFormatted}
              </span>
            </div>

            {/* Risk Probability */}
            <div className="p-4 rounded-xl border bg-[#F7F8FA] border-[#D9E0E6] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5B6875] block">
                  Risk Probability
                </span>
                <div className="text-lg font-bold text-[#243447]">
                  {probabilityFormatted != null ? probabilityFormatted : '—'}
                </div>
              </div>
              {probabilityFormatted != null ? (
                <span className="text-xs text-[#5B6875] font-medium bg-white px-2.5 py-1 rounded-md border border-[#D9E0E6] shadow-2xs">
                  Estimated Probability
                </span>
              ) : (
                <span className="text-xs text-[#5B6875] italic">
                  Not provided by model
                </span>
              )}
            </div>
          </div>

          {/* Model and Version Metadata */}
          <div className="flex items-center justify-between text-xs text-[#5B6875] px-1 pt-0.5">
            <span className="flex items-center gap-1.5 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-[#315A7D]" />
              <span>
                Model: <strong className="font-semibold text-[#243447]">{modelName}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Version: <strong className="font-semibold text-[#243447]">{modelVersion}</strong>
              </span>
            </span>

            <span className="text-[11px] text-[#5B6875]">
              Tenant #{tenantId}
            </span>
          </div>
        </div>
      )}

      {/* Advisory & Decision Support Disclaimer */}
      <div className="p-3.5 bg-[#F7F8FA] border border-[#D9E0E6] rounded-xl text-xs text-[#5B6875] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-[#243447]">
            Advisory Notice (Decision Support Only)
          </p>
          <p className="leading-relaxed">
            This risk analysis is generated algorithmically to assist in reviewing applications.
            It does not replace independent verification of tenant financial stability and does not
            automatically determine or alter application approval or rejection.
          </p>
        </div>
      </div>
    </div>
  )
}
