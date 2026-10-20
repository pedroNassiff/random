import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_BYTES, readAttachment } from './attachments'
import { calendar, mockApi, PEDRO, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const pdf = (name = '036.pdf', body = '%PDF-1.4 hola') => new File([body], name, { type: 'application/pdf' })
const BASE = { 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([]) } }
const chatCalls = (calls: { key: string; body: unknown }[]) =>
  calls.filter((c) => c.key === 'POST /fiscal/agent/chat').map((c) => c.body as Record<string, unknown>)

async function openChat() {
  await userEvent.click(await screen.findByRole('button', { name: 'NEO' }))
  return screen.getByRole('region', { name: 'NEO, asistente fiscal' })
}

describe('readAttachment', () => {
  it('devuelve nombre, tipo y contenido en base64 sin el prefijo data:', async () => {
    expect(await readAttachment(pdf())).toEqual({
      name: '036.pdf',
      media_type: 'application/pdf',
      data: btoa('%PDF-1.4 hola'),
    })
  })

  it('rechaza tipos no admitidos, archivos vacíos y los que pesan más de 5 MB', async () => {
    await expect(readAttachment(new File(['x'], 'a.zip', { type: 'application/zip' }))).rejects.toThrow(
      'a.zip: solo se aceptan PDF e imágenes',
    )
    await expect(readAttachment(pdf('vacio.pdf', ''))).rejects.toThrow('vacio.pdf: el archivo está vacío.')
    const big = new File([new Uint8Array(MAX_BYTES + 1)], 'grande.pdf', { type: 'application/pdf' })
    await expect(readAttachment(big)).rejects.toThrow('grande.pdf: pesa más de 5 MB.')
  })

  it('informa si el navegador no puede leer el archivo', async () => {
    class Broken {
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.onerror?.()
      }
    }
    vi.stubGlobal('FileReader', Broken)
    await expect(readAttachment(pdf())).rejects.toThrow('036.pdf: no se pudo leer el archivo.')
  })
})

describe('adjuntos en el chat', () => {
  it('manda el documento con el mensaje y después solo lo menciona en el historial', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Leí tu 036.', proposals: [] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.upload(within(chat).getByLabelText('Adjuntar documento'), pdf())
    expect(await within(chat).findByText('036.pdf')).toBeInTheDocument()
    // Con un adjunto se puede enviar sin escribir nada.
    await userEvent.click(within(chat).getByRole('button', { name: 'Enviar' }))
    expect(await within(chat).findByText('Leí tu 036.')).toBeInTheDocument()
    expect(within(chat).getByText('Adjunto: 036.pdf')).toBeInTheDocument()
    expect(within(chat).queryByRole('button', { name: 'Quitar 036.pdf' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Mensaje para NEO'), 'gracias{Enter}')
    await waitFor(() => expect(chatCalls(calls)).toHaveLength(2))
    const [first, second] = chatCalls(calls)
    expect(first).toMatchObject({
      message: 'Te adjunto documentos.',
      attachments: [{ name: '036.pdf', media_type: 'application/pdf', data: btoa('%PDF-1.4 hola') }],
    })
    expect(second).toMatchObject({
      message: 'gracias',
      attachments: [],
      history: [
        { role: 'user', text: 'Te adjunto documentos.\n[Adjunto: 036.pdf]' },
        { role: 'assistant', text: 'Leí tu 036.' },
      ],
    })
  })

  it('hay un botón para documentos (PDF) y otro para imágenes, y la imagen viaja como imagen', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Veo la foto.', proposals: [] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    const docs = within(chat).getByLabelText('Adjuntar documento')
    const images = within(chat).getByLabelText('Adjuntar imagen')
    expect(docs).toHaveAttribute('accept', 'application/pdf')
    expect(images).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
    expect(docs.closest('label')).toHaveTextContent('D+')
    expect(images.closest('label')).toHaveTextContent('I+')

    const photo = new File(['\u00ff\u00d8\u00ff'], 'ticket.jpg', { type: 'image/jpeg' })
    await userEvent.upload(images, photo)
    await userEvent.upload(docs, pdf())
    expect(await within(chat).findByText('ticket.jpg')).toBeInTheDocument()
    await userEvent.click(within(chat).getByRole('button', { name: 'Enviar' }))
    expect(await within(chat).findByText('Veo la foto.')).toBeInTheDocument()
    const sent = chatCalls(calls)[0]?.attachments as { name: string; media_type: string }[]
    expect(sent.map((a) => [a.name, a.media_type])).toEqual([
      ['ticket.jpg', 'image/jpeg'],
      ['036.pdf', 'application/pdf'],
    ])
  })

  it('se puede quitar un adjunto antes de enviar', async () => {
    mockApi(BASE)
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.upload(within(chat).getByLabelText('Adjuntar documento'), [pdf('a.pdf'), pdf('b.pdf')])
    await userEvent.click(await within(chat).findByRole('button', { name: 'Quitar a.pdf' }))
    expect(within(chat).queryByText('a.pdf')).not.toBeInTheDocument()
    expect(within(chat).getByText('b.pdf')).toBeInTheDocument()
  })

  it('avisa si el archivo no sirve o si se pasan de tres, sin adjuntar nada', async () => {
    mockApi(BASE)
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    const input = within(chat).getByLabelText('Adjuntar documento')
    const empty = pdf('vacio.pdf', '')
    await userEvent.upload(input, empty)
    expect(await within(chat).findByRole('alert')).toHaveTextContent('vacio.pdf: el archivo está vacío.')
    await userEvent.upload(input, [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf'), pdf('4.pdf')])
    expect(await within(chat).findByRole('alert')).toHaveTextContent('hasta 3 archivos')
    expect(within(chat).queryByText('1.pdf')).not.toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('si el envío falla, el adjunto vuelve para reintentar', async () => {
    mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { status: 422, body: { detail: '036.pdf: el archivo llegó dañado.' } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.upload(within(chat).getByLabelText('Adjuntar documento'), pdf())
    await userEvent.click(await within(chat).findByRole('button', { name: 'Enviar' }))
    expect(await within(chat).findByRole('alert')).toHaveTextContent('el archivo llegó dañado')
    expect(within(chat).getByRole('button', { name: 'Quitar 036.pdf' })).toBeInTheDocument()
  })
})
