import { useState, type ChangeEvent } from 'react'
import { errorText } from '../api'
import { ACCEPT_DOCUMENT, ACCEPT_IMAGE, MAX_FILES, readAttachment } from '../attachments'
import type { ChatAttachment } from '../types'

interface Props {
  files: ChatAttachment[]
  onChange: (files: ChatAttachment[]) => void
  disabled: boolean
}

const PICKERS = [
  { letter: 'D', label: 'Adjuntar documento', accept: ACCEPT_DOCUMENT },
  { letter: 'I', label: 'Adjuntar imagen', accept: ACCEPT_IMAGE },
]

export function AttachmentBar({ files, onChange, disabled }: Props) {
  const [error, setError] = useState<string | null>(null)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    setError(null)
    if (files.length + picked.length > MAX_FILES) {
      setError(`Podés adjuntar hasta ${MAX_FILES} archivos por mensaje.`)
      return
    }
    try {
      onChange([...files, ...(await Promise.all(picked.map(readAttachment)))])
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <div className="rd-attach">
      {PICKERS.map((p) => (
        <label key={p.letter} className="rd-attach-pick" title={p.label}>
          <input
            className="rd-sr"
            type="file"
            multiple
            accept={p.accept}
            disabled={disabled}
            aria-label={p.label}
            onChange={(e) => void onPick(e)}
          />
          {/* Letra clara de fondo (D = documento, I = imagen) con el + encima. */}
          <span className="rd-attach-letter" aria-hidden="true">
            {p.letter}
          </span>
          <span className="rd-attach-plus" aria-hidden="true">
            +
          </span>
        </label>
      ))}
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="rd-tag rd-attach-file">
          {f.name}
          <button
            type="button"
            className="rd-link"
            aria-label={`Quitar ${f.name}`}
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
    </div>
  )
}
