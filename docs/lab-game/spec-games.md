# SPEC · Lab Games & Experiences

> Extensión de `lab-core` con dos experiencias 3D nuevas.
> Objetivo doble: (1) sumar dos entradas jugables al Lab, (2) armar una pieza de portfolio que muestre *juegos y experiencias 3D* end-to-end (shaders + gameplay + datos reales + interacción).
> Formato pensado para trabajar por fases en Claude Code. Prosa en castellano, identificadores en inglés.

---

## 0. TL;DR

- **Game 1 — `PANSPERMIA`** *(alt: SAMSARA / ANIMA)*: nuestro ser holográfico "renace" viajando por la galaxia y cae en planetas generados a partir de **tipos reales de exoplanetas**. Elige un **elemento** (agua/fuego/tierra/aire → luego hielo/rayo/éter), aprende poderes, enfrenta guardianes y desbloquea **centros de energía** (reutiliza el mecanismo de *tercer ojo + respiración* que ya existe en `HolographicModel`). El nivel de reencarnación + energía deciden en qué mundo aparecés.
- **Game 2 — `KESSLER`** *(pick creativo, alternativas abajo)*: simulador orbital sobre la Tierra que ya tenemos (shader earth + atmósfera + `satellite.js`). Usás **datos TLE reales** de satélites, gestionás basura orbital y evitás el síndrome de Kessler. Física real, dato real, contraste de género con Game 1.
- **Capa compartida — `lab-core/engine/`**: mini motor (estado, input, save, loop, escenas) que sirve a ambos y a futuros juegos.

Todo se apoya en assets que ya tenés: **earth shader**, **galaxy particles**, **holographic model**, **satellites**, **audio analyzer**, **face tracker**.

---

## 1. Pilares de diseño

1. **Ciencia + imaginación, en ese orden.** Cada planeta parte de un tipo real de exoplaneta y de bioquímicas hipotéticas *plausibles*. La sci-fi es la extrapolación, no la base. El "planet bible" (§4) es la fuente de verdad.
2. **Reuso máximo.** Antes de crear algo nuevo, generalizar lo existente. El earth shader se convierte en un *planet shader* parametrizado; el galaxy model se convierte en el mapa de viaje; el holographic model es el personaje.
3. **Complejidad progresiva.** Poderes de lo simple a lo complejo (bola de fuego → muro → dash → ultimate). Planetas de lo amable a lo hostil según nivel de reencarnación.
4. **Aprender jugando.** Cada misión enseña un dato astrobiológico real de ese mundo; ese conocimiento *es* la mecánica de desbloqueo. El "ir aprendiendo cosas" tiene forma concreta.
5. **Encaja en el Lab.** Ambos entran en `LAB_EXPERIMENTS` con su ruta `/lab/:id` y su thumbnail en el grid, igual que `brain`, `retratarte`, etc.

---

## 2. Cómo encaja en la arquitectura actual

Hoy cada experimento es un componente autocontenido que se renderiza dentro de un `<Canvas>` (R3F) o en vanilla Three (como `RetratarteDetail`). Un juego necesita más: game loop propio, estado persistente, input, escenas y transición. La propuesta es **no romper** el patrón de `lab-core`, sino agregar una subcarpeta `games/` con su propia capa de engine, y que cada juego siga exponiendo:

- un **`Model`/preview** liviano para el thumbnail del grid del Lab (como los demás experimentos), y
- una **`Detail` page** a pantalla completa con el juego real (como `RetratarteDetail`).

