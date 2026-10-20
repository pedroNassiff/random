-- Facturas emitidas (ledger de ingresos). Idempotente.
-- Append-only: una factura no se edita ni se borra. Un registro cargado por error se marca `anulada`;
-- una factura emitida con errores se corrige con una rectificativa (otra fila).
-- Sin UNIQUE sobre el número: el registro refleja lo realmente emitido, incluidos duplicados, y el
-- dominio los señala como incidencia.

CREATE TABLE IF NOT EXISTS fiscal.invoices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    serie            text NOT NULL DEFAULT '',
    numero           integer NOT NULL CHECK (numero >= 1),
    fecha            date NOT NULL,
    fecha_devengo    date NOT NULL,
    cliente          text NOT NULL,
    cliente_pais     text NOT NULL CHECK (length(cliente_pais) = 2),
    cliente_tax_id   text,
    cliente_empresa  boolean NOT NULL DEFAULT true,
    concepto         text NOT NULL,
    moneda           text NOT NULL CHECK (length(moneda) = 3),
    importe          numeric(14, 2) NOT NULL CHECK (importe > 0),
    tipo_cambio      numeric(14, 6) NOT NULL CHECK (tipo_cambio > 0),
    tipo_iva         numeric(5, 2) NOT NULL,
    retencion_pct    numeric(5, 2) NOT NULL,
    mencion          text NOT NULL DEFAULT '',
    documento_id     uuid REFERENCES fiscal.documents(id) ON DELETE SET NULL,
    anulada          boolean NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_owner ON fiscal.invoices (owner_id, fecha_devengo);
