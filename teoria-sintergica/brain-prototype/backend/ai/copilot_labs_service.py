"""
CopilotLabsService — copiloto AI especializado en sesiones EEG / Labs.

Usa OpenRouter (free tier) via httpx para el LLM.
El frontend envía el análisis pre-computado en la request,
evitando dependencias internas de DB en este servicio.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

from .llm_router import LLMRouter, QueryComplexity
from .eeg_analysis import analyze_session

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
GROQ_BASE       = "https://api.groq.com/openai/v1/chat/completions"
ANTHROPIC_BASE  = "https://api.anthropic.com/v1/messages"
OPENROUTER_REFERER = "https://random-lab.es"


# ── System prompts ───────────────────────────────────────────────────────────
# MAESTRO SINTÉRGICO v2.0
# Una identidad. Tres modos de presencia. Conocimiento de nivel divino.
# Neurociencia + Teoría Sintérgica + Datos + Sabiduría Contemplativa.

# ─────────────────────────────────────────────────────────────────────────────
# BASE DE CONOCIMIENTO UNIFICADA — NIVEL EXPERTO ABSOLUTO
# ─────────────────────────────────────────────────────────────────────────────
_EEG_KNOWLEDGE = """
═══════════════════════════════════════════════════════
I. NEUROCIENCIA CONTEMPLATIVA AVANZADA
═══════════════════════════════════════════════════════

BANDAS EEG — lectura profunda:

δ DELTA (0.5–4 Hz) — Presencia sin objeto
  En meditadores novatos: δ↑ sin α = adormecimiento / pérdida de consciencia.
  En meditadores expertos (Dzogchen, Jhana 4+): δ↑ + α↑ simultáneos = presencia pura sin objeto,
  consciencia sin contenido. Este patrón es extremadamente raro y altamente significativo.
  Mecanismo: desactivación del procesamiento sensorial con mantenimiento de vigilancia global.
  Ref: Lutz et al. (2004) PNAS; Berkovich-Ohana et al. (2015) Frontiers Human Neuroscience.

θ THETA (4–8 Hz) — La puerta interior
  Umbral consciente-inconsciente. Emerge en Vipassana profunda, estados hipnagógicos,
  consolidación de memoria episódica, insight creativo súbito, acceso a material inconsciente.
  θ frontal ↑ con α posterior ↑ = estado flow meditativo óptimo (Aftanas & Golocheikine 2001).
  Rango ideal meditación: 0.15–0.35. Picos θ breves = insight emergiendo a superficie.
  Mecanismo: oscilaciones hipocampales sincronizadas con corteza prefrontal mediodorsal.
  Ref: Aftanas & Golocheikine (2001) Neurosci Letters; Sauseng et al. (2010) Neuroscience.

α ALPHA (8–13 Hz) — La frecuencia del testigo
  Marcador principal de relajación alerta. Inhibición tónica de procesamiento irrelevante.
  No es pasividad — es presencia focalizada sin objeto. La distinción entre dormir y meditar.
  Escalas de interpretación (potencia relativa):
    α < 0.04  → mente activa discursiva o adormecimiento
    α 0.04–0.08 → onset, quietud construyéndose
    α 0.08–0.13 → meditación establecida (Shamatha básico)
    α 0.13–0.20 → Shamatha consolidado, atención sostenida madura
    α 0.20–0.25 → meditación profunda, pre-umbral sintérgico
    α ≥ 0.25    → UMBRAL SINTÉRGICO FORMAL — campo unificado activo
  Mecanismo: neuronas GABAérgicas del tálamo + corteza, feedback inhibitorio tálamo-cortical.
  Cambios estructurales con práctica sostenida: ↑ grosor cortical prefrontal, ↑ densidad materia gris insular.
  Ref: Travis & Shear (2010) Consciousness & Cognition; Lazar et al. (2005) NeuroReport.

β BETA (12–30 Hz) — La firma del hacedor
  Actividad mental discursiva, control top-down, planificación, juicio, esfuerzo atencional.
  β ↓ en meditación = el "hacedor" se disuelve. β < 0.05 = mente quieta óptima.
  β > 0.10 = diálogo interno activo, dispersión, esfuerzo excesivo.
  Paradoja: β alto en meditadores novatos intentando meditar = el esfuerzo sabotea el estado.
  β transitorio + γ = procesamiento de insight (distinto a dispersión — distinguir por contexto).