```
src/
├─ lab-core/
│  ├─ registry.js                 # ← agregar panspermia + kessler
│  ├─ brain/ retratarte/ ...      # existentes
│  ├─ engine/                     # NUEVO · capa compartida
│  │  ├─ GameStore.js             # zustand: estado global de juego
│  │  ├─ SaveManager.js           # persistencia localStorage (versionada)
│  │  ├─ InputManager.js          # teclado/touch/gamepad → acciones
│  │  ├─ SceneManager.jsx         # transición entre escenas/planetas
│  │  ├─ useGameLoop.js           # tick fijo (física) + render (R3F useFrame)
│  │  └─ audio/BreathDetector.js  # respiración vía mic (reusa AudioAnalyzer)
│  ├─ games/
│  │  ├─ panspermia/
│  │  │  ├─ PanspermiaPreview.jsx     # thumbnail Lab
│  │  │  ├─ PanspermiaGame.jsx        # root del juego
│  │  │  ├─ scenes/
│  │  │  │  ├─ GalaxyTravel.jsx       # vuelo por la galaxia (mapa)
│  │  │  │  ├─ PlanetSurface.jsx      # gameplay en superficie
│  │  │  │  └─ Nexus.jsx              # hub de reencarnación / árbol de poderes
│  │  │  ├─ planets/
│  │  │  │  ├─ planetBible.js         # DATA · §4 (fuente de verdad)
│  │  │  │  ├─ PlanetShaderMaterial.js# earth shader generalizado
│  │  │  │  └─ shaders/planet/{vertex,fragment}.glsl
│  │  │  ├─ character/
│  │  │  │  ├─ Avatar.jsx             # wrap de HolographicModel + controller
│  │  │  │  └─ FlightController.js    # vuelo espacial
│  │  │  ├─ powers/
│  │  │  │  ├─ elements.js            # data de elementos + árbol de poderes
│  │  │  │  ├─ PowerSystem.js         # cooldowns, cast, daño
│  │  │  │  └─ vfx/                   # partículas/shaders por poder
│  │  │  ├─ combat/
│  │  │  │  ├─ Guardian.jsx           # enemigos por bioma
│  │  │  │  └─ CombatSystem.js
│  │  │  └─ progression/
│  │  │     ├─ energyCenters.js       # 7 centros ↔ tercer ojo/respiración
│  │  │     └─ reincarnation.js       # nivel meta ↔ mundos accesibles
│  │  └─ kessler/
│  │     ├─ KesslerPreview.jsx
│  │     ├─ KesslerGame.jsx
│  │     ├─ data/tle.js               # fetch + parse TLE (Celestrak)
│  │     ├─ sim/orbital.js            # propagación (satellite.js) + colisiones
│  │     └─ shaders/                  # reusa earth/atmosphere existentes
│  └─ ...
└─ pages/
   ├─ PanspermiaDetail.jsx
   └─ KesslerDetail.jsx
```

**Decisiones técnicas base**

- **Estado:** `zustand` (estándar de facto en R3F, sin boilerplate). Un store por juego + slices.
- **Física:** `@react-three/rapier` (Rapier WASM). Más rápido y moderno que cannon-es; determinista, buen character controller. Para colisiones de superficie/proyectiles.
- **Raycasting/colisión de malla:** `three-mesh-bvh` para el terreno del planeta y detección de impactos de poderes.
- **Post-proceso:** `@react-three/postprocessing` (UnrealBloom para glow energético/holográfico, chromatic aberration sutil para el viaje).
- **Save:** `localStorage` versionado (esto corre en tu repo real, no en un artifact, así que localStorage va perfecto). Estructura `{ version, reincarnationLevel, unlockedCenters, element, visitedPlanets, knowledge }`.
- **Audio:** reusar `Tone`/`AudioAnalyzer` que ya tenés. La respiración detectada por mic alimenta la carga de energía (opt-in, degrada bien sin permiso).

---

## 3. `PANSPERMIA` · concepto y game loop

**Fantasía central:** sos una chispa de vida/conciencia que se propaga por el cosmos (panspermia = la hipótesis real de que la vida viaja entre mundos). Cada "vida" es una encarnación en un planeta distinto. Aprendés, te desbloqueás, morís/ascendés, y renacés en un mundo más exótico.

**Loop macro (una reencarnación):**

