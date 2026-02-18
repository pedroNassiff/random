#!/usr/bin/env python3
"""
Random Lab — LinkedIn Scraper Propio
=====================================
Mismo approach que el sniper del Colosseo:
Playwright + stealth + tu sesión real de LinkedIn.

Sin pagar APIs. Sin límites artificiales.
Tu cuenta LinkedIn = tu acceso.

SETUP (una sola vez):
    pip install playwright playwright-stealth
    playwright install chromium

    Conseguir tu li_at cookie:
    1. Abre LinkedIn en Chrome
    2. F12 → Application → Cookies → www.linkedin.com
    3. Copia el valor de "li_at"
    4. En .env: LINKEDIN_LI_AT=tu_cookie_aqui

USO:
    python -m automation.linkedin_scraper --dry-run --campaign wellness_tech_europe
    python -m automation.linkedin_scraper --query "neurofeedback startup Barcelona" --dry-run
    python -m automation.linkedin_scraper --campaign wellness_tech_europe   # LIVE
    python -m automation.linkedin_scraper --cookie                          # Solo guardar cookie

⚠️  LÍMITES SEGUROS:
    - Max 80-100 perfiles/día por cuenta
    - Pausa 3-8s entre requests (aleatorio)
    - No más de 3 campañas seguidas sin pausa
"""

import asyncio
import argparse
import json
import os
import random
import re
import time
from datetime import datetime
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

# ============================================
# CONFIG
# ============================================

LINKEDIN_LI_AT = os.getenv("LINKEDIN_LI_AT")  # Tu cookie de sesión
AUTOMATION_API = os.getenv("AUTOMATION_API", "http://localhost:8000/automation")

# Límites conservadores para no triggear ban
MIN_DELAY = 5.0   # segundos mínimo entre requests (aumentado de 3)
MAX_DELAY = 12.0  # segundos máximo (aumentado de 8)
MAX_PER_SEARCH = 10  # empresas por búsqueda (LinkedIn muestra ~10 en primera página)
DAILY_LIMIT = 80  # requests máximos por sesión

# Retry config — mejores prácticas de resilience
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # segundos
RETRY_MAX_DELAY = 10.0  # segundos máximo exponential backoff
PAGE_STABLE_TIMEOUT = 15000  # ms para esperar página estable

# User agents del sniper — rotación realista
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# Campañas — mismo formato que scraper.py
CAMPAIGNS = {
    "wellness_tech_europe": {
        "description": "Apps de meditación, biohacking y neurofeedback en Europa",
        "search_queries": [
            "wellness technology startup",
            "meditation app company Europe",
            "neurofeedback startup",
            "biohacking technology company",
            "mental wellness platform",
        ],
        "keywords_filter": ["wellness", "health", "meditation", "neuro", "biohack", "mental", "brain", "mind"],
    },
    "consciousness_tech": {
        "description": "Startups en mindfulness digital y cognitive enhancement",
        "search_queries": [
            "consciousness technology",
            "cognitive enhancement platform",
            "digital mindfulness startup",
            "brain computer interface company",
        ],
        "keywords_filter": ["consciousness", "cognitive", "mindful", "brain", "neural", "mental"],
    },
    "creative_tech_studios": {
        "description": "Estudios que mezclan arte, datos y tecnología",
        "search_queries": [
            "creative technology studio",
            "generative art company",
            "data visualization studio",
            "immersive experience studio Barcelona",
            "interactive installation studio Europe",
        ],
        "keywords_filter": ["creative", "art", "generative", "immersive", "interactive", "experience", "3d"],
    },
    "health_tech_bcn": {
        "description": "Health tech en Barcelona y España",
        "search_queries": [
            "health technology Barcelona",
            "digital health Spain startup",
            "healthtech Barcelona",
            "salud digital startup",
        ],
        "keywords_filter": ["health", "salud", "medical", "digital health", "barcelona", "spain"],
    },
    "innovation_labs": {
        "description": "Labs de innovación corporativos",
        "search_queries": [
            "innovation lab technology Europe",
            "R&D technology lab",
            "corporate innovation studio",
        ],
        "keywords_filter": ["innovation", "lab", "research", "studio", "R&D"],
    },
}


# ============================================
# LINKEDIN SCRAPER
# ============================================

