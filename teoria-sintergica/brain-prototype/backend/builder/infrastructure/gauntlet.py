"""La gauntlet local: los mismos gates que CI, con los paquetes que declara el workflow del worktree."""

from __future__ import annotations

import os
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from builder.application.ports import GauntletReport
from builder.domain.policy import BACKEND
from builder.domain.tracks import Track
from builder.infrastructure.shell import Runner, run

WORKFLOW = ".github/workflows/gauntlet.yml"
# Ni la gauntlet ni el agente reciben secretos: los tests de Postgres se saltean y los corre CI.
SECRETS = (
    "DATABASE_URL",
    "ANALYTICS_DATABASE_URL",
    "NEO_DATABASE_URL",
    "FUTBOL_TEST_DSN",
    "ANTHROPIC_API_KEY",
    "CLAUDE_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GITHUB_TOKEN",
    "GH_TOKEN",
)


def clean_env(venv_bin: Path, base: Mapping[str, str] | None = None) -> dict[str, str]:
    env = {k: v for k, v in (os.environ if base is None else base).items() if k not in SECRETS}
    env["PATH"] = f"{venv_bin}{os.pathsep}{env.get('PATH', '')}"
    return env


def workflow_env(root: Path, name: str) -> list[str]:
    path = root / WORKFLOW
    if not path.is_file():
        raise ValueError(f"La rama base no tiene {WORKFLOW}: construí desde una rama que tenga la gauntlet.")
    match = re.search(rf"^\s*{name}:\s*(.+)$", path.read_text(encoding="utf-8"), re.MULTILINE)
    if not match:
        raise ValueError(f"{WORKFLOW} no declara {name}.")
    return match.group(1).split()


def python_commands(packages: Sequence[str], tests: Sequence[str]) -> list[list[str]]:
    version = f"{sys.version_info.major}.{sys.version_info.minor}"
    cov = [f"--cov={p}" for p in packages]
    return [
        ["ruff", "format", "--check", *packages, *tests],
        ["ruff", "check", *packages, *tests],
        ["mypy", "--strict", "--python-version", version, *packages],
        ["lint-imports"],
        ["python", "-m", "pytest", *tests, "-q", *cov, "--cov-fail-under=90"],
        ["bandit", "-q", "-r", *packages, "-lll"],
    ]


MAX_LINES = 400


def oversized(backend: Path, packages: Sequence[str]) -> list[str]:
    """Módulos de más de 400 líneas, como el gate de tamaño de CI."""
    return [
        f"{path.relative_to(backend)}: {n} líneas"
        for package in packages
        for path in sorted((backend / package).rglob("*.py"))
        if (n := len(path.read_text(encoding="utf-8").splitlines())) > MAX_LINES
    ]


class SubprocessGauntlet:
    def __init__(self, venv_bin: Path, runner: Runner = run) -> None:
        self._venv_bin = venv_bin
        self._run = runner

    def _steps(self, root: Path, tracks: Sequence[Track]) -> list[tuple[list[str], Path]]:
        steps: list[tuple[list[str], Path]] = []
        if "python" in tracks:
            packages, tests = workflow_env(root, "PY_PACKAGES"), workflow_env(root, "PY_TESTS")
            steps += [(cmd, root / BACKEND) for cmd in python_commands(packages, tests)]
        if "dashboard" in tracks:
            steps.append((["npm", "run", "-s", "dash:gauntlet"], root))
        return steps

    def run(self, root: Path, tracks: Sequence[Track]) -> GauntletReport:
        try:
            steps = self._steps(root, tracks)
        except ValueError as exc:
            return GauntletReport(False, str(exc))
        env = clean_env(self._venv_bin)
        log: list[str] = []
        if "python" in tracks and (big := oversized(root / BACKEND, workflow_env(root, "PY_PACKAGES"))):
            return GauntletReport(False, "Módulos de más de 400 líneas:\n" + "\n".join(big))
        for args, cwd in steps:
            done = self._run(args, cwd, env, None)
            log.append(f"$ {' '.join(args)}  [{'ok' if done.code == 0 else f'falló ({done.code})'}]")
            if done.code != 0:
                return GauntletReport(False, "\n".join(log) + "\n\n" + done.output)
        return GauntletReport(True, "\n".join(log) or "No hay tracks que correr.")
