import type { ChatAttachment } from './types'

export const MAX_FILES = 3
export const MAX_BYTES = 5 * 1024 * 1024
export const ACCEPT_DOCUMENT = 'application/pdf'
export const ACCEPT_IMAGE = 'image/png,image/jpeg,image/webp'
const ALLOWED = new Set([ACCEPT_DOCUMENT, ...ACCEPT_IMAGE.split(',')])

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`${file.name}: no se pudo leer el archivo.`))
    // readAsDataURL devuelve "data:<tipo>;base64,<contenido>": solo interesa el contenido.
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(file)
  })
}

/** Valida tipo y tamaño (las mismas reglas que el backend) y devuelve el archivo en base64. */
export async function readAttachment(file: File): Promise<ChatAttachment> {
  if (!ALLOWED.has(file.type))
    throw new Error(`${file.name}: solo se aceptan PDF e imágenes (PNG, JPG o WebP).`)
  if (file.size === 0) throw new Error(`${file.name}: el archivo está vacío.`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: pesa más de 5 MB.`)
  return { name: file.name, media_type: file.type, data: await toBase64(file) }
}
