-- Gestor Autónomo — schema inicial (perfil fiscal, festivos y estado de obligaciones).
-- Spec: docs/sistema-agente-tributario.md. Idempotente. Vive en el schema `fiscal` de la BBDD de Random.
-- Los usuarios son los de la sesión compartida (futbol.app_users); cada fila pertenece a un owner.

CREATE SCHEMA IF NOT EXISTS fiscal;

-- Versionado: cada cambio del 036 crea una versión nueva. Nunca se hace UPDATE.
CREATE TABLE IF NOT EXISTS fiscal.tax_profiles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    version             int  NOT NULL CHECK (version >= 1),
    nif                 text NOT NULL,
    fecha_alta          date NOT NULL,
    iae                 text NOT NULL,
    regimen_iva         text NOT NULL CHECK (regimen_iva IN ('general', 'recargo_equivalencia', 'exento')),
    regimen_irpf        text NOT NULL CHECK (regimen_irpf IN ('directa_simplificada', 'directa_normal', 'objetiva')),
    roi                 boolean NOT NULL DEFAULT false,
    tarifa_plana_hasta  date,
    domicilio_fiscal    text NOT NULL,
    municipio           text NOT NULL,
    comunidad           text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, version)
);

-- Festivos por ejercicio y territorio ('ES' = nacional, comunidad autónoma, municipio).
-- Cambiar de ejercicio es cargar filas, no desplegar código.
CREATE TABLE IF NOT EXISTS fiscal.holidays (
    day         date NOT NULL,
    territorio  text NOT NULL,
    nombre      text NOT NULL,
    PRIMARY KEY (day, territorio)
);

-- El calendario se genera; solo se persiste el estado de cada obligación (clave determinista,
-- p. ej. '303-2026-3T'). Cerrar (presentado/pagado) exige justificante.
CREATE TABLE IF NOT EXISTS fiscal.obligation_status (
    owner_id      uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    key           text NOT NULL,
    estado        text NOT NULL CHECK (estado IN ('pendiente', 'preparado', 'presentado', 'pagado')),
    justificante  text,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, key),
    CHECK (estado NOT IN ('presentado', 'pagado') OR justificante IS NOT NULL)
);
