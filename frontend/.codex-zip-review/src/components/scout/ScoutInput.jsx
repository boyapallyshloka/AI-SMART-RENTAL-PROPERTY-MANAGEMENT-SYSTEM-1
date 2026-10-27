import React, { useState, useRef, useEffect } from 'react'
import { SendHorizontal } from 'lucide-react'

/**
 * ScoutInput Component
 * Text input and send action for interacting with the SCOUT assistant.
 *
 * @param {Object} props
 * @param {Function} props.onSendMessage
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 */
export default function ScoutInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask SCOUT about properties, applications, or maintenance...',
}) {
  const [inputText, setInputText] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || disabled) return

    onSendMessage(trimmed)
    setInputText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-white border-t border-[#D9E0E6] flex items-center gap-2"
    >
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full text-xs sm:text-sm bg-[#F7F8FA] border border-[#D9E0E6] rounded-xl px-3.5 py-2.5 text-[#243447] placeholder-[#5B6875] focus:outline-none focus:border-[#315A7D] focus:ring-1 focus:ring-[#315A7D] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Message to SCOUT"
        />
      </div>

      <button
        type="submit"
        disabled={!inputText.trim() || disabled}
        className="p-2.5 rounded-xl bg-[#315A7D] hover:bg-[#274B68] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center shadow-xs cursor-pointer"
        title="Send message"
        aria-label="Send message"
      >
        <SendHorizontal className="w-4 h-4" />
      </button>
    </form>
  )
}
