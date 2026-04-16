"""
prospecting_analysis.py — FastAPI router
Endpoints: POST /prospecting/scrape + POST /prospecting/analyze
"""
import json
import asyncio
import os
import re as _re
import xml.etree.ElementTree as _ET
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse
import httpx
try:
    from playwright.async_api import async_playwright
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

load_dotenv()

from database.prospecting_db import init_db, contact_update
init_db()

router = APIRouter(prefix="/prospecting", tags=["prospecting"])

# ── Tier config ───────────────────────────────────────────────────────────────
TIER_MODELS = {
    "free": "claude-haiku-4-5-20251001",
    "paid": "claude-sonnet-4-6",
}
TIER_MAX_TOKENS = {
    "free": 8192,
    "paid": 8192,
}

# ── Pydantic models ───────────────────────────────────────────────────────────
class ScrapeRequest(BaseModel):
    urls: list[str]
    max_subpages: int = 8  # sub-pages to crawl per site root
    contact_id: Optional[int] = None  # if set, save content to DB

class ScrapeResult(BaseModel):
    url: str
    content: str
    status: str  # 'ok' | 'error'
    emails: list[str] = []  # discovered contact emails, best first

class ScrapeResponse(BaseModel):
    results: list[ScrapeResult]

class AnalyzeRequest(BaseModel):
    company: str
    contact_id: Optional[int] = None
    notes: Optional[str] = ""
    scraped_content: Optional[str] = ""
    custom_prompt: str
    tier: str = "free"
    model: Optional[str] = None  # overrides tier if provided

class AnalyzeResponse(BaseModel):
    analysis: dict
    model_used: str
    tokens_used: int


# ── Scraper ───────────────────────────────────────────────────────────────────
#
# Strategy (layered, in order of richness):
#   1. Homepage HTML — title, meta og/twitter, JSON-LD, body text
#   2. SPA inline data — __NEXT_DATA__, __NUXT__, window.__INITIAL_STATE__
#   3. robots.txt → Sitemap: URLs
#   4. sitemap.xml / sitemap_index — all site pages
#   5. RSS / Atom feed — latest posts with titles + summaries
#   6. Internal links from homepage — discover real sub-pages
#   7. Common path probes — /about /services /blog /work /team …
#   8. Deep crawl top-N sub-pages concurrently, scored by relevance
#
# Auto-triggers deep crawl for site roots (no path), single scrape otherwise.

_CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _CHROME_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

_COMMON_PATHS = [
    "/about", "/nosotros", "/quienes-somos", "/sobre-nosotros",
    "/services", "/servicios", "/soluciones", "/solutions",
    "/work", "/projects", "/proyectos", "/portfolio", "/casos", "/case-studies",
    "/blog", "/noticias", "/news", "/articulos", "/insights",
    "/equipo", "/team", "/people",
    "/contact", "/contacto",
    "/pricing", "/precios", "/planes",
    "/productos", "/products",
    "/clientes", "/clients", "/partners",
    "/tecnologia", "/technology", "/stack",
]
_SKIP_PATTERNS = [
    "/login", "/signup", "/register", "/cart", "/checkout",
    "/wp-admin", "/wp-login", "/admin", "/404", "/500",
    "/cdn-cgi", "/wp-content", ".pdf", ".zip", ".jpg", ".png",
]

# ── Email extractor ────────────────────────────────────────────────────────────
_EMAIL_RE = _re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

# Scored prefixes — higher = better for outreach
_EMAIL_PREFIX_SCORE: list[tuple[list[str], int]] = [
    (["hola", "hello", "hi", "hey"],                          100),
    (["contacto", "contact", "contactenos", "contactus"],     95),
    (["info", "information"],                                  90),
    (["general", "mail", "email"],                            80),
    (["team", "equipo"],                                      75),
    (["press", "prensa", "media"],                            70),
    (["ventas", "sales", "comercial", "business"],            65),
    (["studio", "estudio"],                                   60),
]
_EMAIL_BLACKLIST = {
    "noreply", "no-reply", "donotreply", "bounce", "mailer-daemon",
    "postmaster", "abuse", "spam", "robot", "bot",
    "support", "soporte", "help", "ayuda", "helpdesk",
    "admin", "administrator", "webmaster", "root",
    "sentry", "errors", "alerts", "notifications", "notify",
    "wordpress", "woocommerce",
}

