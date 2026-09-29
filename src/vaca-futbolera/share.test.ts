import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('html2canvas', () => ({
  default: vi.fn(async (_node: HTMLElement, opts: { onclone: (d: Document, el: HTMLElement) => void }) => {
    const clone = document.createElement('div')
    opts.onclone(document, clone)
    return {
      toBlob: (cb: (b: Blob | null) => void) => cb(clone.style.width === '720px' ? new Blob(['png']) : null),
    }
  }),
}))

import { canCopyImages, copyImage, download, isAbort, renderPng, shareImage, shareText } from './share'

const png = new Blob(['png'], { type: 'image/png' })

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('share', () => {
  it('renderPng captura el nodo a ancho fijo', async () => {
    await expect(renderPng(document.createElement('div'))).resolves.toBeInstanceOf(Blob)
  })

  it('copyImage usa el portapapeles cuando existe y falla claro si no', async () => {
    vi.stubGlobal('ClipboardItem', undefined)
    expect(canCopyImages()).toBe(false)
    await expect(copyImage(Promise.resolve(png))).rejects.toThrow('no deja copiar imágenes')

    const write = vi.fn(async () => undefined)
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(readonly items: Record<string, unknown>) {}
      },
    )
    vi.stubGlobal('navigator', { ...navigator, clipboard: { write } })
    expect(canCopyImages()).toBe(true)
    await copyImage(Promise.resolve(png))
    expect(write).toHaveBeenCalledOnce()
  })

  it('shareImage usa la hoja nativa si acepta archivos; si no, descarga', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    await expect(shareImage(png, 'equipos.png', 'txt')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: 'txt' }))

    vi.stubGlobal('navigator', { ...navigator, canShare: () => false })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await expect(shareImage(png, 'equipos.png', 'txt')).resolves.toBe('downloaded')
    expect(click).toHaveBeenCalledOnce()
  })

  it('download crea un link temporal con el nombre del archivo', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('a.png')
    })
    download(png, 'a.png')
    expect(click).toHaveBeenCalledOnce()
  })

  it('shareText usa Web Share o cae a wa.me', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    await shareText('hola')
    expect(share).toHaveBeenCalledWith({ text: 'hola' })

    vi.stubGlobal('navigator', { ...navigator, share: undefined })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await shareText('⚽ hola y chau')
    expect(open).toHaveBeenCalledWith('https://wa.me/?text=%E2%9A%BD%20hola%20y%20chau', '_blank', 'noopener')
  })

  it('isAbort reconoce cuando el usuario cierra la hoja de compartir', () => {
    expect(isAbort(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isAbort(new Error('x'))).toBe(false)
  })
})
