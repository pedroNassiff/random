# Papaya Interview Prep
## Full Stack Engineer — Intelligence Layer for Vehicle Fleets

---

## Company Intelligence (Know Before You Walk In)

**What they've actually built:**
Two products in market:
- **Fleet Management** — the operational core: centralized vehicle database, SMR (Service, Maintenance, Repair) management, downtime & cost tracking, partner/supplier management.
- **AI Copilot** — the intelligence layer on top: fragmented data → clear insights → embedded actions. This is where the job description lives.

**The team (7 people):**
- Santi Ureta — Founder & CEO (the 45-min cultural conversation will be with him)
- Ben Greenwood — Product and Engineer Lead (likely running the 75-min technical pairing)
- Ton Badal — Lead Data Engineer (your closest technical peer)
- Elis Glynne — Senior Frontend Developer
- Alexia Auersperg-Breunner — Business Development
- Arianna Auersperg — Customer Success
- Haoran Wang — Founder Associate

This is a very small team. You're not joining a mid-size company with process. You're joining as one of 3 engineers. Own everything.

**Strategic bets to understand:**
- EV transition is a major product direction — tracking electrification KPIs, fleet sustainability targets. They're building the infrastructure for the ICE→EV migration in corporate fleets.
- "Insights embedded in workflows" is their philosophy — not another dashboard you open separately, but intelligence that flows into where teams already work (integrations, alerts, notifications).
- Barcelona HQ at Norrsken House (beach front). The culture note matters for the conversation with Santi.

**Their pain point framing (from the AI Copilot page):**
- Fragmented Fleet Data across disconnected systems
- Unclear Operational Signals (which signals actually matter)
- Reactive Manual Workflows (firefighting instead of proacting)
- Electrification & ESG Targets (external pressure to go green)

---

## The Match: Why This Role is a Natural Fit

Papaya's core problem is one I've lived twice:

- **At NDS (3 years):** Built the intelligence layer for automotive manufacturing data at a Ford tier-1 supplier. Data fragmented across departments and production lines. CSVs from everywhere. No single source of truth. Costs and quality metrics that didn't reconcile. Built the pipelines and dashboards that made it operational.
- **At Hub City Guides:** Ingested noisy, real-world GPS data from mobile devices, reconciled it against road networks, detected patterns in messy inputs. Shipped v1 fast, learned in production, rebuilt v2 with statistical rigor.
- **At Calavera Sur:** Deployed a semantic search pipeline on a legacy PHP system using pgvector + OpenAI embeddings — zero downtime migration, microservice architecture over a 8K+ product catalog.

The through-line: **messy real-world data → canonical model → actionable intelligence.** That's exactly what Papaya is building for fleets.

---

## My Experience, Mapped to Papaya's Stack

### 1. Messy Data Ingestion (CSVs, not clean APIs)

**NDS — Ford Automotive (3 years):**
Data came from multiple departments: production lines, quality control, supplier systems. Mostly CSVs, different schemas, different update cadences. Built ETL pipelines that standardized everything into a unified model for dashboards that plant engineers could trust.

**Calavera Sur:**
PHP legacy system with MySQL. Built a FastAPI microservice that ingested product data, ran AI tagging (OpenAI), generated embeddings, and wrote to PostgreSQL with pgvector — without touching the existing system. The legacy stayed intact, the client kept selling, we shipped in 3 weeks instead of a 6-month rewrite.

**What I've learned:** You can't assume input data is clean. You need validation at ingestion, explicit conflict resolution rules, and systems that degrade gracefully when the data is wrong.

---

### 2. Canonical Data Modeling

**NDS:** Designed the unified schema that reconciled data from assembly, quality, supplier, and cost systems across plant areas. That model had to be flexible enough to handle new data sources without breaking existing pipelines.

**HCG GPS Processing:** Defined the canonical representation for GPS routes: raw coordinates → cleaned segments → matched road paths → detected stops with durations. Each stage produced a well-defined, validated output. Downstream consumers never saw raw GPS noise.

