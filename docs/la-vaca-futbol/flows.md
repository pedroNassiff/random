# Fútbol Vaquero — Procesos, vistas y casos de uso

Cómo funciona hoy la app (M0 + M1) y hacia dónde va (M2–M7). Complementa
[README.md](README.md) (estado y doc técnica) y [spec.md](spec.md) (spec funcional).

Leyenda en todos los diagramas: ✅ implementado · ⏳ pendiente.

---

## 1. Mapa de vistas y menú

```mermaid
flowchart TD
    Entrar["/entrar<br/>Email + contraseña ✅"] -->|login| Shell
    Entrar -->|"primera vez / olvidé<br/>→ magic link"| Pass["/contrasena<br/>Crear o cambiar contraseña ✅"]
    Pass --> Shell

    subgraph Shell["App logueada — menú NavTabs"]
        direction LR
        Partido["PARTIDO<br/>/ ✅ Voy / Me bajo, cupo, convocados, espera<br/>⏳ pantalla VS"]
        Jugadores["JUGADORES<br/>/jugadores ✅"]
        Skills["SKILLS<br/>/skills ✅ solo admin"]
        Historial["PARTIDOS ✅<br/>/partidos: resultado, Parejo, equipos"]
        Stats["STATS ⏳ M6 admin"]
        Ajustes["AJUSTES ⏳ admin"]
    end

    Jugadores -->|botón Puntuar| Puntuar["/jugadores/:id/puntuar ✅<br/>SkillPicker 1–10 por skill"]
    Partido -->|admin| Equipos["/partidos/:id/equipos ✅<br/>3 propuestas, mover, publicar, restricciones"]
    Partido -->|admin| Resultado["/partidos/:id/resultado ✅<br/>goles y quién jugó"]

    DevUI["/dev/ui ✅<br/>catálogo de componentes (público)"]
```

Todas las rutas cuelgan de `/vaca-futbolera`.

| Pestaña | Miembro ve | Admin ve además |
|---|---|---|
| **Partido** ✅ | Fecha y hora, cuenta regresiva al cierre (roja si faltan < 12 h), **Voy / Me bajo**, convocados `n/cupo`, lista de espera. ⏳ pantalla VS | Agregar y sacar jugadores (también después del cierre). ⏳ armar equipos, cargar resultado |
| **Jugadores** ✅ | Lista con puesto y botón **Puntuar** (si su usuario está vinculado a un jugador) | Formulario **Agregar jugador**, puntaje compuesto y raters por skill |
| **Skills** ✅ | — (la pestaña no aparece y la URL redirige) | Crear skill, cambiar peso 0–3, activar o desactivar |
| **Partidos** ✅ | Tarjeta por partido jugado: BLANCOS 5 – 4 NEGROS, "Parejo" si la diferencia ≤ 2, desplegable con quién jugó | Editar resultado |
| Stats ⏳ | — | Parejidad y calibración |
| Ajustes ⏳ | — | Calendario, cupo, pesos, restricciones |

CAMBIO: la pestaña de contraseña y salir deberian estar en la esquina, el logo de la vaca que esta aca: static/lavaca.png deberia ir ene l medio, pero dentro de .random(logo)
---

## 2. Casos de uso

```mermaid
flowchart LR
    Miembro(("👤 Miembro"))
    Admin(("🛡️ Admin"))
    Cron(("⏱️ Cron"))

    subgraph M1["Implementado (M0–M3)"]
        LOGIN["Entrar con email + contraseña ✅"]
        PASS["Crear / recuperar contraseña con magic link ✅"]
        UC01["UC-01 Alta y edición de jugador ✅"]
        UC02["UC-02 Crear y editar skill ✅"]
        UC03["UC-03 Puntuar skills de un jugador ✅"]
        VERP["Ver puntajes agregados y raters ✅"]
        UC04["UC-04 Inscribirse / bajarse ✅"]
        UC05["UC-05 Generar 3 propuestas ✅"]
        UC06["UC-06 Comparar, mover y publicar ✅"]
        UC07["UC-07 Compartir por WhatsApp (texto + imagen) ✅"]
        UC13["UC-13 Restricciones apart/together ✅"]
        UC08["UC-08 Cargar resultado ✅"]
    end

    subgraph NEXT["Pendiente"]
        UC10["UC-10 Importar historial CSV ⏳ M4"]
        UC11["UC-11 Invitado puntual ⏳ M4"]
        UC09["UC-09 Recalcular ratings ⏳ M5"]
        UC12["UC-12 Dashboard de stats ⏳ M6"]
    end

    Miembro --- LOGIN
    Miembro --- PASS
    Miembro --- UC03
    Miembro --- UC04
    Admin --- LOGIN
    Admin --- PASS
    Admin --- UC01
    Admin --- UC02
    Admin --- UC03
    Admin --- VERP
    Admin --- UC05
    Admin --- UC06
    Admin --- UC07
    Admin --- UC13
    Admin --- UC08
    Admin --- UC10
    Admin --- UC11
    Admin --- UC12
    Cron --- UC05
    Cron --- UC09
```