1. **NEXUS** (hub): elegís/confirmás elemento, gastás energía en el árbol de poderes, ves qué mundos desbloqueaste.
2. **GALAXY TRAVEL**: volás por la galaxia (reusa `GalaxyModel`). Los planetas accesibles a tu nivel brillan. Elegís destino.
3. **DESCENSO**: transición cinemática cae hacia el planeta (reusa `PlanetShaderMaterial` para el mundo, atmósfera fresnel para la entrada).
4. **PLANET SURFACE**: misiones = aprender el "secreto" del mundo (dato real) + superar al **Guardián** del bioma. Recogés fragmentos de conocimiento y energía.
5. **DESBLOQUEO**: completar el planeta abre un **centro de energía** (tercer ojo pulsa/respira — reusa `showThirdEye`/`isBreathing`) y sube tu nivel de reencarnación.
6. Volvés al NEXUS con más energía → nuevos poderes y mundos.

**Loop micro (en superficie):** explorar → detectar objetivo/enemigo → castear poderes (cooldown) → resolver puzzle/combate → obtener conocimiento. Combate simple y legible primero (proyectil + esquive), profundidad después.

---

## 4. Planet Bible (la parte científica, anclada en datos reales)

Cada **bioma** = una variante del planet shader + un tipo de bioquímica + un elemento + un guardián. Los planetas *concretos* son exoplanetas reales usados como "niveles". Fuentes: catálogo de exoplanetas de NASA (~6.000 confirmados), clasificación NASA (Terrestrial / Super-Earth / Neptunian / Gas Giant), literatura de bioquímicas hipotéticas.

### 4.1 Mapa tipo real → bioma → elemento

| Bioma (id) | Tipo real de exoplaneta | Bioquímica plausible | Elemento | Ejemplo real (nivel) |
|---|---|---|---|---|
| `terra` | Terrestrial en zona habitable | Carbono + agua ("vida como la conocemos") | **Agua/Tierra** | TRAPPIST-1 e (~40 ly), Teegarden's b (~12,5 ly, ESI ~0,9), Proxima b (4,2 ly) |
| `ocean` | Ocean / Hycean world | Carbono + agua, océano global, atmósfera rica en H₂ | **Agua** | LHS 1140 b (~48 ly, candidato a mundo océano) |
| `magma` | Lava world / super-Earth ultra-caliente | Silicatos vaporizados, alta temperatura; hipótesis "super-Io" | **Fuego** | TOI-561 b (magma ocean, día de 10,5 h), 55 Cancri e, CoRoT-7b |
| `cryo` | Snowball / ice world | Solvente **amoníaco** (líquido −78 a −33 °C), metabolismo lento | **Hielo** | mundos exteriores de sistemas de enana roja |
| `titan` | Mundo tipo Titán (hidrocarburos) | Solvente **metano/etano**, no polar; química lenta, atmósfera de N₂ | **Aire+Hielo** (híbrido "orgánico") | Titán (Sistema Solar, referencia canónica) |
| `gas` | Gas giant / hot Jupiter | Vida flotante en atmósfera; **hidrógeno supercrítico** como solvente | **Aire** | 51 Peg b (primer hot Jupiter), hemisferios día/noche por acoplamiento de marea |
| `flare` | Mundo acoplado por marea de enana roja | Vida en el **anillo terminador**, endurecida a radiación (fulguraciones UV/X) | **Rayo/Plasma** | sistema Proxima / TRAPPIST (enanas rojas que fulguran mucho) |

> Notas de verdad para no inventar de más:
> - Los lava worlds cercanos suelen estar **acoplados por marea**: un lado siempre día (fundido), otro noche (helado). Buen gancho visual y de gameplay (ya lo hace tu earth shader con `uSunDirection`).
> - El **silicio** como base de vida necesita condiciones no terrestres (alta temperatura, o frío con solvente no polar como nitrógeno líquido que disuelve polisilanos). Úsalo en `magma` y `cryo`, no en mundos tipo Tierra.
> - Las enanas rojas fulguran y bañan sus planetas en UV/rayos X → justifica el elemento Rayo y enemigos "de radiación".
> - El **amoníaco** y el **metano** son los solventes alternativos más citados y realistas para mundos fríos → sostienen `cryo` y `titan`.

