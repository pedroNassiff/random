"""Lanzador local del builder: `python -m builder` como proceso aparte, con su log y su resultado en disco.

Por módulo quedan tres archivos en `data/neo_builds`: `<slug>.json` (lo escribe este lanzador al empezar),
`<slug>.log` (la salida del builder) y `<slug>.result.json` (lo escribe el builder al terminar, o este
lanzador si se cancela). Como todo está en disco, el estado sobrevive a las recargas de uvicorn.
"""

from __future__ import annotations

import json
import os
import re
import signal
import subprocess  # nosec B404 - lanza el builder propio, sin shell
import unicodedata
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fiscal.application.builds import BuildStatus
from fiscal.application.errors import Invalid

LOG_LINES = 40


def slugify(modulo: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", modulo).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-") or "modulo"


def _pid_alive(pid: object) -> bool:
    if not isinstance(pid, int):
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _load(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


class LocalBuildLauncher:
    def __init__(
        self,
        directory: Path,
        *,
        cwd: Path,
        base: str,
        budget_usd: float,
        command: Sequence[str],
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._dir = directory
        self._cwd = cwd
        self._base = base
        self._budget = float(budget_usd)
        self._command = list(command)
        self._clock = clock
        self._procs: dict[str, subprocess.Popen[bytes]] = {}

    @property
    def budget_usd(self) -> float:
        return self._budget

    def _running(self, slug: str, pid: object) -> bool:
        proc = self._procs.get(slug)
        if proc is not None:  # hijo de este proceso: poll() también lo cosecha
            return proc.poll() is None
        return _pid_alive(pid)

    def start(self, modulo: str) -> BuildStatus:
        slug = slugify(modulo)
        self._dir.mkdir(parents=True, exist_ok=True)
        start = _load(self._dir / f"{slug}.json")
        if start and not (self._dir / f"{slug}.result.json").exists() and self._running(slug, start.get("pid")):
            raise Invalid("Ya hay una construcción en curso para este módulo.")
        (self._dir / f"{slug}.result.json").unlink(missing_ok=True)
        args = [*self._command, modulo, "--base", self._base, "--budget", str(self._budget)]
        args += ["--status-file", str(self._dir / f"{slug}.result.json")]
        with open(self._dir / f"{slug}.log", "wb") as log:
            proc = subprocess.Popen(  # nosec B603 - lista de argumentos fija, sin shell
                args, cwd=self._cwd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True
            )
        self._procs[slug] = proc
        inicio = self._clock().isoformat()
        info = {"modulo": modulo, "pid": proc.pid, "inicio": inicio}
        (self._dir / f"{slug}.json").write_text(json.dumps(info), encoding="utf-8")
        return BuildStatus(slug, modulo, "corriendo", inicio)

    def _status(self, path: Path) -> BuildStatus | None:
        slug = path.name.removesuffix(".json")
        start = _load(path)
        if start is None:
            return None
        result = _load(self._dir / f"{slug}.result.json")
        if result is None:
            estado = "corriendo" if self._running(slug, start.get("pid")) else "interrumpido"
            result = {"estado": estado}
        try:
            lines = (self._dir / f"{slug}.log").read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            lines = []
        return BuildStatus(
            slug=slug,
            modulo=str(start.get("modulo", slug)),
            estado=str(result.get("estado", "error")),
            inicio=str(start.get("inicio", "")),
            log=tuple(lines[-LOG_LINES:]),
            rama=result.get("rama"),
            intentos=result.get("intentos"),
            costo_usd=result.get("costo_usd"),
            pr_url=result.get("pr_url"),
            detalle=result.get("detalle"),
        )

    def status(self) -> list[BuildStatus]:
        if not self._dir.is_dir():
            return []
        paths = sorted(p for p in self._dir.glob("*.json") if not p.name.endswith(".result.json"))
        found = [s for p in paths if (s := self._status(p)) is not None]
        return sorted(found, key=lambda s: s.inicio, reverse=True)

    def cancel(self, slug: str) -> bool:
        start = _load(self._dir / f"{slug}.json")
        if not start or (self._dir / f"{slug}.result.json").exists() or not self._running(slug, start.get("pid")):
            return False
        pid = start.get("pid")
        if isinstance(pid, int):
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except OSError:  # pragma: no cover - terminó justo entre la consulta y la señal
                pass
        proc = self._procs.get(slug)
        if proc is not None:
            proc.wait(timeout=10)
        result = {"estado": "cancelado", "detalle": "Cancelada desde el dashboard."}
        (self._dir / f"{slug}.result.json").write_text(json.dumps(result), encoding="utf-8")
        return True
