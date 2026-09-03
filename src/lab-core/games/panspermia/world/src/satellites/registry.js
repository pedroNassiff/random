const BASE = 'https://celestrak.org/NORAD/elements/gp.php'

/**
 * Fuente de verdad de todos los grupos de satélites.
 *
 * renderer: 'points'    → THREE.Points con ShaderMaterial (glow)
 *           'instanced' → THREE.InstancedMesh con geometría procedural (body + paneles)
 *
 * pointSize  : tamaño del punto (solo renderer: 'points')
 * bodyScale  : escala del mesh procedural en unidades de escena (solo renderer: 'instanced')
 * updateEvery: propagar cada N frames. Más alto = mejor perf, menos suave.
 * color      : hex color
 */
export const REGISTRY = {

    // ---------- instanced (pocos sats, forma visible) ----------
    stations: {
        label:       'Space Stations',
        description: 'Estaciones espaciales tripuladas en órbita. Incluye ISS (NASA/ESA/JAXA), la estación china Tiangong (CSS), y todas las naves acopladas: Soyuz, Dragon, Progress, Cygnus, HTV.',
        url:         `${BASE}?GROUP=stations&FORMAT=tle`,
        color:       '#ffffff',
        renderer:    'instanced',
        bodyScale:   0.030,
        updateEvery: 20,
    },
    'gps-ops': {
        label:       'GPS (USA)',
        description: 'Los 32 satélites operacionales del sistema GPS del Departamento de Defensa de EEUU. Orbitan a ~20,200 km en órbita media (MEO). Son la base del GPS global que usamos a diario.',
        url:         `${BASE}?GROUP=gps-ops&FORMAT=tle`,
        color:       '#ffcc00',
        renderer:    'instanced',
        bodyScale:   0.018,
        updateEvery: 30,
    },
    galileo: {
        label:       'Galileo (EU)',
        description: 'Constelación de navegación satélital de la Unión Europea operada por la ESA. 33 satélites en MEO a ~23,200 km. Más preciso que GPS; es el sistema que usan los smartphones modernos en Europa.',
        url:         `${BASE}?GROUP=galileo&FORMAT=tle`,
        color:       '#66ff99',
        renderer:    'instanced',
        bodyScale:   0.018,
        updateEvery: 30,
    },
    iridium: {
        label:       'Iridium NEXT',
        description: 'Constelación de 66 satélites en LEO (~780 km) para comunicaciones de voz y datos globales, incluyendo zonas remotas sin cobertura celular. Usados en aviación, marítimo y expediciones.',
        url:         `${BASE}?GROUP=iridium-NEXT&FORMAT=tle`,
        color:       '#ff9900',
        renderer:    'instanced',
        bodyScale:   0.018,
        updateEvery: 20,
    },
    noaa: {
        label:       'NOAA (Weather)',
        description: 'Satélites meteorológicos de la NOAA (Agencia Oceanográfica y Atmosférica de EEUU). Monitore an temperatura, nubes, tormentas y clima en tiempo real. Fuente primaria de datos para pronósticos globales.',
        url:         `${BASE}?GROUP=noaa&FORMAT=tle`,
        color:       '#aaddff',
        renderer:    'instanced',
        bodyScale:   0.020,
        updateEvery: 25,
    },

    // ---------- points (miles de sats, solo puntos) ----------
    starlink: {
        label:       'Starlink',
        description: 'Constelación de internet de banda ancha de SpaceX con más de 7000 satélites activos en LEO (~550 km). La constelación privada más grande de la historia. Provee internet en regiones sin fibra óptica.',
        url:         `${BASE}?GROUP=starlink&FORMAT=tle`,
        color:       '#4fc3f7',
        renderer:    'points',
        pointSize:   2.0,
        updateEvery: 5,
    },
    oneweb: {
        label:       'OneWeb',
        description: 'Constelación de internet satelital de la empresa británica OneWeb (ahora Eutelsat OneWeb). ~600 satélites en LEO a ~1200 km. Competencia directa de Starlink, enfocada en gobiernos y empresas.',
        url:         `${BASE}?GROUP=oneweb&FORMAT=tle`,
        color:       '#ff6699',
        renderer:    'points',
        pointSize:   2.5,
        updateEvery: 5,
    },
    visual: {
        label:       'Visible (naked eye)',
        description: 'Los satélites más brillantes visibles a ojo desnudo desde la Tierra en condiciones claras. Incluye estaciones espaciales, cohetes, y objetos grandes en LEO bajo. Estos son los "puntos de luz" que ves pasar de noche.',
        url:         `${BASE}?GROUP=visual&FORMAT=tle`,
        color:       '#ffffaa',
        renderer:    'points',
        pointSize:   4.0,
        updateEvery: 5,
    },
    active: {
        label:       'All Active (~6000)',
        description: 'Todos los satélites activos actualmente en órbita: comunicaciones, meteorología, ciencia, espionaje, navegación y más. Muestra el total de presencia humana en el espacio en este momento.',
        url:         `${BASE}?GROUP=active&FORMAT=tle`,
        color:       '#888888',
        renderer:    'points',
        pointSize:   1.5,
        updateEvery: 5,
    },
    debris: {
        label:       'Cosmos Debris',
        description: 'Fragmentos del satélite ruso Cosmos 1408, destruido el 15 de noviembre de 2021 por un misil antisatélite ruso (prueba ASAT). Generó más de 1500 fragmentos rastreables que amenazan la ISS y otros satélites en LEO.',
        url:         `${BASE}?GROUP=cosmos-1408-debris&FORMAT=tle`,
        color:       '#ff4444',
        renderer:    'points',
        pointSize:   1.5,
        updateEvery: 10,
    },
}