---

## 3. Historias de usuario

| # | Historia | Criterio de aceptación | Estado |
|---|---|---|---|
| HU-01 | Como **miembro**, quiero entrar con email y contraseña, sin depender de abrir un mail cada vez. | Login con contraseña; sesión de 30 días; mismo error si el email o la contraseña están mal. | ✅ |
| HU-01b | Como **miembro nuevo**, quiero crear mi contraseña la primera vez con un link por email, y recuperarla igual si me la olvido. | El link vale 15 min y se usa una vez; lleva a crear la contraseña (mínimo 8 caracteres); sin contraseña no se puede usar la app. | ✅ |
| HU-02 | Como **admin**, quiero cargar a los jugadores con su puesto y email, para que puedan entrar y ser puntuados. | El jugador aparece en la lista; al entrar con ese email queda vinculado. | ✅ |
| HU-03 | Como **admin**, quiero crear una skill nueva, para medir algo que hoy no se mide. | Aparece en el formulario de puntuar de todos; sin puntajes no cambia el orden de los jugadores. | ✅ |
| HU-04 | Como **admin**, quiero desactivar una skill en vez de borrarla, para no romper el historial. | Deja de verse y de contar; se puede reactivar. | ✅ |
| HU-05 | Como **miembro**, quiero puntuar a mis compañeros de forma anónima, para opinar sin conflictos. | Solo veo los valores que puse yo; nadie ve quién puntuó qué. | ✅ |
| HU-06 | Como **miembro**, quiero puntuarme a mí mismo, sabiendo que no cuenta. | Se guarda, pero no entra en el puntaje del grupo. | ✅ |
| HU-07 | Como **admin**, quiero ver el puntaje de cada jugador y de dónde sale, para confiar en el número. | Veo el compuesto y, por skill: valor, cantidad de raters y fuente (peers/admin/imputed). | ✅ |
| HU-08 | Como **admin**, quiero cargar el plantel inicial de una vez desde un archivo, para no hacerlo a mano. | Importar el JSON crea los jugadores con sus puntajes de admin. | ⏳ próximo |
| HU-09 | Como **miembro**, quiero anotarme o bajarme del partido del miércoles desde el celular. | Con cupo lleno quedo en lista de espera; si alguien se baja, subo solo. Después del cierre no puedo anotarme, pero sí bajarme (queda marcado). | ✅ |
| HU-10 | Como **admin**, quiero que el sistema me proponga equipos parejos, para armarlos en menos de 2 minutos. | 3 propuestas con % de victoria y desglose del costo; puedo mover jugadores y publicar. | ✅ |
| HU-11 | Como **miembro**, quiero ver los equipos publicados en una pantalla VS y recibirlos por WhatsApp. | Tarjeta Blancos vs Negros en la pestaña Partido; copiar o compartir imagen; texto con formato de la spec §7. | ✅ |
| HU-12 | Como **admin**, quiero cargar el resultado y quién jugó realmente. | El partido pasa a `played`, abre la inscripción del siguiente y aparece en Partidos. | ✅ (recalcular ratings: ⏳ M5) |
| HU-13 | Como **miembro**, quiero ver los partidos jugados con su resultado y quién jugó en cada equipo. | Pestaña Partidos con tarjetas, "Parejo" y desplegable de equipos. | ✅ |



