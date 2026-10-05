-- Clientes. A diferencia de las facturas, un cliente se edita (cambia de domicilio, de email…);
-- no se borra: se archiva, para no perder el rastro de a quién se facturó. Idempotente.

CREATE TABLE IF NOT EXISTS fiscal.clients (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    codigo           integer NOT NULL CHECK (codigo >= 1),
    nombre           text NOT NULL,
    pais             text NOT NULL CHECK (length(pais) = 2),
    tipo             text NOT NULL CHECK (tipo IN ('empresa', 'autonomo', 'particular')),
    tax_id           text,
    direccion        text NOT NULL DEFAULT '',
    email            text,
    moneda           text NOT NULL DEFAULT 'EUR' CHECK (length(moneda) = 3),
    retencion_pct    numeric(5, 2) NOT NULL DEFAULT 0,
    dias_pago        integer,
    vinculada        boolean NOT NULL DEFAULT false,
    notas            text NOT NULL DEFAULT '',
    vies_ok          boolean,
    vies_checked_at  timestamptz,
    vies_nombre      text,
    activo           boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, codigo)
);
