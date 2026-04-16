"""
prospecting_groups.py — FastAPI router
Endpoints: POST /prospecting/groups/generate
           POST /prospecting/groups
           GET  /prospecting/groups
           GET  /prospecting/groups/{id}
           PATCH /prospecting/groups/{id}/items/{item_id}
           DELETE /prospecting/groups/{id}
"""
import json
import re
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
from dotenv import load_dotenv

load_dotenv()

from database.prospecting_db import (
    init_db,
    contacts_list,
    contact_create,
    groups_list,
    group_get,
    group_create,
    group_update,
    group_delete,
    group_items_list,
    group_item_create,
    group_item_update,
)

init_db()

router = APIRouter(prefix="/prospecting", tags=["prospecting-groups"])

# ── Model config ──────────────────────────────────────────────────────────────
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8192

# ── Default identity context (loaded once from docs) ──────────────────────────
_IDENTITY_PATH = Path(__file__).parent.parent.parent / "docs" / "context" / "prospect-identity.md"

def _load_default_identity() -> str:
    try:
        return _IDENTITY_PATH.read_text(encoding="utf-8")
    except Exception:
        return ""

DEFAULT_IDENTITY = _load_default_identity()


# ── Pydantic models ───────────────────────────────────────────────────────────

class GenerateGroupRequest(BaseModel):
    group_name: str
    identity_context: Optional[str] = None   # if None → use default identity.md
    extra_context: Optional[str] = ""
    geo: list[str] = ["Barcelona", "Madrid"]
    sectors: list[str] = ["creative_studios"]
    size_range: str = "15-80"
    focus: list[str] = ["ai_integration", "3d_visualization"]
    min_score: int = 65
    batch_size: int = 15
    use_db_references: bool = True

class AcceptItemRequest(BaseModel):
    status: str   # "accepted" | "discarded"

class SaveGroupRequest(BaseModel):
    group_id: str  # temporary UUID from generate step
    name: str
    config: dict
    prospects: list[dict]  # only accepted ones (status="accepted")


# ── Sector label map for prompt ───────────────────────────────────────────────
SECTOR_LABELS = {
    "creative_studios":  "Creative & Tech Studios (diseño, instalaciones interactivas, motion, arquitectura paramétrica)",
    "institutions":      "Instituciones culturales y educativas (museos, fundaciones, universidades, centros de arte)",
    "scale_ups":         "Scale-ups y SaaS técnicos (fintech, edtech, healthtech, e-commerce B2B, logística)",
    "other":             "Otros sectores técnicamente ambiciosos",
}

