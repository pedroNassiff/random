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
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

load_dotenv()

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

class ScrapeResult(BaseModel):
    url: str
    content: str
    status: str  # 'ok' | 'error'

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
    "Accept-Encoding": "gzip, deflate, br",
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
        # deduplicate consecutive
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
    for u in sm_urls + internal + probes:
        clean = u.rstrip("/")
        if clean not in seen and _same_domain(clean, base):
            seen.add(clean)
            candidates.append(clean)
    candidates.sort(key=_score_url, reverse=True)
    to_crawl = candidates[:max_subpages]

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
    if not combined.strip():
        return ScrapeResult(
            url=base_url,
            content="",
            status="error: El sitio parece ser una SPA sin contenido HTML estático visible. Ingresá la información manualmente.",
        )

    return ScrapeResult(url=base_url, content=combined[:10000], status="ok")


async def scrape_url(url: str, client: httpx.AsyncClient) -> ScrapeResult:
    """Single-URL scrape (specific pages, not site roots)."""
    try:
        if not url.startswith("http"):
            url = "https://" + url
        r = await _try_fetch(url, client, timeout=15.0)
        if not r:
            return ScrapeResult(url=url, content="", status="error: No se pudo acceder a la URL")
        content = _extract_page(r[0], r[1])
        return ScrapeResult(url=url, content=content[:5000], status="ok")
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

        return AnalyzeResponse(
            analysis=analysis,
            model_used=model,
            tokens_used=message.usage.input_tokens + message.usage.output_tokens,
        )

    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Error Anthropic API: {str(e)}")