**Papaya parallel:** Fleet data from leasing, fuel, maintenance, telematics, and charging needs the same treatment — ingest raw, resolve conflicts, output a canonical model that the rest of the system (and agents) can reason over.

---

### 3. Reconciliation & Conflict Resolution

**HCG GPS v1 → v2:**
Shipped v1 in 2 weeks: basic threshold-based stop detection. It worked until it didn't. GPS bouncing (phone oscillating between two coordinates while guide was stationary) caused OSRM map matching to fail with impossible routes — A→B→A→B→A.

Rebuilt v2 with:
- **Kalman filtering** to smooth GPS noise before map matching → 85% error reduction
- **DBSCAN clustering** to detect real stops vs. GPS artifacts
- **Segmented OSRM processing** — each route segment processed independently, not the full route at once
- Post-processing filters to remove impossible geometries

The lesson: reconciliation isn't a cleanup step, it's a first-class architectural concern. The system needs to know *why* data conflicts, not just that it does.

**NDS:** Reconciled cost and quality data from departments that didn't agree. Built anomaly detection (AI-powered) that surfaced discrepancies across vehicle electrical circuits and manufacturing defects.

---

### 4. Anomaly Detection

**NDS:** Integrated AI systems for sound recognition, image processing, and anomaly detection across vehicle electrical circuits. The system had to flag real defects without flooding engineers with false positives — precision mattered as much as recall.

**HCG:** Stop detection in GPS routes is an anomaly detection problem. The system had to distinguish between "guide actually stopped" vs. "GPS bouncing," "guide paused at traffic light" vs. "guide explaining a landmark." Used DBSCAN with spatial density parameters tuned to real production data.

**What I'd bring to Papaya:** The discipline of defining what "anomaly" means with precision — not just "this looks weird" but "this is statistically outside normal bounds given these conditions." And importantly, making that explainable to the people who need to act on it.

---

### 5. Agent Orchestration & LLM-Powered Workflows

**Calavera Sur — Semantic Search:**
Built a full semantic search pipeline: product descriptions → OpenAI embeddings → pgvector storage → cosine similarity queries → ranked results. Deployed as a FastAPI microservice with three-level caching (memory → Redis → DB), integrated into legacy PHP via a thin proxy layer.

Also designed (spec-complete) a behavioral tracking + recommendation system: 12 event types captured via vanilla JS + Beacon API, session profiles built with recency decay, purchase history signals from MySQL synced to pgvector. Blended at 40/60 ratio for recommendation vectors.

**What I'm building toward:** The hard problem in agents isn't the LLM call — it's making the system **reliable and auditable**. At Papaya, "LLM says so" isn't good enough when you're disputing a supplier invoice. I think about this as: every agent action needs a trace, a confidence signal, and a fallback.

---

### 6. Explainability & Auditability

This is where I think I can add real value. At NDS, dashboards that plant engineers couldn't trust were useless. At HCG, if GPS processing produced wrong stop durations, tour operators noticed and complained. At Calavera Sur, search results that couldn't be explained by product attributes lost user trust.

For Papaya's agents (billing reconciliation, dispute drafting, compliance enforcement), the output needs to be defensible. Not just "we detected a discrepancy" but "invoice #4821 charged €0.12/km vs. the €0.09/km in contract clause 4.2, over 847km, for an overcharge of €25.41." That's a different design problem than building an LLM that produces plausible text.

---

### 7. Full Stack Ownership, 0→1

At Random Lab I own the full arc: architecture → implementation → deployment → monitoring → iteration. No handoffs. Recent examples:

