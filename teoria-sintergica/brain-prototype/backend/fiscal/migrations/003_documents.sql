-- Documentos subidos al chat del agente (036, resoluciones, justificantes, notificaciones).
-- El contenido vive en el bucket (o en disco en local); acá solo los metadatos. Idempotente.
-- Un mismo archivo (mismo sha256) de un mismo owner se guarda una sola vez.

CREATE TABLE IF NOT EXISTS fiscal.documents (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    name         text NOT NULL,
    media_type   text NOT NULL,
    size_bytes   integer NOT NULL CHECK (size_bytes > 0),
    sha256       text NOT NULL CHECK (length(sha256) = 64),
    storage_key  text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_owner ON fiscal.documents (owner_id, created_at DESC);
