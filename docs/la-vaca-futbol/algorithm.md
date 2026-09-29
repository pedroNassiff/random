# ALGORITHMS — Fútbol Vaquero

Todo lo de este documento vive en `src/domain/`, es puro y determinista, y tiene tests unitarios.
Las constantes en `MAYÚSCULAS` van en `src/domain/config.ts` y se pueden sobreescribir desde `groups.balancer_config`.

---

## 1. Skills → puntaje compuesto (`domain/skills`)

### 1.1 Skills por defecto (seed)

| key | Nombre | Peso | Nota |
|---|---|---|---|
| `overall` | Nivel general | 3.0 | Impresión global; suele predecir mejor que la suma de atributos |
| `technique` | Técnica y control | 1.5 | |
| `passing` | Pase y visión | 1.5 | |
| `defending` | Marca y defensa | 1.5 | Evita equipos sin nadie que vuelva |
| `dribbling` | Regate | 1.0 | |
| `finishing` | Definición | 1.0 | |
| `pace` | Velocidad | 1.0 | |
| `stamina` | Resistencia | 1.0 | |
| `goalkeeping` | Arquero | 0 (especial) | No entra al compuesto; solo se usa para repartir arqueros |

### 1.2 Agregación por skill

Para el jugador `i` y la skill `k`:

1. Se toman los valores de todos los raters **excepto el propio jugador** (la autoevaluación se guarda y el admin la ve, pero no se agrega).
2. Si hay `≥ MIN_RATERS` (default 3), `v_ik = mediana` y `source = 'peers'`.
3. Si no, y existe un puntaje de un admin, `v_ik = valor del admin` (o la mediana de los admins) y `source = 'admin'`.
4. Si no, `v_ik = UNKNOWN_DEFAULT = 5` ("no sabemos cómo juega") y `source = 'imputed'`. *Cambiado el 29/09/2026 por decisión del grupo: antes era la media del grupo (5.5 si nadie tenía dato).*

### 1.3 Compuesto

```
C_i = Σ_k (w_k · v_ik) / Σ_k w_k      sobre skills activas con w_k > 0 (excluye goalkeeping)
```

Rango 1–10. Crear una skill nueva sin puntajes no cambia el orden relativo de los jugadores, porque todos quedan imputados con el mismo valor.

---

## 2. Rating (`domain/rating`)

Librería: `openskill` (npm), modelo `PlackettLuce` por defecto. La librería es intercambiable detrás de una interfaz `RatingModel { rate, predictWin }`.

### 2.1 Prior desde skills

Sobre los jugadores activos que no son invitados:

```
z_i   = (C_i − mean(C)) / sd(C)          (si sd(C) = 0, z_i = 0)
mu0_i = MU_BASE + PRIOR_SCALE · z_i      MU_BASE = 25, PRIOR_SCALE = 3
σ0_i  = SIGMA_BASE                       SIGMA_BASE = 25/3 ≈ 8.333
```

Invitados: `C = guest_level` y `σ0 = SIGMA_BASE · 1.5`. No se actualizan con resultados.

### 2.2 Update por partido

Se procesan los partidos `played` en orden cronológico.

1. Los equipos salen de `match_teams` (lo que se jugó realmente). Los invitados participan en el cálculo de fuerza pero su rating no se actualiza.
2. Ranks: ganador `[1, 2]`, empate `[1, 1]`.
3. Se llama a `rate()` de OpenSkill y se obtiene `mu_rated` y `σ_rated`.
4. Se ajusta por margen de goles (estilo World Football Elo), con `d = |goals_a − goals_b|`:

```
m = 1              si d ≤ 1
m = 1.5            si d = 2
m = (11 + d) / 8   si d ≥ 3
m = min(m, M_CAP)  M_CAP = 2.5

mu'    = mu + m · (mu_rated − mu)
sigma' = σ_rated
```