class LinkedInScraper:
    """
    Scraper de LinkedIn usando Playwright stealth.
    Misma filosofía del sniper: navegador real, comportamiento humano.
    """

    def __init__(self, dry_run: bool = False, headless: bool = True):
        self.dry_run = dry_run
        self.headless = headless
        self.request_count = 0
        self.stats = {
            "scraped": 0,
            "sent_to_backend": 0,
            "errors": 0,
            "skipped_duplicates": 0,
        }

    def _human_delay(self, min_s: float = MIN_DELAY, max_s: float = MAX_DELAY):
        """Delay aleatorio — simula comportamiento humano como en el sniper"""
        delay = random.uniform(min_s, max_s)
        time.sleep(delay)

    def _get_random_ua(self) -> str:
        return random.choice(USER_AGENTS)

    def _sanitize_log(self, message: str) -> str:
        """Sanitiza logs para no exponer cookies u otros datos sensibles"""
        if not message:
            return message
        # Reemplazar cualquier cookie por asteriscos
        if LINKEDIN_LI_AT and LINKEDIN_LI_AT in message:
            message = message.replace(LINKEDIN_LI_AT, "li_at:***REDACTED***")
        return message

    async def _wait_for_stable_page(self, page, timeout: int = PAGE_STABLE_TIMEOUT, retries: int = MAX_RETRIES) -> bool:
        """
        Espera a que la página esté estable y no navegando.
        Usa retry logic con exponential backoff.
        
        Best practices:
        - Network idle check
        - Multiple wait strategies
        - Exponential backoff en reintentos
        - Timeout configurables
        """
        for attempt in range(retries):
            try:
                # Strategy 1: Wait for network to be idle
                await page.wait_for_load_state("networkidle", timeout=timeout)
                
                # Strategy 2: Pequeña espera adicional para JS dinámico
                await asyncio.sleep(1)
                
                # Strategy 3: Verificar que no hay navegación activa
                url = page.url
                await asyncio.sleep(0.5)
                
                # Si la URL no cambió, la página está estable
                if url == page.url:
                    return True
                    
            except Exception as e:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                print(f"  ⏳ Página navegando (intento {attempt + 1}/{retries}), esperando {delay:.1f}s...")
                await asyncio.sleep(delay)
                
                if attempt == retries - 1:
                    print(f"  ⚠️  Timeout esperando página estable: {str(e)}")
                    return False
        
        return False

    async def _safe_goto(self, page, url: str, wait_until: str = "domcontentloaded", timeout: int = 15000, wait_stable: bool = True) -> bool:
        """
        Navegación segura con retry logic y error handling.
        
        Args:
            page: Playwright page object
            url: URL de destino
            wait_until: Estrategia de espera ('domcontentloaded', 'networkidle', 'load')
            timeout: Timeout en ms
            wait_stable: Si debe esperar a que la página esté estable después de cargar
            
        Returns:
            bool: True si navegación exitosa, False en caso contrario
        """
        for attempt in range(MAX_RETRIES):
            try:
                await page.goto(url, wait_until=wait_until, timeout=timeout)
                
                if wait_stable:
                    is_stable = await self._wait_for_stable_page(page)
                    if not is_stable and attempt < MAX_RETRIES - 1:
                        delay = RETRY_BASE_DELAY * (2 ** attempt)
                        print(f"  ⏳ Página inestable, reintentando en {delay:.1f}s...")
                        await asyncio.sleep(delay)
                        continue
                    return is_stable
                
                return True
                
            except Exception as e:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                error_msg = self._sanitize_log(str(e))
                
                if attempt < MAX_RETRIES - 1:
                    print(f"  ⚠️  Error navegando (intento {attempt + 1}/{MAX_RETRIES}): {error_msg}")
                    print(f"  ⏳ Reintentando en {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    print(f"  ❌ Falló navegación después de {MAX_RETRIES} intentos: {error_msg}")
                    return False
        
        return False

    async def _safe_get_content(self, page, retries: int = MAX_RETRIES) -> Optional[str]:
        """
        Obtiene el contenido de la página de forma segura con retry logic.
        
        Args:
            page: Playwright page object
            retries: Número de reintentos
            
        Returns:
            str o None: Contenido HTML o None si falla
        """
        for attempt in range(retries):
            try:
                content = await page.content()
                return content
                
            except Exception as e:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                error_msg = self._sanitize_log(str(e))
                
                if "navigating" in error_msg.lower() or "changing" in error_msg.lower():
                    # La página está navegando, esperar más
                    print(f"  ⏳ Página navegando, esperando {delay:.1f}s...")
                    await asyncio.sleep(delay)
                    
                    # Intentar esperar estabilidad
                    is_stable = await self._wait_for_stable_page(page, timeout=10000, retries=2)
                    if is_stable and attempt < retries - 1:
                        continue
                
                if attempt < retries - 1:
                    print(f"  ⚠️  Error obteniendo contenido (intento {attempt + 1}/{retries}): {error_msg}")
                    await asyncio.sleep(delay)
                else:
                    print(f"  ❌ No se pudo obtener contenido después de {retries} intentos")
                    return None
        
        return None

    async def _setup_browser(self, playwright):
        """
        Configura Chromium con máximo stealth.
        Basado en las técnicas del sniper v9 + mejoras anti-detección.
        """
        ua = self._get_random_ua()

        browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1366,768",
                "--disable-extensions",
                "--disable-dev-shm-usage",
                "--disable-web-security",
                "--lang=en-US,en;q=0.9",
                # Mejoras anti-detección adicionales
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-features=BlockInsecurePrivateNetworkRequests",
            ],
        )

        context = await browser.new_context(
            user_agent=ua,
            viewport={"width": 1366, "height": 768},
            locale="en-US",
            timezone_id="Europe/Madrid",
            # Headers más realistas para evitar detección
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0",
            },
            # Simular permisos reales de browser
            permissions=[],
            color_scheme="light",
        )

        # Inyectar scripts anti-detección (del sniper + mejoras)
        await context.add_init_script("""
            // === NIVEL 1: Ocultar indicadores básicos de automatización ===
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // === NIVEL 2: Simular entorno real de Chrome ===
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer'},
                    {name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'},
                    {name: 'Native Client', description: '', filename: 'internal-nacl-plugin'}
                ]
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en', 'es']
            });
            
            // === NIVEL 3: Chrome runtime completo ===
            window.chrome = {
                runtime: {
                    connect: () => {},
                    sendMessage: () => {},
                    PlatformOs: {MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd'}
                },
                loadTimes: function() {
                    return {
                        commitLoadTime: Date.now() / 1000 - Math.random(),
                        connectionInfo: 'h2',
                        finishDocumentLoadTime: Date.now() / 1000 - Math.random() / 2,
                        finishLoadTime: Date.now() / 1000 - Math.random() / 4,
                        firstPaintAfterLoadTime: 0,
                        firstPaintTime: Date.now() / 1000 - Math.random() / 2,
                        navigationType: 'Other',
                        npnNegotiatedProtocol: 'h2',
                        requestTime: Date.now() / 1000 - Math.random() * 2,
                        startLoadTime: Date.now() / 1000 - Math.random() * 2,
                        wasAlternateProtocolAvailable: true,
                        wasFetchedViaSpdy: true,
                        wasNpnNegotiated: true
                    };
                },
                csi: function() {
                    return {
                        onloadT: Date.now(),
                        pageT: Date.now() - Math.random() * 1000,
                        startE: Date.now() - Math.random() * 2000,
                        tran: 15
                    };
                },
                app: {
                    isInstalled: false,
                    InstallState: {DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed'},
                    RunningState: {CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running'}
                }
            };
            
            // === NIVEL 4: Permisos y notificaciones ===
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({state: Notification.permission}) :
                    originalQuery(parameters)
            );
            
            // === NIVEL 5: WebGL Vendor (evitar "headless" signature) ===
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.call(this, parameter);
            };
        """)

        # Inyectar cookie de sesión de LinkedIn
        if LINKEDIN_LI_AT:
            await context.add_cookies([
                {
                    "name": "li_at",
                    "value": LINKEDIN_LI_AT,
                    "domain": ".linkedin.com",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                }
            ])

        return browser, context

    def _extract_company_data(self, card_text: str, linkedin_url: str, campaign: str) -> Optional[dict]:
        """
        Extrae datos estructurados del texto de una card de empresa de LinkedIn.
        LinkedIn muestra: Nombre | Industria | Ubicación | Nº empleados | Followers
        """

        if not card_text or len(card_text.strip()) < 5:
            return None

        lines = [l.strip() for l in card_text.split("\n") if l.strip()]

        if not lines:
            return None

        company_name = lines[0]

        # Extraer industria (segunda línea típicamente)
        industry = lines[1] if len(lines) > 1 else None

        # Buscar ubicación (contiene ciudad o país)
        location = None
        for line in lines[2:]:
            if any(loc in line.lower() for loc in [
                "spain", "españa", "barcelona", "madrid", "germany", "uk", "france",
                "netherlands", "sweden", "italy", "europe", "united kingdom",
                "london", "berlin", "paris", "amsterdam", "stockholm"
            ]):
                location = line
                break

        # Buscar tamaño de empresa
        company_size = None
        size_patterns = [
            r"(\d+[,\.]?\d*)\s*[-–]\s*(\d+[,\.]?\d*)\s*employees",
            r"(\d+[,\.]?\d+)\s*employees",
            r"(\d+)\+\s*employees",
        ]
        for line in lines:
            for pattern in size_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    company_size = line.strip()
                    break

        return {
            "company_name": company_name,
            "website": None,  # LinkedIn no muestra website en cards
            "linkedin_url": linkedin_url,
            "industry": industry,
            "company_size": company_size,
            "location": location,
            "tech_stack": None,
            "tags": [campaign, "linkedin_direct"],
            "source": "linkedin_playwright",
        }

    async def _simulate_human_navigation(self, page, search_url: str) -> bool:
        """
        Simula navegación humana en lugar de ir directo a la URL de búsqueda.
        LinkedIn detecta menos bots cuando el flujo parece natural.
        
        Flujo humano:
        1. Ir al feed primero
        2. Pequeño delay (leer posts)
        3. Luego buscar
        """
        try:
            # Paso 1: Ir al feed primero (comportamiento humano)
            feed_success = await self._safe_goto(
                page, 
                "https://www.linkedin.com/feed/",
                wait_stable=True,
                timeout=10000
            )
            
            if not feed_success:
                # Si falla el feed, intentar directo (fallback)
                return await self._safe_goto(page, search_url, wait_stable=True)
            
            # Paso 2: Esperar un poco (simular lectura)
            await asyncio.sleep(random.uniform(2, 4))
            
            # Paso 3: Scroll ligero (simular lectura de posts)
            await page.evaluate("window.scrollTo(0, 300)")
            await asyncio.sleep(random.uniform(0.5, 1))
            
            # Paso 4: Ahora sí, ir a búsqueda
            return await self._safe_goto(page, search_url, wait_stable=True)
            
        except Exception as e:
            print(f"  ⚠️  Error en navegación humana: {e}")
            # Fallback: intentar directo
            return await self._safe_goto(page, search_url, wait_stable=True)

    async def search_companies(
        self,
        query: str,
        campaign: str,
        page,
        max_results: int = MAX_PER_SEARCH,
    ) -> list[dict]:
        """
        Busca empresas en LinkedIn usando la barra de búsqueda + filtro Companies.
        Mismo approach que el sniper: URL directa, espera inteligente, extracción real.
        """

        print(f"  🔍 LinkedIn: '{query}'...")

        # URL de búsqueda directa de companies en LinkedIn
        search_url = (
            f"https://www.linkedin.com/search/results/companies/"
            f"?keywords={query.replace(' ', '%20')}&origin=SWITCH_SEARCH_VERTICAL"
        )

        try:
            # Navegación con comportamiento humano (en lugar de directo)
            nav_success = await self._simulate_human_navigation(page, search_url)
            if not nav_success:
                print("  ❌ No se pudo acceder a la página de búsqueda")
                self.stats["errors"] += 1
                return []
            
            self.request_count += 1

            # Esperar a que carguen los resultados
            try:
                await page.wait_for_selector(
                    ".search-results-container, .reusable-search__entity-result-list",
                    timeout=8000
                )
            except Exception:
                # Si no hay resultados o LinkedIn pide login
                content = await self._safe_get_content(page)
                if content and ("authwall" in content.lower() or "sign in" in content.lower()):
                    print("  ⚠️  LinkedIn pide login — cookie expirada o no configurada")
                    return []
                # Intentar continuar igual
                await asyncio.sleep(2)

            # Scroll suave para cargar lazy content (técnica del sniper)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
            await asyncio.sleep(1)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            await asyncio.sleep(0.5)

            # Extraer cards de empresa
            results = await page.evaluate("""
                () => {
                    const results = [];
                    
                    // Selector principal de cards de resultado
                    const cards = document.querySelectorAll(
                        '.reusable-search__result-container, ' +
                        '.search-result__wrapper, ' +
                        '[data-chameleon-result-urn], ' +
                        '.entity-result'
                    );
                    
                    cards.forEach(card => {
                        // Nombre de la empresa
                        const nameEl = card.querySelector(
                            '.entity-result__title-text a, ' +
                            '.app-aware-link span[aria-hidden="true"], ' +
                            '.search-result__title'
                        );
                        
                        // URL de LinkedIn de la empresa
                        const linkEl = card.querySelector(
                            'a[href*="/company/"]'
                        );
                        
                        if (!nameEl || !linkEl) return;
                        
                        const name = nameEl.innerText.trim();
                        const href = linkEl.href;
                        
                        // Extraer LinkedIn URL limpia
                        const match = href.match(/linkedin\\.com\\/company\\/([^/?]+)/);
                        if (!match) return;
                        
                        const slug = match[1];
                        const linkedinUrl = `https://www.linkedin.com/company/${slug}`;
                        
                        // Texto secundario (industria, ubicación, tamaño)
                        const subtitleEl = card.querySelector(
                            '.entity-result__primary-subtitle, ' +
                            '.search-result__truncate'
                        );
                        const industry = subtitleEl ? subtitleEl.innerText.trim() : null;
                        
                        const locationEl = card.querySelector(
                            '.entity-result__secondary-subtitle'
                        );
                        const location = locationEl ? locationEl.innerText.trim() : null;
                        
                        results.push({
                            company_name: name,
                            linkedin_url: linkedinUrl,
                            industry: industry,
                            location: location,
                        });
                    });
                    
                    return results;
                }
            """)

            # Mapear al schema del backend
            companies = []
            for r in results[:max_results]:
                if r.get("company_name"):
                    companies.append({
                        "company_name": r["company_name"],
                        "website": None,
                        "linkedin_url": r.get("linkedin_url", ""),
                        "industry": r.get("industry"),
                        "company_size": None,
                        "location": r.get("location"),
                        "tech_stack": None,
                        "tags": [campaign, "linkedin_direct"],
                        "source": "linkedin_playwright",
                    })

            print(f"  ✅ {len(companies)} empresas encontradas")
            self.stats["scraped"] += len(companies)
            return companies

        except Exception as e:
            print(f"  ❌ Error en búsqueda '{query}': {e}")
            self.stats["errors"] += 1
            return []

    async def enrich_company(self, company: dict, page) -> dict:
        """
        Visita la página de la empresa para obtener más datos:
        website, descripción, tamaño exacto.
        Opcional — solo para leads de alta prioridad.
        """
        if not company.get("linkedin_url"):
            return company

        try:
            # Navegación segura a página About de la empresa
            about_url = f"{company['linkedin_url']}/about/"
            nav_success = await self._safe_goto(page, about_url, wait_stable=True, timeout=10000)
            
            if not nav_success:
                print(f"  ⚠️  No se pudo acceder a {about_url}")
                return company
            
            await asyncio.sleep(random.uniform(1.5, 3))

            data = await page.evaluate("""
                () => {
                    const getText = (sel) => {
                        const el = document.querySelector(sel);
                        return el ? el.innerText.trim() : null;
                    };
                    
                    // Website
                    const websiteEl = document.querySelector(
                        'a[data-tracking-control-name="about_website"]'
                    );
                    const website = websiteEl ? websiteEl.href : null;
                    
                    // Company size
                    const sizeEl = document.querySelector(
                        '[data-test-id="about-us__size"] dd, ' +
                        '.org-about-company-module__company-size-definition-text'
                    );
                    const size = sizeEl ? sizeEl.innerText.trim() : null;
                    
                    // Specialties
                    const specEl = document.querySelector(
                        '[data-test-id="about-us__specialties"] dd'
                    );
                    const specialties = specEl ? specEl.innerText.trim() : null;
                    
                    return { website, size, specialties };
                }
            """)

            if data.get("website"):
                company["website"] = data["website"]
            if data.get("size"):
                company["company_size"] = data["size"]
            if data.get("specialties"):
                # Usar specialties para inferir tech stack
                specs_lower = data["specialties"].lower()
                tech = {}
                for category, terms in {
                    "biometrics": ["eeg", "biofeedback", "neurofeedback", "brain"],
                    "3d_graphics": ["webgl", "three.js", "unity", "3d", "ar", "vr"],
                    "data_ai": ["machine learning", "ai", "deep learning", "neural"],
                    "wellness": ["meditation", "mindfulness", "wellness", "mental"],
                }.items():
                    found = [t for t in terms if t in specs_lower]
                    if found:
                        tech[category] = found
                if tech:
                    company["tech_stack"] = tech

        except Exception:
            pass  # El enrich es opcional, seguimos sin él

        return company

    async def send_to_backend(self, company: dict) -> Optional[dict]:
        """Envía lead al backend"""
        if self.dry_run:
            loc = company.get("location", "N/A")
            ind = company.get("industry", "N/A")
            print(f"  [DRY RUN] {company['company_name']} | {ind} | {loc}")
            return {"id": "dry_run"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{AUTOMATION_API}/webhooks/lead-scraped",
                    json=company,
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code == 200:
                    self.stats["sent_to_backend"] += 1
                    return response.json()
                else:
                    print(f"  ⚠️  Backend {response.status_code}: {response.text[:80]}")
                    self.stats["errors"] += 1
                    return None
        except Exception as e:
            print(f"  ❌ Backend error: {e}")
            self.stats["errors"] += 1
            return None

    async def diagnose_linkedin_access(self, page) -> dict:
        """
        Diagnóstico completo de acceso a LinkedIn.
        Identifica el problema específico y da recomendaciones.
        
        Returns:
            dict con 'status', 'issue', y 'recommendation'
        """
        diagnosis = {
            "status": "unknown",
            "issue": None,
            "recommendation": None
        }
        
        try:
            # Test 1: Intentar acceder al feed
            print("  🔬 Diagnóstico: navegando a LinkedIn...")
            nav_result = await self._safe_goto(
                page,
                "https://www.linkedin.com/feed/",
                wait_stable=False,  # No esperar estabilidad para diagnosis rápida
                timeout=10000
            )
            
            if not nav_result:
                diagnosis["status"] = "error"
                diagnosis["issue"] = "ERR_TOO_MANY_REDIRECTS o timeout"
                diagnosis["recommendation"] = (
                    "La cookie LINKEDIN_LI_AT está expirada o inválida.\\n"
                    "   📌 Solución:\\n"
                    "   1. Abre LinkedIn en Chrome\\n"
                    "   2. F12 → Application → Cookies → www.linkedin.com\\n"
                    "   3. Copia el valor COMPLETO de 'li_at'\\n"
                    "   4. Actualiza LINKEDIN_LI_AT en .env\\n"
                    "   5. Reinicia el scraper"
                )
                return diagnosis
            
            # Test 2: Verificar URL final
            url = page.url
            if "authwall" in url or "login" in url or "checkpoint" in url:
                diagnosis["status"] = "auth_required"
                diagnosis["issue"] = f"Redirigido a: {url}"
                diagnosis["recommendation"] = (
                    "LinkedIn requiere autenticación o verificación de seguridad.\\n"
                    "   📌 Solución:\\n"
                    "   1. Abre LinkedIn manualmente en tu browser\\n"
                    "   2. Completa cualquier verificación de seguridad\\n"
                    "   3. Obtén una cookie nueva siguiendo los pasos anteriores"
                )
                return diagnosis
            
            # Test 3: Verificar contenido
            content = await self._safe_get_content(page)
            if content:
                if "Sign in" in content and "Join now" in content:
                    diagnosis["status"] = "logged_out"
                    diagnosis["issue"] = "Página muestra login"
                    diagnosis["recommendation"] = "Cookie inválida o expirada - renovar LINKEDIN_LI_AT"
                elif "feed" in url:
                    diagnosis["status"] = "success"
                    diagnosis["issue"] = None
                    diagnosis["recommendation"] = None
                    return diagnosis
            
            # Test 4: Si llegamos aquí, algo raro pasó
            diagnosis["status"] = "unknown"
            diagnosis["issue"] = f"Estado ambiguo (URL: {url})"
            diagnosis["recommendation"] = "Intenta en modo no-headless para debug: --no-headless"
            
        except Exception as e:
            diagnosis["status"] = "error"
            diagnosis["issue"] = f"Exception: {self._sanitize_log(str(e))}"
            diagnosis["recommendation"] = "Error inespecado - contacta soporte técnico"
        
        return diagnosis

    async def check_session_valid(self, page, verbose: bool = True) -> bool:
        """
        Verifica que la cookie de LinkedIn sea válida.
        
        Mejoras de ingeniería:
        - Retry logic con exponential backoff
        - Manejo robusto de navegación en curso
        - Multiple validation checks
        - Error handling detallado
        """
        for attempt in range(MAX_RETRIES):
            try:
                # Step 1: Navegar con timeout razonable usando safe_goto
                nav_success = await self._safe_goto(
                    page,
                    "https://www.linkedin.com/feed/",
                    wait_until="domcontentloaded",
                    timeout=15000,
                    wait_stable=False  # Ya lo verificaremos manualmente después
                )
                
                if not nav_success:
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                        continue
                    return False
                
                # Step 2: Esperar a que la página esté estable (sin navegaciones activas)
                is_stable = await self._wait_for_stable_page(page, timeout=PAGE_STABLE_TIMEOUT)
                
                if not is_stable:
                    print(f"  ⚠️  Página no se estabilizó en intento {attempt + 1}/{MAX_RETRIES}")
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                        continue
                    return False
                
                # Step 3: Validaciones de sesión
                url = page.url
                
                # Check 1: URL no debe redirigir a login/authwall
                if "authwall" in url or "login" in url:
                    print("  ❌ Redirigido a login/authwall")
                    return False
                
                # Check 2: Intentar obtener contenido de forma segura
                content = await self._safe_get_content(page)
                if not content:
                    print(f"  ⚠️  No se pudo obtener contenido de la página")
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                        continue
                    return False
                
                # Check 3: Contenido no debe tener botones de login
                if "Sign in" in content and "Join now" in content:
                    print("  ❌ Contenido muestra página de login")
                    return False
                
                # Check 4: Debe tener elementos del feed (verificación positiva)
                if "feed" in url and ("share" in content.lower() or "post" in content.lower()):
                    return True
                    
                # Si llegamos aquí y la URL es del feed, asumimos válido
                if "feed" in url:
                    return True
                    
                print(f"  ⚠️  Validación inconclusa en intento {attempt + 1}/{MAX_RETRIES}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                    
                return False
                
            except Exception as e:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                error_msg = self._sanitize_log(str(e))
                print(f"  ⚠️  Error validando sesión (intento {attempt + 1}/{MAX_RETRIES}): {error_msg}")
                
                if attempt < MAX_RETRIES - 1:
                    print(f"  ⏳ Reintentando en {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    print(f"  ❌ Falló validación de sesión después de {MAX_RETRIES} intentos")
                    return False
        
        return False

    async def run_campaign(self, campaign_name: str, enrich: bool = False):
        """Ejecuta una campaña completa con Playwright"""

        campaign = CAMPAIGNS.get(campaign_name)
        if not campaign:
            print(f"❌ Campaña '{campaign_name}' no encontrada")
            return

        print(f"\n{'='*60}")
        print(f"🚀 CAMPAÑA: {campaign_name.upper()}")
        print(f"📋 {campaign['description']}")
        print(f"🔍 Queries: {len(campaign['search_queries'])}")
        print(f"🤖 Modo: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print(f"{'='*60}")

        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser, context = await self._setup_browser(p)
            page = await context.new_page()

            # Verificar sesión (con auto-renovación automatizada)
            if LINKEDIN_LI_AT:
                print("  🔐 Verificando sesión LinkedIn...")
                valid = await self.check_session_valid(page, verbose=False)
                if valid:
                    print("  ✅ Sesión activa")
                else:
                    print("  ❌ Sesión inválida o expirada")
                    print()
                    print("🔄 INICIANDO RENOVACIÓN AUTOMÁTICA")
                    print("   No necesitas copiar/pegar manualmente")
                    print()
                    
                    # Cerrar browser actual
                    await browser.close()
                    
                    # ⚡ RENOVACIÓN AUTOMÁTICA
                    new_cookie = await auto_refresh_cookie()
                    
                    if not new_cookie:
                        print()
                        print("❌ No se pudo renovar automáticamente")
                        print()
                        print("📝 ALTERNATIVA MANUAL:")
                        print("   python automation/scraper.py --cookie")
                        return
                    
                    # Reabrir browser con nueva cookie
                    print("🔄 Reiniciando scraper con nueva sesión...")
                    browser, context = await self._setup_browser(p)
                    page = await context.new_page()
                    
                    # Verificar que funciona
                    valid_now = await self.check_session_valid(page, verbose=False)
                    if not valid_now:
                        print("❌ Cookie renovada sigue siendo inválida")
                        print("🚨 Posible problema de seguridad en tu cuenta LinkedIn")
                        await browser.close()
                        return
                    
                    print("✅ Sesión renovada exitosamente")
                    print()
            else:
                print("  ⚠️  Sin LINKEDIN_LI_AT detectada")
                print()
                print("🔄 CAPTURA AUTOMÁTICA DE COOKIE")
                
                # Cerrar browser actual
                await browser.close()
                
                # Capturar automáticamente
                new_cookie = await auto_refresh_cookie()
                
                if not new_cookie:
                    print()
                    print("⚠️  Continuando sin autenticación (resultados limitados)")
                    # Reabrir sin cookie
                    browser, context = await self._setup_browser(p)
                    page = await context.new_page()
                else:
                    print("✅ Cookie capturada - iniciando scraping autenticado")
                    # Reabrir con cookie nueva
                    browser, context = await self._setup_browser(p)
                    page = await context.new_page()

            all_companies = []

            for query in campaign["search_queries"]:
                if self.request_count >= DAILY_LIMIT:
                    print(f"\n  ⛔ Límite diario alcanzado ({DAILY_LIMIT} requests). Para mañana.")
                    break

                companies = await self.search_companies(query, campaign_name, page)
                all_companies.extend(companies)

                # Pausa humana entre búsquedas
                self._human_delay()

            # Deduplicar
            seen = set()
            unique = []
            for c in all_companies:
                key = c.get("linkedin_url") or c.get("company_name", "").lower()
                if key and key not in seen:
                    seen.add(key)
                    unique.append(c)

            print(f"\n📊 {len(unique)} empresas únicas | Enviando al backend...\n")

            for company in unique:
                # Enrich opcional (visita la página de la empresa)
                if enrich and company.get("linkedin_url"):
                    company = await self.enrich_company(company, page)
                    self._human_delay(2, 4)

                result = await self.send_to_backend(company)

                if result and not self.dry_run:
                    lead_id = result.get("lead_id", "?")
                    print(f"  ✅ [{lead_id}] {company['company_name']} — {company.get('industry', 'N/A')}")

                await asyncio.sleep(0.3)

            await browser.close()

        self._print_summary()

    async def run_custom_query(self, query: str, enrich: bool = False):
        """Búsqueda puntual con auto-renovación de cookie"""
        print(f"\n🔍 BÚSQUEDA: '{query}'")

        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser, context = await self._setup_browser(p)
            page = await context.new_page()

            # Verificar sesión (con auto-renovación)
            if LINKEDIN_LI_AT:
                valid = await self.check_session_valid(page, verbose=False)
                if not valid:
                    print("  ❌ Cookie expirada - renovando automáticamente...")
                    await browser.close()
                    
                    new_cookie = await auto_refresh_cookie()
                    if not new_cookie:
                        print("❌ No se pudo renovar cookie")
                        return
                    
                    # Reabrir con nueva cookie
                    browser, context = await self._setup_browser(p)
                    page = await context.new_page()

            companies = await self.search_companies(query, "custom", page)

            for company in companies:
                if enrich:
                    company = await self.enrich_company(company, page)
                result = await self.send_to_backend(company)
                if result and not self.dry_run:
                    print(f"  ✅ {company['company_name']}")

            await browser.close()

        self._print_summary()

    def _print_summary(self):
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN")
        print(f"{'='*60}")
        print(f"  Empresas scrapeadas:  {self.stats['scraped']}")
        print(f"  Leads enviados:       {self.stats['sent_to_backend']}")
        print(f"  Errores:              {self.stats['errors']}")
        if not self.dry_run:
            print(f"\n  👉 Review: {AUTOMATION_API.replace('/automation', '')}/dashboard")
        print(f"{'='*60}\n")


# ============================================
# COOKIE AUTO-MANAGER (AUTOMATED)
# ============================================

async def auto_refresh_cookie() -> Optional[str]:
    """
    Sistema completamente automatizado de renovación de cookies.
    
    Filosofía de automatización total:
    - NO requiere copiar/pegar manual
    - Captura automática al detectar expiración
    - Guarda en .env automáticamente
    - Recarga variables de entorno
    - Continúa el scraping sin reiniciar
    
    Returns:
        str: Nueva cookie li_at o None si falla
    """
    print("\n" + "="*60)
    print("🔄 RENOVACIÓN AUTOMÁTICA DE COOKIE LINKEDIN")
    print("="*60)
    print("👉 Se abrirá un browser - haz login en LinkedIn")
    print("👉 La cookie se capturará y guardará automáticamente")
    print("👉 Todo sin copiar/pegar manual")
    print()
    
    from playwright.async_api import async_playwright
    
    li_at_cookie = None
    
    try:
        async with async_playwright() as p:
            print("⏳ Abriendo browser...")
            browser = await p.chromium.launch(
                headless=False,  # Siempre visible para login
                args=[
                    "--window-size=1280,720",
                    "--disable-blink-features=AutomationControlled",
                ]
            )
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 720},
                locale="en-US",
            )
            page = await context.new_page()
            
            try:
                print("🌐 Navegando a LinkedIn...")
                await page.goto(
                    "https://www.linkedin.com/login",
                    wait_until="domcontentloaded",
                    timeout=15000
                )
                
                print()
                print("🔑 HAZ LOGIN EN EL BROWSER")
                print("👉 Cuando veas tu feed de LinkedIn, presiona Enter aquí...")
                print()
                
                input("⏸️  [Presiona Enter cuando estés logueado] ")
                
                # Esperar un poco para asegurar que terminó
                await asyncio.sleep(2)
                
                # Verificar que realmente está logueado
                current_url = page.url
                if "feed" not in current_url and "login" in current_url:
                    print("⚠️  Parece que aún no terminaste el login...")
                    print("⏳ Esperando 5 segundos más...")
                    await asyncio.sleep(5)
                
                # Extraer cookies
                print("🔍 Extrayendo cookie...")
                cookies = await context.cookies()
                
                for cookie in cookies:
                    if cookie["name"] == "li_at":
                        li_at_cookie = cookie["value"]
                        break
                
                await browser.close()
                
            except Exception as e:
                print(f"❌ Error durante captura: {e}")
                await browser.close()
                return None
                
    except Exception as e:
        print(f"❌ Error iniciando browser: {e}")
        return None
    
    # Validar cookie capturada
    if not li_at_cookie:
        print("❌ No se encontró la cookie li_at")
        print("💡 Asegúrate de:")
        print("   - Completar el login exitosamente")
        print("   - Esperar a que cargue el feed")
        return None
    
    # Validar formato (cookies de LinkedIn son largas)
    if len(li_at_cookie) < 50:
        print(f"⚠️  Cookie sospechosamente corta ({len(li_at_cookie)} chars)")
        return None
    
    print(f"✅ Cookie capturada ({len(li_at_cookie)} caracteres)")
    
    # Guardar en .env automáticamente
    try:
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            ".env"
        )
        
        print(f"💾 Guardando en {os.path.basename(env_path)}...")
        
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                content = f.read()
            
            # Actualizar o agregar
            if "LINKEDIN_LI_AT" in content:
                import re
                content = re.sub(
                    r"LINKEDIN_LI_AT=.*",
                    f"LINKEDIN_LI_AT={li_at_cookie}",
                    content
                )
                print("✅ Cookie actualizada en .env")
            else:
                content += f"\nLINKEDIN_LI_AT={li_at_cookie}\n"
                print("✅ Cookie agregada a .env")
            
            with open(env_path, "w") as f:
                f.write(content)
        else:
            # Crear .env nuevo
            with open(env_path, "w") as f:
                f.write(f"LINKEDIN_LI_AT={li_at_cookie}\n")
            print("✅ Archivo .env creado")
        
        # Recargar variables de entorno en el proceso actual
        load_dotenv(override=True)
        
        # Actualizar variable global
        global LINKEDIN_LI_AT
        LINKEDIN_LI_AT = li_at_cookie
        
        print("🔄 Variables recargadas")
        print()
        print("✨ ¡Listo! Continuando con el scraping...")
        print("="*60)
        print()
        
        return li_at_cookie
        
    except Exception as e:
        print(f"❌ Error guardando: {e}")
        print(f"📝 Cookie capturada (cópiala manualmente si necesario):")
        print(f"   LINKEDIN_LI_AT={li_at_cookie}")
        return li_at_cookie


# ============================================
# HELPER: Capturar cookie interactivamente
# ============================================

async def capture_cookie_interactive():
    """
    Abre el browser visible para que el usuario haga login
    y captura automáticamente la cookie li_at.
    Útil si no quieres buscar la cookie manualmente.
    """
    print("\n🔐 CAPTURAR COOKIE DE LINKEDIN")
    print("="*50)
    print("Se abrirá un browser. Haz login en LinkedIn.")
    print("Cuando estés logueado, presiona Enter aquí.\n")

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        
        try:
            await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            print(f"⚠️  Error navegando a LinkedIn: {e}")
            await browser.close()
            return

        input("Presiona Enter cuando hayas hecho login en LinkedIn...")

        # Extraer la cookie
        cookies = await context.cookies()
        li_at = None
        for cookie in cookies:
            if cookie["name"] == "li_at":
                li_at = cookie["value"]
                break

        await browser.close()

    if li_at:
        print(f"\n✅ Cookie capturada!")
        print(f"\nAñade esto a tu .env:")
        print(f"LINKEDIN_LI_AT={li_at}")

        # Guardar automáticamente si existe el .env
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            ".env"
        )
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                content = f.read()

            if "LINKEDIN_LI_AT" in content:
                # Actualizar existente
                import re
                content = re.sub(r"LINKEDIN_LI_AT=.*", f"LINKEDIN_LI_AT={li_at}", content)
            else:
                content += f"\nLINKEDIN_LI_AT={li_at}\n"

            with open(env_path, "w") as f:
                f.write(content)
            print(f"✅ Guardado automáticamente en {env_path}")
    else:
        print("❌ No se encontró la cookie — asegúrate de haber hecho login")