def _extract_emails(html_or_text: str, domain: str = "") -> list[str]:
    """
    Extract and rank email addresses from HTML/text.
    Returns list sorted by outreach suitability (best first).
    """
    raw = _EMAIL_RE.findall(html_or_text)
    seen: set[str] = set()
    scored: list[tuple[int, str]] = []

    site_domain = urlparse("https://" + domain).netloc.lower() if domain else ""

    for email in raw:
        email = email.lower().strip(".,;'\"")
        if email in seen:
            continue
        seen.add(email)

        local = email.split("@")[0]
        email_domain = email.split("@")[1] if "@" in email else ""

        # Skip obvious noise
        if local in _EMAIL_BLACKLIST:
            continue
        if any(b in local for b in _EMAIL_BLACKLIST):
            continue
        # Skip emails from unrelated domains (unless we have no domain to compare)
        if site_domain and email_domain and not site_domain.endswith(email_domain) and not email_domain.endswith(site_domain.split(".")[-2] + "." + site_domain.split(".")[-1]) if "." in site_domain else False:
            continue
        # Skip example/placeholder
        if "example" in email or "yourdomain" in email or "correo" == local:
            continue

        score = 10  # base
        for prefixes, s in _EMAIL_PREFIX_SCORE:
            if any(local.startswith(p) or local == p for p in prefixes):
                score = s
                break

        scored.append((score, email))

    scored.sort(key=lambda x: -x[0])
    return [e for _, e in scored[:8]]


# ── Login walls ────────────────────────────────────────────────────────────────
_LOGIN_WALL_SIGNALS = [
    "únete a linkedin", "join linkedin", "registrarse | linkedin",
    "sign in to your account", "create your account",
    "you must be logged in", "please log in",
    "iniciar sesión para ver",
]

def _is_login_wall(html: str) -> bool:
    low = html[:3000].lower()
    return sum(1 for s in _LOGIN_WALL_SIGNALS if s in low) >= 1

# ── Noise line filter ──────────────────────────────────────────────────────────
_NOISE_FRAGMENTS = [
    # auth / forms
    "inicia sesión", "iniciar sesión", "sign in", "log in",
    "únete a", "join linkedin", "registrarse", "sign up", "crear cuenta",
    "¿ya estás", "¿no eres tú?", "aceptar y unirse",
    "contraseña", "password", "email o teléfono",
    "continuar con google", "continue with google", "continue with facebook",
    "¿has olvidado tu contraseña", "forgot password",
    # legal boilerplate
    "política de privacidad", "privacy policy", "condiciones de uso",
    "terms of use", "terms of service", "política de cookies", "cookie policy",
    "al hacer clic en", "by clicking",
    # cookie banners
    "aceptar cookies", "accept cookies", "rechazar cookies", "gestionar cookies",
    "usamos cookies", "we use cookies",
    # generic nav noise
    "ver más", "read more", "leer más", "load more",
    "suscribirse", "subscribe", "newsletter",
    "© ", "all rights reserved", "todos los derechos reservados",
]

