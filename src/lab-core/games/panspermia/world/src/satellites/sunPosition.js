import * as THREE from 'three'

/**
 * Calcula la dirección hacia el Sol en coordenadas ECI (Earth-Centered Inertial),
 * mapeadas al sistema de Three.js: THREE.y = norte, THREE.x = equinoccio vernal.
 *
 * Precisión: ~0.01° (suficiente para visualización).
 * Algoritmo: Astronomical Algorithms, Jean Meeus, cap. 25.
 *
 * @param {Date} date
 * @returns {THREE.Vector3} vector unitario desde la Tierra hacia el Sol (world space)
 */
export function getSunDirection(date) {
    const jd = date.getTime() / 86400000.0 + 2440587.5   // Julian Date
    const T  = (jd - 2451545.0) / 36525.0                // Julian centuries desde J2000

    // Longitud media del Sol (grados)
    const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360

    // Anomalía media del Sol (radianes)
    const M = (((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360) * Math.PI / 180

    // Ecuación del centro (grados)
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
            + 0.000289 * Math.sin(3 * M)

    // Longitud verdadera del Sol (radianes)
    const sunLon = (L0 + C) * Math.PI / 180

    // Oblicuidad de la eclíptica (radianes)
    const eps = (23.439291111 - 0.013004167 * T) * Math.PI / 180

    // Vector unitario ECI estándar:
    // ECI X = equinoccio vernal, ECI Y = 90°E en el plano ecuatorial, ECI Z = polo norte
    const eciX = Math.cos(sunLon)
    const eciY = Math.sin(sunLon) * Math.cos(eps)
    const eciZ = Math.sin(sunLon) * Math.sin(eps)  // componente "norte" debida a la inclinación

    // Conversión ECI → Three.js world space:
    //   THREE.x = ECI.x  (hacia equinoccio vernal)
    //   THREE.y = ECI.z  (polo norte = arriba en la escena)
    //   THREE.z = ECI.y  (completar la base derecha)
    return new THREE.Vector3(eciX, eciZ, eciY).normalize()
}
