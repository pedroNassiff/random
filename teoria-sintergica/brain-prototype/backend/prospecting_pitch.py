"""
Prospecting Pitch Router — /prospecting/pitch

Handles:
  POST /prospecting/pitch/send       — send email via SMTP (Hostinger)
  GET  /prospecting/pitch/track/{id} — 1×1 pixel open tracking
  GET  /prospecting/pitch/stats/{contact_id} — open/click stats per contact
"""

import os
import uuid
import smtplib
import email.utils
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

from database.prospecting_db import (
    init_db, log_create, log_get, log_append_open,
    logs_by_contact, logs_all,
)

load_dotenv()
init_db()  # ensure tables exist

router = APIRouter(prefix="/prospecting/pitch", tags=["prospecting-pitch"])

# ── 1×1 transparent GIF bytes ──────────────────────────────────────────────────
PIXEL_GIF = (
    b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00'
    b'\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00'
    b'\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
)

# ── SMTP config (Hostinger) ───────────────────────────────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.hostinger.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER",     "")   # your@yourdomain.com
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM     = os.getenv("SMTP_FROM",     SMTP_USER)
_APP_URL_ENV  = os.getenv("APP_URL",       "http://localhost:8000")


def _get_public_url() -> tuple[str, bool]:
    """
    Returns (public_url, is_local).
    Priority:
      1. APP_URL env var if it's not localhost
      2. /tmp/cloudflare_tunnel_url — written by init-backend.sh / init-tunner-cloudflare.sh
      3. Auto-detect running ngrok tunnel via localhost:4040 API
      4. Fallback to APP_URL (localhost) → is_local=True
    """
    if _APP_URL_ENV and "localhost" not in _APP_URL_ENV and "127.0.0.1" not in _APP_URL_ENV:
        return _APP_URL_ENV.rstrip("/"), False

    # Check file written by cloudflared wrapper
    tunnel_file = Path("/tmp/cloudflare_tunnel_url")
    if tunnel_file.exists():
        try:
            url = tunnel_file.read_text().strip()
            if url.startswith("https://") and "trycloudflare.com" in url:
                return url.rstrip("/"), False
        except Exception:
            pass

    # Try ngrok local API
    for ngrok_port in (4040, 4041, 4042):
        try:
            with urllib.request.urlopen(f"http://localhost:{ngrok_port}/api/tunnels", timeout=1) as r:
                data = json.loads(r.read())
            for tunnel in data.get("tunnels", []):
                pub = tunnel.get("public_url", "")
                if pub.startswith("https://"):
                    return pub.rstrip("/"), False
            for tunnel in data.get("tunnels", []):
                pub = tunnel.get("public_url", "")
                if pub.startswith("http://"):
                    return pub.rstrip("/"), False
        except Exception:
            pass

    return _APP_URL_ENV.rstrip("/"), True


# ── Pydantic models ────────────────────────────────────────────────────────────
class SendPitchRequest(BaseModel):
    contact_id: int
    to_email: str
    subject: str
    body_html: str          # full HTML body (frontend renders template)
    body_text: str          # plain text fallback
    pitch_type: str = "email"  # "email" | "dm"
    company: Optional[str] = ""
    override_app_url: Optional[str] = None  # cloudflare/ngrok URL from frontend


