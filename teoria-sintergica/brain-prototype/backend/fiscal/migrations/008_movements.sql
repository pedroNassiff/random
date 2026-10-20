-- Ingresos y gastos (movimientos mensuales), importados de la planilla o cargados después. Idempotente.
-- `fuente_ref` identifica la fila en el origen: reimportar actualiza en vez de duplicar.

CREATE TABLE IF NOT EXISTS fiscal.movements (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    mes         date NOT NULL CHECK (extract(day FROM mes) = 1),
    tipo        text NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
    persona     text NOT NULL,
    concepto    text NOT NULL,
    categoria   text NOT NULL,
    importe     numeric(14, 2) NOT NULL,
    moneda      text NOT NULL DEFAULT 'EUR',
    fuente      text NOT NULL DEFAULT '',
    fuente_ref  text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, fuente_ref)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_movements_owner ON fiscal.movements (owner_id, mes);
