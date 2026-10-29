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
      <div className="w-8 h-8 rounded-lg bg-[#EDF4ED] border border-[#E3E8DF] flex items-center justify-center text-[#3F7D58] shrink-0 mt-0.5">
        <Bot className="w-4 h-4" />
      </div>

      {/* Typing Bubble */}
      <div className="bg-white border border-[#E3E8DF] rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs space-y-1">
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="w-2 h-2 rounded-full bg-[#3F7D58] animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-[#3F7D58] animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-[#3F7D58] animate-bounce" />
          <span className="text-xs text-[#5B6875] font-medium ml-2">SCOUT is typing...</span>
        </div>
      </div>
    </div>
  )
}