# ============================================
# CLI
# ============================================

async def main():
    parser = argparse.ArgumentParser(
        description="Random Lab — LinkedIn Scraper (Playwright)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python -m automation.linkedin_scraper --cookie           # Capturar cookie (abre browser)
  python -m automation.linkedin_scraper --dry-run --campaign wellness_tech_europe
  python -m automation.linkedin_scraper --campaign wellness_tech_europe
  python -m automation.linkedin_scraper --query "neurofeedback Barcelona" --dry-run
  python -m automation.linkedin_scraper --campaign creative_tech_studios --enrich

Setup:
  pip install playwright playwright-stealth
  playwright install chromium
        """,
    )

    parser.add_argument("--campaign", help="Nombre de campaña")
    parser.add_argument("--query", help="Query personalizada")
    parser.add_argument("--dry-run", action="store_true", help="Sin guardar en DB")
    parser.add_argument("--enrich", action="store_true", help="Visitar página de cada empresa para más datos")
    parser.add_argument("--visible", action="store_true", help="Mostrar el browser (no headless)")
    parser.add_argument("--cookie", action="store_true", help="Capturar cookie de LinkedIn interactivamente")
    parser.add_argument("--list-campaigns", action="store_true")

    args = parser.parse_args()

    if args.list_campaigns:
        print("\n📋 CAMPAÑAS:\n")
        for name, config in CAMPAIGNS.items():
            print(f"  {name}")
            print(f"    → {config['description']}")
            print(f"    → {len(config['search_queries'])} queries\n")
        return

    if args.cookie:
        await capture_cookie_interactive()
        return

    # Verificar Playwright instalado
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("\n❌ Playwright no instalado")
        print("   pip install playwright")
        print("   playwright install chromium\n")
        return

    print(f"\n📡 CONFIGURACIÓN:")
    print(f"   LinkedIn session: {'✅ LINKEDIN_LI_AT configurada' if LINKEDIN_LI_AT else '⚠️  Sin cookie (solo público)'}")
    print(f"   Backend: {AUTOMATION_API}")
    print(f"   Browser: {'Visible' if args.visible else 'Headless'}")

    if not LINKEDIN_LI_AT:
        print("\n💡 TIP: Para mejores resultados, configura tu cookie:")
        print("   python -m automation.linkedin_scraper --cookie\n")

    if args.dry_run:
        print("⚠️  DRY RUN — no se guarda en DB")

    scraper = LinkedInScraper(
        dry_run=args.dry_run,
        headless=not args.visible,
    )

    if args.query:
        await scraper.run_custom_query(args.query, enrich=args.enrich)
    elif args.campaign:
        await scraper.run_campaign(args.campaign, enrich=args.enrich)
    else:
        print("❌ Especifica --campaign o --query")
        print("   python -m automation.linkedin_scraper --list-campaigns")


if __name__ == "__main__":
    asyncio.run(main())