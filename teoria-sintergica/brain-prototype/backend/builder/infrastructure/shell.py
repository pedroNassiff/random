"""Correr comandos sin shell, con salida capturada. Se inyecta para poder testear sin procesos."""

from __future__ import annotations

import subprocess  # nosec B404 - comandos fijos del builder, sin shell
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Done:
    code: int
    output: str


Runner = Callable[[Sequence[str], Path, Mapping[str, str] | None, str | None], Done]


def run(args: Sequence[str], cwd: Path, env: Mapping[str, str] | None = None, stdin: str | None = None) -> Done:
    proc = subprocess.run(  # nosec B603 - args es una lista, nunca un string de shell
        list(args),
        cwd=cwd,
        env=dict(env) if env is not None else None,
        input=stdin,
        capture_output=True,
        text=True,
        timeout=1800,
        check=False,
    )
    return Done(proc.returncode, proc.stdout + proc.stderr)


class CommandFailed(Exception):
    def __init__(self, args: Sequence[str], done: Done) -> None:
        super().__init__(f"Falló `{' '.join(args)}` ({done.code}):\n{done.output[-2000:]}")


def checked(runner: Runner, args: Sequence[str], cwd: Path, stdin: str | None = None) -> str:
    done = runner(args, cwd, None, stdin)
    if done.code != 0:
        raise CommandFailed(args, done)
    return done.output
