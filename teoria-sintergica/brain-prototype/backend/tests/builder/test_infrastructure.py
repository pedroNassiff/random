"""Builder local: adaptadores (git real en un repo temporal, gauntlet, gh, Agent SDK, Postgres y CLI).

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § Builder local.
"""

from __future__ import annotations

import argparse
from collections.abc import AsyncIterator, Mapping, Sequence
from pathlib import Path
from typing import Any

import asyncpg
import pytest
from claude_agent_sdk import AssistantMessage, ClaudeSDKClient, ResultMessage, TextBlock, ToolUseBlock

from builder.application.build import BuildError, BuildResult
from builder.application.ports import SavedSpec
from builder.domain.policy import BACKEND
from builder.infrastructure import cli
from builder.infrastructure.agent_sdk import SdkCodingAgent, gate, options_for, sdk_client
from builder.infrastructure.gauntlet import SECRETS, SubprocessGauntlet, clean_env, python_commands, workflow_env
from builder.infrastructure.git import GhPublisher, GitWorkspaces
from builder.infrastructure.shell import CommandFailed, Done, checked, run
from builder.infrastructure.specs_pg import PgSavedSpecs
from tests.fiscal.test_clients import pool  # noqa: F401 - pool es fixture

WORKFLOW = "env:\n  PY_PACKAGES: fiscal accounts futbol builder\n  PY_TESTS: tests\n"


class FakeRunner:
    def __init__(self, *codes: int, output: str = "") -> None:
        self.codes = list(codes)
        self.output = output
        self.calls: list[tuple[list[str], Path, Mapping[str, str] | None, str | None]] = []

    def __call__(self, args: Sequence[str], cwd: Path, env: Mapping[str, str] | None, stdin: str | None) -> Done:
        self.calls.append((list(args), cwd, env, stdin))
        return Done(self.codes.pop(0) if self.codes else 0, self.output)


# ── shell ────────────────────────────────────────────────────────────────────
def test_run_captures_output_and_exit_code(tmp_path: Path) -> None:
    done = run(["python3", "-c", "import sys; print('hola'); sys.exit(3)"], tmp_path)
    assert (done.code, done.output.strip()) == (3, "hola")
    assert run(["python3", "-c", "import sys; print(sys.stdin.read())"], tmp_path, stdin="x").output.strip() == "x"
    with pytest.raises(CommandFailed, match="Falló"):
        checked(run, ["python3", "-c", "raise SystemExit(1)"], tmp_path)


# ── git ──────────────────────────────────────────────────────────────────────
def _git(cwd: Path, *args: str) -> str:
    return checked(run, ["git", *args], cwd)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    origin, repo = tmp_path / "origin.git", tmp_path / "random"
    _git(tmp_path, "init", "-q", "--bare", str(origin))
    _git(tmp_path, "init", "-q", "-b", "main", str(repo))
    for key, value in (("user.email", "neo@random.test"), ("user.name", "NEO"), ("commit.gpgsign", "false")):
        _git(repo, "config", key, value)
    (repo / ".github/workflows").mkdir(parents=True)
    (repo / ".github/workflows/gauntlet.yml").write_text(WORKFLOW)
    (repo / ".gitignore").write_text("node_modules/\n")
    (repo / "node_modules").mkdir()
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "base")
    _git(repo, "remote", "add", "origin", str(origin))
    _git(repo, "push", "-q", "origin", "main")
    return repo


def test_worktree_changes_commit_and_push(repo: Path, tmp_path: Path) -> None:
    builds = tmp_path / "builds"
    ws = GitWorkspaces(repo, builds).create("neo/finanzas-familiares", "main")
    assert ws.root == builds / "finanzas-familiares"
    assert (ws.root / "node_modules").is_symlink()  # el front corre sin npm ci
    assert ws.changed_files() == []

    (ws.root / "src").mkdir()
    (ws.root / "src/FinanzasPage.tsx").write_text("export {}\n")
    (ws.root / ".gitignore").write_text("node_modules/\n.cache/\n")
    assert ws.changed_files() == [".gitignore", "src/FinanzasPage.tsx"]
    assert ws.read("src/FinanzasPage.tsx") == "export {}\n"

    ws.commit("feat(neo): módulo Finanzas\n\nCuerpo")
    ws.push()
    assert ws.changed_files() == []
    assert _git(repo, "log", "-1", "--format=%s", "neo/finanzas-familiares").strip() == "feat(neo): módulo Finanzas"
    assert "node_modules" not in _git(repo, "show", "--name-only", "--format=", "neo/finanzas-familiares")
    assert "neo/finanzas-familiares" in _git(repo, "ls-remote", "--heads", "origin")
    assert _git(repo, "status", "--porcelain") == ""  # la copia de trabajo de Pedro no se toca


