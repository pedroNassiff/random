"""
audit/capa2/auth_sessions.py

AuthSession management for Capa 2 authenticated probes.

Sessions are captured via Playwright (browser automation) and stored as
Playwright storage_state JSON files. Probes load these files to run
authenticated requests without replaying the login flow each time.

Playwright is an optional dependency — the module loads without it,
but `capture_session()` will raise if it's not installed.

Usage (session capture, run once before audit):
    session = await capture_session(
        login_url="https://example.com/login",
        email="test+audit@example.com",
        password="...",  # from env, never hardcoded
        label="customer_a",
        output_path="/secure/sessions/customer_a.json",
    )

Usage (loading in probe):
    sessions = ctx.cache.get("auth_sessions", {})
    session = sessions["customer_a"]
    async with load_playwright_context(session) as page:
        await page.goto("https://example.com/dashboard")
"""
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

SESSION_TTL_HOURS = 8


@dataclass
class AuthSession:
    """A captured Playwright session for authenticated probes."""
    label:               str
    storage_state_path:  str
    captured_at:         datetime
    expires_at:          datetime
    test_user_email:     str
    refresh_strategy:    str = "cookies_only"  # 'cookies_only' | 'full_login_replay'

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "storage_state_path": self.storage_state_path,
            "captured_at": self.captured_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "test_user_email": self.test_user_email,
            "refresh_strategy": self.refresh_strategy,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AuthSession":
        return cls(
            label=data["label"],
            storage_state_path=data["storage_state_path"],
            captured_at=datetime.fromisoformat(data["captured_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"]),
            test_user_email=data["test_user_email"],
            refresh_strategy=data.get("refresh_strategy", "cookies_only"),
        )


async def capture_session(
    login_url: str,
    email: str,
    password: str,
    label: str,
    output_path: str,
    email_field_selector: str = "input[type='email'], input[name='email']",
    password_field_selector: str = "input[type='password']",
    submit_selector: str = "button[type='submit']",
) -> AuthSession:
    """
    Launch a headless Chromium browser, perform login, save storage state.

    Args:
        login_url: URL of the login page.
        email: Test user email (must be a dedicated test account).
        password: Password — read from env var, never passed as literal string.
        label: Human-readable session label (e.g. 'customer_a', 'admin').
        output_path: Where to save the Playwright storage_state JSON.
        email_field_selector: CSS selector for the email input.
        password_field_selector: CSS selector for the password input.
        submit_selector: CSS selector for the submit button.

    Returns:
        AuthSession with the captured state.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise ImportError(
            "playwright is not installed. Run: pip install playwright && playwright install chromium"
        )

    output_path = str(Path(output_path).resolve())
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        logger.info("Capturing session '%s' via %s", label, login_url)
        await page.goto(login_url, wait_until="networkidle")

        await page.fill(email_field_selector, email)
        await page.fill(password_field_selector, password)
        await page.click(submit_selector)
        await page.wait_for_load_state("networkidle")

        await ctx.storage_state(path=output_path)
        await browser.close()

    now = datetime.now(timezone.utc)
    session = AuthSession(
        label=label,
        storage_state_path=output_path,
        captured_at=now,
        expires_at=now + timedelta(hours=SESSION_TTL_HOURS),
        test_user_email=email,
    )
    logger.info("Session '%s' captured → %s (expires %s)", label, output_path, session.expires_at)
    return session


def load_session_from_file(path: str) -> AuthSession:
    """Load a previously serialized AuthSession from a JSON manifest file."""
    with open(path) as f:
        return AuthSession.from_dict(json.load(f))


def save_session_manifest(session: AuthSession, manifest_path: str) -> None:
    """Persist the AuthSession metadata alongside the storage_state file."""
    with open(manifest_path, "w") as f:
        json.dump(session.to_dict(), f, indent=2)


async def load_playwright_context(session: AuthSession):
    """
    Async context manager that yields a Playwright Page loaded with an auth session.

    Usage:
        async with load_playwright_context(session) as (browser, page):
            await page.goto(url)
        # browser is closed after the block
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise ImportError(
            "playwright is not installed. Run: pip install playwright && playwright install chromium"
        )

    if session.is_expired:
        logger.warning("Session '%s' is expired — results may be incomplete", session.label)

    if not os.path.exists(session.storage_state_path):
        raise FileNotFoundError(
            f"storage_state not found for session '{session.label}': {session.storage_state_path}"
        )

    return _PlaywrightContextManager(session)


class _PlaywrightContextManager:
    """Internal async context manager for Playwright sessions."""

    def __init__(self, session: AuthSession):
        self.session = session
        self._pw = None
        self._browser = None

    async def __aenter__(self):
        from playwright.async_api import async_playwright
        self._pw = async_playwright()
        pw = await self._pw.__aenter__()
        self._browser = await pw.chromium.launch(headless=True)
        ctx = await self._browser.new_context(
            storage_state=self.session.storage_state_path
        )
        page = await ctx.new_page()
        return self._browser, page

    async def __aexit__(self, *exc):
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.__aexit__(*exc)
