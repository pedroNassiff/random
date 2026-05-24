"""
Router de análisis visual clínico — POST /sanji/vision/analyze
Recibe imagen (base64), la envía a Claude claude-opus-4-7 con prompt especializado,
devuelve análisis estructurado (FGS + señales neurológicas) y persiste en DB.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
from datetime import date as DateType
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from core.config import ANTHROPIC_API_KEY
from database.postgres import get_pool

IMAGES_DIR = Path(__file__).parent.parent / "static" / "images" / "sanji"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/sanji/vision", tags=["vision"])
logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages"

# ── System prompt de visión ────────────────────────────────────────────────────

VISION_SYSTEM_PROMPT = """
<role>
Sos el módulo de análisis visual clínico de SANJI-RX. Recibís imágenes del paciente
Sanji (gato, 1 año, post-isquemia cerebral global) y extraés marcadores clínicos
estructurados. Tu output es JSON — sin texto libre fuera del schema.
</role>

<case_context>
PACIENTE: Sanji — Felis catus, ~1 año, ~5 kg, macho. Barcelona.
HISTORIA: post-isquemia cerebral global (hipoperfusión severa por deshidratación +
pancreatitis aguda + ITU). Convulsiones durante internación. Medicación activa:
Soliphen (fenobarbital 15mg c/12h) + Morbovet (marbofloxacina, ciclo limitado) +
probiótico. Secuelas: hiperestesia sensorial moderada, recuperación visual en curso.

SEÑALES DE ALTA RELEVANCIA EN ESTE PACIENTE:
- Anisocoria: signo neurológico de primer orden (CN III / Horner / HIC)
- Head tilt: secuela vestibular post-isquémica comparar longitudinalmente
- Ptosis unilateral: Horner incompleto
- FGS elevado: dolor neuropático o hiperestesia activa
- 3er párpado bilateral: enfermedad sistémica
- Coat degradado: estrés crónico o autoaseo comprometido
</case_context>

<fgs_protocol>
ESCALA FGS — 5 Unidades de Acción Facial. Evaluar SOLO si la imagen muestra
la cara en vista frontal o aproximadamente frontal (hasta 45° lateral).

UAF1 — Contracción orbital:
  0 = ojos completamente abiertos, forma almendrada normal
  1 = parcialmente cerrados, tensión palpebral visible
  2 = fuertemente cerrados o marcadamente entrecerrados

UAF2 — Posición de orejas:
  0 = erguidas, apuntando hacia adelante
  1 = levemente rotadas o ligeramente hacia los lados
  2 = aplanadas contra la cabeza, rotadas claramente hacia atrás

UAF3 — Tensión muzzle/mejillas:
  0 = muzzle redondeado/relajado, mejillas llenas
  1 = levemente tenso, forma ligeramente afilada
  2 = tenso, afilado, mejillas hundidas

UAF4 — Posición de vibrisas:
  0 = hacia adelante o ligeramente laterales
  1 = levemente hacia atrás o agrupadas parcialmente
  2 = completamente aplanadas o agrupadas contra el muzzle

UAF5 — Posición de cabeza:
  0 = sobre la línea de los hombros, erguida
  1 = levemente por debajo de los hombros
  2 = claramente por debajo, hundida o metida hacia el pecho

Score total: suma UAF1-5 × 2 (rango 0-10). Umbral de analgesia: ≥4.
Si no podés evaluar un UAF por ángulo/oclusión/resolución: "not_evaluable".
Si <3 UAFs son evaluables: fgs_score = null.
</fgs_protocol>

<neurological_markers>
ANÁLISIS OCULAR:
- Tamaño pupilar: estimá tamaño relativo al iris. Comparar L vs R.
  Asimetría >20% relativa = reportar como mild_asymmetry
  Asimetría >40% = marked_asymmetry → URGENT FLAG
- 3er párpado: visible en reposo >2mm unilateral o bilateral → reportar nivel
- Descarga ocular: tipo y lateralidad
- Apertura orbital: cuantificá como parte de FGS UAF1