def test_an_existing_branch_is_never_reused(repo: Path, tmp_path: Path) -> None:
    _git(repo, "branch", "neo/proyectos")
    with pytest.raises(ValueError, match="ya existe"):
        GitWorkspaces(repo, tmp_path / "builds").create("neo/proyectos", "main")


def test_gh_opens_a_draft_pr_and_returns_its_url(tmp_path: Path) -> None:
    runner = FakeRunner(output="Creating pull request\nhttps://github.com/x/y/pull/7\n")
    url = GhPublisher(runner).open_draft_pr(tmp_path, "neo/x", "main", "feat: x", "cuerpo")
    assert url == "https://github.com/x/y/pull/7"
    [(args, cwd, _, stdin)] = runner.calls
    assert args[:4] == ["gh", "pr", "create", "--draft"] and "--base" in args and "main" in args
    assert (cwd, stdin) == (tmp_path, "cuerpo")


# ── gauntlet ─────────────────────────────────────────────────────────────────
def _root(tmp_path: Path, workflow: str | None = WORKFLOW) -> Path:
    if workflow is not None:
        (tmp_path / ".github/workflows").mkdir(parents=True)
        (tmp_path / ".github/workflows/gauntlet.yml").write_text(workflow)
    return tmp_path


def test_python_track_runs_the_ci_gates_with_the_workflow_packages(tmp_path: Path) -> None:
    root, runner = _root(tmp_path), FakeRunner()
    report = SubprocessGauntlet(Path("/venv/bin"), runner).run(root, ("python",))
    assert report.ok and report.output.count("[ok]") == 6
    commands = [c[0] for c in runner.calls]
    assert commands[0] == ["ruff", "format", "--check", "fiscal", "accounts", "futbol", "builder", "tests"]
    assert commands[2][:2] == ["mypy", "--strict"] and commands[3] == ["lint-imports"]
    assert "--cov=builder" in commands[4] and "--cov-fail-under=90" in commands[4]
    assert {c[1] for c in runner.calls} == {root / BACKEND}
    env = runner.calls[0][2]
    assert env is not None and env["PATH"].startswith("/venv/bin") and not set(SECRETS) & set(env)


def test_modules_over_400_lines_are_red(tmp_path: Path) -> None:
    root = _root(tmp_path, "env:\n  PY_PACKAGES: fiscal\n  PY_TESTS: tests\n")
    (root / BACKEND / "fiscal").mkdir(parents=True)
    (root / BACKEND / "fiscal" / "grande.py").write_text("x = 1\n" * 401)
    runner = FakeRunner()
    report = SubprocessGauntlet(Path("/venv/bin"), runner).run(root, ("python",))
    assert not report.ok and "fiscal/grande.py: 401 líneas" in report.output and runner.calls == []


def test_gauntlet_stops_at_the_first_red_gate(tmp_path: Path) -> None:
    runner = FakeRunner(0, 1, output="E501 line too long")
    report = SubprocessGauntlet(Path("/venv/bin"), runner).run(_root(tmp_path), ("python", "dashboard"))
    assert not report.ok and "E501 line too long" in report.output and "falló (1)" in report.output
    assert len(runner.calls) == 2


def test_dashboard_track_and_no_tracks(tmp_path: Path) -> None:
    runner = FakeRunner()
    gauntlet = SubprocessGauntlet(Path("/venv/bin"), runner)
    assert gauntlet.run(tmp_path, ("dashboard",)).ok
    assert runner.calls[0][0] == ["npm", "run", "-s", "dash:gauntlet"] and runner.calls[0][1] == tmp_path
    assert gauntlet.run(tmp_path, ()).output == "No hay tracks que correr."


