import type { ReactNode } from 'react'

export function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="vf-section-header">{children}</h2>
}
