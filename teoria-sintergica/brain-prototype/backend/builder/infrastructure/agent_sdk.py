"""El agente del builder con el Claude Agent SDK: una sesión por pedido, gobernada por un hook PreToolUse."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Protocol, cast

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookContext,
    HookInput,
    HookJSONOutput,
    HookMatcher,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

from builder.application.ports import AgentSession, AgentTurn
from builder.domain.policy import denial
from builder.infrastructure.gauntlet import clean_env

MODEL = "claude-opus-5-5"
_APPEND = (
    "Sos el builder de NEO: construís un módulo del dashboard de Random en un worktree aislado, sin persona "
    "mirando en tiempo real. Si una herramienta te deniega algo, no lo intentes por otro camino: seguí con lo "
    "permitido y mencionalo en el resumen final."
)


class _Client(Protocol):
    async def __aenter__(self) -> _Client: ...
    async def __aexit__(self, *exc: object) -> None: ...
    async def query(self, prompt: str) -> None: ...
    def receive_response(self) -> AsyncIterator[Any]: ...


ClientFactory = Callable[[ClaudeAgentOptions], _Client]


def sdk_client(options: ClaudeAgentOptions) -> _Client:
    return cast(_Client, ClaudeSDKClient(options=options))


def gate(root: Path) -> Callable[[HookInput, str | None, HookContext], Any]:
    """Hook PreToolUse: deniega todo lo que la política no permite, con el motivo para el agente."""

    async def hook(input_data: HookInput, _tool_use_id: str | None, _context: HookContext) -> HookJSONOutput:
        if input_data["hook_event_name"] != "PreToolUse":
            return {}
        reason = denial(input_data["tool_name"], input_data["tool_input"], root)
        if reason is None:
            return {}
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }

    return hook


def options_for(root: Path, *, api_key: str, venv_bin: Path, budget_usd: float, model: str) -> ClaudeAgentOptions:
    env = {**clean_env(venv_bin), "ANTHROPIC_API_KEY": api_key}
    return ClaudeAgentOptions(
        cwd=str(root),
        model=model,
        effort="high",
        system_prompt={"type": "preset", "preset": "claude_code", "append": _APPEND},
        setting_sources=["project"],
        permission_mode="bypassPermissions",
        hooks={"PreToolUse": [HookMatcher(hooks=[gate(root)])]},
        disallowed_tools=["WebFetch", "WebSearch", "Agent", "Task"],
        sandbox={"enabled": True, "autoAllowBashIfSandboxed": True, "allowUnsandboxedCommands": False},
        max_budget_usd=budget_usd,
        env=env,
    )


def _describe(message: object) -> list[str]:
    if not isinstance(message, AssistantMessage):
        return []
    lines: list[str] = []
    for block in message.content:
        if isinstance(block, TextBlock) and block.text.strip():
            lines.append(f"  NEO: {block.text.strip()[:300]}")
        elif isinstance(block, ToolUseBlock):
            target = block.input.get("file_path") or block.input.get("command") or block.input.get("pattern") or ""
            lines.append(f"  · {block.name} {str(target)[:160]}")
    return lines


class _Session:
    def __init__(self, client: _Client, log: Callable[[str], None]) -> None:
        self._client = client
        self._log = log
        self._spent = 0.0

    async def send(self, prompt: str) -> AgentTurn:
        await self._client.query(prompt)
        result: ResultMessage | None = None
        async for message in self._client.receive_response():
            for line in _describe(message):
                self._log(line)
            if isinstance(message, ResultMessage):
                result = message
        if result is None:
            return AgentTurn(False, "El agente terminó sin resultado.", 0.0)
        # En una sesión de varios pedidos el costo llega acumulado: se cuenta solo lo nuevo.
        total = result.total_cost_usd or 0.0
        cost, self._spent = max(total - self._spent, 0.0), max(total, self._spent)
        ok = result.subtype == "success" and not result.is_error
        summary = result.result or result.subtype + "".join(f"\n{e}" for e in result.errors or [])
        return AgentTurn(ok, summary, cost)


class SdkCodingAgent:
    def __init__(
        self,
        *,
        api_key: str,
        venv_bin: Path,
        budget_usd: float,
        model: str = MODEL,
        log: Callable[[str], None] = print,
        client_factory: ClientFactory = sdk_client,
    ) -> None:
        self._api_key = api_key
        self._venv_bin = venv_bin
        self._budget = budget_usd
        self._model = model
        self._log = log
        self._factory = client_factory

    @asynccontextmanager
    async def session(self, root: Path) -> AsyncIterator[AgentSession]:
        options = options_for(
            root, api_key=self._api_key, venv_bin=self._venv_bin, budget_usd=self._budget, model=self._model
        )
        async with self._factory(options) as client:
            yield _Session(client, self._log)