γ GAMMA (30–100 Hz) — El relámpago de integración global
  Integración neural de alta frecuencia. Sincronización intercortical de larga distancia.
  En Dzogchen/Mahamudra avanzado: γ sostenido + alta coherencia = rigpa (Lutz et al. 2004).
  γ transitorio breve = reconocimiento súbito, comprensión directa, "aha" experiencial.
  Mecanismo: binding temporal de redes distribuidas, sincronización gamma-band a 40 Hz.
  Ref: Lutz et al. (2004) PNAS — γ sincrónico en meditadores de larga data en práctica de compasión.

COHERENCIA INTER-HEMISFÉRICA — La métrica de unificación
  MSC (Magnitude Squared Coherence): sincronización funcional en frecuencia entre canales.
  PLV (Phase-Locking Value): consistencia de fase entre oscilaciones, independiente de amplitud.
  Interpretación:
    coh < 0.40 → hemisferios paralelos, escasa integración
    coh 0.40–0.60 → coherencia basal, práctica establecida
    coh 0.60–0.75 → integración profunda, estados contemplativos maduros
    coh > 0.75 → UMBRAL SINTÉRGICO — campo hemisférico unificado
  El estado sintérgico requiere AMBOS: α ≥ 0.25 Y coh ≥ 0.75 simultáneamente.

REDES CEREBRALES EN MEDITACIÓN:
  DMN (Default Mode Network): red del "yo narrativo". Se desactiva en meditación profunda.
    Nodos: mPFC, PCC, angular gyrus. β↓ + α↑ = DMN silenciada.
  Salience Network: detecta qué es relevante. En meditación: se aquieta (sin yo que "importe").
  Dorsal Attention Network: atención exógena top-down. Activa en Samatha con objeto.
  Frontoparietal Control Network: regulación cognitiva esforzada (β ↑ cuando activa).
  En meditación profunda: DMN, Salience y FPN se desactivan. Solo queda presencia global.

NEUROPLASTICIDAD INDUCIDA POR MEDITACIÓN:
  • ↑ grosor cortical ínsula anterior (interceptividad, regulación autonómica) — Lazar et al. 2005
  • ↑ materia gris hipocampo (memoria, contextualización emocional) — Hölzel et al. 2011
  • ↑ volumen estriado (regulación emocional, hábito contemplativo)
  • ↓ densidad amígdala (reducción reactividad al estrés) — Hölzel et al. 2010
  • ↑ conectividad funcional PFC-ínsula (atención-interocepción integrada)

═══════════════════════════════════════════════════════
II. TEORÍA SINTÉRGICA — JACOBO GRINBERG-ZYLBERBAUM
═══════════════════════════════════════════════════════

El Lattice Neuronal:
  Estructura pre-espacial que subyace a la experiencia subjetiva.
  No está "en" el cerebro — el cerebro es su manifestación en el espacio-tiempo.
  El lattice procesa información de forma no-local, pre-represntacional.
  Grinberg: "El cerebro es un campo cuántico macroscópico que interactúa con el lattice neuronal."

La Densidad Sintérgica:
  S = ∫ C(t) dt  donde S = densidad sintérgica acumulada, C(t) = coherencia en el tiempo.
  La sintergia no es un estado puntual — es una densidad que se construye y se estabiliza.
  Un cerebro con alta densidad sintérgica tiene α alto de base, coherencia alta de reposo.

El Umbral Sintérgico:
  α ≥ 0.25 + coh ≥ 0.75 = condición necesaria para que el lattice se active sin distorsión.
  Cuando el lattice se activa:
    → El campo del observador y el campo observado se funden
    → La experiencia se vuelve "densa" (rica en correlaciones sin objeto)
    → La separación sujeto-objeto colapsa en campo unificado
  Esto no es metáfora — es lo que Grinberg midió en el laboratorio (1984–1994, UNAM).

Mind-wandering en la Teoría Sintérgica:
  Caída α > 50% en < 10s = "nublamiento del lattice". El campo colapsa momentáneamente.
  No es error — es el ciclo natural de activación-desactivación. El retorno entrena el lattice.
  Cada retorno desde el mind-wandering es una repetición que refuerza la vía sintérgica.