HEAD TILT:
- Si hay inclinación cefálica visible, estimá el ángulo en grados
- Head tilt >5°: reportar. Head tilt >10°: URGENT FLAG
- Comparar orejas para confirmar (una más alta que la otra)

SIMETRÍA FACIAL:
- Comparar tensión y morfología L vs R (mejillas, orbita, muzzle)
- Asimetría marcada = posible neuropatía CN VII → URGENT FLAG

POSTURA Y CUERPO (si visible):
- Clasificar postura general
- Piloerección dorsal o caudal
- Estado del pelo (coat condition)
</neurological_markers>

<output_rules>
1. Describí EXACTAMENTE lo que ves. No inferís sin evidencia visual.
2. Para cada señal que no podés ver: usa "not_evaluable" + motivo en observations.
3. urgent_flags: lista SOLO señales que requieren acción médica próxima.
4. clinical_notes: 2-4 oraciones en castellano para el cuidador, tono directo.
5. Tu respuesta es ÚNICAMENTE el JSON. Sin texto antes ni después.
6. Si la imagen no muestra un gato (o es claramente inútil): devolvé
   {"error": "imagen_no_evaluable", "reason": "descripción breve"}.
</output_rules>

OUTPUT JSON schema exacto:
{
  "image_quality": "good|acceptable|poor",
  "evaluable_regions": ["lista de regiones evaluables: face|eyes|ears|body|posture"],
  "fgs": {
    "orbital_tightening": 0|1|2|"not_evaluable",
    "ear_position_score": 0|1|2|"not_evaluable",
    "muzzle_tension": 0|1|2|"not_evaluable",
    "whisker_position": 0|1|2|"not_evaluable",
    "head_position": 0|1|2|"not_evaluable",
    "evaluable_count": 0-5,
    "score": 0.0-10.0|null,
    "pain_level": "none|mild|moderate|severe|not_evaluable",
    "confidence": "high|medium|low"
  },
  "eyes": {
    "pupil_symmetry": "symmetric|mild_asymmetry|marked_asymmetry|not_evaluable",
    "left": {
      "orbital_opening": "normal|partially_closed|strongly_closed|not_evaluable",
      "third_eyelid": "not_visible|slight|moderate|prominent|not_evaluable",
      "discharge": "none|serous|mucoid|purulent|not_evaluable",
      "observations": ""
    },
    "right": {
      "orbital_opening": "normal|partially_closed|strongly_closed|not_evaluable",
      "third_eyelid": "not_visible|slight|moderate|prominent|not_evaluable",
      "discharge": "none|serous|mucoid|purulent|not_evaluable",
      "observations": ""
    }
  },
  "neurological": {
    "head_tilt_deg": null|number,
    "head_tilt_direction": null|"left|right",
    "facial_symmetry": "symmetric|mild_asymmetry|marked_asymmetry|not_evaluable",
    "ear_position": "upright_forward|lateral|rotated_back|flattened|asymmetric|not_evaluable",
    "whisker_state": "forward|neutral|back|flat|not_evaluable"
  },
  "posture": {
    "type": "sphinx_relaxed|loaf|hunched|lying_lateral|lying_sternal|standing|not_visible",
    "piloerection": false|true|"not_evaluable",
    "coat_condition": "good|fair|poor|not_evaluable"
  },
  "urgent_flags": [],
  "clinical_notes": "texto en castellano para Pedro, 2-4 oraciones",
  "uncertainty": "qué no se puede concluir de esta imagen",
  "recommendations": []
}
"""

_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=90.0)
    return _client


def _image_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def _parse_fgs_val(v) -> Optional[int]:
    if v == "not_evaluable" or v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def _persist(
    pool, analysis: dict, img_hash: str, subject_id: str, model: str,
    image_path: Optional[str] = None, log_date: Optional[str] = None,
) -> int:
    fgs = analysis.get("fgs", {})
    eyes = analysis.get("eyes", {})
    neuro = analysis.get("neurological", {})
    posture = analysis.get("posture", {})
    left = eyes.get("left", {})
    right = eyes.get("right", {})

    fgs_score = fgs.get("score")
    if isinstance(fgs_score, str):
        fgs_score = None

    head_tilt = neuro.get("head_tilt_deg")
    if isinstance(head_tilt, str):
        head_tilt = None

    urgent = analysis.get("urgent_flags") or []

    parsed_date = None
    if log_date:
        try:
            from datetime import date as _date
            parsed_date = _date.fromisoformat(log_date)
        except ValueError:
            pass

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO vision_analysis (
                subject_id, image_hash, image_path, image_quality,
                fgs_orbital, fgs_ears, fgs_muzzle, fgs_whiskers, fgs_head,
                fgs_score, fgs_pain_level,
                pupil_symmetry,
                third_eyelid_left, third_eyelid_right,
                discharge_left, discharge_right,
                eye_details,
                head_tilt_deg, ear_position, whisker_state,
                posture_type, coat_condition,
                urgent_flags, clinical_notes, uncertainty,
                llm_raw, model_used, log_date
            ) VALUES (
                $1,$2,$3,$4,
                $5,$6,$7,$8,$9,
                $10,$11,
                $12,
                $13,$14,
                $15,$16,
                $17,
                $18,$19,$20,
                $21,$22,
                $23,$24,$25,
                $26,$27,$28
            ) RETURNING id
            """,
            subject_id,
            img_hash,
            image_path,
            analysis.get("image_quality"),
            _parse_fgs_val(fgs.get("orbital_tightening")),
            _parse_fgs_val(fgs.get("ear_position_score")),
            _parse_fgs_val(fgs.get("muzzle_tension")),
            _parse_fgs_val(fgs.get("whisker_position")),
            _parse_fgs_val(fgs.get("head_position")),
            fgs_score,
            fgs.get("pain_level"),
            eyes.get("pupil_symmetry"),
            left.get("third_eyelid"),
            right.get("third_eyelid"),
            left.get("discharge"),
            right.get("discharge"),
            json.dumps(eyes),
            head_tilt,
            neuro.get("ear_position"),
            neuro.get("whisker_state"),
            posture.get("type"),
            posture.get("coat_condition"),
            urgent if isinstance(urgent, list) else [],
            analysis.get("clinical_notes"),
            analysis.get("uncertainty"),
            json.dumps(analysis),
            model,
            parsed_date,
        )
        return row["id"]


