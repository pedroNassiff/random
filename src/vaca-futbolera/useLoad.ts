import { useCallback, useEffect, useState } from 'react'
import { errorText } from './api'

interface State<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** Carga async con cancelación. `loader` debe ser estable (módulo o useCallback). */
export function useLoad<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    loader()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => !cancelled && setState({ data: null, error: errorText(e), loading: false }))
    return () => {
      cancelled = true
    }
  }, [loader, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