- **HCG:** NestJS API + Vue 3 + PostgreSQL + Python processing service. GCP infrastructure with self-hosted GitHub Actions CI/CD. Stripe Connect for marketplace payments. Background GPS tracking (Android WorkManager + Foreground Service). Full grant documentation in Catalan for Kit Digital.
- **Calavera Sur:** FastAPI microservice on Cloud Run + Cloud SQL. pgvector migrations with zero downtime. PHP legacy integration via REST proxy.
- **Random Lab CRM:** Full B2B prospecting tool with kanban board, AI-powered prospect analysis (Claude API), PostgreSQL-backed schema. LinkedIn OAuth2 integration.

---

## Questions They'll Likely Ask

### "Tell me about a time you shipped something quickly that wasn't perfect. What were you trying to learn?"

**Answer — HCG GPS v1:**

I needed to understand how noisy real GPS data is in production. You can't learn that from docs. I shipped a basic pipeline in 2 weeks: threshold-based stop detection, direct OSRM calls, no pre-processing. It worked. Routes showed up on the map. Stops were detected.

Then I watched it fail. GPS bouncing during guide stops broke OSRM. False positives at traffic lights frustrated operators. Routes crossed water and buildings.

That production failure gave me everything I needed to build v2 correctly: Kalman filtering before OSRM, DBSCAN for stop detection, segmented map matching. The second version was informed by real failure patterns I couldn't have anticipated upfront.

**The principle:** when you're dealing with real-world data, speed to production is speed to learning. Perfect upfront design on messy data is a fantasy.

---

### "Why Papaya specifically?"

NDS gave me 3 years working exactly in the domain Papaya is targeting: fragmented data across automotive systems, no single source of truth, costs that didn't reconcile. I know that problem from the inside.

What excites me about Papaya is the timing. The AI tooling needed to make this *actually intelligent* — not just a better spreadsheet — is becoming viable now. I've been building with pgvector, OpenAI embeddings, and LLM-powered workflows and I see how transformative the approach is for data that's complex and messy but structured enough for AI to be reliable.

The specific thing I want to work on: the canonical data model and agent orchestration. Not implementing specs someone else designed, but shaping how the system behaves when data is wrong, when suppliers dispute the reconciliation, when an agent needs to decide whether to act or escalate. That's the interesting 0→1 problem.

---

### "How do you handle data that's incomplete or wrong?"

Three principles from production experience:

1. **Validate at ingestion, not at query time.** If bad data enters the canonical model, it will surface at the worst possible moment. Build validation gates with explicit failure modes and alerting.

2. **Make conflict explicit, not silent.** When two sources disagree, the system should record both values, the source, the timestamp, and the resolution rule applied. "We used the leasing data because it's the contract source of truth" is auditable. "We picked one" is not.

3. **Statistical approaches beat rules for messy data.** At HCG I tried threshold-based GPS cleaning first. It failed because the thresholds were wrong for different guides, different devices, different cities. Switching to statistical methods (Kalman, DBSCAN) that adapt to data distribution was the right call. The same logic applies to fleet cost anomaly detection.

---

### "Describe a complex system you designed. What tradeoffs did you make?"

**HCG Route Processing Architecture:**

I had a NestJS backend and needed heavy GPS processing. Options: add it to NestJS (simpler, but memory/CPU intensive in Node), or separate service.

Built a separate Python FastAPI service (`api-visor`) for all processing: Kalman filtering, DBSCAN stop detection, OSRM map matching. NestJS handles API surface, auth, DB writes. Python service handles computation.

Tradeoffs:
- More infra complexity (two services, serialization layer)
- But: Python ecosystem for data processing is vastly better than Node
- Deployable independently — I can iterate on the algorithm without touching the main API
- Failure isolated — processing service down doesn't take down the whole platform

**Calavera Sur Semantic Search:**

Option A: Rewrite the platform in modern stack. 6 months, high risk, client selling disrupted.
Option B: FastAPI microservice integrated into PHP via REST proxy. 3 weeks, zero downtime.

I chose B. The client kept operating normally throughout. The microservice approach let me deploy incrementally: tagging first, then embeddings, then search, then recommendations. Each phase independently valuable and reversible.