def _filter_noise(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        low = line.lower()
        # skip very short lines (nav items, button labels)
        if len(line) < 8:
            continue
        # skip lines dominated by special chars (icons, separators)
        if _re.match(r'^[\W\d\s]+$', line):
            continue
        if any(n in low for n in _NOISE_FRAGMENTS):
            continue
        out.append(line)
    return out


def _base_root(url: str) -> str:
    p = urlparse(url)
    return urlunparse((p.scheme, p.netloc, "", "", "", ""))

def _same_domain(url: str, base: str) -> bool:
    return urlparse(url).netloc == urlparse(base).netloc

def _should_skip(url: str) -> bool:
    low = url.lower()
    return any(p in low for p in _SKIP_PATTERNS)

def _normalize(href: str, base: str) -> str | None:
    try:
        full = urljoin(base, href).split("#")[0].split("?")[0].rstrip("/")
        if not full.startswith("http"):
            return None
        if not _same_domain(full, base):
            return None
        if _should_skip(full):
            return None
        return full
    except Exception:
        return None

def _is_root(url: str) -> bool:
    if not url.startswith("http"):
        url = "https://" + url
    return urlparse(url).path in ("", "/")

def _score_url(url: str) -> int:
    low = url.lower()
    if any(p in low for p in ["/about", "/nosotros", "/quienes"]):        return 10
    if any(p in low for p in ["/service", "/servicio", "/solucion"]):     return 10
    if any(p in low for p in ["/work", "/project", "/portfolio", "/caso"]): return 9
    if any(p in low for p in ["/blog", "/news", "/noticias", "/article", "/insight"]): return 8
    if any(p in low for p in ["/product", "/producto"]):                   return 8
    if any(p in low for p in ["/team", "/equipo", "/people"]):             return 7
    if any(p in low for p in ["/pricing", "/precio", "/plan"]):            return 7
    if any(p in low for p in ["/contact", "/contacto"]):                   return 4
    return 3


def _extract_strings(obj, out: list, depth: int = 0) -> None:
    """Recursively extract readable strings from nested JSON/dict/list."""
    if depth > 5 or len(out) > 40:
        return
    if isinstance(obj, str) and len(obj.strip()) > 10:
        out.append(obj.strip()[:200])
    elif isinstance(obj, dict):
        for v in obj.values():
            _extract_strings(v, out, depth + 1)
    elif isinstance(obj, list):
        for item in obj[:15]:
            _extract_strings(item, out, depth + 1)


async def _try_fetch(url: str, client: httpx.AsyncClient, timeout: float = 10.0):
    """Fetch URL silently, return (final_url, text) or None."""
    try:
        r = await client.get(url, headers=_HEADERS, timeout=timeout, follow_redirects=True)
        if r.status_code == 200:
            return str(r.url), r.text
        return None
    except Exception:
        return None


def _extract_page(url: str, html: str, max_body_lines: int = 150) -> str:
    """Extract all useful text from a page. Handles SSR, SPA meta, JSON-LD, SPA inline data."""
    soup = BeautifulSoup(html, "html.parser")
    parts: list[str] = []

    # ── Title ────────────────────────────────────────────────────────────────
    if soup.title and soup.title.string:
        parts.append(f"TÍTULO: {soup.title.string.strip()}")

    # ── Meta tags ────────────────────────────────────────────────────────────
    meta: dict[str, str] = {}
    for m in soup.find_all("meta"):
        k = (m.get("property") or m.get("name") or "").strip().lower()
        v = (m.get("content") or "").strip()
        if k and v:
            meta[k] = v
    for k in [
        "description", "keywords",
        "og:description", "og:title", "og:site_name", "og:type",
        "twitter:description", "twitter:title",
        "article:published_time", "article:tag",
    ]:
        if k in meta:
            parts.append(f"{k.upper()}: {meta[k][:300]}")

    # ── JSON-LD ───────────────────────────────────────────────────────────────
    def _flat_ld(obj, prefix="") -> list[str]:
        out = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                if not k.startswith("@"):
                    out.extend(_flat_ld(v, k))
        elif isinstance(obj, list):
            for item in obj:
                out.extend(_flat_ld(item, prefix))
        elif obj and str(obj).strip():
            out.append(f"{prefix}: {str(obj)[:200]}")
        return out

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            flat = _flat_ld(data)
            if flat:
                parts.append("JSON-LD:\n" + "\n".join(flat[:40]))
        except Exception:
            pass

    # ── SPA inline data ───────────────────────────────────────────────────────
    def _extract_strings(obj, out: list, depth=0):
        if depth > 5 or len(out) > 40:
            return
        if isinstance(obj, str) and len(obj.strip()) > 10:
            out.append(obj.strip()[:200])
        elif isinstance(obj, dict):
            for v in obj.values():
                _extract_strings(v, out, depth + 1)
        elif isinstance(obj, list):
            for item in obj[:15]:
                _extract_strings(item, out, depth + 1)

    for script in soup.find_all("script"):
        src = script.string or ""
        if not src.strip():
            continue

        # Next.js __NEXT_DATA__
        if "__NEXT_DATA__" in src:
            try:
                m = _re.search(r"__NEXT_DATA__\s*=\s*(\{.+\})\s*</script>", src + "</script>", _re.DOTALL)
                if m:
                    data = json.loads(m.group(1))
                    props = data.get("props", {}).get("pageProps", {})
                    texts: list[str] = []
                    _extract_strings(props, texts)
                    if texts:
                        parts.append("NEXT.JS DATA:\n" + "\n".join(texts[:30]))
            except Exception:
                pass

        # Nuxt.js __NUXT__
        if "__NUXT__" in src:
            try:
                strings = _re.findall(r'"([^"]{15,200})"', src)
                readable = [s for s in strings if " " in s and not s.startswith(("http", "/", "\\"))][:20]
                if readable:
                    parts.append("NUXT DATA:\n" + "\n".join(readable))
            except Exception:
                pass

        # Generic window state
        if "window.__INITIAL_STATE__" in src or "window.__APP_STATE__" in src:
            try:
                m = _re.search(r"window\.__(?:INITIAL|APP)_STATE__\s*=\s*(\{.+?\})\s*;", src, _re.DOTALL)
                if m:
                    data = json.loads(m.group(1))
                    texts = []
                    _extract_strings(data, texts)
                    if texts:
                        parts.append("SPA STATE:\n" + "\n".join(texts[:25]))
            except Exception:
                pass

        # Gatsby / Remix / generic window.__data
        if "window.__data" in src.lower() or "window.pageData" in src:
            try:
                m = _re.search(r"window\.\w+\s*=\s*(\{.+?\})\s*;", src, _re.DOTALL)
                if m:
                    data = json.loads(m.group(1))
                    texts = []
                    _extract_strings(data, texts)
                    if texts:
                        parts.append("PAGE DATA:\n" + "\n".join(texts[:20]))
            except Exception:
                pass

    # ── Body text ─────────────────────────────────────────────────────────────
    for tag in soup(["script", "style", "noscript", "iframe", "svg", "link"]):
        tag.decompose()

    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id=_re.compile(r"^(content|main|app|root)$", _re.I))
        or soup.find(class_=_re.compile(r"(main|content|page)", _re.I))
        or soup.body
    )
    if main:
        text = main.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.splitlines() if len(l.strip()) >= 4]
        # remove noise + deduplicate consecutive
        lines = _filter_noise(lines)
        deduped, prev = [], None
        for line in lines:
            if line != prev:
                deduped.append(line)
            prev = line
        if deduped:
            parts.append("CONTENIDO:\n" + "\n".join(deduped[:max_body_lines]))

    return "\n\n".join(p for p in parts if p)