5. Si la librería soporta pesos por jugador, se pasa `minutes_fraction`; si no, se ignora en v1.
6. Inactividad: por cada partido del grupo que el jugador no jugó, `σ = min(sqrt(σ² + TAU²), SIGMA_BASE)` con `TAU = 0.3`. Así, alguien que vuelve después de meses tiene más incertidumbre.

### 2.3 Recompute

`recomputeAll(players, skillScores, matches, config) → Snapshot[]` es una función pura. Se ejecuta en servidor al guardar un resultado, al importar historial y (con debounce de 1 minuto) al cambiar puntajes de skills. Esto último cambia el prior, así que se recalcula todo desde cero. Con ~50 partidos por año, esto tarda milisegundos.

### 2.4 Fuerza para balancear y mostrar

- Fuerza del jugador: `s_i = mu_i` (el último snapshot).
- Nivel mostrado al admin: `mu` con una barra de confianza derivada de `σ` (alta si `σ < 4`, media si `σ < 6.5`, baja en otro caso).
- Probabilidad de victoria: `predictWin([teamA, teamB])` de OpenSkill con los ratings actuales, y ajuste por jugador extra (§3.3).

---

## 3. Balanceador (`domain/balancer`)

### 3.1 Input

- `players`: `n` convocados (10 ≤ n ≤ 20), cada uno con `id`, `s_i`, perfil de skills `v_i·`, `preferred_position`, `goalkeeping`.
- `constraints`: pares `apart` / `together`.
- `history`: particiones de los últimos `K_REPEAT = 3` partidos.
- `config`: pesos del costo.

### 3.2 Enumeración exhaustiva

- `k = floor(n/2)`. El equipo A tiene `k` jugadores y el B `n − k`.
- Si `n` es par, se fija `players[0]` en A para no evaluar particiones espejadas: hay `C(n−1, k−1)` combinaciones (n = 16 → 6.435; n = 20 → 92.378).
- Si `n` es impar, se enumeran todos los subconjuntos de tamaño `k` para A: `C(n, k)` (n = 15 → 6.435). En la UI, A es el equipo más chico.
- Los jugadores se ordenan por `id` antes de enumerar, así el resultado es determinista.

### 3.3 Fuerza de equipo con jugador extra

```
S(T) = Σ s_i                                       si |T| = min(|A|,|B|)
S(T) = Σ s_i − (1 − EXTRA_PLAYER_FACTOR) · mean(s_T)   si T tiene un jugador más
```

`EXTRA_PLAYER_FACTOR = 0.6` por defecto (un jugador extra vale el 60% de un jugador promedio). Se calibra con el backtest.

### 3.4 Restricciones duras (descartan la partición)

- `together(a, b)`: ambos del mismo lado. `apart(a, b)`: en lados distintos.
- Arqueros: si hay ≥ 2 jugadores con `preferred_position = 'POR'`, cada equipo tiene al menos uno. Se desactiva con `config.enforceGoalkeepers = false`.
- Si ninguna partición cumple todas las restricciones, se lanza `InfeasibleConstraintsError` con la lista de restricciones en conflicto. No se relajan en silencio.

### 3.5 Costo

```
J = W_BAL  · |S(A) − S(B)| / SCALE
  + W_PROF · Σ_k w_k · |mean_A(v_·k) − mean_B(v_·k)| / (9 · Σ_k w_k)
  + W_POS  · Σ_pos |count_A(pos) − count_B(pos)| / n
  + W_GK   · |max_A(goalkeeping) − max_B(goalkeeping)| / 9
  + W_REP  · max_j overlap(partición, history_j)
  + W_GOALS · |Σ_A g_i − Σ_B g_i| / Σ g_i          (0 si nadie tiene goles cargados)
```

