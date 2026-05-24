import os
from dotenv import load_dotenv

# Carga el .env del brain-prototype (misma base de datos, mismas keys)
_env_path = os.path.join(os.path.dirname(__file__), "../../../teoria-sintergica/brain-prototype/backend/.env")
load_dotenv(dotenv_path=_env_path)

POSTGRES_HOST     = os.getenv("SANJI_POSTGRES_HOST", "localhost")
POSTGRES_PORT     = int(os.getenv("SANJI_POSTGRES_PORT", 5432))
POSTGRES_DB       = os.getenv("SANJI_POSTGRES_DB", "sanji_rx")
POSTGRES_USER     = os.getenv("SANJI_POSTGRES_USER", "brain_user")
POSTGRES_PASSWORD = os.getenv("SANJI_POSTGRES_PASSWORD", "sintergic2024")

# Acepta tanto ANTHROPIC_API_KEY como CLAUDE_API_KEY (el nombre que usamos en el .env compartido)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