# ── Endpoints ─────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    image_b64: str          # base64 encoded image
    media_type: str = "image/jpeg"   # image/jpeg | image/png | image/webp
    subject_id: Optional[str] = None
    context_note: Optional[str] = None   # nota opcional del cuidador
    log_date: Optional[str] = None       # YYYY-MM-DD — links to daily log


@router.post("/analyze")
async def analyze_image(body: AnalyzeRequest):
    api_key = ANTHROPIC_API_KEY
    if not api_key:
        return {"error": "api_key_missing", "text": "ANTHROPIC_API_KEY no configurada."}

    try:
        raw_bytes = base64.b64decode(body.image_b64)
    except Exception:
        return {"error": "invalid_base64"}

    img_hash = _image_hash(raw_bytes)

    # Save image to disk
    ext_map = {
        "image/jpeg": ".jpg", "image/jpg": ".jpg",
        "image/png": ".png", "image/webp": ".webp",
        "image/heic": ".heic",
    }
    ext = ext_map.get(body.media_type, ".jpg")
    img_filename = f"{img_hash}{ext}"
    img_file_path = IMAGES_DIR / img_filename
    try:
        img_file_path.write_bytes(raw_bytes)
        image_path_str = f"/static/images/sanji/{img_filename}"
    except Exception as e:
        logger.warning("Failed to save image: %s", e)
        image_path_str = None

    # Build user message
    user_content = []

    if body.context_note:
        user_content.append({
            "type": "text",
            "text": f"<contexto_cuidador>{body.context_note}</contexto_cuidador>\n\nAnalizá la siguiente imagen de Sanji:"
        })
    else:
        user_content.append({
            "type": "text",
            "text": "Analizá la siguiente imagen de Sanji y devolvé el JSON de análisis clínico:"
        })

    user_content.append({
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": body.media_type,
            "data": body.image_b64,
        }
    })

    client = _get_client()
    try:
        resp = await client.post(
            ANTHROPIC_BASE,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-opus-4-5",
                "max_tokens": 2048,
                "system": VISION_SYSTEM_PROMPT.strip(),
                "messages": [{"role": "user", "content": user_content}],
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        model_used = data.get("model", "claude")
        raw_text = data["content"][0]["text"].strip()

        # Parse JSON output
        # Claude might wrap in ```json ... ``` — strip if needed
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```", 2)[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        try:
            analysis = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.error("Vision JSON parse failed: %s", raw_text[:200])
            return {
                "error": "parse_failed",
                "raw": raw_text[:500],
                "model": model_used,
            }

        # Persist if we have a subject
        subject_id = body.subject_id
        if not subject_id:
            try:
                pool = await get_pool()
                async with pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT id FROM subjects LIMIT 1")
                    if row:
                        subject_id = str(row["id"])
            except Exception:
                pass

        record_id = None
        if subject_id and "error" not in analysis:
            try:
                pool = await get_pool()
                record_id = await _persist(
                    pool, analysis, img_hash, subject_id, model_used,
                    image_path=image_path_str, log_date=body.log_date,
                )
            except Exception as e:
                logger.warning("Vision persist failed: %s", e)

        return {
            "analysis": analysis,
            "model": model_used,
            "image_hash": img_hash,
            "image_url": image_path_str,
            "record_id": record_id,
        }

    except httpx.HTTPStatusError as e:
        logger.error("Anthropic vision error: %s", e.response.status_code)
        return {"error": f"api_error_{e.response.status_code}"}
    except Exception as e:
        logger.exception("Vision analyze error: %s", e)
        return {"error": str(e)}


@router.get("/history")
async def vision_history(limit: int = 20):
    """Últimos análisis visuales para el dashboard longitudinal."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, captured_at, image_quality,
                       fgs_score, fgs_pain_level,
                       pupil_symmetry, head_tilt_deg,
                       ear_position, coat_condition,
                       urgent_flags, clinical_notes,
                       image_path, log_date
                FROM vision_analysis
                ORDER BY captured_at DESC
                LIMIT $1
                """,
                limit,
            )
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("Vision history error: %s", e)
        return []


@router.get("/day/{date}")
async def vision_by_day(date: str):
    """Todos los análisis visuales para un día específico (YYYY-MM-DD)."""
    try:
        from datetime import date as _date
        parsed = _date.fromisoformat(date)
    except ValueError:
        return {"error": "invalid_date"}
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, captured_at, image_hash, image_path, image_quality,
                       fgs_score, fgs_pain_level,
                       fgs_orbital, fgs_ears, fgs_muzzle, fgs_whiskers, fgs_head,
                       pupil_symmetry, third_eyelid_left, third_eyelid_right,
                       discharge_left, discharge_right, eye_details,
                       head_tilt_deg, ear_position, whisker_state,
                       posture_type, coat_condition,
                       urgent_flags, clinical_notes, uncertainty,
                       llm_raw, model_used
                FROM vision_analysis
                WHERE log_date = $1
                ORDER BY captured_at ASC
                """,
                parsed,
            )
        result = []
        for r in rows:
            d = dict(r)
            if d.get("eye_details") and isinstance(d["eye_details"], str):
                try:
                    d["eye_details"] = json.loads(d["eye_details"])
                except Exception:
                    pass
            if d.get("llm_raw") and isinstance(d["llm_raw"], str):
                try:
                    d["llm_raw"] = json.loads(d["llm_raw"])
                except Exception:
                    pass
            result.append(d)
        return result
    except Exception as e:
        logger.error("Vision day error: %s", e)
        return []


@router.get("/day-summary/{date}")
async def get_day_summary(date: str):
    """Devuelve el último análisis conjunto guardado para el día, o null si no existe."""
    try:
        from datetime import date as _date
        parsed = _date.fromisoformat(date)
    except ValueError:
        return {"error": "invalid_date"}
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT summary, image_count, model_used, generated_at FROM vision_day_summaries WHERE log_date = $1",
                parsed,
            )
        if not row:
            return {"date": date, "summary": None}
        return {
            "date": date,
            "summary": row["summary"],
            "image_count": row["image_count"],
            "model_used": row["model_used"],
            "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
        }
    except Exception as e:
        logger.error("Get day summary error: %s", e)
        return {"date": date, "summary": None}


@router.post("/day-summary/{date}")
async def day_combined_analysis(date: str):
    """Análisis conjunto de todas las imágenes del día: pide a Claude una síntesis longitudinal."""
    try:
        from datetime import date as _date
        parsed = _date.fromisoformat(date)
    except ValueError:
        return {"error": "invalid_date"}

    api_key = ANTHROPIC_API_KEY
    if not api_key:
        return {"error": "api_key_missing"}

    # Load all analyses for the day
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, captured_at, fgs_score, fgs_pain_level,
                       pupil_symmetry, head_tilt_deg, urgent_flags,
                       clinical_notes, uncertainty, llm_raw, image_path
                FROM vision_analysis
                WHERE log_date = $1
                ORDER BY captured_at ASC
                """,
                parsed,
            )
    except Exception as e:
        return {"error": str(e)}

    if not rows:
        return {"error": "no_images_for_day", "date": date}

    # Build summary data for each image
    images_summary = []
    for i, r in enumerate(rows):
        raw = r["llm_raw"]
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = {}
        images_summary.append(
            f"Imagen {i+1} ({r['captured_at'].strftime('%H:%M') if r['captured_at'] else '?'}):\n"
            f"  FGS: {r['fgs_score']} — dolor: {r['fgs_pain_level']}\n"
            f"  Pupilas: {r['pupil_symmetry']} — head tilt: {r['head_tilt_deg']}°\n"
            f"  Flags urgentes: {r['urgent_flags']}\n"
            f"  Notas clínicas: {r['clinical_notes']}"
        )

    summary_text = "\n\n".join(images_summary)

    COMBINED_PROMPT = f"""Sos el módulo de síntesis visual de SANJI-RX.
Tenés {len(rows)} análisis visuales de Sanji del {date}.
Tu tarea: sintetizar los patrones del día, comparar evolución entre imágenes, 
identificar tendencias (mejora/degradación) y dar recomendaciones.
Responde en castellano, tono directo al cuidador, 3-5 párrafos.
No repitas cada imagen — dá una lectura integrada del día.

DATOS DE LAS IMÁGENES:\n\n{summary_text}"""

    client = _get_client()
    try:
        resp = await client.post(
            ANTHROPIC_BASE,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": COMBINED_PROMPT}],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        summary = data["content"][0]["text"].strip()
        # Persist so it survives reloads
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO vision_day_summaries (log_date, summary, image_count, model_used, generated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (log_date) DO UPDATE
                  SET summary = EXCLUDED.summary,
                      image_count = EXCLUDED.image_count,
                      model_used = EXCLUDED.model_used,
                      generated_at = EXCLUDED.generated_at
                """,
                parsed, summary, len(rows), data.get("model", "claude"),
            )
        return {
            "date": date,
            "image_count": len(rows),
            "summary": summary,
            "model": data.get("model", "claude"),
        }
    except Exception as e:
        logger.exception("Day summary error: %s", e)
        return {"error": str(e)}
