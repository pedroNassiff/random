export interface Me {
  email: string
  has_password: boolean
  apps: string[]
}

export type RegimenIva = 'general' | 'recargo_equivalencia' | 'exento'
export type RegimenIrpf = 'directa_simplificada' | 'directa_normal' | 'objetiva'

export interface ProfileInput {
  nif: string
  fecha_alta: string
  iae: string
  regimen_iva: RegimenIva
  regimen_irpf: RegimenIrpf
  roi: boolean
  tarifa_plana_hasta: string | null
  domicilio_fiscal: string
  municipio: string
  comunidad: string
}

export interface Profile extends ProfileInput {
  version: number
}

export type Estado = 'pendiente' | 'preparado' | 'presentado' | 'pagado'
export type Aviso = 'sin_aviso' | 'T-15' | 'T-5' | 'T-1' | 'T' | 'vencida'

export interface CalendarItem {
  key: string
  modelo: string
  ejercicio: number
  periodo: string
  titulo: string
  vence: string
  vence_nominal: string
  provisional: boolean
  condicional: boolean
  nota: string
  fuente: string
  estado: Estado
  justificante: string | null
  aviso: Aviso
  dias_restantes: number
}

export interface CalendarView {
  hoy: string
  festivos_cargados: number[]
  items: CalendarItem[]
}

export type DeadlineKind = 'dias_habiles' | 'apremio'

export interface DeadlineInput {
  tipo: DeadlineKind
  fecha_notificacion: string
  dias?: number
}

export interface DeadlineResult {
  vence: string
  fuente: string
  traza: string[]
}

export interface StatusPayload {
  key: string
  estado: Estado
  justificante: string | null
}

interface ProposalBase {
  id: string
  titulo: string
  detalle: string[]
}

export interface InvoiceInput {
  serie: string
  numero: number
  fecha: string
  fecha_devengo: string | null
  cliente: string
  cliente_pais: string
  cliente_tax_id: string | null
  cliente_empresa: boolean
  concepto: string
  moneda: string
  importe: string
  tipo_cambio: string
  tipo_iva: string
  retencion_pct: string
  mencion: string
  documento_id: string | null
}

export type Operacion = 'nacional' | 'intracomunitaria' | 'extracomunitaria'

export interface Invoice extends InvoiceInput {
  id: string
  fecha_devengo: string
  trimestre: number
  anulada: boolean
  operacion: Operacion
  base: string
  cuota_iva: string
  retencion: string
  total: string
  observaciones: string[]
}

export interface InvoiceList {
  ejercicio: number
  invoices: Invoice[]
  numeracion: string[]
}

export interface OperationTotal {
  operacion: Operacion
  casillas: string
  base: string
  cuota_iva: string
  retencion: string
  facturas: string[]
}

export interface QuarterSummary {
  ejercicio: number
  trimestre: number
  operaciones: OperationTotal[]
  clientes_ue: { tax_id: string; cliente: string; base: string }[]
  con_observaciones: number
}

/** Cambio que el agente propone y la persona guarda, rehace o descarta. El agente nunca escribe. */
export type Proposal =
  | (ProposalBase & { kind: 'profile'; payload: ProfileInput })
  | (ProposalBase & { kind: 'status'; payload: StatusPayload })
  | (ProposalBase & { kind: 'invoice'; payload: InvoiceInput })
  | (ProposalBase & { kind: 'client'; payload: ClientInput & { id: string | null } })

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AgentReply {
  reply: string
  proposals: Proposal[]
}

/** Documento adjunto a un mensaje del chat: va al agente en ese pedido y no se guarda. */
export interface ChatAttachment {
  name: string
  media_type: string
  data: string
}

export interface StoredDocument {
  id: string
  name: string
  media_type: string
  size_bytes: number
  created_at: string
}

export interface OnboardingStep {
  clave: string
  titulo: string
  estado: 'hecho' | 'pendiente' | 'opcional'
  documento: string
  completa: string
  detalle: string
}

export interface Onboarding {
  pasos: OnboardingStep[]
  siguiente: string | null
}

export type ProposalStatus = 'pendiente' | 'guardando' | 'guardada' | 'descartada'

export interface ProposalState {
  proposal: Proposal
  status: ProposalStatus
  error: string | null
}

/** Una línea del chat con NEO. Es lo que se guarda como historial. */
export interface ChatEntry {
  id: number
  /** `event` = acción de la persona sobre una propuesta; NEO la lee como contexto. */
  kind: 'user' | 'assistant' | 'event'
  text: string
  /** Nombres de los documentos adjuntos al mensaje. */
  files: string[]
  proposals: ProposalState[]
}

export type ClientType = 'empresa' | 'autonomo' | 'particular'

export interface ClientInput {
  nombre: string
  pais: string
  tipo: ClientType
  tax_id: string | null
  direccion: string
  email: string | null
  moneda: string
  retencion_pct: string
  dias_pago: number | null
  vinculada: boolean
  notas: string
}

export interface Client extends ClientInput {
  id: string
  codigo: number
  activo: boolean
  vies_ok: boolean | null
  vies_checked_at: string | null
  vies_nombre: string | null
  operacion: Operacion
  mencion: string
  casillas: string
  requiere_vies: boolean
  observaciones: string[]
}

export interface CategoryRow {
  categoria: string
  valores: string[]
  total: string
  promedio: string
  variacion: string | null
  conceptos: string[]
}

export interface MovementSummary {
  meses: string[]
  filas: CategoryRow[]
  totales: string[]
  total: string
  personas: string[]
}

export interface ImportResult {
  nuevos: number
  actualizados: number
  movimientos: number
  desde: string
  hasta: string
  meses: number
  omitidas: string[]
  dudosos: string[]
  descuadres: string[]
}
