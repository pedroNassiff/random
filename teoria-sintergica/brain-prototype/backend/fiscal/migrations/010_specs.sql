-- Specs de módulos aprobadas desde NEO (spec: NEO constructor del dashboard § La spec aprobada queda guardada).
-- Cada cambio aprobado es una fila nueva con la versión siguiente; no se pisa ni se borra. Idempotente.

CREATE TABLE IF NOT EXISTS fiscal.specs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    modulo      text NOT NULL CHECK (length(modulo) BETWEEN 1 AND 80),
    contenido   text NOT NULL CHECK (length(contenido) BETWEEN 1 AND 20000),
    version     integer NOT NULL CHECK (version >= 1),
    estado      text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente')),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS specs_owner_modulo_version ON fiscal.specs (owner_id, lower(modulo), version);

-- NEO la lee con consultar_bd, como las demás tablas de 009: solo sus filas.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neo_reader') THEN
        GRANT SELECT ON fiscal.specs TO neo_reader;
    END IF;
END
$$;
ALTER TABLE fiscal.specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_all ON fiscal.specs;
DO $$
BEGIN
    EXECUTE format('CREATE POLICY app_all ON fiscal.specs TO %I USING (true) WITH CHECK (true)', current_user);
END
$$;
DROP POLICY IF EXISTS neo_owner ON fiscal.specs;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neo_reader') THEN
        CREATE POLICY neo_owner ON fiscal.specs FOR SELECT TO neo_reader USING (owner_id = fiscal.neo_owner());
    END IF;
END
$$;
