/**
 * PANSPERMIA — Planet
 *
 * Monta la esfera de superficie + la cáscara de atmósfera (mismo patrón de
 * dos mallas que Kessler: earth + athmosphere escalada ~1.04×), maneja
 * rotación y anima uTime/uSunDirection por frame.
 */
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createPlanetSurfaceMaterial,
  createPlanetAtmosphereMaterial,
  updatePlanetMaterials,
} from './PlanetShaderMaterial'

export default function Planet({
  biome = 'terra',
  overrides,
  radius = 1,
  position = [0, 0, 0],
  sunDirection = [1, 0.3, 0.5],
  autoRotate = true,
  rotationSpeed = 0.06,
}) {
  const surfaceRef = useRef()
  const sunDirRef = useRef(new THREE.Vector3(...sunDirection).normalize())

  const surfaceMaterial = useMemo(() => createPlanetSurfaceMaterial(biome, overrides), [biome, overrides])
  const atmosphereMaterial = useMemo(() => createPlanetAtmosphereMaterial(biome, overrides), [biome, overrides])

  useEffect(() => () => {
    surfaceMaterial.dispose()
    atmosphereMaterial.dispose()
  }, [surfaceMaterial, atmosphereMaterial])

  useFrame((state, delta) => {
    updatePlanetMaterials({
      surfaceMaterial,
      atmosphereMaterial,
      time: state.clock.elapsedTime,
      sunDirection: sunDirRef.current,
    })
    if (surfaceRef.current && autoRotate) surfaceRef.current.rotation.y += rotationSpeed * delta
  })

  return (
    <group position={position}>
      <mesh ref={surfaceRef} material={surfaceMaterial}>
        <sphereGeometry args={[radius, 64, 64]} />
      </mesh>
      <mesh scale={1.04} material={atmosphereMaterial}>
        <sphereGeometry args={[radius, 64, 64]} />
      </mesh>
    </group>
  )
}
