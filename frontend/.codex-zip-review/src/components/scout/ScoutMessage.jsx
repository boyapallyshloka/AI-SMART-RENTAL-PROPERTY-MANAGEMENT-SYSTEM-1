import React from 'react'
import { Bot, User } from 'lucide-react'

/**
 * ScoutMessage Component
 * Renders individual chat bubbles for SCOUT or the User with high-contrast SaaS styling.
 *
 * @param {Object} props
 * @param {Object} props.message
 * @param {string} props.message.id
 * @param {'scout'|'user'} props.message.sender
 * @param {string} props.message.text
 * @param {string} props.message.timestamp
 * @param {string[]} [props.message.suggestions]
 * @param {Function} [props.onSelectSuggestion]
 */
export default function ScoutMessage({ message, onSelectSuggestion }) {
  const isScout = message.sender === 'scout'

  return (
    <div
      className={`flex items-start gap-2.5 max-w-[90%] sm:max-w-[85%] ${
        isScout ? 'self-start text-left' : 'self-end flex-row-reverse text-right'
      } animate-in fade-in duration-200`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
          isScout
            ? 'bg-[#EAF2F7] border border-[#D9E0E6] text-[#315A7D]'
            : 'bg-[#315A7D] text-white'
        }`}
      >
        {isScout ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      {/* Message Content Bubble */}
      <div
        className={`rounded-2xl px-4 py-3 shadow-xs space-y-1 ${
          isScout
            ? 'bg-white border border-[#D9E0E6] text-[#243447] rounded-tl-sm text-left'
            : 'bg-[#315A7D] text-white rounded-tr-sm text-left'
        }`}
      >
        {/* Header Label for SCOUT */}
        {isScout && (
          <div className="flex items-center justify-between gap-2 pb-0.5">
            <span className="text-[11px] font-semibold text-[#315A7D] uppercase tracking-wider">
              SCOUT Assistant
            </span>
          </div>
        )}

        {/* Message Body Text */}
        <p
          className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
            isScout ? 'text-[#243447]' : 'text-white'
          }`}
        >
          {message.text}
        </p>

        {/* Action Suggestions (optional contextual suggestions) */}
        {isScout && message.suggestions && message.suggestions.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1.5 border-t border-[#D9E0E6]/80 mt-2">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectSuggestion && onSelectSuggestion(suggestion)}
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#F7F8FA] border border-[#D9E0E6] text-[#315A7D] hover:bg-[#EAF2F7] hover:border-[#315A7D] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <p
            className={`text-[10px] pt-0.5 text-right ${
              isScout ? 'text-[#5B6875]' : 'text-[#EAF2F7]/80'
            }`}
          >
            {message.timestamp}
          </p>
        )}
      </div>
    </div>
  )
}