### 4.2 Estructura de dato por planeta (`planetBible.js`)

```js
export const PLANETS = {
  'trappist-1e': {
    biome: 'terra',
    realName: 'TRAPPIST-1 e',
    distanceLy: 40,
    starType: 'M (enana roja)',
    massEarths: 0.69,
    tidallyLocked: true,
    fact: 'Uno de los 4 mundos rocosos de TRAPPIST-1 en zona habitable; objetivo prioritario del JWST.',
    shader: { /* uniforms del bioma: paleta, rugosidad, nubes, hielo, lava... */ },
    unlockLevel: 1,           // reincarnación mínima
    guardian: 'terra-guardian',
    knowledgeFragment: 'habitable_zone',
  },
  // ... 55-cancri-e (magma), lhs-1140b (ocean), titan (titan), etc.
}
```

El `fact` alimenta la misión educativa. `unlockLevel` conecta con reencarnación (§6).

---

## 5. Elementos y poderes (simple → complejo)

Cuatro elementos base + tres avanzados que se desbloquean por reencarnación. Cada elemento tiene un **árbol de 4 tiers** (de lo simple a lo complejo, como pediste):

```
Agua   T1 chorro   → T2 escudo agua   → T3 surf (movilidad) → T4 maremoto
Fuego  T1 bola     → T2 muro de fuego → T3 dash ígneo       → T4 nova
Tierra T1 roca     → T2 armadura      → T3 pilar-salto      → T4 sismo
Aire   T1 ráfaga   → T2 empuje/knockback → T3 planeo        → T4 tornado
--- avanzados (por nivel de reencarnación) ---
Hielo  (rama de Agua en mundos cryo)      Rayo (mundos flare)     Éter/Vacío (endgame)
```

**Reglas:**
- Empezás con **1 elemento** (elección al primer renacer). El elemento sesga en qué biomas rendís mejor (Fuego fuerte en `magma`, débil en `ocean`, etc.) → incentiva variar.
- T1 disponible ya; T2–T4 cuestan **energía** ganada superando planetas.
- Poderes = `{ id, element, tier, cost, cooldown, cast(fn), vfx }`. Empezar con proyectil + un defensivo; el resto es data-driven.

**VFX reutilizable:** los shaders holográficos y de partículas que ya tenés (glitch/fresnel del `HolographicModel`, sistema de partículas del galaxy) son la base de los efectos de poder. UnrealBloom para el brillo.

---

## 6. Progresión: energía, centros y reencarnación

Acá es donde tu estética ciencia + contemplación ya está medio construida en el código.

**Centros de energía (7).** Reusan literalmente el mecanismo de `HolographicModel`: `showThirdEye`, `isBreathing`, `thirdEyeIntensity`, `onThirdEyePress/Release`. Cada planeta superado "enciende" un centro (visualmente, el tercer ojo pulsa/late). Siete centros = siete desbloqueos mayores (un elemento avanzado o un tier ultimate por centro).

**Respiración como mecánica real (opcional, gancho de portfolio).** Reusar `AudioAnalyzer` para detectar inhalar/exhalar por mic y *cargar* energía o un ultimate mientras respirás — el mismo insight de `retratarte` ("inhalar, el patrón se forma; exhalar, el todo se revela"). Degrada limpio sin permiso de mic (fallback a mantener botón). Esto es novedoso y muy demostrable en una entrevista.

**Nivel de reencarnación (meta).** Sube al completar planetas. Gatea `unlockLevel` en el bible: a mayor nivel, mundos más exóticos/hostiles se abren en el mapa (de `terra` amable a `flare`/`gas` brutales). El nivel también escala enemigos y recompensa.

