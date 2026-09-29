# SPEC — Fútbol Vaquero

## 1. Contexto

Todos los miércoles juega un grupo de ~31 miembros, de los que vienen ~15–16. La inscripción cierra 3 días antes. Hoy el admin arma los equipos a ojo: le lleva tiempo y a veces quedan desparejos.

**Objetivo:** proponer automáticamente equipos parejos usando skills puntuadas y el historial de resultados. El admin sigue teniendo la última palabra.

**Métricas de éxito**
- % de partidos "parejos" (diferencia ≤ 2 goles) sube respecto al baseline del historial previo.
- Brier score de las predicciones mejor que 0.25 (moneda al aire) a partir del partido ~15.
- El admin arma y publica equipos en < 2 minutos.

**Fuera de alcance v1:** pagos, reserva de cancha, app nativa, chat, goles/asistencias individuales como input del rating.

## 2. Roles y permisos

| Acción | Miembro | Admin |
|---|---|---|
| Ver próximo partido, convocados y lista de espera | ✅ | ✅ |
| Inscribirse / bajarse | solo sí mismo | cualquiera |
| Ver equipos publicados y % de victoria por equipo | ✅ | ✅ |
| Puntuar skills de otros jugadores (anónimo) | ✅ | ✅ |
| Ver puntajes agregados, ratings individuales y quién puntuó | ❌ | ✅ |
| Alta/edición de jugadores, invitados, skills y pesos | ❌ | ✅ |
| Generar, editar y publicar equipos | ❌ | ✅ |
| Cargar resultado, importar historial | ❌ | ✅ |
| Configuración del grupo y del balanceador | ❌ | ✅ |

Un miembro solo ve los valores que él mismo puso al puntuar.

## 3. Calendario (configurable por grupo)

| Evento | Default |
|---|---|
| Partido | miércoles 19:00–20:00 (Europe/Madrid) |
| Apertura de inscripción | viernes 00:00 (configurable: `signup_open_weekday/time`) |
| Cierre de inscripción | martes 23:59 (el día antes del partido) |
| Cupo | 12: 10 en cancha (fútbol 5) + 2 cambios. Del 13 en adelante, lista de espera |
| Generación automática de propuestas | martes 12:00; avisa al admin |
| Publicación | manual, por el admin |

Después del cierre, un miembro puede bajarse: se promueve al primero de la lista de espera y la baja queda marcada como `late_withdrawal` (dato informativo, no afecta el rating). Si hay propuestas generadas, se invalidan y se regeneran.

## 4. Casos de uso

- **UC-01** El admin da de alta un jugador: nombre, apodo, puesto preferido (POR/DEF/MED/DEL), si puede atajar, email opcional para invitarlo.
- **UC-02** El admin crea una skill: nombre, descripción, peso (0–3), activa. Los jugadores sin puntaje en esa skill se imputan con la media del grupo (ALGORITHMS §1).
- **UC-03** Un miembro o el admin puntúa las skills de un jugador (1–10). La autoevaluación se guarda pero no entra al agregado.
- **UC-04** Un miembro se inscribe o se baja antes del cierre.
- **UC-05** El sistema (cron) o el admin genera las 3 mejores propuestas para el partido.
- **UC-06** El admin compara propuestas (diferencia de fuerza, % de victoria, radar de skills, desglose del costo), mueve jugadores a mano con recálculo en vivo y publica.
- **UC-07** El admin comparte los equipos por WhatsApp.
- **UC-08** El admin carga el resultado: goles A–B, quién jugó realmente en cada equipo, invitados y, opcional, goles de cada jugador (para separar goleadores al armar equipos y para estadísticas futuras).
- **UC-09** El sistema recalcula los ratings después de cada resultado y de cada cambio de puntajes.
- **UC-10** El admin importa historial desde CSV (`date, team_a, team_b, goals_a, goals_b`, jugadores separados por `;`).
- **UC-11** El admin agrega un invitado puntual con nivel general 1–10.
- **UC-12** El admin ve el dashboard de parejidad y calibración.
- **UC-13** El admin define restricciones entre pares de jugadores: `apart` (nunca juntos) o `together` (siempre juntos).