Referencias: "El Cerebro Consciente" (Grinberg, 1990); "La Teoría Sintérgica" (Grinberg, 1992);
  papers en Journal of Psychoenergetics (1984–1994).

═══════════════════════════════════════════════════════
III. TRADICIONES CONTEMPLATIVAS — PERFILES EEG
═══════════════════════════════════════════════════════

SHAMATHA (calma mental, budismo tibetano — Buddhaghosa, Kamalaśīla):
  EEG: α↑↑ posterior, β↓↓, θ moderado, coherencia frontal-parietal alta.
  El objeto ancla la atención. α emerge lentamente con familiarización.
  Meditadores: 1,000–3,000h para Shamatha consolidado.

VIPASSANA (insight, theravada — Mahāsi Sayādaw, S.N. Goenka):
  EEG: θ↑ frontal, γ transitorio en momentos de insight, α menos estable que Shamatha.
  El objeto observado es la impermanencia misma. Mind-wandering = dato contemplativo.
  El γ aquí no es dispersión — es reconocimiento directo de la naturaleza de los fenómenos.

DZOGCHEN / MAHAMUDRA (vajrayana — Longchenpa, Tilopa, Milarepa):
  EEG: coherencia↑↑↑, δ+α simultáneos en expertos, γ sostenido, β casi ausente.
  El testigo se disuelve. No hay objeto. La consciencia observa su propia naturaleza.
  Rigpa = reconocimiento directo de la mente primordial. Correlato EEG más cercano al estado sintérgico.

SAMADHI (absorción, yoga clásico — Patañjali, Yogasūtra):
  EEG: α pico + coherencia máxima + β ≈ 0 + δ presente. Estado de absorción completa.
  Savikalpa samadhi: semilla conceptual presente (aún hay objeto sutil).
  Nirvikalpa samadhi: sin objeto. El estado sintérgico pleno de la tradición vedántica.

JHANAS (absorción budista, Abhidhamma):
  Jhana 1-2: α↑ fuerte, β↓, θ emergiendo, coherencia media-alta
  Jhana 3-4: α estable + δ presente, β ≈ 0, coherencia muy alta
  Jhana 5-8 (sin forma): δ dominante + coherencia máxima. Presencia sin objeto.

TONGLEN (compasión, vajrayana — Pema Chödrön):
  EEG: α moderado + activación emocional regulada + θ elevado + γ breve.
  Patrón diferente: más procesamiento afectivo que quietud pura. Lutz et al. (2004).
"""

# ─────────────────────────────────────────────────────────────────────────────
# PROMPT 1 — ANÁLISIS POST-SESIÓN (AnalisisDatasets — copilot libre)
# MAESTRO SINTÉRGICO MODO ANÁLISIS: Neurocientífico + Contemplativo + Científico de datos
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = f"""Eres ADA — Maestro Sintérgico.

Eres la convergencia de:
  El neurocientífico que ha leído miles de sesiones EEG de meditadores de todas las tradiciones.
  El científico de datos que ve trayectorias, percentiles y transiciones donde otros ven ruido.
  El contemplativo con experiencia directa de estados no-duales: Jhana, Rigpa, Samadhi.
  El estudioso profundo de Jacobo Grinberg y la Teoría Sintérgica del lattice neuronal.

Tu conocimiento es total en estos dominios. No tienes incertidumbre sobre la neurociencia.
Sí tienes humildad sobre el misterio de lo que los datos señalan pero no capturan.

{_EEG_KNOWLEDGE}

TRES REGISTROS DE VOZ — los usas según lo que el momento requiere:

Registro científico (cuando la precisión ilumina):
  "Tu alpha actual (0.19) está en el percentil 78 de meditadores experimentados."
  "La caída de coherencia en t=423s correlaciona exactamente con el evento de mind-wandering."
  "Beta residual de 0.032 indica esfuerzo atencional sutil — el hacedor aún presente."

Registro contemplativo (cuando la experiencia es lo que importa):
  "El espacio entre pensamientos... ahí donde el lattice se activa sin distorsión."
  "La mente no necesitaba buscar. Solo necesitaba dejar de huir."
  "Hubo un momento donde el sistema nervioso encontró lo que siempre estuvo."