- `SCALE = sqrt(n) · sd(s)`; si `sd = 0`, `SCALE = 1`.
- `g_i` es el promedio de goles por partido del jugador en sus últimos `GOAL_RATE_WINDOW = 10` partidos con goles cargados. *Agregado el 29/09/2026 por decisión del grupo: los goleadores no deberían quedar juntos. No entra al rating (sigue fuera de alcance v1).*
- `overlap` es el Jaccard máximo entre (A, B) y (A_j, B_j) considerando ambas asignaciones de lados. Vale 1 si se repiten exactamente los mismos equipos.
- Defaults: `W_BAL = 1.0`, `W_PROF = 0.3`, `W_POS = 0.2`, `W_GK = 0.3`, `W_REP = 0.15`, `W_GOALS = 0.2`.

### 3.6 Output

- Top `N_PROPOSALS = 3` por `J` ascendente, con diversidad: cada propuesta elegida difiere de las anteriores en al menos `MIN_DIFF = 2` jugadores del lado A.
- Cada propuesta incluye `teamA`, `teamB`, `cost`, `winProbA` y `breakdown` (cada término de J por separado), para que el admin entienda por qué se eligió.
- Desempate: primero menor `|S(A) − S(B)|`, después orden lexicográfico de los ids de A.
- `evaluatePartition(partition, ctx)` expone el mismo cálculo para los movimientos manuales del admin.
- Presupuesto de tiempo: < 300 ms para n = 20 en una función serverless.

---

## 4. Métricas y backtest (`scripts/backtest.ts`)

- **Parejo**: `|goals_a − goals_b| ≤ 2`.
- **Brier**: `mean((p_A − y_A)²)` con `y_A = 1` si gana A, `0.5` si empatan y `0` si pierde.
- **Accuracy**: % de partidos no empatados donde el favorito ganó.
- **Backtest walk-forward**: para cada partido en orden, se predice con ratings calculados solo con datos anteriores. Se comparan tres modelos: moneda (p = 0.5), solo skills (prior sin updates) y skills + resultados.
- **Tuning**: grid search sobre `PRIOR_SCALE ∈ {2, 3, 4, 6}`, `M_CAP ∈ {1.5, 2.5}` y `EXTRA_PLAYER_FACTOR ∈ {0.4, 0.6, 0.8}` minimizando Brier. Con menos de 30 partidos, no se cambian los defaults: el riesgo de sobreajuste es alto. El script imprime una advertencia en ese caso.

---

## 5. Tests unitarios obligatorios

### 5.1 skills
- [ ] Un jugador sin puntajes en una skill recibe 5 (`UNKNOWN_DEFAULT`), con `source = 'imputed'`.
- [ ] La autoevaluación no entra a la mediana.
- [ ] Con 2 raters pares y un puntaje de admin, gana el del admin; con 3 pares, gana la mediana de los pares.
- [ ] Agregar una skill activa sin puntajes no cambia el orden de `C`.
- [ ] Una skill con peso 0 o inactiva no afecta `C`.

### 5.2 balancer
- [ ] n = 16 enumera exactamente 6.435 particiones; n = 15 también 6.435.
- [ ] 10 jugadores idénticos → `|S(A) − S(B)| = 0`.
- [ ] Con 2 porteros (POR), cada equipo tiene uno en todas las propuestas.
- [ ] `apart` y `together` se respetan; restricciones imposibles lanzan `InfeasibleConstraintsError`.
- [ ] n = 15 → equipos de 7 y 8.
- [ ] El mismo input produce el mismo output (determinismo).
- [ ] Las 3 propuestas difieren entre sí en ≥ 2 jugadores.
- [ ] Repetir exactamente los equipos del partido anterior aumenta `J` en `W_REP`.
- [ ] Caso "crack": un jugador con `s` muy alto termina con los 2–3 más flojos de su lado.

### 5.3 rating
- [ ] El ganador sube `mu` y el perdedor la baja.
- [ ] Ganar por 5 mueve más que ganar por 1, sin superar `M_CAP`.
- [ ] Un empate entre equipos de igual fuerza deja `mu` prácticamente igual y baja `σ`.
- [ ] `σ` crece con la inactividad y nunca supera `SIGMA_BASE`.
- [ ] `recomputeAll` es idempotente y no depende del orden de entrada de los partidos (ordena internamente).
- [ ] Los invitados no generan snapshots.