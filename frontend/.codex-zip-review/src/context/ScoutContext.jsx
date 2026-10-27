import React, { createContext, useContext, useState } from 'react'

const ScoutContext = createContext(null)

export function ScoutProvider({ children }) {
  const [isScoutOpen, setIsScoutOpen] = useState(false)

  return (
    <ScoutContext.Provider
      value={{
        isScoutOpen,
        openScout: () => setIsScoutOpen(true),
        closeScout: () => setIsScoutOpen(false),
        toggleScout: () => setIsScoutOpen((open) => !open),
      }}
    >
      {children}
    </ScoutContext.Provider>
  )
}

export function useScout() {
  const context = useContext(ScoutContext)
  if (!context) throw new Error('useScout must be used within a ScoutProvider')
  return context
}
