import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { ChatEntry, Proposal, ProposalStatus } from './types'

export interface EntryDraft {
  kind: ChatEntry['kind']
  text: string
  files?: string[]
  proposals?: Proposal[]
}

interface ChatHistory {
  /** Mensajes cargados, del más viejo al más nuevo. */
  entries: ChatEntry[]
  hasMore: boolean
  loadingOlder: boolean
  /** Trae el bloque anterior al mensaje más viejo cargado. */
  loadOlder: () => Promise<void>
  append: (drafts: EntryDraft[]) => void
  setProposalStatus: (proposalId: string, status: ProposalStatus, error?: string | null) => void
  clear: () => void
}

/**
 * Conversación con NEO guardada en el servidor: al entrar trae el último bloque, los anteriores se piden
 * de a uno y cada mensaje nuevo se guarda al momento. Si la primera carga falla no se guarda nada en esa
 * sesión, para no dejar un historial a medias.
 */
export function useChatHistory(): ChatHistory {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // Copia siempre al día de `entries`, para que las acciones seguidas partan del último estado.
  const current = useRef<ChatEntry[]>([])
  const persist = useRef(false)
  const tempId = useRef(-1)

  const commit = useCallback((next: ChatEntry[]) => {
    current.current = next
    setEntries(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .chatHistory()
      .then((page) => {
        if (cancelled) return
        persist.current = true
        // Lo que la persona ya escribió mientras cargaba queda al final.
        commit([...page.entries, ...current.current])
        setHasMore(page.has_more)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [commit])

  const loadOlder = useCallback(async () => {
    const oldest = current.current.find((e) => e.id > 0)
    if (!oldest || !persist.current) return
    setLoadingOlder(true)
    try {
      const page = await api.chatHistory(oldest.id)
      commit([...page.entries, ...current.current])
      setHasMore(page.has_more)
    } catch {
      /* se puede reintentar: el botón sigue ahí */
    } finally {
      setLoadingOlder(false)
    }
  }, [commit])

  const saveProposals = (entry: ChatEntry) => {
    if (!persist.current || entry.id < 0) return
    const settled = entry.proposals.map((p) =>
      p.status === 'guardando' ? { ...p, status: 'pendiente' as const } : p,
    )
    api.saveChatProposals(entry.id, settled).catch(() => undefined)
  }

  const append = useCallback(
    (drafts: EntryDraft[]) => {
      const added: ChatEntry[] = drafts.map((d) => ({
        id: tempId.current--,
        kind: d.kind,
        text: d.text,
        files: d.files ?? [],
        proposals: (d.proposals ?? []).map((proposal) => ({ proposal, status: 'pendiente', error: null })),
      }))
      commit([...current.current, ...added])
      if (!persist.current) return
      api
        .appendChat(added)
        .then((ids) => {
          const real = new Map(added.map((e, i) => [e.id, ids[i] ?? e.id]))
          commit(current.current.map((e) => ({ ...e, id: real.get(e.id) ?? e.id })))
          // Si mientras se guardaba ya se resolvió alguna propuesta, se guarda ese estado.
          for (const e of current.current)
            if ([...real.values()].includes(e.id) && e.proposals.some((p) => p.status !== 'pendiente'))
              saveProposals(e)
        })
        .catch(() => undefined)
    },
    [commit],
  )

  const setProposalStatus = useCallback(
    (proposalId: string, status: ProposalStatus, error: string | null = null) => {
      const next = current.current.map((e) =>
        e.proposals.some((p) => p.proposal.id === proposalId)
          ? {
              ...e,
              proposals: e.proposals.map((p) => (p.proposal.id === proposalId ? { ...p, status, error } : p)),
            }
          : e,
      )
      commit(next)
      const changed = next.find((e) => e.proposals.some((p) => p.proposal.id === proposalId))
      if (changed && status !== 'guardando') saveProposals(changed)
    },
    [commit],
  )

  const clear = useCallback(() => {
    commit([])
    setHasMore(false)
    if (persist.current) api.clearChatHistory().catch(() => undefined)
  }, [commit])

  return { entries, hasMore, loadingOlder, loadOlder, append, setProposalStatus, clear }
}
