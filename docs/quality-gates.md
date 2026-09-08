# Quality Gates — Random Lab ("The Gauntlet v2")

> Filosofía (Uncle Bob): el código del agente no se revisa línea por línea.
> Se lo rodea de restricciones extremas. Si pasa la muralla completa, hay
> confianza alta en su correctitud. Rol humano: **arquitecto de calidad**,
> no revisor de código.
>
> Regla de oro: un gate que no bloquea el merge NO es un guardrail, es una
> sugerencia.
>
> Este es el mismo sistema implementado en Calavera Sur, ahora replicado en
> Random Lab. Stack distinto (sin PHP, con multi-proveedor de IA en vez de
> RAG puro), misma filosofía. Random tiene dos tracks de código
> (Python / React+Three.js) más un tercer track de calidad de IA — acá el
> riesgo no es "recuperación semántica mala" como en Calavera, es
> "el router elige el proveedor equivocado" o "el scoring de leads devuelve
> basura sin que nadie se entere".

---

## Contrato de trabajo del agente

Antes de generar código, el agente DEBE:

1. Trabajar contra una **especificación formal** (criterios de aceptación
   explícitos), nunca contra notas informales. Spec ambigua → pedir
   aclaración, NO adivinar.
2. Escribir los tests ANTES o junto al código de producción.
3. Identificar a qué **track** pertenece el cambio y correr la muralla de
   ESE track.
4. No marcar la tarea como completa hasta que la gauntlet del track pase
   en verde.

---

## TRACK 1 — Python (backend: `ai/`, `automation/`, `prospecting_*`)

| # | Gate | Herramienta | Bloquea merge si |
|---|------|-------------|------------------|
| 1 | Formato | `ruff format --check` | hay diffs |
| 2 | Lint | `ruff check` | cualquier error |
| 3 | Tipos | `mypy --strict` | cualquier error |
| 4 | Unit tests | `pytest` | algún test falla |
| 5 | Cobertura | `pytest --cov` | < 85% (router de IA y scoring: 95%) |
| 6 | Complejidad | `ruff` (C901) | ciclomática > 10 |
| 7 | Tamaño módulo | check custom | archivo > 400 líneas |
| 8 | Dependencias | `import-linter` | viola contrato de capas |
| 9 | Mutation | `mutmut` | mutation score < 75% |
| 10 | Seguridad | `bandit` + `pip-audit` | vuln HIGH/CRITICAL |

**Contrato de capas (import-linter) — punto de partida para Random:**

```
ai/            → no importa de automation/ ni de prospecting_*
automation/    → no importa de ai/ directamente, consume vía interfaz común
prospecting_*  → puede consumir ai/, no al revés
vertex_client.py, claude_client.py  → solo los consume el router, ningún
                                        endpoint llama a un provider directo
```

> **Nota:** esta es la regla razonable dado lo que sabemos de la estructura
> real. Ajustala si el layout de módulos difiere — el punto no es esta
> regla específica, es que exista UNA regla explícita y que el linter la
> haga cumplir, en vez de confiar en que nadie rompa el patrón "todo pasa
> por el router" por accidente.

**Primer objetivo real cuando se active este track:** el gate #8 (contrato
de capas) debería, casi de inmediato, marcar como violación la duplicación
que ya identificamos en la auditoría (`claude_client.py` / `ClaudeClient`
vs `claude_integration.py` / `ClaudeService`, mismos métodos duplicados).
No es que import-linter detecte duplicación directamente, pero al forzar
que todo consumo pase por una sola interfaz, el propio ejercicio de escribir
la regla expone el problema — buen primer caso de uso real para justificar
la inversión de tiempo en montar el track.

---

## TRACK 2 — React / Three.js (frontend: componentes + experimentos del Lab)

Mismo principio que en Calavera: el render NO se testea con cobertura ni
mutation. Se separa lógica de render.

**2a. Lógica pura** (routing del `model_preference` toggle, formateo de
datos de prospecting, cálculos de posición/geometría antes de tocar la GPU)

| Gate | Herramienta | Bloquea si |
|------|-------------|-----------|
| Formato | `prettier --check` | diffs |
| Lint | `eslint` | errores |
| Tipos | `tsc --noEmit` (o JSDoc strict) | errores |
| Unit tests | `vitest` | falla |
| Cobertura (solo lógica) | `vitest --coverage` | < 80% |
| Mutation (solo lógica) | `stryker` | score < 70% |

**2b. Render / WebGL** (Retratarte, Galaxy, Tesseract, Holographic — los
experimentos del Lab con Three.js y shaders GLSL)

| Gate | Herramienta | Bloquea si |
|------|-------------|-----------|
| Regresión visual | Playwright + screenshot diff | diff > umbral vs. referencia |
| Presupuesto perf | check custom en escena de prueba | FPS < 50, o carga inicial > X MB |
| Carga de assets/shaders | test de integración | GLSL no compila, texturas no cargan |

> Igual que en Calavera: la matemática de shaders (uniforms, geometría) va
> en 2a como lógica pura si es testeable de forma aislada. El shader
> corriendo en GPU va en 2b. Mutation testing sobre un fragment shader es
> teatro de calidad, no gate real.

---

## TRACK 3 — Calidad de IA (el más específico a Random, y el más crítico)

En Calavera este track evaluaba calidad de retrieval semántico. En Random
el riesgo es distinto pero igual de real: **un router multi-proveedor que
elige mal, o un modelo de scoring que devuelve un número sin sentido y
nadie se da cuenta porque el código "funciona".**