async def _sitemap_urls(base: str, client: httpx.AsyncClient) -> list[str]:
    """Discover all URLs from sitemap(s) and robots.txt."""
    urls: list[str] = []
    candidates = [
        f"{base}/sitemap.xml",
        f"{base}/sitemap_index.xml",
        f"{base}/sitemap-index.xml",
        f"{base}/wp-sitemap.xml",
        f"{base}/post-sitemap.xml",
        f"{base}/page-sitemap.xml",
    ]
    # Check robots.txt for Sitemap: lines
    robots = await _try_fetch(f"{base}/robots.txt", client)
    if robots:
        for line in robots[1].splitlines():
            if line.lower().startswith("sitemap:"):
                sm = line.split(":", 1)[1].strip()
                if sm not in candidates:
                    candidates.insert(0, sm)

    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    for sm_url in candidates[:5]:
        result = await _try_fetch(sm_url, client)
        if not result:
            continue
        try:
            root = _ET.fromstring(result[1])
            # sitemap index → recurse one level
            sub_locs = root.findall(f"{{{ns}}}sitemap/{{{ns}}}loc") or root.findall("sitemap/loc")
            for loc_el in sub_locs:
                if loc_el.text:
                    sub = await _try_fetch(loc_el.text.strip(), client)
                    if sub:
                        try:
                            sub_root = _ET.fromstring(sub[1])
                            for l in sub_root.findall(f"{{{ns}}}url/{{{ns}}}loc") or sub_root.findall("url/loc"):
                                if l.text:
                                    urls.append(l.text.strip())
                        except Exception:
                            pass
            # regular sitemap
            for l in root.findall(f"{{{ns}}}url/{{{ns}}}loc") or root.findall("url/loc"):
                if l.text:
                    urls.append(l.text.strip())
            if urls:
                break
        except Exception:
            pass

    return [u for u in dict.fromkeys(urls) if _same_domain(u, base) and not _should_skip(u)]


async def _rss_content(base: str, client: httpx.AsyncClient) -> str:
    """Try RSS/Atom feeds, return formatted latest posts string."""
    for path in ["/feed", "/rss", "/rss.xml", "/atom.xml", "/feed.xml", "/blog/feed", "/blog/rss", "/news/feed"]:
        result = await _try_fetch(base + path, client)
        if not result:
            continue
        html = result[1]
        if not any(t in html[:600] for t in ["<rss", "<feed", "<atom", "xmlns"]):
            continue
        try:
            root = _ET.fromstring(html)
            items: list[str] = []
            # RSS 2.0
            for item in root.findall(".//item")[:10]:
                title = (item.findtext("title") or "").strip()
                desc  = (item.findtext("description") or "").strip()
                date  = (item.findtext("pubDate") or "").strip()
                if title:
                    entry = f"• {title}"
                    if date:
                        entry += f" [{date[:16]}]"
                    if desc:
                        entry += f"\n  {BeautifulSoup(desc, 'html.parser').get_text()[:150]}"
                    items.append(entry)
            # Atom
            atom_ns = "http://www.w3.org/2005/Atom"
            for entry in root.findall(f"{{{atom_ns}}}entry")[:10]:
                title   = (entry.findtext(f"{{{atom_ns}}}title") or "").strip()
                summary = (entry.findtext(f"{{{atom_ns}}}summary") or "").strip()
                updated = (entry.findtext(f"{{{atom_ns}}}updated") or "").strip()
                if title:
                    e = f"• {title}"
                    if updated:
                        e += f" [{updated[:10]}]"
                    if summary:
                        e += f"\n  {summary[:150]}"
                    items.append(e)
            if items:
                return "BLOG / PUBLICACIONES RECIENTES:\n" + "\n".join(items)
        except Exception:
            pass
    return ""