---

## 4. Proceso: login ✅

**Accesos habituales: email + contraseña**

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Web /vaca-futbolera
    participant API as FastAPI /futbol
    participant DB as Postgres (schema futbol)

    U->>W: Email + contraseña en /entrar
    W->>API: POST /auth/login
    API->>DB: Busca el hash scrypt del usuario
    alt coincide
        API->>DB: Crea sesión de 30 días
        API-->>W: 200 + cookie futbol_session (httpOnly)
        W-->>U: Entra a la pestaña Partido
    else email inexistente o contraseña incorrecta
        API-->>W: 401 "Email o contraseña incorrectos." (mismo mensaje y tiempo)
    end
```

**Primer acceso u olvido de contraseña: magic link**

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Web /vaca-futbolera
    participant API as FastAPI /futbol
    participant DB as Postgres (schema futbol)
    participant Mail as Mailer

    U->>W: "¿Primera vez o te olvidaste?" → email
    W->>API: POST /auth/request {email}
    API->>DB: ¿email de admin, de jugador o de usuario conocido?
    alt email conocido
        API->>DB: Guarda hash del token (vence en 15 min)
        API->>Mail: Envía el link
        Note over Mail: Local: se imprime en la terminal del backend<br/>Prod: SMTP
    end
    API-->>W: 202 siempre (no revela si el email existe)
    U->>W: Abre /entrar?token=…
    W->>API: POST /auth/verify {token}
    API->>DB: Consume el token (un solo uso), crea usuario y membresía, vincula jugador por email
    API-->>W: 200 + cookie de sesión
    W-->>U: Pantalla "Creá tu contraseña"
    U->>W: Contraseña (mínimo 8, repetida)
    W->>API: PUT /auth/password
    API->>DB: Guarda hash scrypt
    W-->>U: Entra a la pestaña Partido
```

---

## 5. Proceso: del plantel al puntaje ✅

```mermaid
flowchart TD
    A["🛡️ Admin carga jugadores<br/>(a mano o ⏳ importando JSON)"] --> B["🛡️ Admin revisa skills y pesos<br/>(9 skills por defecto)"]
    B --> C["👤 Jugadores entran con su email<br/>→ quedan vinculados"]
    C --> D["👤 Cada uno puntúa a otros 1–10 por skill<br/>(anónimo, autoevaluación no cuenta)"]
    D --> E{"Por jugador y skill:<br/>¿≥ 3 pares puntuaron?"}
    E -->|sí| F["Mediana de los pares<br/>fuente: peers"]
    E -->|no| G{"¿Puntuó un admin?"}
    G -->|sí| H["Mediana de los admins<br/>fuente: admin"]
    G -->|no| I["Media del grupo en esa skill<br/>(5.5 si nadie tiene dato)<br/>fuente: imputed"]
    F & H & I --> J["Puntaje compuesto C =<br/>Σ peso·valor / Σ peso<br/>(sin goalkeeping, sin skills inactivas o de peso 0)"]
    J --> K["🛡️ Admin lo ve en Jugadores"]
    J -. ⏳ M3 .-> L["Balanceador: fuerza de cada jugador"]
```

---

## 6. Proceso: ciclo semanal del partido (✅ M2: open → closed · ⏳ M3–M5)

Estados de `matches.status`, según la spec §3 y §5:

```mermaid
stateDiagram-v2
    [*] --> open: se crea el partido<br/>(al cargar el resultado anterior o jueves 00:00)
    open --> closed: cierre de inscripción<br/>(domingo 23:59, cron)
    closed --> closed: martes 12:00 cron genera 3 propuestas<br/>y avisa al admin
    closed --> teams_published: admin publica equipos
    teams_published --> played: admin carga resultado<br/>→ recalcula ratings
    open --> cancelled
    closed --> cancelled
    played --> [*]
```

Reglas de inscripción (M2): cupo por defecto 16. Los que llegan con el cupo lleno van a la lista de
espera por orden de llegada. Si alguien se baja después del cierre, sube el primero de la espera, la
baja queda marcada `late_withdrawal` y, si ya había propuestas, se regeneran.