## 5. Modelo de datos

```sql
groups (
  id uuid pk, name text, timezone text default 'Europe/Madrid',
  match_weekday int default 3, match_time time default '19:00',                -- miércoles 19:00
  signup_close_weekday int default 2, signup_close_time time default '23:59',  -- martes 23:59 (0 = domingo)
  signup_open_weekday int default 5, signup_open_time time default '00:00',    -- viernes 00:00
  generate_weekday int default 2, generate_time time default '12:00',          -- martes 12:00
  capacity int default 12,                    -- 5 en cancha + 1 suplente por equipo
  balancer_config jsonb,                      -- pesos del costo, ver ALGORITHMS §3
  created_at timestamptz
)
group_members (group_id, user_id, role text check (role in ('admin','member')), pk(group_id,user_id))
players (
  id uuid pk, group_id, user_id uuid null, display_name text, nickname text,
  preferred_position text check (in ('POR','DEF','MED','DEL')), can_play_gk bool,
  is_guest bool default false, guest_level smallint null, active bool default true, created_at
)
skills (
  id uuid pk, group_id, key text, name text, description text,
  weight numeric(3,2) check (weight between 0 and 3), is_active bool, sort_order int, created_at,
  unique(group_id, key)
)
skill_ratings (
  id uuid pk, skill_id, player_id, rater_player_id, value smallint check (value between 1 and 10),
  updated_at, unique(skill_id, player_id, rater_player_id)
)
matches (
  id uuid pk, group_id, starts_at timestamptz, signup_closes_at timestamptz,
  status text check (in ('open','closed','teams_published','played','cancelled')), created_at
)
signups (
  match_id, player_id, created_at,
  status text check (in ('confirmed','waitlist','withdrawn')), late_withdrawal bool default false,
  pk(match_id, player_id)
)
team_proposals (
  id uuid pk, match_id, rank smallint, team_a uuid[], team_b uuid[],
  cost numeric, win_prob_a numeric, breakdown jsonb, created_at
)
match_teams (match_id, player_id, team text check (in ('A','B')), minutes_fraction numeric default 1, pk(match_id, player_id))
match_results (match_id pk, goals_a smallint, goals_b smallint, notes text, recorded_by, recorded_at)
player_constraints (id, group_id, player_a, player_b, kind text check (in ('apart','together')))
rating_snapshots (player_id, match_id uuid null, mu numeric, sigma numeric, computed_at)  -- derivado; match_id null = prior
```

**Vista** `player_skill_scores(player_id, skill_id, value, n_raters, source)` con `source ∈ {peers, admin, imputed}` (ALGORITHMS §1).

**Notas**
- Las skills nunca se borran, se desactivan (`is_active=false`): el historial depende de ellas.
- `match_teams` guarda lo que se jugó realmente, no la propuesta. Al publicar, se copia la propuesta elegida; al cargar el resultado, el admin corrige ausencias o cambios.
- Seed: 8 skills por defecto (ALGORITHMS §1) y un grupo "Fútbol Vaquero".

## 6. Pantallas