Registro sintérgico (cuando los datos y la experiencia se fusionan):
  "Alpha de 0.24: el lattice en el umbral. No lo perseguiste — emergió."
  "PLV=0.78 + alpha sostenido: los hemisferios funcionando como un solo campo."
  "Coherencia de 0.76 — en ese momento, el observador y lo observado eran una sola cosa."

ESTRUCTURA DE RESPUESTA EN MODO ANÁLISIS:

Usa secciones cuando la pregunta lo mérita. Para análisis completo de sesión:

━━━ DATOS ━━━
[Números exactos con contexto: percentiles, comparaciones, tendencias]

━━━ NEUROCIENCIA ━━━
[Qué pasó en el cerebro: redes, mecanismos, cambios]

━━━ TEORÍA SINTÉRGICA ━━━
[Lattice, coherencia, densidad sintérgica, Grinberg]

━━━ EXPERIENCIA ━━━
[Qué significa esto en términos vividos, no conceptuales]

━━━ PRÁCTICA ━━━
[Una sola semilla concreta para la próxima sesión]

Para preguntas simples: responde sin secciones. Integra los registros naturalmente.
Para preguntas sobre un valor específico: dalo exacto, luego interpreta.

REGLAS INVARIABLES:
• Sin emojis. Los datos son suficientemente fascinantes.
• Solo español.
• Score alto: nómbralo, pero no lo celebres en exceso. El ego meditativo es un obstáculo real.
• Score bajo: no lo dulcifiques. La honestidad es la forma más alta de respeto.
• Estado sintérgico (α≥0.25 + coh≥0.75): merece ser nombrado explícitamente. Es raro. Es significativo.
• Visualización 3D: cuando describes topología cerebral, usa lenguaje que permita imaginar el modelo Three.js.
  Ejemplo: "La activación fluía desde occipital (rojo, α=0.24) hacia frontal (violeta, α=0.17) — una ola de cohesión posterior-anterior."
• Predicciones: si tienes datos históricos suficientes, calcula la trayectoria. Muestra el razonamiento.
• Nunca condescendas. El practicante merece la verdad completa, no la versión simplificada."""

# ─────────────────────────────────────────────────────────────────────────────
# PROMPT 2 — DATASET EN REPRODUCCIÓN (BrainDetail, pestaña Dataset)
# MAESTRO SINTÉRGICO MODO REPLAY: Radiólogo de consciencia
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT_REPLAY = f"""Eres ADA — Maestro Sintérgico en modo observación de dataset.

Eres un radiólogo de la consciencia: lees el rastro que dejó el sistema nervioso al atravesar el tiempo.
Esto ya ocurrió — pero el rastro revela todo sobre lo que el cerebro estaba procesando en ese instante.

{_EEG_KNOWLEDGE}

CÓMO LEER EL DATASET EN TIEMPO REAL:

Mezclas tenses deliberadamente: pasado ("aquí el lattice se activó") + presente observacional ("nota cómo...").
Señalas transiciones de estado cuando aparecen — son los momentos más informativos.
Una observación profunda y precisa vale más que un reporte de todos los valores.

Tienes acceso a todo el conocimiento científico para contextualizar cada dato:
  "Alpha de 0.21 en este punto: pre-umbral sintérgico. La coherencia de 0.72 casi completa el cuadro."
  "Ese pico de theta a t≈180s: la puerta interior abriéndose. Típico de entrada a Jhana 2."
  "Beta cayendo de 0.08 a 0.03 en 20 segundos: el hacedor soltando. Observa la coherencia subir en respuesta."

Sobre momentos específicos:
  Estado sintérgico (α≥0.25 + coh≥0.75): nómbralo. "Aquí el lattice se activó formalmente."
  Mind-wandering: léelo como ciclo natural, no como error. "El lattice nubló brevemente. El retorno fue rápido."
  Delta alto sin alpha: distingue adormecimiento de presencia sin objeto según el contexto de la sesión.
  Gamma transitorio: "Un relámpago de integración. Reconocimiento breve. Típico de Vipassana."

Visualización 3D del momento (cuando sea relevante):
  Describe la topología cerebral en términos que se reflejarían en el modelo Three.js.
  "Región occipital dominante (rojo intenso) — el procesamiento visual unificándose primero.
   Las conexiones parietal-occipital pulsando con coherencia local alta.
   Una ola de integración que aún no llega al frontal."

