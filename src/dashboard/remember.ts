/** "Recordarme": guarda solo el email en este navegador. La contraseña nunca se guarda acá: de eso se
 * encarga el gestor de contraseñas del navegador, y la sesión dura 30 días. */
const KEY = 'rdash:email'

export function rememberedEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return '' // almacenamiento bloqueado (modo privado, políticas del navegador)
  }
}

export function rememberEmail(email: string | null): void {
  try {
    if (email) localStorage.setItem(KEY, email)
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: no se recuerda, el login funciona igual */
  }
}

const TOUR_KEY = 'rdash:guia-vista'

/** La guía de primer ingreso se muestra una vez por navegador (y solo si todavía no hay perfil). */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, '1')
  } catch {
    /* sin almacenamiento: la guía puede volver a aparecer, nada más */
  }
}