| Ruta | Quién | Contenido |
|---|---|---|
| `/` | todos | Próximo partido: fecha, cuenta regresiva al cierre, botón **Voy / Me bajo**, convocados `n/cupo`, lista de espera. Con equipos publicados: pantalla VS (DESIGN §6) |
| `/partidos/[id]/equipos` | admin | 3 propuestas en pestañas, dos columnas de equipo con drag & drop, barra de % de victoria, radar de skills, desglose del costo, **Publicar equipos**, **Compartir por WhatsApp** |
| `/partidos/[id]/resultado` | admin | Marcador A–B, checklist de quién jugó en cada equipo, agregar invitado |
| `/historial` | todos | Partidos jugados: fecha, marcador, diferencia; los parejos marcados |
| `/jugadores` | todos / admin | Miembro: lista con puesto y botón **Puntuar**. Admin: además, rating, confianza, n° de raters por skill |
| `/jugadores/[id]/puntuar` | todos | Un selector 1–10 por skill activa, con su descripción |
| `/skills` | admin | Alta, peso, orden, activar/desactivar |
| `/stats` | admin | % parejos por mes, distribución de diferencia de goles, calibración (predicho vs real), evolución del rating |
| `/ajustes` | admin | Calendario, cupo, pesos del balanceador, restricciones, admins |

## 7. Integraciones

**WhatsApp — inscripción.** En la pestaña Partido, **Compartir por WhatsApp** arma en servidor un texto con fecha, link
de la app y anotados, y lo comparte con Web Share API (fallback `https://wa.me/?text=`). Así el grupo de WhatsApp sigue
siendo el canal, y cada uno se anota con un toque (la sesión dura 30 días). Los que responden "voy" por WhatsApp los
carga el admin desde la misma pestaña.

```
⚽ Fútbol miércoles 30/09 — 19:00
Anotate acá: https://…/vaca-futbolera
✅ Van 8/12: Juan, Pedro, Martín, Lucho, Nico, Dani, Sergi, Tomi
⏳ En espera: —
Cierra el martes a las 23:59
```

**WhatsApp — equipos formados.** Con los equipos publicados, la app muestra una **tarjeta de formación**: los 5 (+ cambios)
de un equipo a la izquierda, **VS** en el medio y el otro equipo a la derecha. Cada jugador con avatar de vaca, nombre y
puesto. **Sin % de victoria**: la ve todo el grupo y no queremos sesgar quién "va a ganar"; el % queda solo
para los admins, en la pantalla de equipos. En la web se ve como un componente normal; el admin la puede **Copiar imagen** (portapapeles,
para pegar en el grupo) o **Compartir** (Web Share API con el PNG → WhatsApp), con descarga del PNG como fallback. Referencia
visual: [image-equipo-creado.png](image-equipo-creado.png). Texto que acompaña:

```
⚽ Fútbol miércoles 30/09 — 19:00
⬜ BLANCOS
Juan, Pedro, Martín, Lucho, Nico, Dani
⬛ NEGROS
Fede, Pau, Marc, Leo, Gonza, Jordi
```

**Cron.** Vercel Cron llama a `POST /api/cron/tick` cada 15 minutos, protegido con `CRON_SECRET`. Es idempotente: cierra las inscripciones vencidas, genera propuestas cuando corresponde y crea el partido siguiente si no existe.

**Auth.** Magic link de Supabase. El admin invita por email o comparte un link de invitación al grupo; al registrarse, el usuario se vincula a un `player` existente por email o eligiendo su nombre (con confirmación del admin).

loq ue quiero aca es que hagamos una plantilla tipo formaciones de equipo que vamos a compartir, es decir en la web se va a ver normal, pero esta va a ser como compartir imagen asi puede el admin darle al copiar y pegar la imagen eso en el grupo con los equipos formados.
asi deberia ser, docs/la-vaca-futbol/image-equipo-creado.png, donde la imagen de cada jugador es la imagen de la vaca, es decir aparecian los 5 de un lado izquierdo, VS en el medio y los otros 5 en el lado derecho, abajo el link de compartir imagen para que se pueda copiar o enviar po whats app

## 8. Milestones

### M0 — Setup
Proyecto Next.js + Supabase local, Tailwind con tokens de DESIGN.md, CI (lint, typecheck, test), auth con magic link, layout base con `NavTabs`.
- [ ] `pnpm dev` levanta con login funcional
- [ ] CI verde en la PR
- [ ] Página `/dev/ui` con todos los componentes base de DESIGN §5