FOCUS_LABELS = {
    "legacy":            "Modernización de sistemas legacy (PHP, monolitos, deuda técnica)",
    "ai_integration":    "Integración de IA (embeddings, búsqueda semántica, modelos custom, visión)",
    "3d_visualization":  "Visualización 3D / WebGL / instalaciones interactivas",
    "data_pipeline":     "Pipelines de datos y procesamiento en tiempo real (GPS, IoT, EEG)",
    "automation":        "Automatización inteligente de procesos",
}


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(req: GenerateGroupRequest, existing_companies: list[str],
                  reference_scores: list[dict]) -> str:
    identity = req.identity_context or DEFAULT_IDENTITY

    sectors_text = "\n".join(
        f"  - {SECTOR_LABELS.get(s, s)}" for s in req.sectors
    )
    focus_text = "\n".join(
        f"  - {FOCUS_LABELS.get(f, f)}" for f in req.focus
    )
    geo_text       = ", ".join(req.geo)
    existing_text  = "\n".join(f"  - {c}" for c in existing_companies[:50]) if existing_companies else "  (none yet)"
    references_text = "\n".join(
        f"  - {r['company']}: score {r['score']}" for r in reference_scores[:10]
    ) if reference_scores else "  (no references yet)"

    return f"""You are an expert B2B business development researcher. Your task is to generate a list of real, specific, high-quality prospects for the company below.

IDENTITY & CONTEXT OF THE COMPANY SEARCHING FOR PROSPECTS:
{identity}

ADDITIONAL CONTEXT FOR THIS SEARCH:
{req.extra_context or "(none)"}

SEARCH PARAMETERS:
- Geography: {geo_text}
- Company size: {req.size_range} employees
- Sectors to search:
{sectors_text}
- Technical focus areas:
{focus_text}
- Minimum score threshold: {req.min_score}/100
- Number of prospects to generate: {req.batch_size}

CALIBRATION REFERENCES (high-score contacts already in our database):
{references_text}

COMPANIES ALREADY IN OUR DATABASE (do NOT include these — avoid duplicates):
{existing_text}

INSTRUCTIONS:
1. Generate exactly {req.batch_size} real B2B prospects that are a strong fit for this company.
2. Be SPECIFIC: use real company names, real people (if known), real URLs.
3. Each prospect must have ai_score >= {req.min_score}.
4. Sort by ai_score descending (highest first).
5. The entry_vector must be CONCRETE: not "they could use AI" but e.g. "their 80k-product catalog has zero semantic search — customers drop off at search".
6. The "why" field must explain the fit in 2-3 specific sentences referencing their actual work.
7. DO NOT invent companies. Only suggest real, verifiable businesses.
8. Respond ONLY with a valid JSON array. No markdown, no backticks, no extra text.

JSON format for each prospect:
{{
  "company": "exact company name",
  "location": "city, country",
  "tier": 1-4,
  "decision_maker": "Full Name / Job Title (if known) or null",
  "linkedin_url": "full URL or null",
  "website": "full URL or null",
  "ai_score": 0-100,
  "fit_category": "high|mid|low",
  "why": "concrete fit reasoning in 2-3 sentences",
  "entry_vector": {{
    "title": "short title",
    "description": "specific solution / opportunity",
    "category": "product|tech_infra|ai_integration|marketing|sales",
    "priority": "high|mid|low"
  }},
  "tags": ["tag1", "tag2"]
}}

Respond only with the JSON array, nothing else."""


# ── /generate endpoint ────────────────────────────────────────────────────────

@router.post("/groups/generate")
async def generate_group(req: GenerateGroupRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # Gather existing companies and reference scores from DB
    existing_companies: list[str] = []
    reference_scores: list[dict] = []

    if req.use_db_references:
        contacts = contacts_list()
        existing_companies = [c["company"] for c in contacts if c.get("company")]
        reference_scores = [
            {"company": c["company"], "score": c["ai_analysis"]["score"]}
            for c in contacts
            if c.get("ai_analysis") and c["ai_analysis"].get("score") is not None
        ]
        reference_scores.sort(key=lambda x: x["score"], reverse=True)

    prompt = _build_prompt(req, existing_companies, reference_scores)

    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {str(e)}")

    raw = message.content[0].text.strip()

    # Strip any accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        prospects_raw = json.loads(raw)
        if not isinstance(prospects_raw, list):
            raise ValueError("Expected JSON array")
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Claude returned invalid JSON: {str(e)}\nRaw: {raw[:500]}"
        )

    # Normalize and validate each prospect
    prospects = []
    for p in prospects_raw:
        if not isinstance(p, dict):
            continue
        score = int(p.get("ai_score", 0))
        if score < req.min_score:
            continue
        fit = p.get("fit_category", "mid")
        if fit not in ("high", "mid", "low"):
            fit = "high" if score >= 80 else "mid" if score >= 60 else "low"
        prospects.append({
            "company":        str(p.get("company", "")),
            "location":       str(p.get("location", "")),
            "tier":           int(p.get("tier", 3)) if p.get("tier") else 3,
            "decision_maker": str(p.get("decision_maker") or ""),
            "linkedin_url":   str(p.get("linkedin_url") or ""),
            "website":        str(p.get("website") or ""),
            "ai_score":       score,
            "fit_category":   fit,
            "why":            str(p.get("why", "")),
            "entry_vector":   p.get("entry_vector", {}),
            "tags":           p.get("tags", []),
            "status":         "pending",
        })

    # Sort descending by score
    prospects.sort(key=lambda x: x["ai_score"], reverse=True)

    import uuid
    return {
        "tmp_id":          str(uuid.uuid4()),
        "prospects":       prospects,
        "total_generated": len(prospects),
        "model_used":      MODEL,
        "config": {
            "group_name":    req.group_name,
            "geo":           req.geo,
            "sectors":       req.sectors,
            "size_range":    req.size_range,
            "focus":         req.focus,
            "min_score":     req.min_score,
            "batch_size":    req.batch_size,
        },
    }


