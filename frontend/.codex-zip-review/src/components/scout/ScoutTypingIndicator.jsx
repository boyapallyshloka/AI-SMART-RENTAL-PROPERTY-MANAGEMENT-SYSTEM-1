import React from 'react'
import { Bot } from 'lucide-react'

/**
 * ScoutTypingIndicator Component
 * Displays a professional, restrained typing animation when SCOUT is generating a response.
 */
export default function ScoutTypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 max-w-[85%] text-left animate-in fade-in slide-in-from-bottom-1 duration-200">
      {/* Assistant Avatar */}
      <div className="w-8 h-8 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center text-[#315A7D] shrink-0 mt-0.5">
        <Bot className="w-4 h-4" />
      </div>

      {/* Typing Bubble */}
      <div className="bg-white border border-[#D9E0E6] rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs space-y-1">
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="w-2 h-2 rounded-full bg-[#315A7D] animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-[#315A7D] animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-[#315A7D] animate-bounce" />
          <span className="text-xs text-[#5B6875] font-medium ml-2">SCOUT is typing...</span>
        </div>
      </div>
    </div>
  )
}
