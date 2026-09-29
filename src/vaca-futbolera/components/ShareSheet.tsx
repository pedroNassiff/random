import { useRef, useState } from 'react'
import { LAVACA_LOGO } from '../routes'
import { canCopyImages, copyImage, isAbort, renderPng, shareImage } from '../share'
import { Button } from './Button'
import { TeamSheet, type SheetTeam } from './TeamSheet'

interface Props {
  heading: string
  teams: [SheetTeam, SheetTeam]
  /** Texto que acompaña la imagen al compartir (formato spec §7). */
  text: string
  filename?: string
}

/** Tarjeta de formación + acciones: Copiar imagen / Compartir (Web Share) / Descargar como fallback. */
export function ShareSheet({ heading, teams, text, filename = 'equipos.png' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: (png: () => Promise<Blob>) => Promise<string | null>) => {
    const node = ref.current
    if (!node) return
    setBusy(true)
    setStatus(null)
    try {
      setStatus(await action(() => renderPng(node)))
    } catch (e) {
      if (!isAbort(e)) setStatus(e instanceof Error ? e.message : 'No se pudo compartir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <TeamSheet ref={ref} heading={heading} teams={teams} avatarSrc={LAVACA_LOGO} />
      <div className="vf-row vf-sheet__actions">
        {canCopyImages() && (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async (png) => (await copyImage(png()), 'Imagen copiada. Pegala en el grupo.'))
            }
          >
            Copiar imagen
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async (png) =>
              (await shareImage(await png(), filename, text)) === 'shared'
                ? null
                : 'Imagen descargada. Adjuntala en WhatsApp.',
            )
          }
        >
          Compartir por WhatsApp
        </Button>
      </div>
      {status && (
        <p role="status" className="vf-muted">
          {status}
        </p>
      )}
    </div>
  )
}
