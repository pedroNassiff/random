/** Compartir texto e imágenes (spec §7): Web Share API, portapapeles y fallbacks. */

/** Ancho fijo de la imagen: se ve igual aunque el admin la genere desde el celular. */
export const IMAGE_WIDTH = 720
const DESKTOP_WIDTH = 1200

export async function renderPng(node: HTMLElement): Promise<Blob> {
  // Carga diferida: html2canvas (~48 kB gz) solo se baja al generar una imagen.
  const { default: html2canvas } = await import('html2canvas')
  await document.fonts?.ready // sin las fuentes cargadas, el texto sale con otra métrica
  // Tailwind (preflight) pone `img { display: block }`. html2canvas mide la línea base con un <img> en el
  // documento ORIGINAL (no en la copia) y, con ese estilo, dibuja el texto corrido hacia abajo.
  const fix = document.createElement('style')
  fix.textContent = 'img { display: inline-block !important; }'
  document.head.appendChild(fix)
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: null,
      // Se renderiza "como escritorio": las media queries móviles no afectan a la imagen.
      windowWidth: DESKTOP_WIDTH,
      onclone: (_doc, el) => {
        el.style.width = `${IMAGE_WIDTH}px`
      },
    })
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))),
        'image/png',
      ),
    )
  } finally {
    fix.remove()
  }
}

export function canCopyImages(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
}

/** Se pasa la promesa (no el blob) para que Safari conserve el gesto del usuario. */
export async function copyImage(png: Promise<Blob>): Promise<void> {
  if (!canCopyImages()) throw new Error('Este navegador no deja copiar imágenes. Usá Compartir o Descargar.')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Móvil: hoja de compartir nativa con el PNG (WhatsApp aparece ahí). Si no se puede, descarga. */
export async function shareImage(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text })
    return 'shared'
  }
  download(blob, filename)
  return 'downloaded'
}

export async function shareText(text: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    await navigator.share({ text })
    return
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

/** El usuario cerró la hoja de compartir: no es un error. */
export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError'
