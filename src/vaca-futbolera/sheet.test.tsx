import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareSheet } from './components/ShareSheet'
import type { SheetTeam } from './components/TeamSheet'

const share = vi.hoisted(() => ({
  canCopyImages: vi.fn(() => true),
  copyImage: vi.fn(async (p: Promise<Blob>) => void (await p)),
  renderPng: vi.fn(async () => new Blob(['png'])),
  shareImage: vi.fn(async () => 'shared' as 'shared' | 'downloaded'),
  isAbort: (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
}))
vi.mock('./share', () => share)

afterEach(() => vi.clearAllMocks())

const TEAMS: [SheetTeam, SheetTeam] = [
  {
    name: 'Blancos',
    tone: 'light',
    players: [
      { name: 'Marc', position: 'POR' },
      { name: 'Juan', position: null },
    ],
  },
  { name: 'Negros', tone: 'dark', players: [{ name: 'Fede', position: 'DEL' }] },
]

const renderSheet = () => render(<ShareSheet heading="MIÉ 30 SEP · 19:00H" teams={TEAMS} text="⚽ texto" />)

describe('tarjeta de formación', () => {
  it('muestra los dos equipos con VS y cada jugador con avatar y puesto, sin %', () => {
    renderSheet()
    const sheet = screen.getByRole('group', { name: 'Blancos contra Negros' })
    expect(within(sheet).getByText('VS')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Blancos' })).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Negros' })).toBeInTheDocument()
    expect(sheet).not.toHaveTextContent('%') // sin probabilidad de victoria: la ve todo el grupo
    expect(within(sheet).getByText('Portero')).toBeInTheDocument()
    expect(within(sheet).getByText('Delantero')).toBeInTheDocument()
    expect(within(sheet).getByText('—')).toBeInTheDocument()
    // Con permiso de uso: cada jugador lleva el logo de La Vaca como avatar.
    expect(sheet.querySelectorAll('img.vf-cow[src="/lavaca-256.png"]')).toHaveLength(3)
  })

  it('Copiar imagen genera el PNG y lo copia', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar imagen' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Imagen copiada')
    expect(share.copyImage).toHaveBeenCalledOnce()
  })

  it('Compartir usa la hoja nativa; si descarga, lo avisa', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(share.shareImage).toHaveBeenCalledWith(expect.any(Blob), 'equipos.png', '⚽ texto')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    share.shareImage.mockResolvedValueOnce('downloaded')
    await userEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Imagen descargada')
  })

  it('cancelar la hoja no es un error; otros errores se muestran', async () => {
    renderSheet()
    share.shareImage.mockRejectedValueOnce(new DOMException('x', 'AbortError'))
    await userEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    share.renderPng.mockRejectedValueOnce(new Error('No se pudo generar la imagen.'))
    await userEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo generar la imagen.')
    share.renderPng.mockRejectedValueOnce('raro')
    await userEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo compartir.')
  })

  it('sin soporte de portapapeles para imágenes, no ofrece Copiar', () => {
    share.canCopyImages.mockReturnValueOnce(false)
    renderSheet()
    expect(screen.queryByRole('button', { name: 'Copiar imagen' })).not.toBeInTheDocument()
  })

  it('sin imagen, cae a la vaca SVG propia', async () => {
    const { TeamSheet } = await import('./components/TeamSheet')
    const { container } = render(<TeamSheet heading="h" teams={TEAMS} />)
    expect(container.querySelectorAll('svg.vf-cow')).toHaveLength(3)
  })
})
