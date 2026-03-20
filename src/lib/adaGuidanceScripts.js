/**
 * adaGuidanceScripts — Frases de guía adaptativa por estado EEG.
 *
 * ADA selecciona la frase según el estado del practicante.
 * Cada categoría tiene múltiples opciones para variar entre intervenciones.
 *
 * Estados EEG → modo ADA:
 *   onset      α < 0.08              → construyendo calma
 *   building   α 0.08–0.13           → camino a meditación
 *   meditation α 0.13–0.25           → meditación establecida
 *   deep       α ≥ 0.25              → zona sintérgica
 *   wandering  β > 0.10 || α < 0.05  → mente dispersa
 *   return     (tras wandering)      → retorno guiado
 */

export const GUIDANCE = {
  // ── Apertura (primera intervención de la sesión) ─────────────────────────
  opening: [
    'Bienvenido. Encuentra tu postura.',
    'Aquí. Ahora. Sin ir a ningún lugar.',
    'La respiración te recibe. Deja que entre.',
  ],

  // ── Onset: alpha bajo, construyendo ──────────────────────────────────────
  onset: [
    'El ruido se asienta. Dale tiempo.',
    'Cada respiración acerca la calma.',
    'No hay prisa. El cuerpo sabe.',
    'Observa sin cambiar nada.',
    'El silencio llega por sí solo.',
  ],

  // ── Building: alpha subiendo ──────────────────────────────────────────────
  building: [
    'Alpha subiendo. El campo despierta.',
    'Vas encontrando el camino.',
    'Deja que llegue. No lo busques.',
    'El hacedor se asienta. Quédate.',
    'Algo se aquieta. Sigue aquí.',
  ],

  // ── Meditation: zona establecida ──────────────────────────────────────────
  meditation: [
    'Así.',
    'Meditación estable. Quédate.',
    'El campo sostiene. No hagas nada.',
    'Presencia clara. Sin esfuerzo.',
    'Aquí. Solo esto.',
  ],

  // ── Deep / sintérgico: α ≥ 0.25 + coh ≥ 0.75 ────────────────────────────
  deep: [
    'Aquí. Esto.',
    // Silencio total es lo óptimo en este estado — usar con moderación
  ],

  // ── Mind-wandering detectado ──────────────────────────────────────────────
  wandering: [
    'Vuelve.',
    'La respiración.',
    'Suelta ese hilo.',
    'El cuerpo sabe. Vuelve a él.',
    'Aquí.',
    'Solo este momento.',
  ],

  // ── Retorno después de wandering ─────────────────────────────────────────
  return: [
    'De vuelta. Bien.',
    'El retorno también es práctica.',
    'Cada vez que vuelves, el lattice se fortalece.',
  ],

  // ── Cierre de sesión ──────────────────────────────────────────────────────
  closing: [
    'Regresa lentamente. Sin prisa.',
    'Lleva esta calma contigo.',
    'La sesión termina. El trabajo continúa.',
  ],
}

// Índices para rotar frases sin repetir la misma dos veces seguidas
const _lastIndex = {}

/**
 * Devuelve una frase del estado dado, rotando para no repetir.
 * @param {string} state - clave de GUIDANCE
 * @returns {string}
 */
export function getGuidance(state) {
  const phrases = GUIDANCE[state] || GUIDANCE.onset
  if (phrases.length === 0) return ''
  if (phrases.length === 1) return phrases[0]

  const last = _lastIndex[state] ?? -1
  let next = Math.floor(Math.random() * phrases.length)
  if (next === last) next = (next + 1) % phrases.length
  _lastIndex[state] = next
  return phrases[next]
}

/**
 * Determina el estado de guía según métricas EEG.
 * @param {{ alpha: number, beta: number }} bands
 * @param {number} coherence
 * @param {boolean} wasWandering - si en intervención anterior era wandering
 * @returns {string} estado de guía
 */
export function classifyGuidanceState(bands = {}, coherence = 0, wasWandering = false) {
  const alpha = bands.alpha ?? 0
  const beta  = bands.beta  ?? 0

  const isWandering = beta > 0.10 || alpha < 0.05
  if (isWandering) return 'wandering'
  if (wasWandering) return 'return'

  if (alpha >= 0.25 && coherence >= 0.75) return 'deep'
  if (alpha >= 0.13) return 'meditation'
  if (alpha >= 0.08) return 'building'
  return 'onset'
}
