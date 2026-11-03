"""Lo que se le pide al agente del builder. Los límites los impone el hook; acá van el qué y el cómo."""

from __future__ import annotations

from builder.domain.policy import BACKEND

MAX_REPORT = 15_000

_RULES = f"""\
Cómo trabajar:
- Leé primero CLAUDE.md y el módulo Specs como modelo de referencia: {BACKEND}/fiscal/domain/specs.py, \
fiscal/application/specs.py, fiscal/infrastructure/pg_specs.py y api_specs.py, la migración \
fiscal/migrations/010_specs.sql, y en el front src/dashboard/pages/SpecsPage.tsx con su test.
- El módulo va dentro del paquete `fiscal` (domain, application, infrastructure) y su migración en \
{BACKEND}/fiscal/migrations con el número siguiente. La migración es aditiva e idempotente, le da SELECT a \
neo_reader y activa RLS por dueño como la 010. Registrá el módulo en MODULOS \
(fiscal/application/builder_tools.py) para que aparezca en ver_modulos.
- En el front: página en src/dashboard/pages, ruta en routes.ts y Dashboard.tsx, entrada en Sidebar.tsx.
- Escribí primero los tests (pytest y vitest) a partir de los escenarios de la spec, y después la \
migración, el backend y el frontend.
- Corré vos los tests y los linters mientras trabajás. Al terminar, el builder corre la gauntlet completa.
- No hagas commit ni push: el builder commitea y abre el PR cuando la gauntlet pasa.
- No toques .github, infra ni archivos .env. No borres ni renombres tablas o columnas existentes.
- Si la spec es ambigua en algo que cambia el modelo de datos, elegí lo más simple y dejalo anotado en tu \
resumen final.
- Terminá con un resumen corto: qué archivos creaste o cambiaste y qué decisiones tomaste."""


def build_prompt(modulo: str, version: int, contenido: str) -> str:
    return (
        f"Construí el módulo «{modulo}» del dashboard de Random según su spec aprobada (versión {version}).\n\n"
        f"<spec>\n{contenido}\n</spec>\n\n{_RULES}"
    )


def fix_prompt(attempt: int, max_attempts: int, report: str) -> str:
    tail = report[-MAX_REPORT:]
    return (
        f"La gauntlet falló (intento {attempt} de {max_attempts}). Corregí el código para que pase, sin "
        f"relajar ningún gate ni borrar tests. Este es el final de la salida:\n\n{tail}"
    )
