import React, { useRef, useMemo, useEffect, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Shaders de la galaxia
const galaxyVertexShader = `
  uniform float uSize;
  uniform float uTime;

  attribute float aScale;
  attribute vec3 aRandomness;

  varying vec3 vColor;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // spin
    float angle = atan(modelPosition.x, modelPosition.z);
    float distanceToCenter = length(modelPosition.xz);
    float angleOffset = (1.0 / distanceToCenter) * uTime * 0.2;
    angle += angleOffset;
    modelPosition.x = cos(angle) * distanceToCenter;
    modelPosition.z = sin(angle) * distanceToCenter;

    // randomness
    modelPosition.xyz += aRandomness;

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // Size
    gl_PointSize = uSize * aScale;
    gl_PointSize *= (1.0 / -viewPosition.z);

    vColor = color;
  }
`

const galaxyFragmentShader = `
  varying vec3 vColor;
  
  void main() {
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 10.0);

    vec3 color = mix(vec3(0.0), vColor, strength);
    gl_FragColor = vec4(color, 1.0);
  }
`

/**
 * GalaxyModel - Versión optimizada
 * 
 * Optimizaciones:
 * - Reducido a 25k partículas (suficiente para el efecto)
 * - Geometría y material completamente memoizados
 * - Early return cuando no visible
 * - Lerp del tamaño solo cuando hay cambio de hover
 */
const GalaxyModel = memo(function GalaxyModel({ 
  scale = 1, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  autoRotate = true,
  opacity = 1,
  hovered = false,
  isVisible = true,
  onClick,
  // Live editor props
  vertexShader: liveVertex,
  fragmentShader: liveFragment,
  galaxyParams: liveParams,
}) {
  const pointsRef = useRef()
  const groupRef = useRef()
  const timeRef = useRef(0)
  const sizeRef = useRef(20)
  const lastHoveredRef = useRef(hovered)

  // Parámetros - merge defaults con los live props del editor
  const parameters = useMemo(() => ({
    count: 25000,
    size: 20,
    radius: 3,
    branches: 5,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984',
    ...liveParams,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [JSON.stringify(liveParams)])

  // Geometría y material memoizados - NUNCA se recrean
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(parameters.count * 3)
    const colors = new Float32Array(parameters.count * 3)
    const scales = new Float32Array(parameters.count)
    const randomness = new Float32Array(parameters.count * 3)

    const colorInside = new THREE.Color(parameters.insideColor)
    const colorOutside = new THREE.Color(parameters.outsideColor)

    for (let i = 0; i < parameters.count; i++) {
      const i3 = i * 3

      const radius = Math.random() * parameters.radius
      const spinAngle = radius * parameters.spin
      const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

      const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
      const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
      const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius
      positions[i3 + 1] = 0
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius

      randomness[i3] = randomX
      randomness[i3 + 1] = randomY
      randomness[i3 + 2] = randomZ

      const mixedColor = colorInside.clone()
      mixedColor.lerp(colorOutside, radius / parameters.radius)

      colors[i3] = mixedColor.r
      colors[i3 + 1] = mixedColor.g
      colors[i3 + 2] = mixedColor.b

      scales[i] = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geo.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3))

    const mat = new THREE.ShaderMaterial({
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: liveVertex ?? galaxyVertexShader,
      fragmentShader: liveFragment ?? galaxyFragmentShader,
      uniforms: {
        uSize: { value: parameters.size * Math.min(window.devicePixelRatio, 2) },
        uTime: { value: 0 }
      }
    })

    return { geometry: geo, material: mat }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters, liveVertex, liveFragment])

  // Dispose old GPU resources when shader/params change
  useEffect(() => {
    return () => {
      geometry?.dispose()
      material?.dispose()
    }
  }, [geometry, material])

  // Animation loop optimizado
  useFrame((state, delta) => {
    // Early return si no visible
    if (!isVisible || !pointsRef.current || !groupRef.current) return
    
    // Update time con ref (más eficiente)
    const speed = hovered ? 2.0 : 1.0
    timeRef.current += delta * speed
    material.uniforms.uTime.value = timeRef.current

    // Solo hacer lerp del tamaño si hover cambió
    if (hovered !== lastHoveredRef.current) {
      const targetSize = hovered ? parameters.size * 1.5 : parameters.size
      sizeRef.current = THREE.MathUtils.lerp(sizeRef.current, targetSize, 0.1)
      material.uniforms.uSize.value = sizeRef.current * Math.min(window.devicePixelRatio, 2)
      lastHoveredRef.current = hovered
    }
    
    // Posición/escala solo primera vez
    if (!groupRef.current.userData.initialized) {
      groupRef.current.position.set(...position)
      const s = scale * 0.4
      groupRef.current.scale.set(s, s, s)
      pointsRef.current.rotation.x = Math.PI * 1
      groupRef.current.userData.initialized = true
    }
    
    // Rotación
    if (autoRotate) {
      groupRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      <points ref={pointsRef} geometry={geometry} material={material} />
    </group>
  )
})

export { GalaxyModel }
export default GalaxyModel