def _is_wordpress(html: str) -> bool:
    """Detect WordPress sites via HTML signals."""
    signals = [
        'wp-content/', 'wp-includes/', 'wp-json',
        '<link rel="https://api.w.org/"', 'generator" content="WordPress',
    ]
    lower = html[:8000].lower()
    return any(s.lower() in lower for s in signals)


async def _wordpress_api_content(base: str, client: httpx.AsyncClient) -> str:
    """
    Fetch pages + posts from WordPress REST API.
    Returns formatted content of all pages and recent posts.
    This is far more reliable than HTML scraping for WordPress sites.
    """
    sections: list[str] = []

    # Pages (About, Work, Projects, etc.)
    pages_r = await _try_fetch(f"{base}/wp-json/wp/v2/pages?per_page=20&_fields=title,content,link", client, timeout=12.0)
    if pages_r:
        try:
            pages = json.loads(pages_r[1])
            if isinstance(pages, list) and pages:
                for page in pages:
                    title = page.get("title", {}).get("rendered", "").strip()
                    rendered = page.get("content", {}).get("rendered", "").strip()
                    link = page.get("link", "")
                    if not title or not rendered:
                        continue
                    text = BeautifulSoup(rendered, "html.parser").get_text(separator="\n", strip=True)
                    lines = _filter_noise([l.strip() for l in text.splitlines() if len(l.strip()) >= 4])
                    if lines:
                        sections.append(f"[PÁGINA] {title}\n{link}\n" + "\n".join(lines[:60]))
        except Exception:
            pass

    # Posts (case studies, blog)
    posts_r = await _try_fetch(f"{base}/wp-json/wp/v2/posts?per_page=10&_fields=title,content,excerpt,link,date", client, timeout=12.0)
    if posts_r:
        try:
            posts = json.loads(posts_r[1])
            if isinstance(posts, list) and posts:
                for post in posts:
                    title = post.get("title", {}).get("rendered", "").strip()
                    excerpt = post.get("excerpt", {}).get("rendered", "").strip()
                    rendered = post.get("content", {}).get("rendered", "").strip()
                    link = post.get("link", "")
                    date = post.get("date", "")[:10]
                    if not title:
                        continue
                    # Skip default "Hello World" placeholder posts
                    if title.lower() in ("¡hola, mundo!", "hello world!", "hello world"):
                        continue
                    text = BeautifulSoup(excerpt or rendered, "html.parser").get_text(separator=" ", strip=True)
                    if text and len(text) > 20:
                        sections.append(f"[POST] {title} ({date})\n{link}\n{text[:400]}")
        except Exception:
            pass

    if not sections:
        return ""
    return "WORDPRESS API — PÁGINAS Y POSTS:\n\n" + "\n\n".join(sections)


async def _wordpress_custom_urls(base: str, client: httpx.AsyncClient) -> list[str]:
    """
    Discover URLs for custom post types via WP REST API types endpoint.
    Returns list of page URLs to scrape for content.
    This handles work/portfolio/project CPTs that store content in HTML templates.
    """
    urls: list[str] = []
    types_r = await _try_fetch(f"{base}/wp-json/wp/v2/types", client, timeout=8.0)
    if not types_r:
        return urls
    try:
        types = json.loads(types_r[1])
        # Skip built-in types already handled
        skip = {"post", "page", "attachment", "nav_menu_item", "wp_block",
                "wp_template", "wp_template_part", "wp_global_styles",
                "wp_navigation", "wp_font_family", "wp_font_face"}
        for type_key, type_info in types.items():
            if type_key in skip:
                continue
            rest_base = type_info.get("rest_base") or type_key
            items_r = await _try_fetch(
                f"{base}/wp-json/wp/v2/{rest_base}?per_page=20&_fields=link,title",
                client, timeout=10.0
            )
            if not items_r:
                continue
            try:
                items = json.loads(items_r[1])
                if isinstance(items, list):
                    for item in items:
                        link = item.get("link", "")
                        if link and _same_domain(link, base):
                            urls.append(link)
            except Exception:
                pass
    except Exception:
        pass
    return urls


