"""
Seed script — carga historia clínica de Sanji y medicaciones activas.
Ejecutar UNA vez: python seed/seed_sanji.py
"""

import asyncio
import asyncpg
import os
from datetime import date, timedelta
from pathlib import Path

# Cargar .env manualmente (sin dependencia externa)
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


DSN = (
    f"postgresql://{os.environ.get('SANJI_POSTGRES_USER', 'brain_user')}"
    f":{os.environ.get('SANJI_POSTGRES_PASSWORD', 'sintergic2024')}"
    f"@{os.environ.get('SANJI_POSTGRES_HOST', 'localhost')}"
    f":{os.environ.get('SANJI_POSTGRES_PORT', '5432')}"
    f"/{os.environ.get('SANJI_POSTGRES_DB', 'sanji_rx')}"
)

# Fechas de referencia (ajustar según la historia real)
TODAY = date.today()
HOSPITALIZATION_START = TODAY - timedelta(days=14)   # ~2 semanas atrás
HOSPITALIZATION_END   = TODAY - timedelta(days=10)
ALTA_DATE             = TODAY - timedelta(days=10)
MEDICATION_START      = TODAY - timedelta(days=10)
MORBOVET_START        = TODAY - timedelta(days=3)


async def seed():
    conn = await asyncpg.connect(DSN)

    # --- Sujeto principal ---
    subject_id = await conn.fetchval(
        "SELECT id FROM subjects WHERE name='Sanji' LIMIT 1"
    )
    if not subject_id:
        subject_id = await conn.fetchval(
            """
            INSERT INTO subjects (name, species, sex, birth_date, weight_kg, notes)
            VALUES ($1,'Felis catus','male','2024-01-01',5.0,
                    'Gato rescatado. Post-encefalopatía isquémica. Vive en Barcelona. Raza: mestizo.')
            RETURNING id
            """,
            "Sanji",
        )
        print(f"[seed] Subject Sanji creado: {subject_id}")
    else:
        print(f"[seed] Subject Sanji ya existe: {subject_id} — saltando.")

    # --- Cohabitantes ---
    cohabitants = [
        ("Pedro",    "human",  "caretaker_primary"),
        ("Emma",     "human",  "cohabitant"),
        ("Mapuche",  "feline", "sibling"),
    ]
    for name, kind, role in cohabitants:
        exists = await conn.fetchval(
            "SELECT id FROM cohabitants WHERE subject_id=$1 AND name=$2",
            subject_id, name,
        )
        if not exists:
            await conn.execute(
                "INSERT INTO cohabitants (subject_id, name, kind, role) VALUES ($1,$2,$3,$4)",
                subject_id, name, kind, role,
            )
            print(f"[seed] Cohabitante {name} ({role}) añadido.")

    # --- Historia clínica ---
    events = [
        {
            "kind": "hospitalization",
            "started_at": HOSPITALIZATION_START,
            "notes": "Ingestión de cuerpo extraño → hospitalización de urgencia.",
            "severity": 4,
        },
        {
            "kind": "other",
            "started_at": HOSPITALIZATION_START,
            "notes": "Pancreatitis aguda durante hospitalización. Fiebre 40.5°C. ITU concurrente.",
            "severity": 3,
        },
        {
            "kind": "seizure_focal",
            "started_at": HOSPITALIZATION_START + timedelta(days=2),
            "notes": "Crisis focal: movimiento repetitivo de orejas durante hospitalización.",
            "severity": 3,
        },
        {
            "kind": "seizure_generalized",
            "started_at": HOSPITALIZATION_START + timedelta(days=3),
            "notes": "Crisis generalizada: movimientos bruscos de patas, pérdida de conciencia breve.",
            "severity": 4,
        },
        {
            "kind": "imaging",
            "started_at": HOSPITALIZATION_START + timedelta(days=4),
            "notes": "RMN: isquemia cerebral global. Etiología indeterminada (vasculitis vs embolia vs anoxia post-pancreatitis).",
            "severity": 5,
        },
        {
            "kind": "isquemia",
            "started_at": ALTA_DATE,
            "notes": "A las 48h post-alta: ceguera cortical, ataxia, desorientación espacial, hipersensibilidad al tacto. Síndrome post-isquémico activo.",
            "severity": 4,
        },
    ]

    for ev in events:
        exists = await conn.fetchval(
            "SELECT id FROM clinical_events WHERE subject_id=$1 AND kind=$2 AND started_at=$3",
            subject_id, ev["kind"], ev["started_at"],
        )
        if not exists:
            await conn.execute(
                """INSERT INTO clinical_events (subject_id, kind, started_at, notes, severity)
                   VALUES ($1,$2,$3,$4,$5)
                """,
                subject_id, ev["kind"], ev["started_at"], ev["notes"], ev["severity"],
            )
            print(f"[seed] Evento '{ev['kind']}' ({ev['started_at']}) añadido.")

    # --- Medicaciones activas ---
    medications = [
        {
            "name": "Soliphen (fenobarbital)",
            "active_substance": "fenobarbital",
            "dose_mg": 15.0,
            "dose_description": "1/4 pastilla de 60mg = ~15mg",
            "frequency_hours": 12,
            "schedule_hours": [8, 20],
            "route": "oral",
            "days_remaining": None,
            "notes": "Control de crisis epilépticas. Nivel terapéutico a verificar en 3-4 semanas. Monitorear sedación y apetito.",
            "started_at": MEDICATION_START,
        },
        {
            "name": "Morbovet (marbofloxacina)",
            "active_substance": "marbofloxacina",
            "dose_mg": None,
            "dose_description": "1/2 pastilla cada 24h",
            "frequency_hours": 24,
            "schedule_hours": [9],
            "route": "oral",
            "days_remaining": 4,
            "notes": "ITU. ATENCIÓN: fluoroquinolonas pueden exacerbar hiperexcitabilidad neurológica. Monitorear hiperesthesia (≥4). Quedan 4 días.",
            "started_at": MORBOVET_START,
        },
        {
            "name": "Probiótico intestinal",
            "active_substance": "probiótico",
            "dose_mg": None,
            "dose_description": "1 sobre/día",
            "frequency_hours": 24,
            "schedule_hours": [12],
            "route": "oral",
            "days_remaining": None,
            "notes": "Apoyo a microbiota tras antibioticoterapia y pancreatitis.",
            "started_at": MEDICATION_START,
        },
    ]

    for med in medications:
        exists = await conn.fetchval(
            "SELECT id FROM medications WHERE subject_id=$1 AND name=$2 AND ended_at IS NULL",
            subject_id, med["name"],
        )
        if not exists:
            await conn.execute(
                """INSERT INTO medications
                   (subject_id, name, active_substance, dose_mg, dose_description,
                    frequency_hours, schedule_hours, route, days_remaining,
                    notes, started_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                """,
                subject_id,
                med["name"],
                med["active_substance"],
                med["dose_mg"],
                med["dose_description"],
                med["frequency_hours"],
                med["schedule_hours"],
                med["route"],
                med["days_remaining"],
                med["notes"],
                med["started_at"],
            )
            print(f"[seed] Medicación '{med['name']}' añadida.")
        else:
            print(f"[seed] Medicación '{med['name']}' ya existe — saltando.")

    await conn.close()
    print("\n[seed] ✅ Seed completo para Sanji.")


if __name__ == "__main__":
    asyncio.run(seed())
