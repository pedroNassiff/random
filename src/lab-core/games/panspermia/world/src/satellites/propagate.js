import * as satellite from 'satellite.js'
import * as THREE from 'three'

// Radio real de la Tierra (km) → escala a unidades de escena (radio = 2)
const EARTH_RADIUS_KM = 6371
const SCENE_SCALE     = 2 / EARTH_RADIUS_KM  // unidades/km

/**
 * Pre-compila un TLE record en satrec (hacerlo una vez al cargar, no en cada frame).
 * @param {Object} record - objeto con TLE_LINE1, TLE_LINE2, OBJECT_NAME
 * @returns {{ satrec, name: string }}
 */
export function initSatrec(record) {
    return {
        satrec: satellite.twoline2satrec(record.TLE_LINE1, record.TLE_LINE2),
        name: record.OBJECT_NAME,
    }
}

/**
 * Propaga un satrec a una fecha dada → devuelve posición en ECI en Three.js world space.
 * ECI es inercial (no gira con la Tierra), perfecto para cuando la Tierra rota con GMST.
 *
 * Conversión ECI → Three.js:
 *   THREE.x = ECI.x  (equinoccio vernal)
 *   THREE.y = ECI.z  (polo norte = Y arriba)
 *   THREE.z = ECI.y  (completa la base derecha)
 *
 * @param {Object} satrec - resultado de twoline2satrec
 * @param {Date} date
 * @returns {THREE.Vector3 | null}
 */
export function propagateSatECI(satrec, date) {
    const { position } = satellite.propagate(satrec, date)
    if (!position || position.x === undefined) return null

    return new THREE.Vector3(
        position.x * SCENE_SCALE,
        position.z * SCENE_SCALE,  // ECI.z = norte → THREE.y
        position.y * SCENE_SCALE,  // ECI.y       → THREE.z
    )
}

/**
 * Propaga un satrec a lat/lon/alt en ECF (legacy, no usado para rendering).
 * Se mantiene por compatibilidad / uso futuro.
 */
export function propagateSat(satrec, date) {
    const { position } = satellite.propagate(satrec, date)

    if (!position || position.x === undefined) return null

    const gmst = satellite.gstime(date)
    const geo = satellite.eciToGeodetic(position, gmst)

    return {
        lat: geo.latitude,   // radianes
        lon: geo.longitude,  // radianes
        alt: geo.height,     // km
    }
}
