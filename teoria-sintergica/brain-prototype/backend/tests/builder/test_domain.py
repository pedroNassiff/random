"""Builder local: reglas puras (nombres, límites del agente, migraciones destructivas, tracks y prompts).

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Builder local.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from builder.domain.migrations import destructive_statements
from builder.domain.naming import branch_for, slugify
from builder.domain.policy import BACKEND, denial
from builder.domain.prompts import build_prompt, fix_prompt
from builder.domain.tracks import tracks_for

ROOT = Path("/tmp/neo-builds/finanzas-familiares")


# ── nombres ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("modulo", "slug"),
    [
        ("Finanzas familiares", "finanzas-familiares"),
        ("  Proyectos  ", "proyectos"),
        ("I+D & Prototipos", "i-d-prototipos"),
        ("Ñandú Économie", "nandu-economie"),
    ],
)
def test_slug_and_branch(modulo: str, slug: str) -> None:
    assert slugify(modulo) == slug
    assert branch_for(modulo) == f"neo/{slug}"


def test_a_module_without_letters_has_no_slug() -> None:
    with pytest.raises(ValueError, match="nombre"):
        slugify("¿¿??")


# ── límites del agente ───────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("tool", "args"),
    [
        ("Read", {"file_path": f"{ROOT}/{BACKEND}/fiscal/domain/specs.py"}),
        ("Read", {"file_path": "src/dashboard/types.ts"}),
        ("Write", {"file_path": f"{ROOT}/{BACKEND}/fiscal/domain/finanzas.py", "content": "x"}),
        ("Edit", {"file_path": f"{ROOT}/src/dashboard/routes.ts"}),
        ("Glob", {"pattern": "**/*.py"}),
        ("Glob", {"pattern": "*.ts", "path": f"{ROOT}/src"}),
        ("Grep", {"pattern": "SpecService", "path": f"{ROOT}/{BACKEND}"}),
        ("TodoWrite", {"todos": []}),
        ("Bash", {"command": "python -m pytest tests/fiscal -q"}),
        ("Bash", {"command": f"cd {BACKEND} && ruff check fiscal tests && mypy --strict fiscal"}),
        ("Bash", {"command": "npx vitest run src/dashboard"}),
        ("Bash", {"command": "npm run -s dash:gauntlet"}),
        ("Bash", {"command": "git status --short"}),
        ("Bash", {"command": "git diff -- src"}),
        ("Bash", {"command": "ls fiscal/migrations"}),
    ],
)
def test_allowed_inside_the_worktree(tool: str, args: dict[str, object]) -> None:
    assert denial(tool, args, ROOT) is None


@pytest.mark.parametrize(
    ("tool", "args", "reason"),
    [
        ("Read", {"file_path": "/Users/pedro/random/teoria-sintergica/brain-prototype/backend/.env"}, "worktree"),
        ("Read", {"file_path": f"{ROOT}/../otro/archivo.py"}, "worktree"),
        ("Read", {"file_path": f"{ROOT}/{BACKEND}/.env"}, ".env"),
        ("Read", {"file_path": f"{ROOT}/{BACKEND}/.env.production"}, ".env"),
        ("Write", {"file_path": f"{ROOT}/.github/workflows/gauntlet.yml"}, ".github"),
        ("Edit", {"file_path": f"{ROOT}/infra/4-services/database.tf"}, "infra"),
        ("Glob", {"pattern": "*", "path": "/etc"}, "worktree"),
        ("Grep", {"pattern": "password", "path": "/Users"}, "worktree"),
        ("WebFetch", {"url": "https://example.com"}, "no está permitida"),
        ("Agent", {"prompt": "x"}, "no está permitida"),
        ("Bash", {"command": "git push origin neo/x"}, "comando"),
        ("Bash", {"command": "git commit -m x"}, "comando"),
        ("Bash", {"command": "gh pr create"}, "comando"),
        ("Bash", {"command": "curl https://evil.example"}, "comando"),
        ("Bash", {"command": "terraform apply"}, "comando"),
        ("Bash", {"command": "pytest; rm -rf /"}, "encadenar"),
        ("Bash", {"command": "ruff check | tee x"}, "encadenar"),
        ("Bash", {"command": "echo $(cat ~/.ssh/id_rsa)"}, "encadenar"),
        ("Bash", {"command": "pytest > /tmp/out"}, "encadenar"),
        ("Bash", {"command": "cd /etc && ls"}, "worktree"),
        ("Bash", {"command": "ls ../.."}, "worktree"),
        ("Bash", {"command": "cat .env"}, ".env"),
        ("Bash", {"command": ""}, "comando"),
        ("Bash", {"command": "ls && && ls"}, "comando"),
        ("Bash", {"command": 'ls "sin cerrar'}, "no se pudo leer"),
    ],
)
def test_denied(tool: str, args: dict[str, object], reason: str) -> None:
    message = denial(tool, args, ROOT)
    assert message is not None and reason in message


def test_the_denial_names_the_subcommand() -> None:
    assert "`git push`" in str(denial("Bash", {"command": "git push origin main"}, ROOT))


def test_tool_inputs_that_are_not_paths_are_denied() -> None:
    assert denial("Read", {"file_path": 3}, ROOT) is not None
    assert denial("Bash", {"command": ["ls"]}, ROOT) is not None


# ── migraciones destructivas ─────────────────────────────────────────────────
def test_additive_migrations_pass() -> None:
    sql = """
    CREATE TABLE IF NOT EXISTS fiscal.cuentas (id uuid PRIMARY KEY, nombre text NOT NULL);
    ALTER TABLE fiscal.cuentas ADD COLUMN banco text;
    DROP POLICY IF EXISTS neo_owner ON fiscal.cuentas;
    -- DROP TABLE fiscal.viejo;  (comentario, no cuenta)
    CREATE INDEX IF NOT EXISTS cuentas_owner ON fiscal.cuentas (owner_id);
    """
    assert destructive_statements(sql) == []


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE fiscal.cuentas;",
        "drop table if exists fiscal.cuentas cascade;",
        "ALTER TABLE fiscal.cuentas DROP COLUMN banco;",
        "ALTER TABLE fiscal.cuentas RENAME COLUMN banco TO entidad;",
        "ALTER TABLE fiscal.cuentas RENAME TO cuentas_v2;",
        "TRUNCATE fiscal.cuentas;",
        "DELETE FROM fiscal.cuentas;",
        "DROP SCHEMA fiscal CASCADE;",
        "ALTER TABLE fiscal.cuentas ALTER COLUMN banco TYPE integer USING 0;",
    ],
)
def test_destructive_migrations_are_flagged(sql: str) -> None:
    assert destructive_statements(f"CREATE TABLE x (id int);\n{sql}") != []


# ── tracks ───────────────────────────────────────────────────────────────────
def test_tracks_follow_the_changed_files() -> None:
    assert tracks_for([f"{BACKEND}/fiscal/domain/finanzas.py"]) == ("python",)
    assert tracks_for(["src/dashboard/pages/FinanzasPage.tsx"]) == ("dashboard",)
    assert tracks_for([f"{BACKEND}/fiscal/migrations/011_finanzas.sql", "src/dashboard/types.ts", "docs/x.md"]) == (
        "python",
        "dashboard",
    )
    assert tracks_for(["docs/x.md"]) == ()


# ── prompts ──────────────────────────────────────────────────────────────────
def test_build_prompt_carries_the_spec_and_the_rules() -> None:
    prompt = build_prompt("Finanzas familiares", 2, "Característica: x\n  Escenario: y")
    assert "Finanzas familiares" in prompt and "versión 2" in prompt
    assert "Característica: x\n  Escenario: y" in prompt
    assert "primero los tests" in prompt and "fiscal/migrations" in prompt and "ver_modulos" in prompt
    assert "no hagas commit" in prompt.lower()


def test_fix_prompt_carries_the_failure_and_the_attempt() -> None:
    prompt = fix_prompt(2, 3, "ruff check: E501 line too long")
    assert "intento 2 de 3" in prompt and "E501 line too long" in prompt
    long = fix_prompt(2, 3, "x" * 50_000)
    assert len(long) < 20_000 and long.rstrip().endswith("x")
