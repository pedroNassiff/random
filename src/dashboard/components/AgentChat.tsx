import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { api, errorText } from '../api'
import { useChatHistory } from '../chatHistory'
import type { ChatAttachment, ChatEntry, ChatTurn, Proposal } from '../types'
import { AttachmentBar } from './AttachmentBar'
import { ProposalCard } from './ProposalCard'
import { ResizeHandle, useChatSize } from './ResizeHandle'

const SUGGESTIONS = [
  '¿Qué documento necesito ahora?',
  '¿Qué me vence primero?',
  'Calculá el plazo de una notificación',
]

function toHistory(entries: ChatEntry[]): ChatTurn[] {
  return entries.map((e) => {
    if (e.kind === 'event') return { role: 'user', text: `[${e.text}]` }
    if (e.kind === 'user')
      return { role: 'user', text: [e.text, ...e.files.map((f) => `[Adjunto: ${f}]`)].join('\n') }
    const shown = e.proposals.map((p) => `[Propuesta mostrada: ${p.proposal.titulo}]`)
    return { role: 'assistant', text: [e.text, ...shown].join('\n') }
  })
}

function save(proposal: Proposal): Promise<unknown> {
  if (proposal.kind === 'profile') return api.saveProfile(proposal.payload)
  if (proposal.kind === 'invoice') return api.addInvoice(proposal.payload)
  if (proposal.kind === 'client') {
    const { id, ...client } = proposal.payload
    return id ? api.updateClient(id, client) : api.createClient(client)
  }
  const { key, estado, justificante } = proposal.payload
  return api.setStatus(key, estado, justificante)
}

function ChatHeader({
  canClear,
  onClear,
  onClose,
}: {
  canClear: boolean
  onClear: () => void
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <header className="rd-chat-head">
      <strong>NEO</strong>
      {canClear && (
        <button
          type="button"
          className="rd-link rd-chat-clear"
          onClick={() => {
            if (confirming) onClear()
            setConfirming(!confirming)
          }}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? 'Confirmar: borrar todo' : 'Borrar conversación'}
        </button>
      )}
      <button type="button" className="rd-link" aria-expanded onClick={onClose}>
        Cerrar
      </button>
    </header>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se guardó algo (una propuesta o un adjunto): la página abierta debe recargar sus datos. */
  onChanged: () => void
}

export function AgentChat({ open, onOpenChange, onChanged }: Props) {
  const { pathname } = useLocation()
  const { entries, hasMore, loadingOlder, loadOlder, append, setProposalStatus, clear } = useChatHistory()
  const { size, resize } = useChatSize()
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<ChatAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const lastId = entries.at(-1)?.id

  // Baja al final cuando llega algo nuevo o se abre la ventana; no cuando se cargan mensajes viejos arriba.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lastId, busy, open])

  const showOlder = async () => {
    const log = logRef.current
    const before = log?.scrollHeight ?? 0
    await loadOlder()
    // Mantiene a la vista lo que la persona estaba leyendo: compensa la altura de lo agregado arriba.
    requestAnimationFrame(() => {
      if (log) log.scrollTop = log.scrollHeight - before
    })
  }

  const onScroll = () => {
    const log = logRef.current
    if (log && log.scrollTop < 40 && hasMore && !loadingOlder) void showOlder()
  }

  const send = async (text: string) => {
    const attached = files
    const message = text.trim() || (attached.length ? 'Te adjunto documentos.' : '')
    if (!message || busy) return
    const history = toHistory(entries)
    append([{ kind: 'user', text: message, files: attached.map((f) => f.name) }])
    setInput('')
    setFiles([])
    setBusy(true)
    setError(null)
    try {
      const reply = await api.agentChat(message, history, pathname, attached)
      append([{ kind: 'assistant', text: reply.reply, proposals: reply.proposals }])
      if (attached.length) onChanged() // los adjuntos quedaron guardados: refresca la página abierta
    } catch (err) {
      setError(errorText(err))
      setFiles(attached) // para reintentar sin volver a elegirlos
    } finally {
      setBusy(false)
    }
  }

  const onSave = async (proposal: Proposal) => {
    setProposalStatus(proposal.id, 'guardando')
    try {
      await save(proposal)
      setProposalStatus(proposal.id, 'guardada')
      append([{ kind: 'event', text: `Guardé la propuesta: ${proposal.titulo}` }])
      onChanged()
    } catch (err) {
      setProposalStatus(proposal.id, 'pendiente', errorText(err))
    }
  }

  const onRedo = (proposal: Proposal) => {
    setProposalStatus(proposal.id, 'descartada')
    setInput(`Rehacé la propuesta «${proposal.titulo}»: `)
    inputRef.current?.focus()
  }

  const onDiscard = (proposal: Proposal) => {
    setProposalStatus(proposal.id, 'descartada')
    append([{ kind: 'event', text: `Descarté la propuesta: ${proposal.titulo}` }])
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="rd-chat-toggle"
        data-tour="neo"
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
      >
        NEO
      </button>
    )

  return (
    <section
      className="rd-chat"
      aria-label="NEO, asistente fiscal"
      style={{ '--neo-w': `${size.width}px`, '--neo-h': `${size.height}px` } as CSSProperties}
    >
      <ResizeHandle size={size} onResize={resize} />
      <ChatHeader canClear={entries.length > 0} onClear={clear} onClose={() => onOpenChange(false)} />
      <div className="rd-chat-log" role="log" aria-live="polite" ref={logRef} onScroll={onScroll}>
        {hasMore && (
          <button
            type="button"
            className="rd-chip rd-chat-older"
            disabled={loadingOlder}
            onClick={() => void showOlder()}
          >
            {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
          </button>
        )}
        {entries.length === 0 && (
          <div className="rd-chat-empty">
            <p className="rd-muted">
              Preguntame, pedime un cambio o adjuntá un documento (036, justificantes, notificaciones) y
              completo los datos por vos. Yo propongo; vos decidís si se guarda, se rehace o se descarta.
            </p>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="rd-chip" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`rd-msg rd-msg--${e.kind}`}>
            {e.text && <p>{e.text}</p>}
            {e.files.map((f) => (
              <p key={f} className="rd-msg-file">
                Adjunto: {f}
              </p>
            ))}
            {e.proposals.map((p) => (
              <ProposalCard
                key={p.proposal.id}
                state={p}
                onSave={() => void onSave(p.proposal)}
                onRedo={() => onRedo(p.proposal)}
                onDiscard={() => onDiscard(p.proposal)}
              />
            ))}
          </div>
        ))}
        {busy && <p role="status">Pensando…</p>}
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
      </div>
      <AttachmentBar files={files} onChange={setFiles} disabled={busy} />
      <form className="rd-chat-form" onSubmit={submit}>
        <label className="rd-sr" htmlFor="rd-chat-input">
          Mensaje para NEO
        </label>
        <textarea
          id="rd-chat-input"
          ref={inputRef}
          className="rd-input"
          rows={2}
          maxLength={4000}
          placeholder="Escribile a NEO…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="rd-btn rd-btn--primary"
          disabled={busy || (!input.trim() && files.length === 0)}
        >
          Enviar
        </button>
      </form>
    </section>
  )
}