**Guardianes.** Un enemigo por bioma, temático a su química: guardián de silicatos en `magma`, de amoníaco en `cryo`, "de radiación" en `flare`, etc. Encaja con tu estética señal/ruido de `retratarte`: los guardianes pueden ser **entidades de entropía/ruido** que impiden el aprendizaje. Combate legible primero (patrón telegrafiado + ventana de esquive), capas después.

---

## 7. `KESSLER` · Game 2 (pick creativo)

**Por qué este:** reutiliza *directo* earth shader + atmósfera + `satellite.js` + posición solar que ya tenés, y aporta un género distinto (simulación/física con dato real) que complementa a `PANSPERMIA` en el portfolio. Un reclutador ve rango: RPG artístico **y** sim de datos.

**Concepto:** gestionás la órbita baja terrestre. Cargás **TLE reales** (Celestrak) de satélites y basura, propagás sus órbitas en tiempo real, y tenés que evitar el **síndrome de Kessler** (cascada de colisiones). Modos: (a) *sandbox* educativo (mirá la constelación real ahora mismo), (b) *desafío* (desviás/desorbitás objetos, cada colisión genera fragmentos que amenazan más órbitas).

**Reuso:** `earth` mesh + shaders tal cual; `athmosphere`; `getSunDirection`; `satellite.gstime` para GMST; el patrón de `SatelliteLayer`/`REGISTRY`. Lo nuevo es la capa de **colisión/propagación** y la UI de gestión.

**Tech extra:** `InstancedMesh` para miles de objetos, `three-mesh-bvh` o grid espacial para broad-phase de colisiones, LOD por distancia.

**Alternativas si preferís otro Game 2** (pick uno):
- **`RESPIRA`** — experiencia meditativa controlada por respiración/rostro (reusa `FaceTracker` + `AudioAnalyzer` de retratarte). Menos "juego", más experiencia interactiva; muy fuerte en diseño de interacción.
- **`TESSERACT RUNNER`** — puzzle de navegación en 4D reusando `TesseractModel`. Original, nicho, difícil.

---

## 8. Qué robar de threejs.org (ejemplos oficiales)

- `webgl_gpgpu_birds` / GPGPU particles → flujo de partículas del **viaje por galaxia** y estelas de poderes.
- `webgl_postprocessing_unreal_bloom` → **glow** energético/holográfico.
- `misc_controls_pointerlock` / fly controls → base del **FlightController** espacial.
- `webgl_instancing_*` → **campos de asteroides / debris** (y Kessler).
- `physics_rapier_*` → integración de **Rapier** (combate, superficie).
- `webgl_lensflare` → estrellas del mapa galáctico.
- Tu earth shader ya viene de la lección de Earth de Three.js Journey → generalizarlo es el camino más corto al **planet shader** multi-bioma.

---

## 9. Fases de trabajo (tickets para Claude Code)

Ordenadas para tener algo jugable y demostrable rápido. Cada fase = un branch/PR.

**Fase 0 · Andamiaje (medio día)**
- [ ] Crear `lab-core/engine/` con `GameStore` (zustand), `SaveManager`, `useGameLoop`, `SceneManager`.
- [ ] Registrar `panspermia` y `kessler` en `registry.js` + rutas `/lab/panspermia`, `/lab/kessler` + previews placeholder en el grid.

**Fase 1 · Planet shader multi-bioma (núcleo visual)**
- [ ] Generalizar earth `fragment.glsl` → `PlanetShaderMaterial` con uniforms por bioma (paleta día/noche, nubes, hielo, lava, bandas de gigante gaseoso).
- [ ] `planetBible.js` con 5–7 planetas reales (§4).
- [ ] Escena de test que cicla biomas (validar cada preset).

