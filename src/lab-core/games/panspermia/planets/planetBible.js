/**
 * PANSPERMIA — Planet Bible
 *
 * Fuente de verdad científica del juego (spec §4). Un planeta real por
 * bioma, cubriendo los 7 tipos de la tabla §4.1 — también da pie a los 7
 * centros de energía (unlockLevel 1-7, ver engine/GameStore + progression).
 *
 * Cifras (masa, distancia) son aproximadas — suficientes para un dato de
 * portfolio, no para un paper.
 */
export const PLANETS = {
  'trappist-1e': {
    biome: 'terra',
    realName: 'TRAPPIST-1 e',
    distanceLy: 40,
    starType: 'M8V (enana roja ultrafría)',
    massEarths: 0.69,
    tidallyLocked: true,
    fact: 'Uno de los 4 mundos rocosos de TRAPPIST-1 en zona habitable; objetivo prioritario del JWST para buscar atmósfera.',
    unlockLevel: 1,
    guardian: 'terra-guardian',
    knowledgeFragment: 'habitable_zone',
  },
  'lhs-1140b': {
    biome: 'ocean',
    realName: 'LHS 1140 b',
    distanceLy: 49,
    starType: 'M4.5V (enana roja)',
    massEarths: 6.98,
    tidallyLocked: true,
    fact: 'Super-Tierra densa en zona habitable; candidato a mundo océano con posible agua líquida en superficie.',
    unlockLevel: 2,
    guardian: 'ocean-guardian',
    knowledgeFragment: 'ocean_world',
  },
  'toi-561b': {
    biome: 'magma',
    realName: 'TOI-561 b',
    distanceLy: 280,
    starType: 'G (enana amarilla muy vieja, ~10 mil millones de años)',
    massEarths: 2.24,
    tidallyLocked: true,
    fact: 'Órbita de apenas 10,5 horas alrededor de una de las estrellas más viejas con planetas conocidas; lado día fundido, probable océano de magma.',
    unlockLevel: 3,
    guardian: 'magma-guardian',
    knowledgeFragment: 'magma_ocean',
  },
  'trappist-1h': {
    biome: 'cryo',
    realName: 'TRAPPIST-1 h',
    distanceLy: 40,
    starType: 'M8V (enana roja ultrafría)',
    massEarths: 0.33,
    tidallyLocked: true,
    fact: 'El más externo y frío de los 7 mundos de TRAPPIST-1; fuera de la zona habitable, candidato a mundo helado.',
    unlockLevel: 4,
    guardian: 'cryo-guardian',
    knowledgeFragment: 'ammonia_solvent',
  },
  'titan': {
    biome: 'titan',
    realName: 'Titán (luna de Saturno)',
    distanceLy: 0,
    starType: 'G2V — el Sol (Sistema Solar)',
    massEarths: 0.0225,
    tidallyLocked: true,
    fact: 'Única luna del sistema solar con atmósfera densa; lagos de metano/etano líquido y probable océano subsuperficial de agua.',
    unlockLevel: 5,
    guardian: 'titan-guardian',
    knowledgeFragment: 'methane_solvent',
  },
  '51-pegasi-b': {
    biome: 'gas',
    realName: '51 Pegasi b',
    distanceLy: 50,
    starType: 'G2IV (similar al Sol)',
    massEarths: 149, // ≈ 0.47 masas de Júpiter
    tidallyLocked: true,
    fact: 'Primer exoplaneta confirmado orbitando una estrella tipo Sol (1995, Nobel de Física 2019); "hot Jupiter" con órbita de 4,2 días.',
    unlockLevel: 6,
    guardian: 'gas-guardian',
    knowledgeFragment: 'hot_jupiter',
  },
  'trappist-1b': {
    biome: 'flare',
    realName: 'TRAPPIST-1 b',
    distanceLy: 40,
    starType: 'M8V (enana roja ultrafría)',
    massEarths: 1.02,
    tidallyLocked: true,
    fact: 'El más interno de los 7 mundos de TRAPPIST-1; bañado en fulguraciones UV/rayos X de su estrella, probablemente sin atmósfera.',
    unlockLevel: 7,
    guardian: 'flare-guardian',
    knowledgeFragment: 'stellar_flares',
  },
}

export const getPlanet = (id) => PLANETS[id]
export const PLANET_IDS = Object.keys(PLANETS)
export const getPlanetsForLevel = (level) => PLANET_IDS.filter((id) => PLANETS[id].unlockLevel <= level)
