import { useEffect } from 'react'

interface Props {
  message: string | null
  onDone: () => void
  ms?: number
}

export function Toast({ message, onDone, ms = 3000 }: Props) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, ms)
    return () => clearTimeout(t)
  }, [message, onDone, ms])
  if (!message) return null
  return (
    <div role="status" className="vf-toast">
      {message}
    </div>
  )
}