async def _playwright_scrape(url: str) -> str:
    """
    Headless Chromium scrape for JS-heavy SPAs.
    - Intercepts fetch() API calls to capture JSON responses
    - Waits for networkidle (full JS render)
    - Extracts rendered DOM + window SPA state (Next.js, Nuxt, etc.)
    Falls back gracefully if playwright is not installed.
    """
    if not _PLAYWRIGHT_AVAILABLE:
        return ""

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=_CHROME_UA,
            extra_http_headers={"Accept-Language": "es-ES,es;q=0.9,en;q=0.8"},
        )
        page = await context.new_page()

        # Intercept fetch() calls before navigation to capture JSON API responses
        await page.add_init_script("""
            window.__rnd_api = [];
            const _f = window.fetch;
            window.fetch = async (...a) => {
                const r = await _f(...a);
                try {
                    if ((r.headers.get('content-type') || '').includes('application/json')
                        && window.__rnd_api.length < 6) {
                        const d = await r.clone().json();
                        window.__rnd_api.push(d);
                    }
                } catch(e) {}
                return r;
            };
        """)

        try:
            await page.goto(url, wait_until="networkidle", timeout=25000)
        except Exception:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await asyncio.sleep(3)
            except Exception:
                await browser.close()
                return ""

        html = await page.content()

        spa_texts: list[str] = []
        try:
            raw = await page.evaluate("""() => JSON.stringify({
                next: window.__NEXT_DATA__     || null,
                nuxt: window.__NUXT__          || null,
                init: window.__INITIAL_STATE__ || null,
                api:  window.__rnd_api         || [],
            })""")
            if raw:
                data_map = json.loads(raw)
                for key, val in data_map.items():
                    if val:
                        texts: list[str] = []
                        _extract_strings(val, texts)
                        if texts:
                            spa_texts.append(f"SPA {key.upper()}:\n" + "\n".join(texts[:25]))
        except Exception:
            pass

        await browser.close()

    parts: list[str] = []
    body = _extract_page(url, html, max_body_lines=200)
    if body:
        parts.append(body)
    parts.extend(spa_texts)
    return "\n\n".join(parts)


