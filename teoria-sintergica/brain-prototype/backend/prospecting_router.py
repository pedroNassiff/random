"""
Prospecting CRM Router — /prospecting

SQLite-backed endpoints for B2B outreach tracking.
Storage lives in database/prospecting.db (auto-migrated from JSON on first run).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.prospecting_db import (
    init_db, contacts_list, contact_get, contact_create,
    contact_update, contact_delete, contacts_reset,
)

router = APIRouter(prefix="/prospecting", tags=["prospecting"])

# Ensure DB + tables exist (idempotent)
init_db()

# ── Seed data — 20 companies (used only for /reset) ──────────────────────────
INITIAL_CONTACTS = [
    # TIER 1 — Barcelona creative studios
    {"id": 1,  "company": "Domestic Data Streamers", "tier": 1, "location": "Barcelona", "focus": "Data visualization, permanent installations, art + data", "linkedin_url": "linkedin.com/company/domestic-data-streamers", "website": "domesticstreamers.com", "decision_maker": "Pau Garcia / Laia Bonet (founders)", "why": "Arte + data viz — stack Three.js/WebGL directo", "stage": "identificado", "follow_up_count": 0, "notes": "Ya aplicaste. Re-engage con approach warm-up.", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 2,  "company": "Onionlab", "tier": 1, "location": "Barcelona", "focus": "Audiovisual installations, interactive experiences", "linkedin_url": "linkedin.com/company/onionlab", "website": "onionlab.com", "decision_maker": "Founders directamente", "why": "Instalaciones audiovisuales, Three.js fit perfecto", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 3,  "company": "Playmodes", "tier": 1, "location": "Barcelona", "focus": "Audiovisual performance, generative art, live coding", "linkedin_url": "linkedin.com/company/playmodes", "website": "playmodes.com", "decision_maker": "Eloi Maduell / Santi Vilanova", "why": "Generative visuals, live coding, creative tech", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 4,  "company": "Antifactory", "tier": 1, "location": "Barcelona", "focus": "Creative studio, branding, digital experiences", "linkedin_url": "linkedin.com/company/antifactory", "website": "antifactory.es", "decision_maker": "Creative Director", "why": "Digital experiences, necesitan dev tech", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 5,  "company": "Greyworld", "tier": 1, "location": "UK / España", "focus": "Public art installations, interactive sculptures", "linkedin_url": "linkedin.com/company/greyworld", "website": "greyworld.org", "decision_maker": "Andrew Shoben (founder)", "why": "Arte público + tech, Three.js heavy", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 6,  "company": "SosoLimited", "tier": 1, "location": "USA (referencia)", "focus": "Art + technology studio, data viz installations", "linkedin_url": "linkedin.com/company/sosolimited", "website": "sosolimited.com", "decision_maker": "John Rothenberg (founder)", "why": "Data viz installations, creative coding", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    # TIER 2 — Museos / instituciones
    {"id": 7,  "company": "CCCB Lab", "tier": 2, "location": "Barcelona", "focus": "Proyectos digitales experimentales, cultura contemporánea", "linkedin_url": "linkedin.com/company/cccb", "website": "cccb.org/lab", "decision_maker": "Responsable Lab / Director Cultural Digital", "why": "Proyectos digitales experimentales, cultura", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 8,  "company": "Fundación Telefónica", "tier": 2, "location": "Madrid", "focus": "Exposiciones arte digital interactivo", "linkedin_url": "linkedin.com/company/fundacion-telefonica", "website": "fundaciontelefonica.com", "decision_maker": "Director Contenidos Digitales", "why": "Exposiciones interactivas, presupuesto corporativo", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 9,  "company": "Arts Santa Mònica", "tier": 2, "location": "Barcelona", "focus": "Arte contemporáneo, instalaciones experimentales digitales", "linkedin_url": "linkedin.com/company/arts-santa-monica", "website": "artssantamonica.cat", "decision_maker": "Coordinador proyectos digitales", "why": "Instalaciones experimentales", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 10, "company": "IDEAL Barcelona", "tier": 2, "location": "Barcelona", "focus": "Centro arte digital inmersivo, proyecciones, instalaciones", "linkedin_url": "linkedin.com/company/ideal-barcelona", "website": "idealbarcelona.com", "decision_maker": "Director técnico / Director de producción", "why": "Proyecciones, instalaciones inmersivas", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    # TIER 3 — Studios creativos con tech
    {"id": 11, "company": "DVEIN", "tier": 3, "location": "Barcelona", "focus": "Motion graphics, animation, creative coding, commercial", "linkedin_url": "linkedin.com/company/dvein", "website": "dvein.com", "decision_maker": "Carlos de Cominges / Fran Rodríguez", "why": "High-end motion, WebGL potential para campaigns", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 12, "company": "Vasava", "tier": 3, "location": "Barcelona", "focus": "Creative studio, illustration, digital experiences, branding", "linkedin_url": "linkedin.com/company/vasava", "website": "vasava.es", "decision_maker": "Bruno Sellés / Director Creativo", "why": "Digital experiences, branding interactivo", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 13, "company": "Field.io", "tier": 3, "location": "UK (internacional)", "focus": "Data visualization high-end, generative design", "linkedin_url": "linkedin.com/company/field-io", "website": "field.io", "decision_maker": "Vera-Maria Glahn / Marcus Wendt", "why": "Data viz de alto nivel, Three.js/WebGL heavy", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 14, "company": "Random Studio", "tier": 3, "location": "Amsterdam (internacional)", "focus": "Digital experiences for brands, interactive installations, WebGL", "linkedin_url": "linkedin.com/company/random-studio", "website": "random.studio", "decision_maker": "Ronen Tanchum (founder/creative director)", "why": "Interactive installations, WebGL — naming similar al lab!", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 15, "company": "The Studio (Google CL)", "tier": 3, "location": "Internacional", "focus": "Experimental projects, big-budget interactive", "linkedin_url": "linkedin.com/company/google-creative-lab", "website": "creativelab5.com", "decision_maker": "Creative Technologist hiring", "why": "Big budget, experimental — referencia para portfolio", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    # TIER 4 — Freelancers / red / eventos
    {"id": 16, "company": "OFFF Festival", "tier": 4, "location": "Barcelona", "focus": "Creative community — speakers, studios, network", "linkedin_url": "linkedin.com/company/offf", "website": "offf.barcelona", "decision_maker": "Organización / speakers del festival", "why": "Community network — conectar con speakers", "stage": "identificado", "follow_up_count": 0, "notes": "Estrategia: buscar speakers pasados en LinkedIn", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 17, "company": "Sónar+D", "tier": 4, "location": "Barcelona", "focus": "Creativity + Technology conference", "linkedin_url": "linkedin.com/company/sonar-festival", "website": "sonar.es/srd", "decision_maker": "Exhibitors / speakers", "why": "Studios asisten — networking directo en junio", "stage": "identificado", "follow_up_count": 0, "notes": "Buscar lista de exhibitors 2025", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 18, "company": "Artivist Collective", "tier": 4, "location": "Barcelona", "focus": "Arte + activismo + tech, proyectos con propósito", "linkedin_url": "", "website": "", "decision_maker": "Fundadores/coordinadores", "why": "Proyectos pequeños, propósito — entry para portfolio", "stage": "identificado", "follow_up_count": 0, "notes": "", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 19, "company": "Creative Coding BCN", "tier": 4, "location": "Barcelona", "focus": "Comunidad creative coding — meetup mensual", "linkedin_url": "", "website": "meetup.com/creative-coding-barcelona", "decision_maker": "Freelancers y studios locales", "why": "Tu expertise exacto — networking cara a cara", "stage": "identificado", "follow_up_count": 0, "notes": "Asistir al próximo meetup físicamente", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
    {"id": 20, "company": "Three.js Meetup BCN", "tier": 4, "location": "Barcelona", "focus": "Three.js community, generative art, WebGL", "linkedin_url": "", "website": "meetup.com", "decision_maker": "Freelancers y devs creativos", "why": "Tu expertise exacto — networking directo", "stage": "identificado", "follow_up_count": 0, "notes": "Buscar en Meetup.com si existe o crear uno", "last_action": None, "next_action": None, "responded": False, "created_at": datetime.now().isoformat()},
]

# ── Pydantic models ───────────────────────────────────────────────────────────
class ContactCreate(BaseModel):
    company: str
    tier: int = 3
    location: str = ""
    focus: str = ""
    linkedin_url: str = ""
    website: str = ""
    decision_maker: str = ""
    why: str = ""
    stage: str = "identificado"
    notes: str = ""
    next_action: Optional[str] = None


class ContactUpdate(BaseModel):
    company: Optional[str] = None
    tier: Optional[int] = None
    location: Optional[str] = None
    focus: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    decision_maker: Optional[str] = None
    why: Optional[str] = None
    stage: Optional[str] = None
    follow_up_count: Optional[int] = None
    notes: Optional[str] = None
    last_action: Optional[str] = None
    next_action: Optional[str] = None
    responded: Optional[bool] = None
    ai_analysis: Optional[dict] = None
    ai_proposal: Optional[dict] = None
    ai_proposal_chat: Optional[list] = None
    scraped_content: Optional[str] = None
    scrape_ts: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/contacts")
def list_contacts():
    return {"status": "success", "contacts": contacts_list()}


@router.post("/contacts")
def create_contact(body: ContactCreate):
    data = {"follow_up_count": 0, "responded": False, "last_action": None,
            "created_at": datetime.now().isoformat(), **body.model_dump()}
    new_contact = contact_create(data)
    return {"status": "success", "contact": new_contact}


@router.put("/contacts/{contact_id}")
def update_contact(contact_id: int, body: ContactUpdate):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = contact_update(contact_id, update_data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "success", "contact": updated}


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int):
    if not contact_delete(contact_id):
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "success"}


@router.post("/reset")
def reset_contacts():
    """Restore initial 20 companies. Destructive."""
    contacts_reset(INITIAL_CONTACTS)
    return {"status": "success", "count": len(INITIAL_CONTACTS)}
