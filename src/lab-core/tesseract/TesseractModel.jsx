import React, { useRef, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

/**
 * TesseractModel - Hipercubo 4D usando Lines (más estable)
 * 
 * Usa Line de drei para las aristas, evitando problemas
 * de orientación con cilindros
 */
const TesseractModel = memo(function TesseractModel({ 
  scale = 1, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  autoRotate = true,
  opacity = 1,
  hovered = false,
  isVisible = true,
  onClick
}) {
  const groupRef = useRef()
  const linesRef = useRef([])
  const pointsRef = useRef([])
  const rotationYRef = useRef(0)

  // Vértices 4D del hipercubo - coordenadas normalizadas
  const vertices4D = useMemo(() => {
    const verts = []
    for (let i = 0; i < 16; i++) {
      verts.push([
        (i & 1) ? 0.5 : -0.5,
        (i & 2) ? 0.5 : -0.5,
        (i & 4) ? 0.5 : -0.5,
        (i & 8) ? 0.5 : -0.5
      ])
    }
    return verts
  }, [])

  // 32 aristas del tesseract
  const edges = useMemo(() => {
    const edgeList = []
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        let diff = 0
        for (let k = 0; k < 4; k++) {
          if (vertices4D[i][k] !== vertices4D[j][k]) diff++
        }
        if (diff === 1) {
          edgeList.push([i, j])
        }
      }
    }
    return edgeList
  }, [vertices4D])

  // Colores
  const colors = useMemo(() => ({
    line: new THREE.Color('#ffd700'),
    lineHover: new THREE.Color('#00ffff'),
    point: new THREE.Color('#ffffff'),
    pointHover: new THREE.Color('#ff6b6b')
  }), [])

  // Estado de colores animados
  const currentColors = useRef({
    line: new THREE.Color('#ffd700'),
    point: new THREE.Color('#ffffff')
  })

  // Proyección 4D → 3D (estereográfica estable)
  const project4Dto3D = (point4D, time) => {
    let [x, y, z, w] = point4D
    
    // Rotación XW (plano x-w)
    const angleXW = time * 0.4
    const cosXW = Math.cos(angleXW)
    const sinXW = Math.sin(angleXW)
    const x1 = x * cosXW - w * sinXW
    const w1 = x * sinXW + w * cosXW
    
    // Rotación YW (plano y-w) - más lenta
    const angleYW = time * 0.25
    const cosYW = Math.cos(angleYW)
    const sinYW = Math.sin(angleYW)
    const y1 = y * cosYW - w1 * sinYW
    const w2 = y * sinYW + w1 * cosYW
    
    // Rotación ZW (plano z-w) - aún más lenta
    const angleZW = time * 0.15
    const cosZW = Math.cos(angleZW)
    const sinZW = Math.sin(angleZW)
    const z1 = z * cosZW - w2 * sinZW
    const w3 = z * sinZW + w2 * cosZW
    
    // Proyección perspectiva desde 4D
    // Distancia del "ojo" en la 4ta dimensión
    const viewDistance = 2.0
    const perspectiveFactor = viewDistance / (viewDistance - w3)
    
    return new THREE.Vector3(
      x1 * perspectiveFactor,
      y1 * perspectiveFactor,
      z1 * perspectiveFactor
    )
  }

  // Geometría para los puntos/vértices
  const pointGeometry = useMemo(() => new THREE.SphereGeometry(0.04, 12, 12), [])

  // Material para los puntos
  const pointMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: colors.point,
    transparent: true,
    opacity: 0.9
  }), [colors.point])

  // Animation loop
  useFrame((state, delta) => {
    if (!isVisible || !groupRef.current) return
    
    const time = state.clock.elapsedTime
    
    // Interpolar colores suavemente
    const targetLineColor = hovered ? colors.lineHover : colors.line
    const targetPointColor = hovered ? colors.pointHover : colors.point
    currentColors.current.line.lerp(targetLineColor, 0.1)
    currentColors.current.point.lerp(targetPointColor, 0.1)
    
    // Actualizar material de puntos
    pointMaterial.color.copy(currentColors.current.point)
    
    // Calcular proyecciones de todos los vértices
    const projectedVertices = vertices4D.map(v => project4Dto3D(v, time))
    
    // Actualizar líneas
    linesRef.current.forEach((lineRef, i) => {
      if (!lineRef) return
      const [fromIdx, toIdx] = edges[i]
      const from = projectedVertices[fromIdx]
      const to = projectedVertices[toIdx]
      
      // Actualizar geometría de la línea
      const positions = lineRef.geometry.attributes.position
      positions.setXYZ(0, from.x, from.y, from.z)
      positions.setXYZ(1, to.x, to.y, to.z)
      positions.needsUpdate = true
      
      // Actualizar color
      lineRef.material.color.copy(currentColors.current.line)
    })
    
    // Actualizar puntos/vértices
    pointsRef.current.forEach((pointRef, i) => {
      if (!pointRef) return
      const pos = projectedVertices[i]
      pointRef.position.copy(pos)
    })
    
    // Transforms del grupo
    if (!groupRef.current.userData.initialized) {
      groupRef.current.position.set(...position)
      const s = scale * 1.5
      groupRef.current.scale.set(s, s, s)
      groupRef.current.userData.initialized = true
    }
    
    // Rotación adicional del grupo (3D)
    if (autoRotate) {
      rotationYRef.current += delta * (hovered ? 0.3 : 0.1)
      groupRef.current.rotation.y = rotationYRef.current
    }
  })

  // Posiciones iniciales para las líneas (se actualizarán en useFrame)
  const initialLinePoints = useMemo(() => {
    return edges.map(([fromIdx, toIdx]) => {
      const from = project4Dto3D(vertices4D[fromIdx], 0)
      const to = project4Dto3D(vertices4D[toIdx], 0)
      return [from, to]
    })
  }, [edges, vertices4D])

  return (
    <group ref={groupRef} onClick={onClick}>
      {/* Aristas usando Line de drei */}
      {initialLinePoints.map((points, i) => (
        <Line
          key={`line-${i}`}
          ref={el => linesRef.current[i] = el}
          points={points}
          color={colors.line}
          lineWidth={2}
          transparent
          opacity={0.8}
        />
      ))}
      
      {/* Vértices */}
      {vertices4D.map((_, i) => (
        <mesh
          key={`point-${i}`}
          ref={el => pointsRef.current[i] = el}
          geometry={pointGeometry}
          material={pointMaterial}
        />
      ))}
    </group>
  )
})

export { TesseractModel }
export default TesseractModel
