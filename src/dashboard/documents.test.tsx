import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, PEDRO, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }
const DOC = {
  id: 'd1',
  name: '036.pdf',
  media_type: 'application/pdf',
  size_bytes: 350_000,
  created_at: '2026-10-01T10:00:00+00:00',
}

describe('documentos', () => {
  it('sin documentos invita a adjuntar el 036 en el asistente', async () => {
    mockApi({ ...ME, 'GET /fiscal/documents': { body: [] } })
    renderApp('/dashboard/impuestos/documentos')
    expect(await screen.findByText(/Todavía no hay documentos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Documentos' })).toHaveAttribute(
      'href',
      '/dashboard/impuestos/documentos',
    )
  })

  it('lista nombre, fecha y tamaño, con enlace de descarga', async () => {
    mockApi({ ...ME, 'GET /fiscal/documents': { body: [DOC] } })
    renderApp('/dashboard/impuestos/documentos')
    expect(await screen.findByText('036.pdf')).toBeInTheDocument()
    expect(screen.getByText('Subido el jue, 01/10/2026 · 342 KB')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Descargar' })
    expect(link).toHaveAttribute('href', '/api/fiscal/documents/d1')
    expect(link).toHaveAttribute('download', '036.pdf')
  })

  it('eliminar pide confirmación y se puede cancelar', async () => {
    const calls = mockApi({ ...ME, 'GET /fiscal/documents': { body: [DOC] } })
    renderApp('/dashboard/impuestos/documentos')
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar 036.pdf' }))
    expect(screen.getByRole('button', { name: 'Sí, eliminar 036.pdf' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Eliminar 036.pdf' })).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false)
  })

  it('al confirmar borra el documento y recarga la lista', async () => {
    let deleted = false
    const calls = mockApi({
      ...ME,
      'GET /fiscal/documents': () => ({ body: deleted ? [] : [DOC] }),
      'DELETE /fiscal/documents/d1': () => {
        deleted = true
        return { status: 204 }
      },
    })
    renderApp('/dashboard/impuestos/documentos')
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar 036.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 036.pdf' }))
    expect(await screen.findByText(/Todavía no hay documentos/)).toBeInTheDocument()
    expect(calls.filter((c) => c.key === 'DELETE /fiscal/documents/d1')).toHaveLength(1)
  })

  it('muestra el error si no se puede borrar o cargar', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/documents': { body: [DOC] },
      'DELETE /fiscal/documents/d1': { status: 404, body: { detail: 'Ese documento no existe.' } },
    })
    const first = renderApp('/dashboard/impuestos/documentos')
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar 036.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar 036.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese documento no existe.')
    expect(screen.getByText('036.pdf')).toBeInTheDocument()
    first.unmount()

    mockApi({ ...ME, 'GET /fiscal/documents': { status: 500, body: { detail: 'Se cayó la base.' } } })
    renderApp('/dashboard/impuestos/documentos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
  })

  it('un documento adjuntado en el chat aparece en la lista sin recargar', async () => {
    let stored = false
    mockApi({
      ...ME,
      'GET /fiscal/documents': () => ({ body: stored ? [DOC] : [] }),
      'POST /fiscal/agent/chat': () => {
        stored = true
        return { body: { reply: 'Leí tu 036.', proposals: [] } }
      },
    })
    renderApp('/dashboard/impuestos/documentos')
    await screen.findByText(/Todavía no hay documentos/)
    await userEvent.click(screen.getByRole('button', { name: 'NEO' }))
    const chat = screen.getByRole('region', { name: 'NEO, asistente fiscal' })
    const file = new File(['%PDF-1.4 hola'], '036.pdf', { type: 'application/pdf' })
    await userEvent.upload(within(chat).getByLabelText('Adjuntar documento'), file)
    await userEvent.click(await within(chat).findByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('link', { name: 'Descargar' })).toBeInTheDocument()
  })
})
