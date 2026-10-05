#!/usr/bin/env python3
"""Export the local datasets, meditation and recorded sessions as a replay bundle for Cloud Run.

Requires the full local stack (torch, mne) for frames and the local backend running for /doc snapshots.
Upload the result with scripts/upload_replay_bundle.sh.
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Sequence

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from replay.exporter import MIN_RECORDED_ID, build_manifest, export_doc_snapshots, export_frames, write_manifest  # noqa: E402


def fetch_json(url: str, retries: int = 8) -> bytes:
    """GET con reintentos: el rate limiter del backend local (429) corta las ráfagas de snapshots."""
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"unsupported URL scheme: {url}")
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:  # nosec B310
                data: bytes = response.read()
            return data
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == retries:
                raise
            wait = int(exc.headers.get("Retry-After") or 0) or min(60, 2**attempt * 2)
            time.sleep(wait)
    raise AssertionError("unreachable")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=BACKEND_DIR / "replay_bundle")
    parser.add_argument("--api", default="http://localhost:8000", help="running local backend for /doc snapshots")
    parser.add_argument("--skip-recorded", action="store_true", help="skip recorded (Postgres/Influx) sessions")
    parser.add_argument("--only", nargs="+", metavar="ID", help="export only these session ids (e.g. physionet_run2)")
    parser.add_argument(
        "--min-recorded-id",
        type=int,
        default=MIN_RECORDED_ID,
        help="ignore recorded sessions with a lower id (early ones were taken while fixing bugs)",
    )
    parser.add_argument("--skip-doc", action="store_true", help="skip /doc snapshots (no backend needed)")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    from ai.inference import SyntergicBrain  # heavy: torch + mne, only needed here

    print(f"Exporting replay bundle -> {args.out}")
    brain = SyntergicBrain()
    entries = export_frames(
        brain, args.out, skip_recorded=args.skip_recorded, only=args.only, min_recorded_id=args.min_recorded_id
    )
    if not entries:
        print("No session could be exported; aborting without manifest.", file=sys.stderr)
        return 1
    if not args.skip_doc:
        saved = export_doc_snapshots(args.out, args.api, fetch_json, min_session_id=args.min_recorded_id)
        print(f"Doc snapshots: {saved} sessions")
    print(f"Manifest: {write_manifest(args.out, build_manifest(entries))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
