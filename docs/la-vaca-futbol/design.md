# DESIGN — Fútbol Vaquero

Inspirado en [lavacacoworking.com](https://www.lavacacoworking.com/), relevado el 23/09/2026 con el CSS computado del sitio.

## 1. Lenguaje visual de referencia

La Vaca usa un estilo **neo-brutalista con toques retro-arcade**:

- Fondo gris claro liso y bloques blancos con borde negro grueso, sin redondeos.
- Botones y pestañas "extruidos": un bisel negro en 3D abajo a la derecha, dibujado con pseudo-elementos sesgados.
- Cabeceras de sección como barra negra con texto blanco en mayúsculas.
- Tarjetas de evento: fecha a la izquierda, hora a la derecha y una línea punteada debajo; después el título grande.
- Íconos pixel-art de línea negra con cuadrados de color sueltos (rojo, violeta, amarillo).
- Hero con un laberinto tipo Pac-Man sobre violeta, con puntos cian y una pelota de fútbol como "power pellet".

Tomamos ese lenguaje y lo aplicamos a nuestro contenido. El toque arcade encaja natural con un marcador y una pantalla de "versus".

> **Marca.** Permiso de uso del logo de La Vaca confirmado por el grupo (29/09/2026): `static/lavaca.png`
> (versión liviana `static/lavaca-256.png`). Se usa en el encabezado, como `.RANDOM(🐄)` al centro con la cuenta
> (Contraseña, Salir) a la derecha, y como avatar de cada jugador en la tarjeta de formación. La mascota y el juego
> del hero del sitio de La Vaca siguen sin usarse.

## 2. Tokens

### Color

| Token | Hex | Origen | Uso |
|---|---|---|---|
| `--bg` | `#E6E6E6` | extraído | Fondo de página |
| `--surface` | `#FFFFFF` | extraído | Tarjetas, botones |
| `--ink` | `#000000` | extraído | Bordes, texto, barras de cabecera |
| `--ink-soft` | `#2C2C2C` | extraído | Texto secundario |
| `--night` | `#121212` | extraído (footer) | Footer, toasts |
| `--sun` | `#FDE761` | extraído | **Amarillos** (equipo A), highlights |
| `--arcade` | `#8A10DE` | aprox. del hero, verificar con cuentagotas | **Violetas** (equipo B), fondo de la pantalla VS |
| `--arcade-deep` | `#5A0A96` | aprox. | Paredes del laberinto, hover sobre violeta |
| `--dot` | `#3FD4FF` | aprox. (puntos del laberinto) | Bordes punteados de la pantalla VS |
| `--link` | `#006DFF` | extraído | Links y anillo de foco |
| `--alarm` | `#D40000` | aprox. (cuadrados de íconos) | Errores, cierre de inscripción inminente |

El sitio usa `rgba(0,0,0,.6)` para el texto de cuerpo sobre `#E6E6E6`, que queda con contraste pobre. Nosotros usamos `--ink` para el cuerpo y `--ink-soft` solo para metadatos.

### Tipografía

| Rol | Fuente del sitio | Nuestra elección |
|---|---|---|
| Display: títulos, botones, navegación | **Andes** (Latinotype) 700/800 | Andes con licencia web. Si no, probar en pantalla **Baloo 2** 700/800 y **Lexend** 700, y quedarse con la que más se parezca en calidez y peso |
| Cuerpo | **Roboto** 400/700 | Roboto 400/700 |
| Pixel: marcador, % de victoria, cuenta regresiva | **DePixel** (klein / halbfett) | DePixel. Verificar la licencia de la versión que se descargue. Nunca se usa para texto corrido |

**Escala** (tomada del sitio): 14 · 16 · 20 · 28 · 40 · 60 px. En mobile, 60 → 40 y 40 → 28.

**Mayúsculas:** solo en botones, pestañas de navegación y barras de cabecera, como hace el sitio. Los títulos de tarjeta y el cuerpo van en sentence case.

### Forma y espacio

- `--radius: 0`, sin excepciones.
- `--border: 3px solid var(--ink)` en todo lo interactivo y en las tarjetas.
- Espaciado en base 4: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Separador punteado: `border-bottom: 3px dotted var(--ink)`.

### Extrusión

Versión simple (default):

```css
.extrude {
  border: var(--border);
  background: var(--surface);
  box-shadow: 6px 6px 0 var(--ink);
  transition: transform 80ms, box-shadow 80ms;
}
.extrude:active {
  transform: translate(6px, 6px);
  box-shadow: 0 0 0 var(--ink);
}
```

Versión fiel (opcional): el sitio dibuja las caras del bisel con `::before` (`skewY(45deg)`, cara derecha) y `::after` (`skewX(45deg)`, cara inferior) en negro sólido. Replicarla en el componente `Extrude` y ajustar a ojo comparando con el sitio.

### Tailwind v4

```css
@theme {
  --color-bg: #E6E6E6;
  --color-surface: #FFFFFF;
  --color-ink: #000000;
  --color-ink-soft: #2C2C2C;
  --color-night: #121212;
  --color-sun: #FDE761;
  --color-arcade: #8A10DE;
  --color-arcade-deep: #5A0A96;
  --color-dot: #3FD4FF;
  --color-link: #006DFF;
  --color-alarm: #D40000;
  --font-display: "Andes", "Baloo 2", system-ui, sans-serif;
  --font-body: "Roboto", Arial, sans-serif;
  --font-pixel: "DePixel", ui-monospace, monospace;
  --radius-none: 0;
}
```

## 3. Principios

1. **Un solo momento memorable:** la pantalla VS (§6). El resto es sobrio: gris, blanco y negro.
2. **Los colores de equipo son semánticos.** Amarillo = A, violeta = B. No se usan para decorar otra cosa.
3. **La estructura informa.** Las barras negras separan secciones reales, la línea punteada separa metadatos del contenido y los bordes indican qué se puede tocar.
4. **Mobile primero.** La gente se anota desde el teléfono. Objetivos táctiles ≥ 44 px.

## 4. Layout

Contenedor `max-width: 1200px` con 16 px de margen en mobile. Alineación a la izquierda.

**Home, mobile (partido abierto)**

```
┌──────────────────────────────┐
│ FÚTBOL VAQUERO   [PARTIDO][…]│  NavTabs con scroll horizontal
├──────────────────────────────┤
│ MIÉ 30 SEP ········· 20:00H  │  MatchCard
│ Cierra en 2d 04h             │  (pixel, --alarm si < 12h)
│ 14/16 convocados             │
│ ┌────────────────────────┐   │
│ │          VOY           │▓  │  Botón extruido, full width
│ └────────────────────────┘▓  │
├──────────────────────────────┤
│ CONVOCADOS                   │  barra negra
│ Juan · DEF  │ Pedro · MED …  │  PlayerChips en 2 columnas
│ LISTA DE ESPERA              │
└──────────────────────────────┘
```

**Equipos, desktop (admin)**

```
┌─[PROPUESTA 1][PROPUESTA 2][PROPUESTA 3]──────────────────────┐
│ ┌─ AMARILLOS ─────────┐   ┌─ VIOLETAS ──────────┐  ┌RADAR──┐ │
│ │ ▌Juan      DEF  27.1│   │ ▌Fede      MED  26.4│  │       │ │
│ │ ▌…  (drag & drop)   │   │ ▌…                  │  │       │ │
│ │ Fuerza 201.3        │   │ Fuerza 199.8        │  └───────┘ │
│ └─────────────────────┘   └─────────────────────┘            │
│ [███████████ 51% ░░░░░░░░░░ 49%]   Costo 0.08  ▸ desglose    │
│ [PUBLICAR EQUIPOS]  [COMPARTIR POR WHATSAPP]                 │
└──────────────────────────────────────────────────────────────┘
```

## 5. Componentes

| Componente | Especificación |
|---|---|
| `Button` | Primario: fondo `--surface`, borde, extruido, display 700 en mayúsculas, 20 px. Secundario: fondo `--ink` con texto blanco y sin extrusión (como el "sounds good" del sitio). Deshabilitado: borde punteado, sin extrusión, `--ink-soft` |
| `NavTabs` | Fila de pestañas con borde, en mayúsculas y 16 px. La activa tiene fondo `--ink` y texto blanco. En mobile, scroll horizontal |
| `SectionHeader` | Barra `--ink`, texto blanco en mayúsculas, 22 px, padding 16/24 |
| `MatchCard` | Fecha (izquierda) y hora (derecha) en display 700, línea punteada, título a 28 px, línea de estado. Ícono pixel opcional |
| `PlayerChip` | Borde, franja izquierda de 8 px con el color del equipo (o `--ink-soft` sin equipo), nombre y puesto. Admin: `mu` alineado a la derecha |
| `SkillPicker` | 10 cuadrados de 24 px; los llenos en `--ink` y el valor elegido en `--sun`. Tiene `role="slider"` y se maneja con flechas y con Home/End. Lleva la descripción de la skill debajo |
| `TeamColumn` | Cabecera con el color del equipo (amarillo con texto negro, violeta con texto blanco), lista de chips y pie con la fuerza (admin) |
| `WinBar` | Barra de 24 px dividida entre `--sun` y `--arcade`, con los porcentajes en fuente pixel |
| `SkillRadar` | Recharts, trazo `--ink` de 3 px, rellenos de equipo al 35 %, grilla mínima |
| `Toast` | Fondo `--night`, texto blanco, borde de 3 px, abajo en el centro |
| `PixelIcon` | SVG de 16×16 en celdas, línea negra y 1–3 cuadrados de color. Íconos propios: pelota, silbato, reloj, arco |

## 6. Momento memorable: pantalla VS

Aparece en `/` cuando hay equipos publicados, y es lo que se comparte como imagen OG.

- Fondo `--arcade`, con un marco interior hecho con puntos `--dot` (borde `dotted`), que evoca el laberinto sin copiarlo.
- Arriba, en fuente pixel: `AMARILLOS  VS  VIOLETAS`.
- Dos columnas de jugadores: la de amarillos en `--sun` con texto negro y la de violetas en blanco sobre `--arcade-deep`.
- `WinBar` abajo.
- Después del partido, el marcador en fuente pixel grande (`5 – 4`) y la leyenda "Parejo" si la diferencia fue ≤ 2.
- **Única animación de la app:** los jugadores entran a su columna uno por uno, con 40 ms de desfase y un paso escalonado (`steps()`) que se siente arcade. Con `prefers-reduced-motion`, aparecen sin animación.

## 7. Accesibilidad

- Contraste: negro sobre `--sun` y blanco sobre `--arcade` pasan AA. Verificar blanco sobre `--arcade-deep`.
- Foco visible: `outline: 3px solid var(--link); outline-offset: 3px`.
- La información nunca depende solo del color: cada equipo tiene nombre y cada chip muestra el puesto en texto.
- `SkillPicker` y el drag & drop de equipos tienen alternativa por teclado. Mover jugadores también funciona con el botón "Pasar al otro equipo".

## 8. Tono de los textos

Español llano, voz activa, frases cortas.

- Acciones: **Voy**, **Me bajo**, **Armar equipos**, **Publicar equipos**, **Compartir por WhatsApp**, **Cargar resultado**, **Puntuar**.
- La confirmación repite el verbo: "Equipos publicados", "Resultado cargado".
- Errores que dicen qué pasó y qué hacer: "La inscripción cerró el domingo a las 23:59. Pedile al admin que te agregue."
- Estados vacíos que invitan a actuar: "Todavía no hay partido para el miércoles. Crealo desde Ajustes."