-- Lectura directa de NEO (spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Producción).
-- Usuario propio `neo_reader` con su propia conexión (NEO_DATABASE_URL): solo SELECT, solo filas del dueño
-- (RLS), sin el NIF del perfil ni el schema `futbol` (credenciales). Idempotente.
--
-- Usuario propio y no SET ROLE desde la conexión de la app: con SET ROLE, la consulta de NEO puede volver al
-- rol de la app con set_config('role', session_user, true) y leer lo que quiera con query_to_xml().
-- Por lo mismo, el dueño no viaja en una variable de sesión: la app lo escribe en `neo_sessions` (por pid de
-- la conexión de NEO), NEO no puede leerla ni escribirla, y la política lo consulta con SECURITY DEFINER.
--
-- El rol nace sin contraseña (no puede entrar): el runner de migraciones le pone la de NEO_DATABASE_URL.
-- No se crea con google_sql_user porque Cloud SQL lo haría miembro de cloudsqlsuperuser.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neo_reader') THEN
        CREATE ROLE neo_reader;
    END IF;
END
$$;
ALTER ROLE neo_reader LOGIN NOINHERIT CONNECTION LIMIT 5;
ALTER ROLE neo_reader SET default_transaction_read_only = on;
ALTER ROLE neo_reader SET statement_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiscal.neo_sessions (
    pid       int  PRIMARY KEY,
    owner_id  uuid NOT NULL
);

CREATE OR REPLACE FUNCTION fiscal.neo_owner() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT owner_id FROM fiscal.neo_sessions WHERE pid = pg_backend_pid() $$;
REVOKE ALL ON FUNCTION fiscal.neo_owner() FROM PUBLIC;
GRANT USAGE ON SCHEMA fiscal TO neo_reader;
GRANT EXECUTE ON FUNCTION fiscal.neo_owner() TO neo_reader;

-- Festivos: datos de referencia compartidos, sin dueño.
GRANT SELECT ON fiscal.holidays TO neo_reader;

-- Perfil sin el NIF: ver_perfil ya lo da enmascarado.
GRANT SELECT (id, owner_id, version, fecha_alta, iae, regimen_iva, regimen_irpf, roi, tarifa_plana_hasta,
              domicilio_fiscal, municipio, comunidad, created_at)
    ON fiscal.tax_profiles TO neo_reader;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['tax_profiles', 'obligation_status', 'documents', 'invoices', 'chat_messages',
                             'clients', 'movements']
    LOOP
        IF t <> 'tax_profiles' THEN
            EXECUTE format('GRANT SELECT ON fiscal.%I TO neo_reader', t);
        END IF;
        EXECUTE format('ALTER TABLE fiscal.%I ENABLE ROW LEVEL SECURITY', t);
        -- La app sigue viendo todo aunque no sea dueña de la tabla (en Cloud SQL lo es, pero no se asume).
        EXECUTE format('DROP POLICY IF EXISTS app_all ON fiscal.%I', t);
        EXECUTE format('CREATE POLICY app_all ON fiscal.%I TO %I USING (true) WITH CHECK (true)', t, current_user);
        EXECUTE format('DROP POLICY IF EXISTS neo_owner ON fiscal.%I', t);
        EXECUTE format(
            'CREATE POLICY neo_owner ON fiscal.%I FOR SELECT TO neo_reader USING (owner_id = fiscal.neo_owner())', t
        );
    END LOOP;
END
$$;
