/**
 * PANSPERMIA — PlanetShaderMaterial
 *
 * Generalización del earth shader de Kessler (ver
 * `games/panspermia/world/src/shaders/earth`) a un material procedural
 * multi-bioma: mismo esquema día/noche + fresnel/atmósfera + specular, pero
 * sin texturas — el terreno, las nubes y las bandas salen de value-noise
 * parametrizado por bioma. Kessler sigue usando el earth shader original
 * "tal cual" (texturas reales); esto es sólo para los exoplanetas de
 * Panspermia.
 */
import * as THREE from 'three'
import surfaceVertexShader from './shaders/surface/vertex.glsl'
import surfaceFragmentShader from './shaders/surface/fragment.glsl'
import atmosphereVertexShader from './shaders/atmosphere/vertex.glsl'
import atmosphereFragmentShader from './shaders/atmosphere/fragment.glsl'

// Paleta + parámetros por bioma — ver planetBible.js (§4.1 del spec) para
// qué exoplaneta real usa cada uno.
export const BIOME_PRESETS = {
  terra: {
    colorA: '#1f5d3a', colorB: '#3a8f5c', nightColor: '#050a12',
    polarColor: '#eef4f8', polarCoverage: 0.78,
    cloudColor: '#f4f7fa', cloudCoverage: 0.35, cloudSpeed: 0.015,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#000000', emissiveIntensity: 0.0,
    atmosphereDayColor: '#4fa8ff', atmosphereTwilightColor: '#ff8a3d',
    noiseScale: 1.6,
  },
  ocean: {
    colorA: '#0c3d5e', colorB: '#155f8a', nightColor: '#020810',
    polarColor: '#dff1ff', polarCoverage: 0.85,
    cloudColor: '#ffffff', cloudCoverage: 0.55, cloudSpeed: 0.02,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#000000', emissiveIntensity: 0.0,
    atmosphereDayColor: '#4fd6ff', atmosphereTwilightColor: '#ff6fae',
    noiseScale: 1.1,
  },
  magma: {
    colorA: '#241511', colorB: '#4a281c', nightColor: '#0a0403',
    polarColor: '#5b3324', polarCoverage: 0.97,
    cloudColor: '#7a5a4a', cloudCoverage: 0.15, cloudSpeed: 0.03,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#ff6a1f', emissiveIntensity: 2.6,
    atmosphereDayColor: '#ff8a3d', atmosphereTwilightColor: '#7a1f0a',
    noiseScale: 2.4,
  },
  cryo: {
    colorA: '#274257', colorB: '#5c85a3', nightColor: '#040810',
    polarColor: '#f2fbff', polarCoverage: 0.5,
    cloudColor: '#eaf6ff', cloudCoverage: 0.25, cloudSpeed: 0.008,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#7fd8ff', emissiveIntensity: 0.4,
    atmosphereDayColor: '#bfe8ff', atmosphereTwilightColor: '#6f9fd8',
    noiseScale: 1.9,
  },
  titan: {
    colorA: '#8a6a2e', colorB: '#b98f3f', nightColor: '#0a0703',
    polarColor: '#d9c78e', polarCoverage: 0.9,
    cloudColor: '#e8c97a', cloudCoverage: 0.6, cloudSpeed: 0.01,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#000000', emissiveIntensity: 0.0,
    atmosphereDayColor: '#e0a84f', atmosphereTwilightColor: '#7a4a1f',
    noiseScale: 1.3,
  },
  gas: {
    colorA: '#c98a4b', colorB: '#e8c398', nightColor: '#150c06',
    polarColor: '#8a5a34', polarCoverage: 0.95,
    cloudColor: '#ffffff', cloudCoverage: 0.1, cloudSpeed: 0.04,
    bandColor1: '#d9a862', bandColor2: '#7a4a2a', bandStrength: 1.0,
    emissiveColor: '#000000', emissiveIntensity: 0.0,
    atmosphereDayColor: '#ffd9a0', atmosphereTwilightColor: '#a85a2a',
    noiseScale: 2.0,
  },
  flare: {
    colorA: '#2a1030', colorB: '#5a1f3f', nightColor: '#060209',
    polarColor: '#ffdff0', polarCoverage: 0.9,
    cloudColor: '#ff9fd6', cloudCoverage: 0.1, cloudSpeed: 0.02,
    bandColor1: '#000000', bandColor2: '#000000', bandStrength: 0.0,
    emissiveColor: '#ff2fae', emissiveIntensity: 1.6,
    atmosphereDayColor: '#ff5fc8', atmosphereTwilightColor: '#7f1a5a',
    noiseScale: 2.1,
  },
}

const mergePreset = (biome, overrides) => ({
  ...BIOME_PRESETS.terra,
  ...(BIOME_PRESETS[biome] || {}),
  ...overrides,
})

const colorUniform = (hex) => ({ value: new THREE.Color(hex) })

export function createPlanetSurfaceMaterial(biome, overrides = {}) {
  if (!BIOME_PRESETS[biome]) {
    console.warn(`[PlanetShaderMaterial] bioma desconocido "${biome}", usando "terra"`)
  }
  const p = mergePreset(biome, overrides)

  return new THREE.ShaderMaterial({
    vertexShader: surfaceVertexShader,
    fragmentShader: surfaceFragmentShader,
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
      uColorA: colorUniform(p.colorA),
      uColorB: colorUniform(p.colorB),
      uNightColor: colorUniform(p.nightColor),
      uPolarColor: colorUniform(p.polarColor),
      uPolarCoverage: { value: p.polarCoverage },
      uCloudColor: colorUniform(p.cloudColor),
      uCloudCoverage: { value: p.cloudCoverage },
      uCloudSpeed: { value: p.cloudSpeed },
      uBandColor1: colorUniform(p.bandColor1),
      uBandColor2: colorUniform(p.bandColor2),
      uBandStrength: { value: p.bandStrength },
      uEmissiveColor: colorUniform(p.emissiveColor),
      uEmissiveIntensity: { value: p.emissiveIntensity },
      uAtmosphereDayColor: colorUniform(p.atmosphereDayColor),
      uAtmosphereTwilightColor: colorUniform(p.atmosphereTwilightColor),
      uTime: { value: 0 },
      uNoiseScale: { value: p.noiseScale },
    },
  })
}

export function createPlanetAtmosphereMaterial(biome, overrides = {}) {
  const p = mergePreset(biome, overrides)

  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
      uAtmosphereDayColor: colorUniform(p.atmosphereDayColor),
      uAtmosphereTwilightColor: colorUniform(p.atmosphereTwilightColor),
    },
  })
}

export function updatePlanetMaterials({ surfaceMaterial, atmosphereMaterial, time, sunDirection }) {
  if (time !== undefined && surfaceMaterial?.uniforms?.uTime) {
    surfaceMaterial.uniforms.uTime.value = time
  }
  if (sunDirection) {
    surfaceMaterial?.uniforms?.uSunDirection?.value.copy(sunDirection)
    atmosphereMaterial?.uniforms?.uSunDirection?.value.copy(sunDirection)
  }
}
