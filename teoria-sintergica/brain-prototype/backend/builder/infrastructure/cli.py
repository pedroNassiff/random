"""python -m builder "<módulo>": construye la última spec guardada del módulo y abre un PR en draft."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

from dotenv import dotenv_values

from builder.application.build import BuildError, BuildResult, BuildService
from builder.domain.policy import BACKEND
from builder.infrastructure.agent_sdk import MODEL, SdkCodingAgent
from builder.infrastructure.gauntlet import SubprocessGauntlet
from builder.infrastructure.git import GhPublisher, GitWorkspaces
from builder.infrastructure.shell import CommandFailed, checked, run
from builder.infrastructure.specs_pg import PgSavedSpecs

LABEL = {
    "pr_abierto": "PR abierto en draft",
    "gauntlet_roja": "La gauntlet sigue en rojo: no se hizo push",
    "migracion_destructiva": "Migración destructiva: necesita tu confirmación aparte, no se hizo push",
    "sin_cambios": "El agente no cambió nada",
    "agente_fallo": "El agente no terminó",
}


def parse(argv: Sequence[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m builder", description="Builder local de NEO.")
    p.add_argument("modulo", help="Nombre del módulo, como figura en la sección Specs.")
    p.add_argument("--base", default="main", help="Rama desde la que se construye y contra la que va el PR.")
    p.add_argument("--budget", type=float, default=20.0, help="Tope de gasto del agente en USD (default 20).")
    p.add_argument("--model", default=MODEL)
    p.add_argument("--builds", type=Path, help="Carpeta de los worktrees (default: ../random-neo-builds).")
    p.add_argument("--status-file", type=Path, help="Dónde escribir el resultado en JSON (lo lee el dashboard).")
    return p.parse_args(argv)


def service_from(args: argparse.Namespace, repo: Path, log: Callable[[str], None]) -> BuildService:
    backend = repo / BACKEND
    env = dotenv_values(backend / ".env")
    dsn = env.get("DATABASE_URL")
    api_key = env.get("ANTHROPIC_API_KEY") or env.get("CLAUDE_API_KEY")
    if not dsn or not api_key:
        raise BuildError(f"Faltan DATABASE_URL o ANTHROPIC_API_KEY en {backend / '.env'}.")
    venv_bin = backend / "venv" / "bin"
    return BuildService(
        PgSavedSpecs(dsn),
        GitWorkspaces(repo, args.builds or repo.parent / "random-neo-builds"),
        SdkCodingAgent(api_key=api_key, venv_bin=venv_bin, budget_usd=args.budget, model=args.model, log=log),
        SubprocessGauntlet(venv_bin),
        GhPublisher(),
    )


def report(result: BuildResult) -> str:
    lines = [
        f"{LABEL[result.outcome]}.",
        f"Rama: {result.branch} · intentos: {result.attempts} · costo: US$ {result.cost_usd:.2f}",
    ]
    if result.pr_url:
        lines.append(f"PR: {result.pr_url}")
    if result.outcome != "pr_abierto":
        lines.append(result.detail)
    return "\n".join(lines)


def write_status(path: Path | None, data: dict[str, object]) -> None:
    if path is not None:
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def main(argv: Sequence[str] | None = None, log: Callable[[str], None] = print) -> int:
    args = parse(argv)
    try:
        repo = Path(checked(run, ["git", "rev-parse", "--show-toplevel"], Path.cwd()).strip())
        service = service_from(args, repo, log)
        log(f"Construyendo «{args.modulo}» desde {args.base}…")
        result = asyncio.run(service.build(args.modulo, args.base))
    except (BuildError, CommandFailed, ValueError) as exc:
        log(f"Error: {exc}")
        write_status(args.status_file, {"estado": "error", "detalle": str(exc)})
        return 2
    log(report(result))
    write_status(
        args.status_file,
        {
            "estado": result.outcome,
            "rama": result.branch,
            "intentos": result.attempts,
            "costo_usd": result.cost_usd,
            "pr_url": result.pr_url,
            "detalle": result.detail,
        },
    )
    return 0 if result.outcome == "pr_abierto" else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
