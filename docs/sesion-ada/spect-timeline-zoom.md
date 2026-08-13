# SPEC (adición) — Zoom interactivo del timeline + auto-escala Y

> Suma al spec `spec-timeline-sidebar.md`. Resuelve el problema central:
> **las variaciones de las bandas no se diferencian** — las líneas se ven planas.
> Solución en dos ejes: zoom de tiempo (X) + reescala de amplitud (Y) sobre la
> ventana visible. El eje Y es la pieza más importante.

---

## Problema

Las 6 sparklines (δ θ α β γ + signalQuality) se ven casi planas. Dos causas
combinadas:
1. **Eje X**: toda la sesión (~10 min) comprimida en el ancho → cada variación
   ocupa poquísimos píxeles horizontales.
2. **Eje Y**: cada banda se normaliza sobre su rango de TODA la sesión y se
   dibuja en poca altura → las oscilaciones locales quedan aplastadas. Un pico
   aislado en el minuto 8 achata todo el resto.

Zoom de tiempo solo no alcanza: estira horizontalmente pero las líneas siguen
chatas verticalmente. **Hay que reescalar el Y sobre la ventana visible.**

---

## Decisión de UX (confirmada)

**Zoom solo visual (Opción A).** El zoom es una lupa de inspección: NO cambia la
reproducción ni el audio, que siguen corriendo sobre la sesión completa. El seek
por click sigue funcionando dentro de la zona ampliada. El cursor de progreso
sigue reflejando la posición real de reproducción (puede quedar fuera de la
ventana visible si hiciste zoom en otra zona — ver manejo abajo).

---

## Modelo de estado

El timeline pasa de "mostrar todo" a "mostrar una ventana `[viewStart, viewEnd]`"
(en unidades de índice de sample o de tiempo; recomiendo índice de sample sobre
el array downsampleado).

```
// Estado nuevo del componente FrequencyTimeline
viewStart : number   // índice inicial de la ventana visible (0..N)
viewEnd   : number   // índice final de la ventana visible (0..N)
yGain     : number   // ganancia manual de amplitud, default 1.0
                     // (auto-escala Y va aparte, siempre activa)

// Derivados
N            = downsampledMetrics.length      // ~400
viewSpan     = viewEnd - viewStart            // cuántos samples se ven
isZoomed     = viewSpan < N                   // hay zoom activo?
```

Estado inicial: `viewStart = 0`, `viewEnd = N` (se ve todo). `yGain = 1`.

---

## Pieza 1 — Auto-escala Y por ventana visible (LA IMPORTANTE)

Cada banda se reescala usando SOLO los samples dentro de `[viewStart, viewEnd]`,
y usa toda su altura de franja disponible. Así las variaciones locales llenan el
espacio vertical.

```
function computeBandPath(band, viewStart, viewEnd, yGain, bandFrameHeight, width):
    // 1. Slice de la ventana visible
    slice = band.values[viewStart .. viewEnd]

    // 2. Min/max SOLO de lo visible (no de toda la sesión)
    vMin = min(slice)
    vMax = max(slice)
    range = vMax - vMin
    if range < EPSILON: range = EPSILON      // evitar div/0 en zonas planas

    // 3. Mapear cada punto a coordenadas SVG
    points = []
    for i in 0 .. slice.length - 1:
        x = (i / (slice.length - 1)) * width

        // Normalizar a 0..1 dentro del rango visible
        norm = (slice[i] - vMin) / range

        // Aplicar ganancia manual, centrada (para no clippear arriba/abajo)
        norm = 0.5 + (norm - 0.5) * yGain
        norm = clamp(norm, 0, 1)

        // Y invertido (SVG crece hacia abajo), con padding vertical
        y = bandFrameHeight * (1 - norm) * (1 - 2*PAD) + bandFrameHeight*PAD

        points.push({x, y})
    return toSvgPath(points)
```

**Efecto clave:** al hacer zoom en una zona chata, `vMin`/`vMax` se recalculan a
ese tramo, `range` se achica, y las micro-variaciones que antes eran invisibles
ahora ocupan toda la altura de la franja. Este es el fix real del problema.

> Nota: auto-escala por ventana está SIEMPRE activa (incluso sin zoom mejora la
> visibilidad vs escala global). `yGain` es un extra manual encima.

---

## Pieza 2 — Zoom de tiempo (eje X)

### Interacción: rueda del mouse (recomendada)

```
function onWheel(event):
    event.preventDefault()

    // Posición del mouse en el timeline → índice del sample bajo el cursor
    mouseX = event.offsetX / timelineWidth        // 0..1
    anchorIdx = viewStart + mouseX * viewSpan       // sample bajo el mouse

    // Factor de zoom (rueda arriba = zoom in)
    zoomFactor = event.deltaY < 0 ? 0.85 : 1.18     // in : out
    newSpan = clamp(viewSpan * zoomFactor, MIN_SPAN, N)
    // MIN_SPAN = ej. 20 samples (no dejar hacer zoom infinito)

    // Recentrar la ventana manteniendo anchorIdx bajo el mouse
    ratioLeft = (anchorIdx - viewStart) / viewSpan
    newStart = anchorIdx - ratioLeft * newSpan
    newEnd   = newStart + newSpan

    // Clampear a los bordes
    if newStart < 0:      newStart = 0; newEnd = newSpan
    if newEnd > N:        newEnd = N;   newStart = N - newSpan

    setView(round(newStart), round(newEnd))
```