# ── Routes ─────────────────────────────────────────────────────────────────────
@router.post("/send")
def send_pitch(req: SendPitchRequest):
    """Send a pitch email via Hostinger SMTP with embedded tracking pixel."""
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=503,
            detail="SMTP not configured. Add SMTP_USER and SMTP_PASSWORD to .env"
        )

    tracking_id = str(uuid.uuid4())
    if req.override_app_url and req.override_app_url.startswith("http"):
        app_url, is_local = req.override_app_url.rstrip("/"), False
    else:
        app_url, is_local = _get_public_url()
    pixel_url   = f"{app_url}/prospecting/pitch/track/{tracking_id}"
    pixel_tag   = f'<img src="{pixel_url}" width="1" height="1" alt="" style="display:none" />'

    # Inject tracking pixel once, just before the last </body>
    body_lower = req.body_html.lower()
    last_body_idx = body_lower.rfind("</body>")
    if last_body_idx != -1:
        tracked_html = req.body_html[:last_body_idx] + pixel_tag + "\n" + req.body_html[last_body_idx:]
    else:
        tracked_html = req.body_html + "\n" + pixel_tag

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = req.subject
    msg["From"]    = email.utils.formataddr(("Random Lab", SMTP_FROM))
    msg["To"]      = req.to_email
    msg["Message-ID"] = email.utils.make_msgid(domain=SMTP_FROM.split("@")[-1] if "@" in SMTP_FROM else "randomlab.io")

    msg.attach(MIMEText(req.body_text, "plain", "utf-8"))
    msg.attach(MIMEText(tracked_html,  "html",  "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [req.to_email], msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SMTP error: {str(e)}")

    # Persist log entry in SQLite
    log_create(
        tracking_id=tracking_id,
        contact_id=req.contact_id,
        company=req.company or "",
        to_email=req.to_email,
        subject=req.subject,
        pitch_type=req.pitch_type,
        sent_at=datetime.now().isoformat(),
    )

    return {
        "status":      "sent",
        "tracking_id": tracking_id,
        "to":          req.to_email,
        "pixel_url":   pixel_url,
        "tracking_local": is_local,
    }


@router.get("/track/{tracking_id}")
def track_open(tracking_id: str, request: Request):
    """
    Tracking pixel endpoint — called when the recipient opens the email.
    Returns a 1×1 transparent GIF and records the open event.
    Deduplicates multiple requests within 5 seconds (email clients often fire 2×).
    """
    log = log_get(tracking_id)
    if log is not None:
        now = datetime.now()
        ip  = request.client.host if request.client else "unknown"
        opens = log.get("opens", [])
        recent = [o for o in opens if o.get("ip") == ip]
        if recent:
            last_ts = datetime.fromisoformat(recent[-1]["timestamp"])
            if (now - last_ts).total_seconds() < 5:
                return Response(
                    content=PIXEL_GIF,
                    media_type="image/gif",
                    headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache"},
                )
        log_append_open(tracking_id, {
            "timestamp":  now.isoformat(),
            "ip":         ip,
            "user_agent": request.headers.get("user-agent", ""),
        })

    return Response(
        content=PIXEL_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma":        "no-cache",
        },
    )


@router.get("/stats/{contact_id}")
def pitch_stats(contact_id: int):
    """Return all pitch logs + open events for a given contact."""
    items = logs_by_contact(contact_id)
    return {
        "contact_id": contact_id,
        "total_sent": len(items),
        "pitches": [
            {
                **item,
                "open_count":  len(item.get("opens", [])),
                "last_opened": item["opens"][-1]["timestamp"] if item.get("opens") else None,
            }
            for item in items
        ],
    }


@router.get("/all-stats")
def all_pitch_stats():
    """Return aggregated stats for all contacts (for dashboard)."""
    all_logs = logs_all()
    return {
        "total_sent":   len(all_logs),
        "total_opens":  sum(len(v.get("opens", [])) for v in all_logs),
        "pitches":      all_logs,
    }


@router.get("/all-stats-by-contact")
def all_stats_by_contact():
    """Return a map of contact_id -> { open_count, last_opened, sent_count }
    for efficient kanban badge rendering (single fetch for all cards)."""
    all_logs = logs_all()
    result: dict[int, dict] = {}
    for item in all_logs:
        cid = item.get("contact_id")
        if cid is None:
            continue
        opens       = item.get("opens", [])
        open_count  = len(opens)
        last_opened = opens[-1]["timestamp"] if opens else None
        if cid not in result:
            result[cid] = {"open_count": 0, "last_opened": None, "sent_count": 0}
        result[cid]["sent_count"]  += 1
        result[cid]["open_count"]  += open_count
        if last_opened and (result[cid]["last_opened"] is None or last_opened > result[cid]["last_opened"]):
            result[cid]["last_opened"] = last_opened
    return result


@router.get("/tunnel-status")
def tunnel_status():
    """Check if a public tunnel (ngrok/cloudflared) is active for tracking."""
    url, is_local = _get_public_url()
    return {
        "public_url": url,
        "is_local":   is_local,
        "tracking_active": not is_local,
    }
