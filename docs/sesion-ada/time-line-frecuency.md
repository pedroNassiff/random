# Timeline de frecuencias en el reproductor — estado y mejoras

> Documentación del `FrequencyTimeline` (que no estaba documentado) + plan de
> las mejoras UI/UX solicitadas. Track de trabajo independiente del multimodal.

---

## 1. Estado actual (lo que ya está implementado)

### Dónde vive
`src/lab-core/brain/hud/SessionControl.jsx` → sub-componente `FrequencyTimeline`.
Es el reproductor del **modo Dataset** (sesiones EEG pregrabadas, ej. OpenNeuro
ds003969). El modo en vivo (`MuseControl.jsx`) NO usa este timeline — muestra
barras verticales en tiempo real.

### Qué hace hoy
- Renderiza un SVG con **6 sparklines apiladas**: las 5 bandas (δ θ α β γ) +
  `signalQuality`, cada una con color propio y `yOffset` vertical.
- Superpone el **cursor de progreso** (línea vertical) desde `progress`.
- **Seek por click** (`handleScrub`): convierte X del click → tiempo de reproducción.
- Datos desde `useSessionMetrics(sessionId)` → `/sessions/{id}/metrics`,
  **downsampleado a ~400 puntos** vía `everyNth`.

### Cómo se ve
Barra inferior full-width, fondo casi negro, las líneas de banda corriendo
horizontalmente. Cursor blanco marca la posición. Reemplazó la barra de progreso
gris lisa anterior.

### Limitaciones actuales (lo que motiva las mejoras)
- **Altura chica**: las 6 líneas quedan comprimidas, poco legibles.
- **Fondo gris/opaco**: no deja ver bien las líneas ni integra con el 3D detrás.
- **Sin interpretación**: son líneas sin ejes, sin leyenda de qué banda es cuál
  (solo el color), sin marcadores de fase del protocolo.
- **Sin coherencia**: la coherencia (MSC/PLV) vive solo en el panel lateral,
  no en el timeline — aunque conceptualmente es una serie temporal más.
- **Solo modo dataset**: el modo en vivo no comparte este componente.

---

## 2. Mejoras solicitadas

### 2.1 Agrandar el timeline
Subir la altura para que las 6 series respiren. Objetivo: que cada banda sea
legible individualmente, no una maraña comprimida. Considerar altura configurable
o modo "expandido" (hover/click para agrandar).

### 2.2 Fondo transparente / mejor color
Cambiar el gris opaco por:
- **Opción A — transparente**: dejar ver el modelo 3D del cerebro detrás, con un
  gradiente sutil de oscuridad abajo para legibilidad. Integra timeline + 3D.
- **Opción B — glass/blur**: fondo `backdrop-filter: blur()` semi-transparente,
  estética "glassmorphism" oscura. Legible sin tapar el 3D del todo.
- Recomendación: **B para la franja de controles, A para la zona de las líneas**.
  Las líneas de banda ganan contraste sobre un degradado oscuro, y el fondo no
  compite con el cerebro.

### 2.3 Coherencia en el timeline
Agregar la serie de coherencia (MSC o PLV) como una línea más, visualmente
diferenciada (ej. más gruesa, o en una sub-banda propia arriba). Convierte el
timeline en la vista temporal unificada de "qué pasó en la sesión".

### 2.4 Marcadores de fase del protocolo
Las fases (baseline_open, meditation_free, etc.) vienen de los markers (ya
resuelto en backend con `get_per_channel_by_phase`). Dibujar líneas verticales
tenues + labels en el timeline para ubicar en qué fase está cada momento. Esto
conecta con el trabajo de per-channel y hace el timeline navegable por fase.

### 2.5 Legibilidad de bandas
Leyenda mínima (los símbolos δ θ α β γ al inicio de cada línea, o un hover que
resalte la banda). Que se entienda qué es cada línea sin adivinar por color.

---

## 3. Consideraciones de diseño UI/UX

- **Jerarquía**: la banda dominante del momento (la que el panel lateral marca
  como "Alpha dominante") podría resaltarse en el timeline — más brillo/grosor.
- **Interacción**: hover sobre el timeline → tooltip con valores exactos de cada
  banda en ese instante. Refuerza "explicar qué y por qué está pasando".
- **Consistencia con el panel lateral**: mismos colores de banda que
  `AdaRealtimePanel` y `FREQUENCY BANDS`. Ya parecen consistentes; verificar.
- **Performance**: mantener el downsample a ~400 puntos. Si se agregan
  coherencia + markers, no recalcular en cada frame — memoizar.

---

## 4. Alcance y orden sugerido

Track independiente del multimodal EEG+HRV. Se puede hacer en cualquier momento.

1. **Fondo + altura** (2.1, 2.2) — el cambio visual de mayor impacto, bajo riesgo.
2. **Marcadores de fase** (2.4) — reutiliza markers ya disponibles del backend.
3. **Coherencia en timeline** (2.3) — requiere traer la serie de coherencia al
   componente (ya está en `sessionMetrics`, solo dibujarla).
4. **Legibilidad + tooltips** (2.5, 3) — pulido final de UX.

Nota: cuando llegue el multimodal (HRV), este mismo timeline es el lugar natural
para una franja de **HRV / coherencia cardíaca** debajo de las bandas EEG — el
diseño de fondo/altura debería dejar espacio para esa fila futura.

---

## 5. Archivos involucrados

| Archivo | Rol | Se toca |
|---|---|---|
| `hud/SessionControl.jsx` | Reproductor dataset + `FrequencyTimeline` | **Sí** (principal) |
| `hud/MuseControl.jsx` | Panel modo en vivo (barras, no timeline) | No (por ahora) |
| `components/AdaRealtimePanel.jsx` | Dashboard lateral (bandas, coherencia, audio) | Quizás (consistencia de color) |