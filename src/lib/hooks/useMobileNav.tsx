'use client'

/**
 * src/lib/hooks/useMobileNav.tsx
 *
 * MobileNavProvider / useMobileNav
 *
 * Context minimal pentru starea sertarului de navigare pe mobil/tabletă
 * (sub breakpoint-ul `lg`). Sidebar-ul citește `open` ca să se afișeze sau
 * să se ascundă, Header-ul apelează `toggle()` din butonul hamburger, iar
 * link-urile din Sidebar apelează `close()` la navigare. Pe desktop (lg+)
 * sidebar-ul e mereu vizibil, indiferent de această stare — vezi clasele
 * `lg:translate-x-0` din Sidebar.tsx.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface MobileNavContextValue {
  open: boolean
  toggle: () => void
  close: () => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <MobileNavContext.Provider value={{ open, toggle, close }}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}
