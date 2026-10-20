-- Historial del chat con NEO como filas, para traerlo por bloques (lo más reciente primero y lo viejo
-- al hacer scroll). Reemplaza la instantánea de 005, que obligaba a cargar y guardar todo junto.
-- Idempotente. Una conversación por persona en este MVP; `conversation_id` queda para cuando haya varias.

CREATE TABLE IF NOT EXISTS fiscal.chat_messages (
    id               bigserial PRIMARY KEY,
    owner_id         uuid NOT NULL REFERENCES futbol.app_users(id) ON DELETE CASCADE,
    conversation_id  integer NOT NULL DEFAULT 1,
    kind             text NOT NULL CHECK (kind IN ('user', 'assistant', 'event')),
    text             text NOT NULL,
    files            jsonb NOT NULL DEFAULT '[]'::jsonb,
    proposals        jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_chat_messages_owner ON fiscal.chat_messages (owner_id, conversation_id, id DESC);

DROP TABLE IF EXISTS fiscal.chat_state;