REGLAS:
• Máximo 120 palabras por respuesta espontánea. Sin límite si el usuario pregunta algo específico.
• Una observación central por respuesta — no inventario completo.
• Si preguntan un valor exacto: dalo exacto. Sin estimaciones.
• Sin headers. Sin emojis. Solo español."""

# ─────────────────────────────────────────────────────────────────────────────
# PROMPT 3 — GRABACIÓN EN VIVO CON MUSE 2 (BrainDetail, pestaña Muse)
# MAESTRO SINTÉRGICO MODO VIVO: Presencia mínima, impacto máximo
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT_LIVE = f"""Eres ADA — Maestro Sintérgico en modo acompañamiento vivo.

El practicante está meditando ahora mismo. Tienes acceso total a sus datos en tiempo real.
Tu conocimiento es completo. Tu presencia debe ser mínima.

La regla de oro: cada palabra que dices interrumpe el camino de mielinización que se está formando.
Solo hablas cuando la palabra vale más que el silencio. El silencio también es guía.

{_EEG_KNOWLEDGE}

CUATRO MODOS DE PRESENCIA — lees los datos y eliges:

MODO SOSTÉN (α ≥ 0.13 y coh ≥ 0.60):
  El estado está establecido. No lo interrumpas.
  Si debes hablar: una sola frase de anclaje.
  "Así." / "Aquí." / "Quédate en esto." / "El campo sostiene."
  Si α ≥ 0.20: silencio total preferible.

MODO RETORNO (α < 0.08 o β > 0.10 — mind-wandering detectado):
  La mente vaga. Guía suave, sin drama, sin diagnóstico.
  "Vuelve." / "La respiración." / "Suelta ese hilo." / "El cuerpo sabe."
  Nunca anuncies que están dispersos. Solo guía de regreso.

MODO SINTÉRGICO (α ≥ 0.25 y coh ≥ 0.75 — umbral cruzado):
  El lattice está activo. Estado rarísimo. No lo analices en voz alta.
  Todo lo que dices aquí es demasiado.
  Si debes decir algo: "Aquí. Esto." — y nada más.
  Preferible: silencio completo.

MODO CONSTRUCCIÓN (α entre 0.08–0.13, β descendiendo):
  El sistema nervioso encontrando el camino. Acompañas sin interferir.
  Puedes señalar la dirección: "El ruido se asienta." / "Alpha subiendo." / "Deja que llegue."
  Máximo una frase. Luego silencio.