# ── POST /groups — save reviewed group + accepted prospects ───────────────────

class SaveGroupBody(BaseModel):
    name: str
    config: dict = {}
    prospects: list[dict]  # all items (any status)

@router.post("/groups")
async def save_group(body: SaveGroupBody):
    total_generated = len(body.prospects)
    accepted = [p for p in body.prospects if p.get("status") == "accepted"]

    group = group_create(
        name=body.name,
        config=body.config,
        model_used=MODEL,
    )
    group_id = group["id"]

    created_contacts = []
    for p in body.prospects:
        # If accepted → insert into contacts table (stage = identificado)
        contact_id = None
        if p.get("status") == "accepted":
            new_contact = contact_create({
                "company":        p.get("company", ""),
                "tier":           p.get("tier", 3),
                "location":       p.get("location", ""),
                "focus":          _focus_from_entry(p.get("entry_vector", {})),
                "linkedin_url":   p.get("linkedin_url", ""),
                "website":        p.get("website", ""),
                "decision_maker": p.get("decision_maker", ""),
                "why":            p.get("why", ""),
                "stage":          "identificado",
                "notes":          f"AI score: {p.get('ai_score', '')} · Generado por grupo '{body.name}'",
                "ai_analysis": {
                    "score":        p.get("ai_score", 0),
                    "fit_category": p.get("fit_category", "mid"),
                    "summary":      p.get("why", ""),
                    "entry_vectors": [p["entry_vector"]] if p.get("entry_vector") else [],
                    "pain_points": [],
                    "opportunities": {},
                    "tags": p.get("tags", []),
                },
            })
            contact_id = new_contact["id"]
            created_contacts.append(new_contact)

        # Save item in group regardless of status
        group_item_create(group_id, {**p, "status": p.get("status", "pending")})

        if contact_id:
            # Update the just-created item with the contact_id
            # (we need to find it — query by group_id + company)
            pass  # contact_id linkage is tracked via contacts table

    group_update(group_id, {
        "total_generated": total_generated,
        "total_accepted":  len(accepted),
        "status":          "completed",
    })

    return {
        "group":            group_get(group_id),
        "accepted_count":   len(accepted),
        "created_contacts": created_contacts,
    }


def _focus_from_entry(entry_vector: dict) -> str:
    """Derive a focus string from entry_vector category."""
    cat = entry_vector.get("category", "")
    mapping = {
        "tech_infra":    "Legacy modernization / Tech infrastructure",
        "ai_integration":"AI integration",
        "product":       "Product development",
        "marketing":     "Marketing automation",
        "sales":         "Sales automation",
    }
    return mapping.get(cat, entry_vector.get("title", ""))


# ── GET /groups ───────────────────────────────────────────────────────────────

@router.get("/groups")
async def list_groups():
    return groups_list()


# ── GET /groups/{id} ──────────────────────────────────────────────────────────

@router.get("/groups/{group_id}")
async def get_group(group_id: int):
    g = group_get(group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    items = group_items_list(group_id)
    return {**g, "items": items}


# ── PATCH /groups/{id}/items/{item_id} ───────────────────────────────────────

@router.patch("/groups/{group_id}/items/{item_id}")
async def update_group_item(group_id: int, item_id: int, body: AcceptItemRequest):
    if body.status not in ("accepted", "discarded", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    item = group_item_update(item_id, body.status)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Recount accepted items and update group
    items = group_items_list(group_id)
    accepted_count = sum(1 for i in items if i["status"] == "accepted")
    group_update(group_id, {"total_accepted": accepted_count})

    return item


# ── DELETE /groups/{id} ───────────────────────────────────────────────────────

@router.delete("/groups/{group_id}")
async def delete_group(group_id: int):
    ok = group_delete(group_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "deleted"}


# ── GET /groups/identity-default — returns the default identity context ────────

@router.get("/groups/identity-default")
async def get_default_identity():
    return {"content": DEFAULT_IDENTITY, "source": "prospect-identity.md"}