### Interacción alternativa/complementaria: drag para seleccionar región

```
function onDragSelect(xStartPx, xEndPx):
    // Convertir píxeles a índices dentro de la ventana ACTUAL
    i0 = viewStart + (xStartPx / timelineWidth) * viewSpan
    i1 = viewStart + (xEndPx   / timelineWidth) * viewSpan
    setView(round(min(i0,i1)), round(max(i0,i1)))
```

### Reset

```
function resetZoom():
    setView(0, N)      // doble-click en el timeline, o botón/tecla Esc
```

---

## Pieza 3 — Mini-mapa (overview)

Una franja fina debajo del timeline principal que muestra la sesión completa con
un rectángulo indicando la ventana visible. Da contexto de "dónde estás".

```
// Render del minimapa (altura ~16-24px, sesión completa siempre)
- Dibujar una versión ultra-comprimida de 1-2 bandas (ej. alpha) sobre todo N.
- Overlay: rectángulo translúcido en [viewStart/N .. viewEnd/N] * width.
- Interacción: click/drag en el minimapa mueve la ventana visible (pan).
- Si !isZoomed: el rectángulo ocupa todo → minimapa puede atenuarse/ocultarse.
```

---

## Pieza 4 — Ganancia Y manual (opcional pero barato)

Un control (slider chico o +/- , o Shift+rueda) que ajusta `yGain` (rango ~0.5
a 4). Multiplica la amplitud vertical estilo "sismógrafo". Ya está contemplado
en `computeBandPath` (el factor centrado en 0.5). Default 1.0.

---

## Interacción con lo existente (preservar)

### Cursor de progreso
El cursor refleja la posición REAL de reproducción, en tiempo absoluto de sesión.
Con zoom, mapearlo a la ventana visible:

```
cursorIdx = progress * N
if cursorIdx dentro de [viewStart, viewEnd]:
    cursorX = ((cursorIdx - viewStart) / viewSpan) * width
    dibujar cursor en cursorX
else:
    // La reproducción está fuera de la zona ampliada
    dibujar una flecha/indicador en el borde (izq o der) señalando hacia dónde
    quedó el cursor, para no perder referencia.
```

### Seek por click (`handleScrub`)
Recalcular con la ventana visible (no con N global):

```
function handleScrub(clickXPx):
    clickIdx = viewStart + (clickXPx / width) * viewSpan
    clickTime = (clickIdx / N) * sessionDuration
    seekTo(clickTime)      // reproducción salta ahí (aunque el zoom no cambie)
```

### Distinción click vs drag
- Click corto (sin movimiento) → seek.
- Drag horizontal → selección de región para zoom (Pieza 2) o pan.
- Definir un umbral de px (ej. >5px de movimiento = drag, si no = click).

---

## Performance

- `computeBandPath` recalcula al cambiar `viewStart/viewEnd/yGain`. Memoizar por
  esas dependencias (no recomputar en cada frame de reproducción — el cursor se
  mueve aparte, sin recalcular paths).
- El slice + min/max sobre ~400 puntos es barato; con 6 bandas sigue siendo
  trivial. No hace falta downsample adicional.
- El cursor de progreso se actualiza por separado (solo su X), sin tocar los
  paths de las bandas.

---

## Criterios de aceptación

1. **El problema base resuelto:** al hacer zoom en una zona, las variaciones de
   cada banda se ven claramente (llenan la altura de su franja). Comparar antes/
   después en una zona que hoy se ve plana.
2. Rueda del mouse hace zoom in/out centrado en el cursor del mouse.
3. La escala Y se recalcula sobre la ventana visible (verificar: una zona chata
   ampliada muestra oscilación, no una línea recta).
4. Doble-click (o Esc) resetea a ver todo.
5. Minimapa muestra qué porción se ve y permite pan.
6. Cursor de progreso: correcto dentro de la ventana; indicador de borde si la
   reproducción quedó fuera del zoom.
7. Seek por click sigue funcionando con coordenadas de la ventana visible.
8. Click vs drag bien diferenciados (no dispara seek al arrastrar).
9. Sin regresión de performance (memoización correcta).
10. yGain manual amplifica la amplitud sin romper el clamp (no clippea fuera de
    la franja).

---

## Orden de implementación

1. **Auto-escala Y por ventana visible** (Pieza 1) — aunque `viewStart/End` sigan
   siendo 0..N al principio, cambiar la normalización de global → por-ventana ya
   mejora la visibilidad. Es el núcleo.
2. **Estado de zoom + rueda** (Pieza 2, onWheel). Ahora la ventana se achica y la
   Pieza 1 empieza a lucir.
3. **Preservar cursor + seek** con la ventana visible.
4. **Minimapa** (Pieza 3).
5. **Ganancia manual + drag-select** (Piezas 2/4) — pulido.

Verificar el criterio 1 después del paso 1-2: si ahí ya se diferencian las
variaciones, el problema central está resuelto y el resto es refinamiento.