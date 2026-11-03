"""Worktree aparte por pedido, commit y push de la rama, y PR en draft con gh."""

from __future__ import annotations

from pathlib import Path

from builder.infrastructure.shell import Runner, checked, run

_SKIP = ":(exclude)node_modules"


class GitWorkspace:
    def __init__(self, root: Path, branch: str, runner: Runner = run) -> None:
        self._root = root
        self._branch = branch
        self._run = runner

    @property
    def root(self) -> Path:
        return self._root

    def changed_files(self) -> list[str]:
        out = checked(self._run, ["git", "status", "--porcelain=v1", "-uall", "--", ".", _SKIP], self._root)
        return sorted({line[3:].split(" -> ")[-1].strip('"') for line in out.splitlines() if len(line) > 3})

    def read(self, path: str) -> str:
        return (self._root / path).read_text(encoding="utf-8")

    def commit(self, message: str) -> None:
        checked(self._run, ["git", "add", "-A", "--", ".", _SKIP], self._root)
        checked(self._run, ["git", "commit", "-q", "-F", "-"], self._root, stdin=message)

    def push(self) -> None:
        checked(self._run, ["git", "push", "-q", "-u", "origin", self._branch], self._root)


class GitWorkspaces:
    """`repo` es la copia de trabajo de Pedro (no se toca); los worktrees van a `builds`."""

    def __init__(self, repo: Path, builds: Path, runner: Runner = run) -> None:
        self._repo = repo
        self._builds = builds
        self._run = runner

    def create(self, branch: str, base: str) -> GitWorkspace:
        if (
            self._run(["git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], self._repo, None, None).code
            == 0
        ):
            raise ValueError(f"La rama {branch} ya existe: borrala o renombrala antes de construir de nuevo.")
        root = self._builds / branch.removeprefix("neo/")
        self._builds.mkdir(parents=True, exist_ok=True)
        checked(self._run, ["git", "worktree", "add", "-q", "-b", branch, str(root), base], self._repo)
        modules = self._repo / "node_modules"
        if modules.is_dir() and not (root / "node_modules").exists():
            (root / "node_modules").symlink_to(modules, target_is_directory=True)
        return GitWorkspace(root, branch, self._run)


class GhPublisher:
    def __init__(self, runner: Runner = run) -> None:
        self._run = runner

    def open_draft_pr(self, root: Path, branch: str, base: str, title: str, body: str) -> str:
        args = ["gh", "pr", "create", "--draft", "--base", base, "--head", branch, "--title", title, "--body-file", "-"]
        out = checked(self._run, args, root, stdin=body)
        return out.strip().splitlines()[-1]