async def scrape_site(base_url: str, client: httpx.AsyncClient, max_subpages: int = 8) -> ScrapeResult:
    """Deep site scrape: homepage + sitemap + RSS + sub-pages."""
    if not base_url.startswith("http"):
        base_url = "https://" + base_url

    base = _base_root(base_url)
    all_sections: list[str] = []
    scraped: set[str] = set()

    # ── 1. Homepage ──────────────────────────────────────────────────────────
    hp = await _try_fetch(base_url, client, timeout=15.0)
    if not hp:
        return ScrapeResult(url=base_url, content="", status="error: No se pudo acceder al sitio")

    final_url, homepage_html = hp
    scraped.add(final_url.rstrip("/"))
    content_hp = _extract_page(final_url, homepage_html, max_body_lines=120)
    if content_hp:
        all_sections.append(f"=== {final_url} [HOMEPAGE] ===\n{content_hp}")

    # ── 2. RSS ───────────────────────────────────────────────────────────────
    rss = await _rss_content(base, client)
    if rss:
        all_sections.append(rss)

    # ── 2b. WordPress REST API (much better than RSS for WP sites) ───────────
    wp_cpt_urls: list[str] = []
    if _is_wordpress(homepage_html):
        wp_content = await _wordpress_api_content(base, client)
        if wp_content:
            all_sections.append(wp_content)
        # Also discover custom post type URLs (work, portfolio, etc.) to crawl their HTML
        wp_cpt_urls = await _wordpress_custom_urls(base, client)

    # ── 3. Sitemap ───────────────────────────────────────────────────────────
    sm_urls = await _sitemap_urls(base, client)

    # ── 4. Internal links from homepage ──────────────────────────────────────
    soup_hp = BeautifulSoup(homepage_html, "html.parser")
    internal: list[str] = []
    for a in soup_hp.find_all("a", href=True):
        norm = _normalize(a["href"], final_url)
        if norm and norm not in scraped:
            internal.append(norm)

    # ── 5. Common path probes ────────────────────────────────────────────────
    probes = [base + p for p in _COMMON_PATHS]

    # ── 6. Merge, dedupe, score ──────────────────────────────────────────────
    seen = set(scraped)
    candidates: list[str] = []
    for u in wp_cpt_urls + sm_urls + internal + probes:
        clean = u.rstrip("/")
        if clean not in seen and _same_domain(clean, base):
            seen.add(clean)
            candidates.append(clean)
    # WP CPT urls are already high-value — keep them, then fill with scored rest
    cpt_set = {u.rstrip("/") for u in wp_cpt_urls}
    cpt_candidates = [u for u in candidates if u in cpt_set]
    other_candidates = sorted([u for u in candidates if u not in cpt_set], key=_score_url, reverse=True)
    to_crawl = (cpt_candidates + other_candidates)[:max(max_subpages, len(cpt_candidates) + 4)]

    # ── 7. Crawl sub-pages ───────────────────────────────────────────────────
    async def _sub(url: str):
        r = await _try_fetch(url, client)
        if not r:
            return None
        c = _extract_page(r[0], r[1], max_body_lines=100)
        if not c or len(c.strip()) < 60:
            return None
        return (url, c)

    sub_results = await asyncio.gather(*[_sub(u) for u in to_crawl])
    for r in sub_results:
        if r:
            all_sections.append(f"=== {r[0]} ===\n{r[1][:2500]}")

    combined = "\n\n".join(all_sections)
    domain = urlparse(base_url).netloc
    # Collect emails from all crawled HTML
    all_html = homepage_html + "\n".join(
        section for section in all_sections
    )
    found_emails = _extract_emails(all_html, domain)

    if not combined.strip():
        # Fallback: try Playwright for JS-rendered SPAs
        if _PLAYWRIGHT_AVAILABLE:
            pw_content = await _playwright_scrape(base_url)
            if pw_content and len(pw_content.strip()) > 100:
                return ScrapeResult(url=base_url, content=pw_content[:10000], status="ok", emails=found_emails)
        return ScrapeResult(
            url=base_url,
            content="",
            status="error: El sitio parece ser una SPA sin contenido accesible. Playwright no está instalado o el sitio bloquea scrapers.",
            emails=found_emails,
        )

    return ScrapeResult(url=base_url, content=combined[:10000], status="ok", emails=found_emails)


async def scrape_url(url: str, client: httpx.AsyncClient) -> ScrapeResult:
    """Single-URL scrape (specific pages, not site roots)."""
    try:
        if not url.startswith("http"):
            url = "https://" + url
        r = await _try_fetch(url, client, timeout=15.0)
        if not r:
            # Fallback to Playwright (JS redirects, auth walls, etc.)
            if _PLAYWRIGHT_AVAILABLE:
                pw_content = await _playwright_scrape(url)
                if pw_content and len(pw_content.strip()) > 100:
                    return ScrapeResult(url=url, content=pw_content[:5000], status="ok", emails=_extract_emails(pw_content, urlparse(url).netloc))
            return ScrapeResult(url=url, content="", status="error: No se pudo acceder a la URL")
        # Detect login walls before wasting tokens
        if _is_login_wall(r[1]):
            domain = urlparse(url).netloc
            return ScrapeResult(url=url, content="", status=f"error: {domain} requiere login para ver este contenido. Ingresá la información manualmente.")
        content = _extract_page(r[0], r[1])
        found_emails = _extract_emails(r[1], urlparse(url).netloc)
        # Fallback to Playwright if BS4 got too little (SPA)
        if len(content.strip()) < 300 and _PLAYWRIGHT_AVAILABLE:
            pw_content = await _playwright_scrape(url)
            if pw_content and len(pw_content.strip()) > len(content.strip()):
                content = pw_content
                found_emails = _extract_emails(pw_content, urlparse(url).netloc) or found_emails
        return ScrapeResult(url=url, content=content[:5000], status="ok", emails=found_emails)
    except Exception as e:
        err = str(e).replace("\n", " ").strip()
        if "999" in err and "linkedin" in url.lower():
            msg = "LinkedIn bloquea scrapers automáticos (error 999). Ingresá el contenido manualmente."
        else:
            msg = err[:120]
        return ScrapeResult(url=url, content="", status=f"error: {msg}")


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_urls(request: ScrapeRequest):
    """
    Scrape URLs.
    - Site roots (no path): deep crawl — sitemap + RSS + sub-pages
    - Specific pages: single-page extraction
    """
    if len(request.urls) > 5:
        raise HTTPException(status_code=400, detail="Máximo 5 URLs por request")

    async with httpx.AsyncClient() as client:
        tasks = []
        for url in request.urls:
            if _is_root(url) and "linkedin.com" not in url.lower():
                tasks.append(scrape_site(url, client, max_subpages=request.max_subpages))
            else:
                tasks.append(scrape_url(url, client))
        results = await asyncio.gather(*tasks)

    # Persist scraped content to DB if contact_id is provided
    if getattr(request, 'contact_id', None):
        from datetime import datetime as _dt
        combined = "\n\n".join(r.content for r in results if r.content)
        contact_update(request.contact_id, {
            "scraped_content": combined,
            "scrape_ts": _dt.now().isoformat(),
        })

    return ScrapeResponse(results=list(results))