---

### "How do you think about agents that need to be reliable and trustworthy?"

The failure mode I want to avoid: agents that produce plausible outputs that are actually wrong, and nobody can tell until a supplier dispute or a missed anomaly surfaces months later.

My mental model:

- **Trace everything.** Every agent action should log: inputs seen, reasoning applied, output produced, confidence estimate. This isn't for debugging — it's the audit trail the business needs.
- **Define failure modes explicitly.** An agent that detects a billing discrepancy should have three modes: "high confidence, act automatically," "medium confidence, surface for review," "low confidence, flag for human." The thresholds need to be tuned with domain experts, not guessed.
- **Explainability as a first-class output.** The agent's output should be: "Invoice overcharge detected: €25.41. Contract clause 4.2 specifies €0.09/km. Invoice 4821 shows €0.12/km over 847km. Confidence: high. Suggested action: dispute." Not "there might be a problem here."
- **Graceful degradation.** When the LLM call fails, when the data is too noisy, when confidence is below threshold — the system should fall back to a well-defined safe state, not silently skip.

---

### "What's your biggest weakness as an engineer?"

I tend to over-architect data models on the first pass. I've been burned a few times designing canonical schemas that were theoretically clean but hard to evolve when new data sources appeared. I've gotten better at this by shipping simpler models first, adding complexity when real use cases demand it rather than anticipating every future need upfront.

---

## Questions to Ask Them

**For Ben (Technical Pairing — likely Product & Engineer Lead):**

1. "You have Fleet Management as the operational layer and AI Copilot as the intelligence layer. How tightly coupled are they technically? Is the Copilot reasoning over the same canonical model, or does it have its own data representation?"

2. "What's the hardest data reconciliation problem you haven't solved yet — the one where two suppliers disagree and you don't have a clear resolution rule?"

3. "How do you decide when an agent should act autonomously vs. surface for human review? Have you drawn that line yet or is it still being figured out?"

4. "The 'insights embedded in workflows' framing is interesting — does that mean integrations into tools customers already use (Slack, email), or something else entirely?"

**For Santi (Cultural Conversation — CEO):**

5. "You're 7 people with two products in market and real customers. What's the thing that would most accelerate you right now — more engineering depth, more data coverage, or more sales?"

6. "The EV transition angle is interesting — are customers coming to you because of electrification pressure, or is that more of a future roadmap item?"

7. "Norrsken House is a good space. What does day-to-day collaboration look like — how does the team actually work?"

---

## Stack Alignment

| Papaya Need | My Experience |
|---|---|
| Messy CSV ingestion | NDS (multi-dept Ford data), Calavera Sur (product catalog), HCG (GPS batch processing) |
| Canonical data modeling | NDS assembly schema, HCG route model, Calavera product+embeddings schema |
| Conflict resolution | HCG GPS reconciliation, NDS supplier data conflicts |
| Anomaly detection | NDS (AI-powered manufacturing QC), HCG (GPS pattern detection with DBSCAN) |
| LLM / agent workflows | Calavera semantic search (pgvector + OpenAI), Random Lab CRM (Claude API integration) |
| Full-stack delivery | HCG (NestJS + Vue 3 + PostgreSQL + GCP), Calavera (FastAPI + PHP + Cloud Run) |
| 0→1 product ownership | Random Lab CTO, all projects shipped end-to-end solo or as technical lead |
| Explainability / audit | GPS processing with validation logs, semantic search with scored results |

---

## Things to Be Ready to Show (if Technical Pairing involves it)

- How you'd design the ingestion pipeline for a new data source (e.g. a new telematics CSV format)
- How you'd model "a charge that might be wrong" — what fields, what states, what resolution flow
- How you'd design a billing discrepancy agent: inputs, reasoning steps, output format, confidence, fallback
- How you'd handle schema evolution when a new supplier has different field names for the same concept
- SQL for anomaly detection: finding vehicles whose cost-per-km is statistical outliers given their category/age/region