**Fase 2 · Avatar + superficie**
- [ ] `Avatar.jsx` envolviendo `HolographicModel`; controller de superficie con Rapier.
- [ ] `PlanetSurface.jsx`: aterrizás, caminás/flotás sobre el planeta, cámara.
- [ ] Recolección de "fragmentos de conocimiento" (misión mínima).

**Fase 3 · Poderes (vertical slice de combate)**
- [ ] `elements.js` + `PowerSystem` (cooldown, cast).
- [ ] 1 elemento completo T1–T2 (ej. Fuego: bola + muro) con VFX (bloom + partículas).
- [ ] 1 `Guardian` con patrón telegrafiado + esquive + derrota → recompensa.

**Fase 4 · Viaje + progresión (cierra el loop)**
- [ ] `GalaxyTravel.jsx` sobre `GalaxyModel`: planetas accesibles brillan, seleccionás, `FlightController`.
- [ ] `Nexus.jsx`: árbol de poderes, gasto de energía, elección de elemento.
- [ ] `reincarnation.js` + `energyCenters.js` conectando desbloqueo ↔ tercer ojo/respiración.
- [ ] Save/load end-to-end.

**Fase 5 · KESSLER (paralelo/posterior)**
- [ ] `data/tle.js`: fetch + parse TLE reales; `sim/orbital.js`: propagación con `satellite.js`.
- [ ] Modo sandbox (constelación real) → modo desafío (colisiones/cascada) con `InstancedMesh`.

**Fase 6 · Pulido de portfolio**
- [ ] Onboarding de 20 s, pantalla de datos reales por planeta (el "aprender"), captura/GIF para el CV.
- [ ] Presupuesto de performance (§10) verificado en mobile.

---

## 10. Presupuesto de performance y riesgos

- **Perf:** `dpr={[1, 1.5]}`, `frameloop="demand"` fuera de foco (ya lo hacés en `Lab.jsx`), `InstancedMesh` para todo lo que se repita, `frustumCulled` con cuidado (ojo: el holographic lo desactiva a propósito), disposición de materiales/geometrías en cleanup (ya lo hacés bien en `RetratarteDetail`). Bloom es caro: limitá resolución del pass.
- **Riesgo de scope:** `PANSPERMIA` puede crecer sin fin. El corte de MVP jugable es **Fase 3** (un planeta, un elemento a T2, un guardián). Todo lo demás es data-driven encima de eso.
- **Física:** Rapier en WASM suma peso de carga; lazy-load la escena de superficie.
- **TLE:** Celestrak tiene rate limits; cachear el fetch y versionar el dataset.
- **Respiración por mic:** siempre con fallback sin permiso.

---

## 11. Definition of Done (ángulo laburo)

Para que sirva como pieza para el puesto, el mínimo demostrable es:

1. **Una experiencia jugable de punta a punta** (Fase 4): elegir elemento → viajar → caer en un planeta real → misión + guardián → desbloquear centro → renacer.
2. **Legible en 60 s** sin explicación previa (onboarding corto).
3. **El dato real visible**: que se note que los planetas salen de ciencia, no de humo (panel de datos por mundo).
4. **Un segundo experimento contrastante** (`KESSLER` o alternativa) que muestre otro género/técnica.
5. Corre en desktop y no explota en mobile.

---

### Apéndice · nombres

- Game 1: **PANSPERMIA** (recomendado, resuena ciencia + reencarnación) · alternativas: SAMSARA, ANIMA, ÉTER. (vamos a empezar puramente por este)
- Game 2: **KESSLER** · alternativas: RESPIRA, TESSERACT RUNNER. (esto queda para futuro)

Datos importante para el juego 1:
Ver juegos historicos y modernos que mezclen buena usabilidad 3d, tengan componentes que llamen la atención a jugar, que sea al mismo tiempo de entrenido y que al mismo tiempo puedas aprender de arte, ciencia, espiritualidad, cuantico
buena interfaz de usuario
