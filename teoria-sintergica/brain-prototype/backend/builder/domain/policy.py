"""Qué puede hacer el agente del builder. Lo aplica un hook antes de cada herramienta, no el prompt.

Solo lee y escribe dentro del worktree, nunca `.github`, `infra` ni `.env*`. En Bash corre solo tests, lint,
tipos y git de lectura, sin encadenar con nada que no sea `&&`. El sandbox del SDK lo refuerza para Bash.
"""

from __future__ import annotations

import os
import shlex
from collections.abc import Mapping
from pathlib import PurePosixPath

BACKEND = "teoria-sintergica/brain-prototype/backend"
_FILE_TOOLS = {"Read": "file_path", "Write": "file_path", "Edit": "file_path", "MultiEdit": "file_path"}
_SEARCH_TOOLS = {"Glob": "path", "Grep": "path"}
_FREE_TOOLS = {"TodoWrite"}
_READ_CMDS = {"ls", "cat", "head", "tail", "wc"}
_TOOLS_CMDS = {"pytest", "ruff", "mypy", "lint-imports"}
_PY_MODULES = {"pytest", "ruff", "mypy"}
_NPX = {"vitest", "prettier", "eslint", "tsc"}
_GIT_READ = {"status", "diff", "log", "show", "ls-files"}
_METACHARS = set(";|<>`&$\n")


def _inside(path: str, root: PurePosixPath) -> PurePosixPath | None:
    """La ruta normalizada relativa al worktree, o None si sale de él."""
    full = path if os.path.isabs(path) else os.path.join(str(root), path)
    norm = PurePosixPath(os.path.normpath(full))
    try:
        return norm.relative_to(root)
    except ValueError:
        return None


def _path_denial(path: object, root: PurePosixPath, *, write: bool) -> str | None:
    if not isinstance(path, str) or not path:
        return "La ruta tiene que ser un texto."
    rel = _inside(path, root)
    if rel is None:
        return f"Solo podés trabajar dentro del worktree ({root}): {path}"
    if any(part.startswith(".env") for part in rel.parts):
        return "Los archivos .env tienen secretos: no se leen ni se escriben."
    if rel.parts[:1] == (".github",):
        return "No podés tocar .github: los workflows los cambia una persona."
    if write and rel.parts[:1] == ("infra",):
        return "No podés tocar infra: la infraestructura pasa por la gauntlet del Track 4 con una persona."
    return None


def _segment_denial(tokens: list[str], root: PurePosixPath) -> str | None:
    cmd, args = tokens[0], tokens[1:]
    allowed = (
        cmd in _READ_CMDS
        or cmd in _TOOLS_CMDS
        or cmd == "cd"
        or (cmd in ("python", "python3") and args[:1] == ["-m"] and args[1:2] and args[1] in _PY_MODULES)
        or (cmd == "npx" and bool(args) and args[0] in _NPX)
        or (cmd == "npm" and args[:1] in (["run"], ["test"]))
        or (cmd == "git" and bool(args) and args[0] in _GIT_READ)
    )
    if not allowed:
        shown = " ".join(tokens[:2]) if cmd in ("git", "npm", "npx", "python", "python3") else cmd
        return f"El comando `{shown}` no está permitido en el builder: solo tests, lint, tipos y git de lectura."
    for arg in args if cmd == "cd" else [a for a in args if "/" in a or a.startswith(".")]:
        if not arg.startswith("-") and (reason := _path_denial(arg, root, write=False)):
            return reason
    return None


def _bash_denial(command: object, root: PurePosixPath) -> str | None:
    if not isinstance(command, str) or not command.strip():
        return "Falta el comando."
    if _METACHARS & set(command.replace("&&", " ")):
        return "No se puede encadenar ni redirigir comandos: usá solo `&&` entre comandos permitidos."
    for segment in command.split("&&"):
        try:
            tokens = shlex.split(segment)
        except ValueError:
            return "El comando no se pudo leer."
        if not tokens:
            return "Falta el comando entre dos `&&`."
        if reason := _segment_denial(tokens, root):
            return reason
    return None


def denial(tool: str, args: Mapping[str, object], root: str | os.PathLike[str]) -> str | None:
    """None si la herramienta puede correr; si no, el motivo que se le devuelve al agente."""
    base = PurePosixPath(os.path.normpath(os.fspath(root)))
    if tool in _FREE_TOOLS:
        return None
    if tool in _FILE_TOOLS:
        return _path_denial(args.get(_FILE_TOOLS[tool]), base, write=tool != "Read")
    if tool in _SEARCH_TOOLS:
        path = args.get(_SEARCH_TOOLS[tool])
        return None if path is None else _path_denial(path, base, write=False)
    if tool == "Bash":
        return _bash_denial(args.get("command"), base)
    return f"La herramienta {tool} no está permitida en el builder."
