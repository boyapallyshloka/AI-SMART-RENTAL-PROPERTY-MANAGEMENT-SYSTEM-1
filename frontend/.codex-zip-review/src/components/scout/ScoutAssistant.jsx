import React from 'react'
import { Bot, CircleOff, X } from 'lucide-react'
import { useScout } from '../../context/ScoutContext'

export default function ScoutAssistant({
  isEmbedded = false,
  isOpen: propIsOpen,
  onClose: propOnClose,
  className = '',
}) {
  const scout = useScout()
  const isOpen = propIsOpen !== undefined ? propIsOpen : scout.isScoutOpen
  const close = propOnClose || scout.closeScout

  if (!isEmbedded && !isOpen) return null

  const containerClasses = isEmbedded
    ? `h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-[#D9E0E6] bg-white ${className}`
    : `fixed bottom-5 right-5 z-50 flex h-[420px] max-h-[85vh] w-[94vw] flex-col overflow-hidden rounded-2xl border border-[#D9E0E6] bg-white shadow-2xl sm:w-[400px] ${className}`

  return (
    <section className={containerClasses} role="dialog" aria-label="SCOUT assistant availability">
      <header className="flex items-center justify-between border-b border-[#D9E0E6] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E0E6] bg-[#EAF2F7] text-[#315A7D]"><Bot className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-bold text-[#243447]">SCOUT</h2>
            <p className="text-[11px] text-[#5B6875]">SmartEstate assistant</p>
          </div>
        </div>
        {!isEmbedded && (
          <button type="button" onClick={close} className="rounded-md p-2 text-[#5B6875] hover:bg-[#F7F8FA]" aria-label="Close SCOUT">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <CircleOff className="h-8 w-8 text-[#8A5B16]" />
        <h3 className="text-base font-semibold text-[#243447]">Assistant unavailable</h3>
        <p className="max-w-sm text-sm leading-relaxed text-[#5B6875]">
          The current backend does not expose a SCOUT chat endpoint, so this assistant cannot answer questions yet. Live property, payment, and maintenance information remains available in their respective pages.
        </p>
      </div>
    </section>
  )
}