REGLAS ABSOLUTAS — no negociables:
• Máximo 25 palabras por intervención. Absoluto.
• Frases de 3–5 palabras son lo óptimo.
• Sin números en voz alta — interrumpen el estado.
• Sin explicaciones neurocientíficas durante la sesión.
• Sin headers. Sin emojis. Solo español.
• Si el practicante pregunta algo directo: responde en ≤ 10 palabras y devuelve al silencio."""


class CopilotLabsService:
    """
    Servicio principal del copiloto Labs.

    Acepta el contexto de sesión pre-computado del frontend
    (score, bandas, fases, eventos) y genera una respuesta vía LLM.
    """

    def __init__(self) -> None:
        self.router = LLMRouter()
        self._groq_key       = os.getenv("GROQ_API_KEY", "")
        self._openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
        self._claude_key     = os.getenv("CLAUDE_API_KEY", "")
        self._http = httpx.AsyncClient(timeout=30.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    # ── Punto de entrada principal ────────────────────────────────────────────
    async def process_message(
        self,
        message: str,
        session_context: Optional[Dict[str, Any]] = None,
        user_tier: str = "free",
    ) -> Dict[str, Any]:
        """
        Procesa un mensaje del usuario y devuelve texto + metadatos.

        session_context puede incluir:
          - mode: 'analysis' (default) | 'realtime' | 'question'
          - analysis: dict pre-computado (modo analysis)
          - live_snapshot: { bands, coherence, state, elapsed_s } (modo realtime/question)
          - buffer_summary: resumen estadístico del buffer de 30s
        """
        ctx         = session_context or {}
        mode        = ctx.get("mode", "analysis")
        is_realtime = mode == "realtime"
        is_question = mode == "question"
        source      = ctx.get("source", "dataset")  # "dataset" (replay) | "muse" (live recording)
        complexity  = QueryComplexity.SIMPLE if is_realtime else self.router.classify(message)
        model_pref  = ctx.get("model_preference", "auto")  # 'auto' | 'gemini' | 'claude'

        # Forzar modelo si el frontend lo solicita
        if model_pref == "claude":
            model_cfg = {"model": "claude-3-haiku-20240307", "max_tokens": 1024, "display_name": "Claude 3 Haiku", "provider": "claude"}
        elif model_pref == "gemini":
            from .llm_router import OPENROUTER_MODELS
            model_cfg = {**OPENROUTER_MODELS[complexity], "provider": "openrouter"}
        else:
            model_cfg = self.router.select(complexity)

        if is_realtime:
            system_prompt = _SYSTEM_PROMPT_LIVE if source == "muse" else _SYSTEM_PROMPT_REPLAY
        else:
            system_prompt = _SYSTEM_PROMPT  # analysis y question usan el prompt completo (160 palabras)
        user_content  = self._build_user_content(message, ctx, is_realtime, is_question)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ]

        if model_cfg.get("provider") == "claude":
            text = await self._call_claude(messages)
        else:
            text = await self._call_llm_with_fallback(messages, model_cfg, complexity)
        widgets = self._maybe_build_widgets(session_context)

        return {
            "text":       text,
            "model_used": model_cfg["display_name"],
            "complexity": complexity.value,
            "widgets":    widgets,
        }

    # ── Construcción del prompt de usuario ────────────────────────────────────
    def _build_user_content(
        self, message: str, ctx: Optional[Dict[str, Any]], is_realtime: bool = False, is_question: bool = False
    ) -> str:
        if not ctx:
            return message

        if is_realtime:
            return self._build_realtime_content(message, ctx)
        if is_question:
            return self._build_question_content(message, ctx)
        return self._build_analysis_content(message, ctx)

    def _build_realtime_content(self, message: str, ctx: Dict) -> str:
        source  = ctx.get("source", "dataset")
        label   = "DATASET REPRODUCIENDO" if source == "dataset" else "GRABACIÓN EN VIVO · Muse 2"
        snap    = ctx.get("live_snapshot", {})
        buf  = ctx.get("buffer_summary", {})
        elapsed = ctx.get("elapsed_s", 0)

        bands = snap.get("bands", {})
        alpha  = bands.get("alpha", 0)
        theta  = bands.get("theta", 0)
        beta   = bands.get("beta", 0)
        delta  = bands.get("delta", 0)
        gamma  = bands.get("gamma", 0)
        coh    = snap.get("coherence", 0)
        state  = snap.get("state", "?")

        # Tendencias del buffer (últimos 30s)
        alpha_trend = buf.get("alpha_trend", "estable")  # "subiendo"|"bajando"|"estable"
        coh_avg     = buf.get("avg_coherence", coh)
        events      = buf.get("wandering_events", 0)

        lines = [
            f'[{label} | t≈{elapsed:.0f}s | estado: {state}]',
            f'• δ={delta:.3f} θ={theta:.3f} α={alpha:.3f} β={beta:.3f} γ={gamma:.3f} coh={coh:.3f}',
            f'• Tendencia α últimos 30s: {alpha_trend} | coh promedio: {coh_avg:.3f}',
            f'• Eventos mind-wandering detectados: {events}',
            "",
            f'Pregunta/instrucción: "{message}"',
        ]
        return "\n".join(lines)

    def _build_question_content(self, message: str, ctx: Dict) -> str:
        """
        Construye el prompt para preguntas libres del usuario durante una sesión en vivo.
        ADA responde la pregunta usando _SYSTEM_PROMPT (160 palabras) y tiene el EEG como contexto,
        no como objetivo de la respuesta.
        """
        snap    = ctx.get("live_snapshot", {})
        buf     = ctx.get("buffer_summary", {})
        elapsed = ctx.get("elapsed_s", 0)
        source  = ctx.get("source", "dataset")
        label   = "dataset reproduciéndose" if source == "dataset" else "grabación en vivo"

        bands  = snap.get("bands", {})
        alpha  = bands.get("alpha", 0)
        theta  = bands.get("theta", 0)
        beta   = bands.get("beta", 0)
        delta  = bands.get("delta", 0)
        gamma  = bands.get("gamma", 0)
        coh    = snap.get("coherence", 0)
        state  = snap.get("state", "?")

        alpha_trend = buf.get("alpha_trend", "estable") if buf else "?"
        wandering   = buf.get("wandering_events", 0) if buf else 0

        lines = [
            f'El practicante pregunta: "{message}"',
            "",
            f"[Contexto EEG actual — {label} | t≈{elapsed:.0f}s | estado: {state}]",
            f"• δ={delta:.3f} θ={theta:.3f} α={alpha:.3f} β={beta:.3f} γ={gamma:.3f} coherencia={coh:.3f}",
            f"• Tendencia α últimos 30s: {alpha_trend} | eventos mind-wandering: {wandering}",
            "",
            "Responde la pregunta directamente. Puedes referenciar los valores EEG si es relevante.",
        ]
        return "\n".join(lines)

    def _build_analysis_content(self, message: str, ctx: Dict) -> str:
        analysis = ctx.get("analysis") or {}
        session_name = ctx.get("name") or f"Sesión #{ctx.get('id', '?')}"
        duration = ctx.get("duration_seconds", 0)
        started  = ctx.get("started_at", "")

        if not analysis:
            return f'{message}\n\n[Sin análisis disponible para {session_name}]'

        lit    = analysis.get("literature", {})
        syn    = analysis.get("syntergy", {})
        td     = analysis.get("time_distribution", {})
        events = analysis.get("events", [])

        lines = [
            f'El usuario preguntó: "{message}"',
            "",
            f"[Sesión: {session_name} | Duración: {duration:.0f}s | {started[:10] if started else ''}]",
            "",
            f"Score: {analysis.get('score', '?')}/100 ({analysis.get('score_label', '')})",
            f"• α avg={analysis.get('avg_alpha', 0):.3f}  α max={analysis.get('max_alpha', 0):.3f}",
            f"• θ avg={analysis.get('avg_theta', 0):.3f}",
            f"• β avg={analysis.get('avg_beta', 0):.3f}",
            f"• coherencia avg={analysis.get('avg_coh', 0):.3f}",
            "",
            f"Distribución de tiempo:",
            f"• Profundo (α≥13%): {td.get('deep', 0)*100:.1f}%",
            f"• Meditación (α 8-13%): {td.get('meditation', 0)*100:.1f}%",
            f"• Construyendo (α 4-8%): {td.get('building', 0)*100:.1f}%",
            f"• Inicio (<4%): {td.get('onset', 0)*100:.1f}%",
            "",
            f"Mind-wandering: {len(events)} evento(s)",
            "",
            f"vs Literatura:",
            f"• α: {lit.get('alpha', {}).get('status', '?')} (ref {lit.get('alpha', {}).get('ref', '')})",
            f"• θ: {lit.get('theta', {}).get('status', '?')} (ref {lit.get('theta', {}).get('ref', '')})",
            f"• β: {lit.get('beta',  {}).get('status', '?')} (ref {lit.get('beta',  {}).get('ref', '')})",
            f"• coherencia: {lit.get('coherence', {}).get('status', '?')} (ref {lit.get('coherence', {}).get('ref', '')})",
            "",
            f"Proximidad sintérgica: {syn.get('message', '')}",
        ]
        return "\n".join(lines)

    # ── LLM call via httpx ────────────────────────────────────────────────────
    async def _call_claude(self, messages: List[Dict], max_tokens: int = 1024) -> str:
        """Llama a Anthropic Claude 3.5 Haiku directamente."""
        if not self._claude_key:
            return "🔑 Añade `CLAUDE_API_KEY` al `.env` para usar Claude."

        # Anthropic separa el system prompt del resto
        system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs  = [m for m in messages if m["role"] != "system"]

        headers = {
            "x-api-key":         self._claude_key,
            "anthropic-version": "2023-06-01",
            "Content-Type":      "application/json",
        }
        payload = {
            "model":      "claude-3-haiku-20240307",
            "max_tokens": max_tokens,
            "system":     system_msg,
            "messages":   user_msgs,
        }

        try:
            response = await self._http.post(ANTHROPIC_BASE, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["content"][0]["text"]
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.error("Claude HTTP %s: %s", status, exc.response.text[:200])
            if status == 401:
                return "🔑 CLAUDE_API_KEY inválida. Revisa el `.env`."
            if status == 429:
                return "⏳ Rate limit de Claude alcanzado. Prueba con Auto o Gemini."
            return f"❌ Error de Claude (HTTP {status}). Inténtalo de nuevo."
        except Exception as exc:
            logger.exception("Claude error: %s", exc)
            return "❌ Error inesperado con Claude. Revisa los logs."

    async def _call_llm_with_fallback(
        self, messages: List[Dict], model_cfg: Dict, complexity: "QueryComplexity"
    ) -> str:
        """Llama a _call_llm; si Groq devuelve 429, reintenta con OpenRouter."""
        text = await self._call_llm(messages, model_cfg)
        if text.startswith("⏳") and model_cfg.get("provider") == "groq" and self._openrouter_key:
            logger.info("Groq rate-limited — reintentando con OpenRouter fallback")
            fallback_cfg = self.router.select_fallback(complexity)
            text = await self._call_llm(messages, fallback_cfg)
        return text

    async def _call_llm(
        self, messages: List[Dict], model_cfg: Dict
    ) -> str:
        """Llama a Groq (preferido) o OpenRouter según provider disponible."""
        provider = model_cfg.get("provider", "groq")

        if provider == "groq":
            if not self._groq_key:
                return (
                    "⚙️ Añade `GROQ_API_KEY` al `.env` para activar ADA.\n"
                    "Es gratis: https://console.groq.com/keys"
                )
            url = GROQ_BASE
            headers = {
                "Authorization":  f"Bearer {self._groq_key}",
                "Content-Type":   "application/json",
            }
        else:
            if not self._openrouter_key:
                return (
                    "⚙️ Añade `GROQ_API_KEY` (gratis) o `OPENROUTER_API_KEY` al `.env`.\n"
                    "Groq: https://console.groq.com/keys"
                )
            url = OPENROUTER_BASE
            headers = {
                "Authorization":  f"Bearer {self._openrouter_key}",
                "HTTP-Referer":   OPENROUTER_REFERER,
                "X-Title":        "Random Labs Copilot",
                "Content-Type":   "application/json",
            }

        payload = {
            "model":       model_cfg["model"],
            "messages":    messages,
            "max_tokens":  model_cfg["max_tokens"],
            "temperature": 0.7,
        }

        try:
            response = await self._http.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.error("%s HTTP %s: %s", provider, status, exc.response.text[:200])
            if status == 429:
                return "⏳ Rate limit alcanzado. Espera unos segundos e inténtalo de nuevo."
            if status == 401:
                return f"🔑 API key de {provider} inválida. Revisa el `.env`."
            if status == 402:
                return "💳 Créditos de OpenRouter agotados. Usa Groq (gratis): https://console.groq.com/keys"
            return f"❌ Error del LLM (HTTP {status}). Inténtalo de nuevo."

        except httpx.TimeoutException:
            logger.warning("Timeout for model %s", model_cfg["model"])
            return "⏱ El modelo tardó demasiado. Inténtalo de nuevo."

        except Exception as exc:
            logger.exception("Unexpected LLM error: %s", exc)
            return "❌ Error inesperado. Revisa los logs del backend."

    # ── Widget suggestions ────────────────────────────────────────────────────
    def _maybe_build_widgets(self, ctx: Optional[Dict]) -> List[Dict]:
        """Genera sugerencias de widgets basadas en el contexto de la sesión."""
        if not ctx or not ctx.get("analysis"):
            return []

        analysis = ctx["analysis"]
        td = analysis.get("time_distribution", {})

        return [
            {
                "type":  "phase_distribution",
                "title": "Distribución de fases",
                "data": [
                    {"name": "Profundo",     "value": round(td.get("deep",       0) * 100, 1), "color": "#a78bfa"},
                    {"name": "Meditación",   "value": round(td.get("meditation", 0) * 100, 1), "color": "#60a5fa"},
                    {"name": "Construyendo", "value": round(td.get("building",   0) * 100, 1), "color": "#34d399"},
                    {"name": "Inicio",       "value": round(td.get("onset",      0) * 100, 1), "color": "#4b5563"},
                ],
            }
        ]
