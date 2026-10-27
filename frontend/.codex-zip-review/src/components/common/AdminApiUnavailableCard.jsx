import React from 'react'
import { AlertTriangle, Server, Key, FileCode2, Database } from 'lucide-react'

/**
 * Method badge color styles
 */
const METHOD_STYLES = {
  GET: 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]',
  POST: 'bg-[#EAF2F7] text-[#315A7D] border-[#D9E0E6]',
  PUT: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
  PATCH: 'bg-[#FEF7EC] text-[#8A5B16] border-[#F4E2B6]',
  DELETE: 'bg-[#FDF2F2] text-[#8A2E2C] border-[#F4B4B4]',
}

/**
 * Enterprise Admin API Unavailable Card
 * Clearly informs Super Admins that a feature requires backend REST APIs
 * and details the exact endpoints, parameters, and roles needed.
 */
export default function AdminApiUnavailableCard({
  title,
  subtitle,
  icon,
  description,
  endpoints = [],
  backendRequirements = [],
}) {
  return (
    <div className="space-y-6">
      {/* Notice Callout */}
      <div className="rounded-lg border border-[#F4E2B6] bg-[#FEF7EC] p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-white p-2 border border-[#F4E2B6] shrink-0 text-[#8A5B16]">
            {icon || <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#243447]">{title}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white text-[#8A5B16] border border-[#F4E2B6]">
                Backend API Required
              </span>
            </div>
            {subtitle && (
              <p className="text-xs font-medium text-[#8A5B16]">{subtitle}</p>
            )}
            <p className="text-xs sm:text-sm text-[#5B6875] pt-1 leading-relaxed">
              {description ||
                'This administrative capability is not yet available because the backend currently does not expose the required authenticated REST endpoints. To ensure strict data integrity, no mock data, hard-coded fallback records, or simulated operations are displayed.'}
            </p>
          </div>
        </div>
      </div>

      {/* Required Endpoints Specification */}
      {endpoints.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#D9E0E6] bg-white shadow-2xs">
          <div className="border-b border-[#D9E0E6] bg-[#F7F8FA] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#315A7D]" />
              <h3 className="text-xs sm:text-sm font-semibold text-[#243447]">
                Required Backend REST Endpoints
              </h3>
            </div>
            <span className="text-xs text-[#5B6875]">
              {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'} needed
            </span>
          </div>

          <div className="divide-y divide-[#D9E0E6]">
            {endpoints.map((ep, idx) => {
              const methodStyle =
                METHOD_STYLES[ep.method?.toUpperCase()] ||
                'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]'

              return (
                <div key={idx} className="p-4 sm:p-5 hover:bg-[#F7F8FA]/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${methodStyle}`}
                      >
                        {ep.method}
                      </span>
                      <code className="text-xs sm:text-sm font-mono font-semibold text-[#243447]">
                        {ep.path}
                      </code>
                    </div>

                    {ep.auth && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] self-start sm:self-auto">
                        <Key className="h-3 w-3" />
                        {ep.auth}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs sm:text-sm text-[#5B6875]">
                    {ep.description}
                  </p>

                  {(ep.params?.length > 0 || ep.body) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B6875]">
                      {ep.params?.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#243447]">Parameters:</span>
                          <span className="font-mono text-[11px] bg-[#F7F8FA] px-1.5 py-0.5 rounded border border-[#D9E0E6]">
                            {ep.params.join(', ')}
                          </span>
                        </div>
                      )}

                      {ep.body && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#243447]">Payload:</span>
                          <span className="font-mono text-[11px] bg-[#F7F8FA] px-1.5 py-0.5 rounded border border-[#D9E0E6]">
                            {ep.body}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Backend Implementation Requirements */}
      {backendRequirements.length > 0 && (
        <div className="rounded-lg border border-[#D9E0E6] bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#243447]">
            <Database className="h-4 w-4 text-[#3F7D58]" />
            <span>Backend Implementation Checklist</span>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-[#5B6875]">
            {backendRequirements.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#3F7D58] font-bold select-none">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
