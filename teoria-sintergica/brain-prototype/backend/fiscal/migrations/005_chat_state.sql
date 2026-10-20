-- Conversación con NEO, una por persona: se guarda como una instantánea (mensajes, adjuntos por nombre
-- y propuestas con su estado) para que el chat siga donde quedó al recargar. Idempotente.

CREATE TABLE IF NOT EXISTS fiscal.chat_state (
    owner_id    uuid PRIMARY KEY REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    entries     jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
