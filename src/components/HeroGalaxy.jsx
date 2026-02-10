import React, { useRef, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Shaders de la galaxia
const galaxyVertexShader = `
  uniform float uSize;
  uniform float uTime;

  attribute float aScale;
  attribute vec3 aRandomness;

  varying vec3 vColor;
  varying float vDistanceToCenter;

  void main() {
    // Guardar distancia al centro ANTES de aplicar spin (para reveal)
    vDistanceToCenter = length(position.xz);
    
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

    // Size con multiplicador para el centro
    // Las partículas del centro (distancia < 0.5) son 3x más grandes
    float centerMultiplier = 1.0 + (2.0 * smoothstep(0.5, 0.0, vDistanceToCenter));
    gl_PointSize = uSize * aScale * centerMultiplier;
    gl_PointSize *= (1.0 / -viewPosition.z);

    vColor = color;
  }
`

const galaxyFragmentShader = `
  uniform float uOpacity;
  uniform float uRevealProgress;
  
  varying vec3 vColor;
  varying float vDistanceToCenter;
  
  void main() {
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 10.0);

    vec3 color = mix(vec3(0.0), vColor, strength);
    
    // Reveal desde el centro hacia afuera
    // uRevealProgress va de 0 a 1 durante la animación
    float revealRadius = uRevealProgress * 4.0;
    float revealAlpha = smoothstep(revealRadius + 0.3, revealRadius - 0.2, vDistanceToCenter);
    
    gl_FragColor = vec4(color, strength * uOpacity * revealAlpha);
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
  startReveal = false
}) {
  const pointsRef = useRef()
  const groupRef = useRef()
  const timeRef = useRef(0)
  const sizeRef = useRef(20)
  const lastHoveredRef = useRef(hovered)
  const revealProgressRef = useRef(0)

  // Parámetros - reducidos para mejor rendimiento
  const parameters = useMemo(() => ({
    count: 20000, // Reducido de 50k a 20k
    size: 30,
    radius: 4,
    branches: 3,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984'
  }), [])

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

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius      // X
    positions[i3 + 1] = 0                                            // Y = 0
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius  // Z

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
      transparent: true,
      vertexShader: galaxyVertexShader,
      fragmentShader: galaxyFragmentShader,
      uniforms: {
        uSize: { value: parameters.size * Math.min(window.devicePixelRatio, 2) },
        uTime: { value: 0 },
        uOpacity: { value: 1.0 },
        uRevealProgress: { value: 0.0 }
      }
    })

    return { geometry: geo, material: mat }
  }, [parameters])

  // Animation loop optimizado
  useFrame((state, delta) => {
    // Early return si no visible
    if (!isVisible || !pointsRef.current || !groupRef.current) return
    
    // Update time con ref (más eficiente)
    const speed = hovered ? 2.0 : 1.0
    timeRef.current += delta * speed
    material.uniforms.uTime.value = timeRef.current
    material.uniforms.uOpacity.value = opacity
    
    // Animación de reveal (10 segundos con easing)
    if (startReveal && revealProgressRef.current < 1) {
      // Incremento base más lento (10 segundos en lugar de 5)
      const baseIncrement = delta / 10.0;
      
      // Easing: muy lento al principio, acelera hacia el final
      // Usando ease-in cúbico
      const currentProgress = revealProgressRef.current;
      const easedIncrement = baseIncrement * (1 + currentProgress * currentProgress * 2);
      
      revealProgressRef.current += easedIncrement;
      material.uniforms.uRevealProgress.value = Math.min(revealProgressRef.current, 1);
    } else if (!startReveal) {
      // Si no hay reveal, mostrar todo inmediatamente
      material.uniforms.uRevealProgress.value = 1.0;
    }

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
      groupRef.current.userData.initialized = true
    }
    
    // 🔄 ROTACIÓN PARA VISTA FRONTAL DE GALAXIA PLANA
    if (autoRotate) {
      // La galaxia está generada en plano XZ (horizontal)
      // X=-90° la rota para ponerla vertical (frente a cámara)
      groupRef.current.rotation.x = -Math.PI * 0.5  // -90° - pone la galaxia vertical
      
      // Z rota la galaxia en su propio plano (como un disco girando)
      groupRef.current.rotation.z += delta * 0.2
      
      // Y fijo en 0
      groupRef.current.rotation.y = 0
      
      // 📊 LOG DETALLADO cada 30 frames (~0.5 segundo)
      if (Math.floor(state.clock.elapsedTime * 60) % 30 === 0) {
        const rx = groupRef.current.rotation.x
        const ry = groupRef.current.rotation.y
        const rz = groupRef.current.rotation.z
        
        console.log('🌌 GALAXY ROTATION DEBUG (Vista Frontal):')
        console.log(`   📐 Rotation X: ${rx.toFixed(3)} rad (${(rx * 180 / Math.PI).toFixed(1)}°) [FIJO - Galaxia vertical]`)
        console.log(`   📐 Rotation Y: ${ry.toFixed(3)} rad (${(ry * 180 / Math.PI).toFixed(1)}°) [FIJO]`)
        console.log(`   📐 Rotation Z: ${rz.toFixed(3)} rad (${(rz * 180 / Math.PI).toFixed(1)}°) [Girando como disco]`)
        console.log(`   ⏱️  Time: ${state.clock.elapsedTime.toFixed(1)}s`)
        console.log('   💡 Para usar esta rotación:')
        console.log(`      rotation={[${rx.toFixed(3)}, ${ry.toFixed(3)}, ${rz.toFixed(3)}]}`)
        console.log('---')
      }
    }
  })

  return (
    <group 
    ref={groupRef} 
    onClick={onClick}
      position={position}
      rotation={rotation} 
      scale={scale * 0.4}
    >
      <points ref={pointsRef} geometry={geometry} material={material} />
    </group>
  )
})

export { GalaxyModel }
export default GalaxyModel