# ── AI Analysis ───────────────────────────────────────────────────────────────
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_prospect(request: AnalyzeRequest):
    """
    Run AI analysis on a prospect using Claude.
    Returns structured JSON with entry vectors, opportunities, score, etc.
    """
    model = request.model or TIER_MODELS.get(request.tier, TIER_MODELS["free"])
    max_tokens = TIER_MAX_TOKENS.get(request.tier, 1500)

    # The prompt comes from the frontend (user may have customized it)
    # We add a final JSON-enforcement instruction
    system_prompt = """Sos un consultor experto en estrategia B2B, marketing digital, ingeniería de producto y ventas.
Respondés ÚNICAMENTE con JSON válido, sin markdown, sin backticks, sin texto extra.
El JSON debe ser parseado directamente con json.loads(). Si no podés analizar algo, incluí campos vacíos pero mantené la estructura."""

    try:
        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY / CLAUDE_API_KEY no configurada en .env")
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[
                {"role": "user", "content": request.custom_prompt}
            ]
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if model adds them anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        try:
            analysis = json.loads(raw)
        except json.JSONDecodeError as e:
            # Return partial error with raw for debugging
            raise HTTPException(
                status_code=422,
                detail=f"El modelo no devolvió JSON válido: {str(e)[:200]}\nRaw: {raw[:300]}"
            )

        if request.contact_id:
            contact_update(request.contact_id, {"ai_analysis": analysis})

        return AnalyzeResponse(
            analysis=analysis,
            model_used=model,
            tokens_used=message.usage.input_tokens + message.usage.output_tokens,
        )

    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {str(e)}")


# ── Translate pitch ───────────────────────────────────────────────────────────
class TranslatePitchRequest(BaseModel):
    subject: str
    text: str
    html: str
    lang: str  # 'en' | 'fr' | 'es'

class TranslatePitchResponse(BaseModel):
    subject: str
    text: str
    html: str

_LANG_NAMES = {"en": "English", "fr": "French", "es": "Spanish", "ca": "Catalan"}

@router.post("/translate-pitch", response_model=TranslatePitchResponse)
async def translate_pitch(request: TranslatePitchRequest):
    """
    Translate a pitch email (subject, plain text, HTML) to the target language.
    Uses Claude Haiku for speed. HTML tags/attributes are preserved verbatim.
    """
    lang_name = _LANG_NAMES.get(request.lang, "English")
    if request.lang == "es":
        # No-op for default language
        return TranslatePitchResponse(subject=request.subject, text=request.text, html=request.html)

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY / CLAUDE_API_KEY no configurada en .env")

    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        f"You are a professional B2B sales email translator. "
        f"Your task is to translate the provided pitch email content into {lang_name}. "
        "Rules:\n"
        "1. For the 'subject' and 'text' fields: translate naturally and professionally, preserving tone.\n"
        "2. For the 'html' field: translate ONLY the visible human-readable text. "
        "DO NOT change any HTML tags, CSS styles, attributes, URLs, email addresses, or code. "
        "Only translate the text content between tags.\n"
        "3. Keep brand names, company names, personal names, and technical terms as-is.\n"
        "4. Maintain the same sales psychology and persuasion structure.\n"
        "Respond ONLY with valid JSON, no markdown, no backticks:\n"
        '{"subject": "...", "text": "...", "html": "..."}'
    )

    user_msg = json.dumps({"subject": request.subject, "text": request.text, "html": request.html}, ensure_ascii=False)

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        result = json.loads(raw)
        return TranslatePitchResponse(
            subject=result.get("subject", request.subject),
            text=result.get("text", request.text),
            html=result.get("html", request.html),
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=422, detail=f"Translation parsing error: {str(e)}")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {str(e)}")

