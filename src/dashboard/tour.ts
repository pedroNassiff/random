import type { Onboarding } from './types'

export interface TourStep {
  title: string
  body: string
  /** Valor de `data-tour` del elemento que se señala; sin target el paso es solo el cartel central. */
  target?: string
  /** Texto de la etiqueta que señala al elemento. */
  hint?: string
  tag?: string
}

/** Dónde se hace cada paso de la puesta en marcha y cómo se señala. */
const PLACES: Record<string, { target: string; hint: string }> = {
  perfil: { target: 'perfil', hint: 'Acá queda tu perfil fiscal' },
  tarifa_plana: { target: 'perfil', hint: 'La tarifa plana se guarda en tu perfil' },
  facturas: { target: 'facturas', hint: 'Acá se cargan tus facturas' },
  justificantes: { target: 'calendario', hint: 'Acá cerrás cada obligación con su justificante' },
  notificaciones: { target: 'plazos', hint: 'Acá calculás el plazo de una notificación' },
}
const TAGS = { hecho: 'Hecho', pendiente: 'Pendiente', opcional: 'Opcional' }

/** Guía de primer ingreso: bienvenida, un paso por cada cosa a cargar y cierre que abre a NEO. */
export function tourSteps(onboarding: Onboarding): TourStep[] {
  const first = onboarding.pasos.find((p) => p.clave === onboarding.siguiente)
  const steps: TourStep[] = [
    {
      title: 'Armemos tu base fiscal',
      body:
        'No hace falta rellenar formularios: en cada paso subís un documento y NEO, tu asistente, completa los ' +
        'datos por vos. ' +
        (first ? `Lo primero que necesitamos: ${first.documento}.` : 'Te muestro dónde está cada cosa.'),
    },
  ]
  for (const p of onboarding.pasos) {
    const place = PLACES[p.clave]
    if (!place) continue
    steps.push({
      title: p.titulo,
      body: `Documento: ${p.documento}. Con eso se completa ${p.completa}.${p.detalle ? ` ${p.detalle}` : ''}`,
      target: place.target,
      hint: place.hint,
      tag: TAGS[p.estado],
    })
  }
  steps.push({
    title: 'Empezá con NEO',
    body:
      'Al cerrar esta guía se abre NEO. Adjuntale el documento del primer paso: él lo lee, te propone los datos ' +
      'y vos decidís si se guardan.',
    target: 'neo',
    hint: 'NEO: acá adjuntás tus documentos',
  })
  return steps
}