---

## The 30-Second Pitch (Intro Chat Opening)

Have this crisp and ready. Adapt to the flow, but know the skeleton:

> "I'm Pedro — founder and CTO of Random Lab, a technical consultancy based in Barcelona. Most of what I build sits at the intersection of messy real-world data and systems that need to be reliable. Before that, I spent three years at NDS building internal tooling for Ford — dashboards, ETL pipelines, anomaly detection across manufacturing data that came from a dozen different sources with no single source of truth. More recently: GPS route processing at Hub City Guides, semantic search on a legacy e-commerce system using pgvector and OpenAI embeddings, and agent-style workflows on top of that. When I read the Papaya job description, it read like a description of problems I've actually lived — fragmented data, no reconciliation, reactive decisions. And I think the timing is right: the AI layer that makes this genuinely intelligent, not just a better spreadsheet, is finally viable."

**Keep it under 45 seconds. Land on "timing is right" — it's the natural handoff for them to start asking questions.**

Variants to have ready:
- If they ask *"what are you doing now?"* → lead with Random Lab CTO + the two active projects (HCG, Calavera Sur)
- If they ask *"why leave consulting?"* → "I want to go deep on one hard problem with a team, not wide across many clients. Papaya is the right hard problem."
- If they ask *"why Papaya specifically?"* → pull from the "Why Papaya" answer in the questions section above

---

## Technical Pairing Simulation

The 75-min pairing uses "a real-world problem." Given what Papaya builds, high probability it's one of:

**Scenario A — Messy fleet CSV ingestion:** They give you a CSV (or describe one) from a leasing or fuel provider. Fields are inconsistent, some vehicles appear twice, costs are in different currencies, dates are formatted three different ways. They want to see how you design the ingestion + normalization pipeline.

**Scenario B — Billing discrepancy detection:** They give you two datasets that should agree — e.g. what a telematics provider says about mileage vs. what the leasing company invoiced — and ask you to find and surface the conflicts.

**Scenario C — Agent design:** Describe how you'd build an agent that investigates a suspected billing overcharge — what it reads, what it reasons over, how it decides to act vs. escalate, what the output looks like.

---

### The Mental Framework (internalize this flow)

For any of these scenarios, run this pipeline out loud:

```
1. UNDERSTAND THE DATA
   - What's the source? How was it generated?
   - What guarantees do we have (none, probably)?
   - What's the primary key / identity anchor for a vehicle?

2. INGEST WITH EXPLICIT VALIDATION
   - Parse without trusting. Everything nullable until proven otherwise.
   - Log every row that fails validation — don't silently drop.
   - Flag anomalies at ingestion (null VIN, negative cost, future date).

3. CANONICAL MODEL
   - What's the minimal stable schema that all sources can map to?
   - Don't try to model everything — model what's needed to answer the key question.
   - Prefer explicit nullable fields over silent defaults.

4. CONFLICT RESOLUTION
   - When two sources disagree, record BOTH values + source + timestamp.
   - Define the resolution rule explicitly: "leasing data wins on mileage because it's the contract source"
   - Never silently overwrite — always trace why a value was chosen.

5. OUTPUT / ACTION
   - What does "actionable" mean for this specific output?
   - Who consumes it? What do they need to trust it?
   - What's the confidence signal? What's the fallback?
```

---

### Worked Example: Fuel Cost Reconciliation

*You receive two CSVs. One from the fuel card provider (Shell), one from the fleet manager's internal system. They both claim to describe fuel costs per vehicle per month. Build something that surfaces discrepancies.*

**How to approach it out loud:**

**Step 1 — Profile the data before writing a single line of code.**
```
Shell CSV columns:   vehicle_id, date, litres, cost_eur, station
Internal CSV columns: reg_plate, month, fuel_spend, notes
```
Already we have problems: different vehicle identifiers (vehicle_id vs reg_plate), different time granularity (date vs month), potentially different cost definitions (cost per transaction vs cost per month rolled up).