def test_a_base_without_the_gauntlet_workflow_is_red(tmp_path: Path) -> None:
    report = SubprocessGauntlet(Path("/venv/bin"), FakeRunner()).run(_root(tmp_path, None), ("python",))
    assert not report.ok and "no tiene .github/workflows/gauntlet.yml" in report.output
    with pytest.raises(ValueError, match="no declara PY_TESTS"):
        workflow_env(_root(tmp_path / "otro", "env:\n  PY_PACKAGES: fiscal\n"), "PY_TESTS")


def test_clean_env_and_commands() -> None:
    env = clean_env(Path("/v"), {"PATH": "/usr/bin", "DATABASE_URL": "postgres://prod", "HOME": "/h"})
    assert env == {"PATH": f"/v:{'/usr/bin'}", "HOME": "/h"}
    assert len(python_commands(["fiscal"], ["tests"])) == 6


# ── Agent SDK ────────────────────────────────────────────────────────────────
def _hook_input(tool: str, args: dict[str, Any]) -> Any:
    return {"hook_event_name": "PreToolUse", "tool_name": tool, "tool_input": args}


async def test_gate_denies_with_the_policy_reason_and_allows_the_rest(tmp_path: Path) -> None:
    hook = gate(tmp_path)
    denied = await hook(_hook_input("Bash", {"command": "git push"}), "t1", {"signal": None})
    assert denied["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert "no está permitido" in denied["hookSpecificOutput"]["permissionDecisionReason"]
    assert await hook(_hook_input("Read", {"file_path": str(tmp_path / "a.py")}), "t2", {"signal": None}) == {}
    assert await hook({"hook_event_name": "PostToolUse"}, None, {"signal": None}) == {}  # type: ignore[typeddict-item]


def test_options_isolate_the_agent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://prod")
    options = options_for(tmp_path, api_key="sk-test", venv_bin=Path("/v"), budget_usd=5.0, model="claude-opus-5-5")
    assert (options.cwd, options.model, options.max_budget_usd) == (str(tmp_path), "claude-opus-5-5", 5.0)
    assert options.permission_mode == "bypassPermissions" and "WebFetch" in options.disallowed_tools
    assert options.sandbox is not None and options.sandbox["enabled"] is True
    assert options.sandbox["allowUnsandboxedCommands"] is False
    assert options.env["ANTHROPIC_API_KEY"] == "sk-test" and "DATABASE_URL" not in options.env
    assert options.hooks is not None and len(options.hooks["PreToolUse"]) == 1


class FakeClient:
    def __init__(self, options: Any, batches: list[list[object]]) -> None:
        self.options = options
        self.batches = batches
        self.prompts: list[str] = []
        self.open = False

    async def __aenter__(self) -> FakeClient:
        self.open = True
        return self

    async def __aexit__(self, *exc: object) -> None:
        self.open = False

    async def query(self, prompt: str) -> None:
        self.prompts.append(prompt)

    async def receive_response(self) -> AsyncIterator[object]:
        for message in self.batches.pop(0):
            yield message


def _result(cost: float | None, subtype: str = "success", text: str | None = "Listo.") -> ResultMessage:
    return ResultMessage(subtype, 10, 5, subtype != "success", 3, "s1", total_cost_usd=cost, result=text)


async def test_session_logs_progress_and_counts_only_the_new_cost(tmp_path: Path) -> None:
    said = AssistantMessage(
        [TextBlock("Arranco por los tests."), ToolUseBlock("t1", "Write", {"file_path": "x.py"})], "claude-opus-5-5"
    )
    batches: list[list[object]] = [[said, _result(1.5)], [_result(2.25)], [said]]
    clients: list[FakeClient] = []

    def factory(options: Any) -> FakeClient:
        clients.append(FakeClient(options, batches))
        return clients[-1]

    log: list[str] = []
    agent = SdkCodingAgent(api_key="k", venv_bin=Path("/v"), budget_usd=9, log=log.append, client_factory=factory)
    async with agent.session(tmp_path) as session:
        first, second, third = await session.send("a"), await session.send("b"), await session.send("c")
        assert clients[0].open
    assert not clients[0].open and clients[0].prompts == ["a", "b", "c"]
    assert (first.ok, first.summary, first.cost_usd) == (True, "Listo.", 1.5)
    assert second.cost_usd == 0.75
    assert (third.ok, third.cost_usd) == (False, 0.0)
    assert log == ["  NEO: Arranco por los tests.", "  · Write x.py"] * 2


async def test_session_reports_sdk_errors(tmp_path: Path) -> None:
    failed = ResultMessage("error_max_budget_usd", 1, 1, True, 9, "s", total_cost_usd=9.1, errors=["tope"])
    agent = SdkCodingAgent(
        api_key="k",
        venv_bin=Path("/v"),
        budget_usd=9,
        log=lambda _: None,
        client_factory=lambda o: FakeClient(o, [[failed]]),
    )
    async with agent.session(tmp_path) as session:
        turn = await session.send("x")
    assert (turn.ok, turn.summary, turn.cost_usd) == (False, "error_max_budget_usd\ntope", 9.1)


def test_default_client_is_the_sdk_client(tmp_path: Path) -> None:
    options = options_for(tmp_path, api_key="k", venv_bin=Path("/v"), budget_usd=1, model="m")
    assert isinstance(sdk_client(options), ClaudeSDKClient)


# ── Postgres ─────────────────────────────────────────────────────────────────
async def test_latest_saved_spec_from_postgres(pool: asyncpg.Pool, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    from tests.fiscal.test_clients import DSN

    owner = await pool.fetchval("INSERT INTO futbol.app_users (email) VALUES ('p@x.com') RETURNING id")
    for version, text in ((1, "v1"), (2, "v2")):
        await pool.execute(
            "INSERT INTO fiscal.specs (owner_id, modulo, contenido, version) VALUES ($1, 'Finanzas', $2, $3)",
            owner,
            text,
            version,
        )
    specs = PgSavedSpecs(str(DSN))
    assert await specs.latest("finanzas") == SavedSpec("Finanzas", 2, "v2")
    assert await specs.latest("Otro") is None


# ── CLI ──────────────────────────────────────────────────────────────────────
class FakeService:
    def __init__(self, result: BuildResult | Exception) -> None:
        self.result = result
        self.calls: list[tuple[str, str]] = []

    async def build(self, modulo: str, base: str) -> BuildResult:
        self.calls.append((modulo, base))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def test_cli_reports_the_pr(monkeypatch: pytest.MonkeyPatch) -> None:
    ok = BuildResult("pr_abierto", "neo/finanzas", 2, 3.5, "Gauntlet en verde.", "https://pr/1")
    service = FakeService(ok)
    monkeypatch.setattr(cli, "service_from", lambda args, repo, log: service)
    log: list[str] = []
    assert cli.main(["Finanzas familiares", "--base", "feat/x"], log.append) == 0
    assert service.calls == [("Finanzas familiares", "feat/x")]
    assert log[-1] == "PR abierto en draft.\nRama: neo/finanzas · intentos: 2 · costo: US$ 3.50\nPR: https://pr/1"


def test_cli_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    red = BuildResult("gauntlet_roja", "neo/finanzas", 3, 9.0, "FAILED test_x")
    monkeypatch.setattr(cli, "service_from", lambda args, repo, log: FakeService(red))
    log: list[str] = []
    assert cli.main(["Finanzas"], log.append) == 1 and log[-1].endswith("FAILED test_x")
    monkeypatch.setattr(cli, "service_from", lambda args, repo, log: FakeService(BuildError("No hay spec")))
    assert cli.main(["Finanzas"], log.append) == 2 and log[-1] == "Error: No hay spec"


def test_cli_needs_the_database_and_the_api_key(tmp_path: Path) -> None:
    (tmp_path / BACKEND).mkdir(parents=True)
    (tmp_path / BACKEND / ".env").write_text("DATABASE_URL=postgresql://x\n")
    args = cli.parse(["Finanzas"])
    with pytest.raises(BuildError, match="ANTHROPIC_API_KEY"):
        cli.service_from(args, tmp_path, print)
    (tmp_path / BACKEND / ".env").write_text("DATABASE_URL=postgresql://x\nCLAUDE_API_KEY=k\n")
    service = cli.service_from(argparse.Namespace(**{**vars(args), "builds": tmp_path / "b"}), tmp_path, print)
    assert service is not None