| # | Gate | Cómo | Bloquea merge si |
|---|------|------|------------------|
| 1 | Contrato de salida del scoring | JSON schema validation | el output no matchea el schema esperado (score 0-100, campos requeridos) |
| 2 | Golden set de scoring de leads | ~30-50 prospects reales con score esperado (rango, no exacto) | el score sale fuera del rango esperado para casos conocidos |
| 3 | Regresión de routing | tests del router con cada valor de `model_preference` | el router llama al provider incorrecto para un valor dado |
| 4 | Sanity del fallback | simular fallo del provider primario (Groq) | el fallback a OpenRouter/Vertex no se dispara |
| 5 | Consistencia de scoring | mismo prospect, 3 corridas | varianza del score > umbral definido (los LLMs no son determinísticos al 100%, pero tampoco deberían dar 20 y 90 para el mismo input) |

**Golden set — ejemplo de estructura:**

```json
{
  "prospect_id": "test-001",
  "input": {
    "company": "...",
    "role": "CTO",
    "industry": "wellness tech",
    "signals": ["..."]
  },
  "expected_score_range": [70, 90],
  "expected_reasoning_keywords": ["ICP match", "budget signal"]
}
```

> Mantené este golden set versionado en el repo, igual que en Calavera.
> Cada cambio al prompt de scoring o al modelo usado corre contra este set
> ANTES de mergear. Si la calidad de scoring se degrada del baseline, se
> bloquea — aunque los tests de código pasen en verde.

**Por qué este track importa más en Random que en Calavera, en cierto
sentido:** en Calavera hay un solo motor de IA (embeddings + GPT-4 Vision).
En Random hay **cinco superficies distintas** (4 puntos Claude directo +
1 router multi-proveedor) — más superficie, más forma de que algo falle
silenciosamente sin que el track de código "normal" lo detecte.

---

## Comandos locales (pre-push, por track)

```bash
# TRACK 1 — Python
ruff format --check . && ruff check . && mypy --strict . && \
pytest --cov=. --cov-fail-under=85 && mutmut run && bandit -r . && pip-audit

# TRACK 2 — React/Three.js
prettier --check . && eslint . && tsc --noEmit && \
vitest run --coverage && stryker run && \
playwright test --grep @visual

# TRACK 3 — Eval de IA (correr al tocar prompts, providers, o el router)
python -m evals.scoring_golden_set --golden tests/golden_set_leads.json --fail-under-baseline
python -m evals.router_regression --all-preferences
```

---

## Qué SÍ revisa el humano (vos, no el agente)

- **Los criterios de aceptación.** Única lectura obligatoria antes de que
  el agente empiece.
- **El golden set del Track 3.** Definir qué es un "buen score" para un
  prospect real es decisión de negocio, no se delega.
- **Los umbrales de las tablas** y el contrato de capas.
- **Cambios de alto riesgo explícitos:** cualquier cambio al prompt de
  scoring de leads, al enrutamiento del `model_preference`, o a
  credenciales/IAM de los providers → revisión humana obligatoria, sin
  excepción, aunque la gauntlet pase en verde. Las métricas no atrapan
  todo — esto ya lo aprendimos en Calavera y aplica igual acá.

---

## Cuándo activar la gauntlet completa vs. camino liviano

Mutation testing y el eval del Track 3 son lentos — no correrlos en cada push.

- **Push normal / feature en progreso:** tracks 1-2 sin mutation, sobre el diff.
- **PR final / pre-merge:** gauntlet completa del track tocado, incluyendo mutation.
- **Cambio en prompts, providers, o routing de IA:** Track 3 obligatorio,
  sin excepción — es el equivalente exacto de "cambio en pipeline de
  embeddings" en Calavera.
- **CRUD trivial / cambio de copy:** camino liviano (formato + lint + tests del diff).

---

## Roadmap de implementación (orden sugerido)

```
1. Track 1 (Python) primero — es donde ya sabemos que hay deuda técnica
   real (los dos ClaudeClient duplicados), así que el primer resultado
   del gate es inmediatamente útil y demostrable
2. Track 3 (calidad de IA) segundo — es el diferenciador más fuerte para
   contar como experiencia, y el golden set de scoring es relativamente
   rápido de armar con ~30 prospects reales ya existentes
3. Track 2 (React/Three.js) tercero — el más laborioso por el split
   lógica/render y la regresión visual con Playwright, pero también el
   que menos urge dado que el Lab (Three.js) es más estable y cambia
   menos seguido que el backend de IA
```

---

## Cómo contarlo como experiencia (para la entrevista, o cualquier conversación técnica)

> "Diseñé un sistema de quality gates que aplico ahora en dos proyectos con
> stacks distintos — Calavera Sur (Python + PHP + Three.js, con foco en
> calidad de retrieval semántico) y Random Lab (Python + React + Three.js,
> con foco en calidad de un router multi-proveedor de IA). La filosofía es
> la misma en los dos: no reviso el output de un agente línea por línea,
> lo rodeo de restricciones automatizadas — formato, tipos, cobertura,
> mutation testing, contratos de arquitectura que bloquean el merge si se
> violan. Y en los dos casos agregué un track específico de calidad de IA
> que va más allá de 'el código corre': un golden set versionado que
> valida que el output del modelo sigue siendo bueno, no solo que no rompe
> nada. Esa distinción — código correcto vs. output confiable — es la que
> más me importa, y es replicable en cualquier stack, no es una solución
> ad-hoc de un solo proyecto."