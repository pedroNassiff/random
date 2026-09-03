import * as THREE from 'three'

// Radio de la esfera en la escena de Three.js (ver earthGeometry: SphereGeometry(2, ...))
const EARTH_RADIUS_SCENE = 2
const EARTH_RADIUS_KM = 6371

/**
 * Convierte lat/lon/alt geodésico a THREE.Vector3 en el espacio de la escena.
 * @param {number} lat - latitud en radianes
 * @param {number} lon - longitud en radianes
 * @param {number} alt - altitud en km
 * @returns {THREE.Vector3}
 */
export function latLonAltToVector3(lat, lon, alt) {
    const r = EARTH_RADIUS_SCENE + (alt / EARTH_RADIUS_KM) * EARTH_RADIUS_SCENE

    return new THREE.Vector3(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon),
    )
}