**Step 2 — Build a normalization layer, not a direct join.**
```python
# Don't do this:
merged = shell_df.merge(internal_df, on='vehicle_id')  # will fail

# Do this:
def normalize_shell(df):
    return df.assign(
        vehicle_ref = df['vehicle_id'].str.upper().str.strip(),
        period = pd.to_datetime(df['date']).dt.to_period('M'),
        cost_eur = pd.to_numeric(df['cost_eur'], errors='coerce'),
        source = 'shell'
    ).groupby(['vehicle_ref', 'period']).agg(
        total_cost=('cost_eur', 'sum'),
        source=('source', 'first')
    ).reset_index()

def normalize_internal(df):
    return df.assign(
        vehicle_ref = df['reg_plate'].str.upper().str.strip(),
        period = pd.to_datetime(df['month'], format='%Y-%m').dt.to_period('M'),
        total_cost = pd.to_numeric(df['fuel_spend'], errors='coerce'),
        source = 'internal'
    )[['vehicle_ref', 'period', 'total_cost', 'source']]
```

**Step 3 — Join on the canonical keys, surface conflicts explicitly.**
```python
merged = shell_norm.merge(
    internal_norm,
    on=['vehicle_ref', 'period'],
    how='outer',
    suffixes=('_shell', '_internal')
)

merged['discrepancy_eur'] = (
    merged['total_cost_shell'] - merged['total_cost_internal']
).abs()

merged['discrepancy_pct'] = (
    merged['discrepancy_eur'] / merged['total_cost_shell']
) * 100

merged['status'] = merged.apply(classify_row, axis=1)
# 'match' | 'discrepancy' | 'missing_in_shell' | 'missing_in_internal'
```

**Step 4 — Output that's actionable, not just a diff.**
```python
# Not this:
print(merged[merged['discrepancy_eur'] > 0])

# This:
discrepancies = merged[merged['status'] == 'discrepancy'].sort_values(
    'discrepancy_eur', ascending=False
)

for _, row in discrepancies.iterrows():
    print(f"""
DISCREPANCY — {row['vehicle_ref']} ({row['period']})
  Shell reported:    €{row['total_cost_shell']:.2f}
  Internal recorded: €{row['total_cost_internal']:.2f}
  Gap:               €{row['discrepancy_eur']:.2f} ({row['discrepancy_pct']:.1f}%)
  Suggested action:  {'Auto-flag for review' if row['discrepancy_pct'] > 5 else 'Within tolerance'}
""")
```

**Step 5 — Say what you'd do next (shows product thinking).**
> "This gives us the discrepancy list. Next I'd want to: (1) add a vehicle identity resolution layer — right now we're assuming reg_plate maps to vehicle_id, but that needs to be validated against a canonical vehicle registry; (2) build a threshold model — what % discrepancy is noise vs. worth investigating?; (3) wire this to an agent that can draft the dispute communication when confidence is high."

---

### Key things they're watching for in the pairing

- Do you profile the data before jumping to code?
- Do you name your assumptions out loud?
- Do you build for the messy case, not the happy path?
- Do you think about the consumer of the output (fleet manager, agent, audit log)?
- Do you know when to stop engineering and ask a product question?

The strongest signal you can give: **"Before I write anything, let me understand what 'correct' looks like for this data, and what a false positive costs vs. a false negative."** That's the product mindset they want.

---

## One-liner Positioning

> "I've spent years building systems that take fragmented, messy data from multiple sources and turn it into something people can trust and act on — first in automotive manufacturing at NDS, then in real-time GPS processing at HCG, and most recently in AI-powered product intelligence at Calavera Sur. Papaya is the same problem, applied to fleet costs, and at exactly the moment when the AI tooling makes the intelligent layer genuinely possible."