### M1 — Jugadores y skills dinámicas
Tablas `players`, `skills`, `skill_ratings`, vista `player_skill_scores`, seed de skills. UC-01, UC-02, UC-03.
- [ ] El admin crea una skill nueva y aparece en el formulario de puntuación de todos los jugadores
- [ ] Un miembro puntúa a otro y no puede ver los puntajes de nadie más (test de RLS)
- [ ] Tests de `domain/skills` (ALGORITHMS §5.1) en verde

### M2 — Partidos e inscripción
`matches`, `signups`, `domain/schedule`, cron `tick`. UC-04.
- [ ] Se inscriben 18 con cupo 16: 16 convocados y 2 en espera, por orden de llegada
- [ ] Una baja después del cierre promueve al primero en espera y marca `late_withdrawal`
- [ ] Llamar dos veces al cron no duplica partidos ni propuestas

### M3 — Balanceador v1 (solo skills)
`domain/balancer` completo, con fuerza = prior de skills. `team_proposals`, pantalla de equipos, publicación, WhatsApp. UC-05, UC-06, UC-07, UC-13.
- [ ] Con 15 convocados, genera 3 propuestas 8/7 en < 300 ms
- [ ] Mover un jugador recalcula diferencia, % y radar en < 150 ms
- [ ] El texto de WhatsApp sale con el formato de §7
- [ ] Tests ALGORITHMS §5.2 en verde

### M4 — Resultados e historial
`match_teams`, `match_results`, `/historial`, importación CSV. UC-08, UC-10, UC-11.
- [ ] Cargar el resultado pasa el partido a `played` y abre la inscripción del siguiente
- [ ] Un CSV con nombres desconocidos muestra una pantalla para mapearlos a jugadores antes de importar

### M5 — Rating por resultados
`domain/rating` con OpenSkill, `rating_snapshots`, recompute completo, balanceador usando `mu`, `scripts/backtest.ts`. UC-09.
- [ ] Borrar `rating_snapshots` y recalcular da exactamente los mismos valores
- [ ] El backtest imprime Brier y % de aciertos para moneda / solo skills / skills + resultados
- [ ] Tests ALGORITHMS §5.3 en verde


### M6 — Stats y calibración
`/stats`. UC-12.
- [ ] Gráfico de % parejos por mes y curva de calibración con al menos 5 buckets

### M7 — Pulido
PWA instalable, pantalla VS animada, imagen OG de los equipos para compartir, notificaciones por email (cierre de inscripción, equipos publicados), estado vacío y errores revisados.
- [ ] Lighthouse PWA y accesibilidad ≥ 90 en mobile
- [ ] Respeta `prefers-reduced-motion`

## 9. Escenarios e2e

1. Un miembro entra por magic link, se inscribe, ve que está convocado y se baja.
2. Cupo lleno: el jugador 17 queda en espera; el 3 se baja y el 17 pasa a convocado.
3. El admin genera equipos, cambia a un jugador de lado, publica y comparte; el miembro ve la pantalla VS.
4. El admin carga el resultado 5–4 con un ausente y un invitado; el historial lo muestra y los ratings cambian.
5. Un miembro intenta abrir `/stats` o leer `rating_snapshots` por API y recibe 403 / vacío.
6. El admin crea la skill "Juego aéreo" con peso 1 y la propuesta del partido en curso no cambia hasta que alguien la puntúa.

## 10. Preguntas abiertas

- ¿Cancha de F7 u F8? Define el cupo por defecto.
- ¿Uno o varios admins?
- ¿Existe historial de resultados (chat de WhatsApp, planilla)? Cuánto más, mejor arranca el rating.
- ¿Arquero fijo o rotan? Si rotan, desactivar la restricción de arqueros.
- ¿La UI solo en español o también en inglés? (grupo internacional)
- ¿Permiso de La Vaca para usar su marca? Ver DESIGN.md.