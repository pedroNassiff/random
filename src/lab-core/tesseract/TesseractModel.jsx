import React, { useRef, useMemo, useEffect, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Default shaders (editable live in the source panel) ────────────────
const DEFAULT_VERTEX = `
uniform float uTime;
varying vec3  vPos;

void main() {
  vPos        = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const DEFAULT_FRAGMENT = `
uniform float uTime;
uniform vec3  uColor;
varying vec3  vPos;

void main() {
  // Pulse along time + distance from origin
  float t = 0.65 + 0.35 * sin(uTime * 1.2 + length(vPos) * 3.0);
  gl_FragColor = vec4(uColor * t, 0.85);
}
`

// ── TesseractModel ────────────────────────────────────────────
const TesseractModel = memo(function TesseractModel({
  scale = 1,
  position = [0, 0, 0],
  autoRotate = true,
  hovered = false,
  isVisible = true,
  onClick,
  // Live editor props
  vertexShader:   liveVertex,
  fragmentShader: liveFragment,
  tesseractParams: liveParams,
}) {
  const groupRef      = useRef()
  const rotationYRef  = useRef(0)
  const liveRef       = useRef(liveParams)
  useEffect(() => { liveRef.current = liveParams }, [liveParams])

  // 16 vertices of the 4D hypercube
  const vertices4D = useMemo(() => {
    const v = []
    for (let i = 0; i < 16; i++) {
      v.push([
        (i & 1) ? 0.5 : -0.5,
        (i & 2) ? 0.5 : -0.5,
        (i & 4) ? 0.5 : -0.5,
        (i & 8) ? 0.5 : -0.5,
      ])
    }
    return v
  }, [])

  // 32 edges: pairs that differ in exactly one bit
  const edges = useMemo(() => {
    const list = []
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++) {
        let diff = 0
        for (let k = 0; k < 4; k++) if (vertices4D[i][k] !== vertices4D[j][k]) diff++
        if (diff === 1) list.push([i, j])
      }
    return list
  }, [vertices4D])

  // ── Geometry: LineSegments — 32 edges * 2 verts * 3 floats ──
  const edgeGeo = useMemo(() => {
    const geo  = new THREE.BufferGeometry()
    const pos  = new Float32Array(edges.length * 2 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [edges])

  // ── Geometry: Points — 16 vertices * 3 floats ──
  const vertGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(16 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [])

  // ── ShaderMaterial for edges — rebuilt when shaders change ──
  const lineMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   liveVertex   || DEFAULT_VERTEX,
    fragmentShader: liveFragment || DEFAULT_FRAGMENT,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color('#ffd700') },
    },
    transparent: true,
  }), [liveVertex, liveFragment])

  // ── PointsMaterial for vertices ──
  const vertMat = useMemo(() => new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.055,
    transparent: true,
    opacity: 0.8,
  }), [])

  // Cleanup GPU resources on rebuild
  useEffect(() => () => { edgeGeo.dispose(); lineMat.dispose() }, [edgeGeo, lineMat])

  // ── 4D → 3D stereographic projection ──
  const project = (point4D, time) => {
    let [x, y, z, w] = point4D
    const p = liveRef.current
    const xwS = p?.rotation?.xwSpeed  ?? 0.4
    const ywS = p?.rotation?.ywSpeed  ?? 0.25
    const zwS = p?.rotation?.zwSpeed  ?? 0.15
    const vd  = p?.viewDistance        ?? 2.0

    // XW
    let cx = Math.cos(time * xwS), sx = Math.sin(time * xwS)
    ;[x, w] = [x * cx - w * sx, x * sx + w * cx]
    // YW
    let cy = Math.cos(time * ywS), sy = Math.sin(time * ywS)
    ;[y, w] = [y * cy - w * sy, y * sy + w * cy]
    // ZW
    let cz = Math.cos(time * zwS), sz = Math.sin(time * zwS)
    ;[z, w] = [z * cz - w * sz, z * sz + w * cz]

    const d = vd / (vd - w)
    return [x * d, y * d, z * d]
  }

  // ── Animation loop ──
  useFrame((state, delta) => {
    if (!isVisible || !groupRef.current) return
    const time = state.clock.elapsedTime

    // Update uniforms
    lineMat.uniforms.uTime.value  = time
    const p = liveRef.current
    lineMat.uniforms.uColor.value.set(
      hovered ? '#00ffff' : (p?.colors?.line ?? '#ffd700')
    )
    vertMat.color.set(hovered ? '#ff6b6b' : (p?.colors?.point ?? '#ffffff'))

    // Project all 16 vertices
    const pts = vertices4D.map(v => project(v, time))

    // Update edge positions buffer
    const eBuf = edgeGeo.attributes.position
    edges.forEach(([a, b], i) => {
      eBuf.setXYZ(i * 2,     pts[a][0], pts[a][1], pts[a][2])
      eBuf.setXYZ(i * 2 + 1, pts[b][0], pts[b][1], pts[b][2])
    })
    eBuf.needsUpdate = true

    // Update vertex positions buffer
    const vBuf = vertGeo.attributes.position
    pts.forEach(([x, y, z], i) => vBuf.setXYZ(i, x, y, z))
    vBuf.needsUpdate = true

    // Group init
    if (!groupRef.current.userData.initialized) {
      groupRef.current.position.set(...position)
      const s = scale * 1.5
      groupRef.current.scale.set(s, s, s)
      groupRef.current.userData.initialized = true
    }
    if (autoRotate) {
      rotationYRef.current += delta * (hovered ? 0.3 : 0.1)
      groupRef.current.rotation.y = rotationYRef.current
    }
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      <lineSegments geometry={edgeGeo} material={lineMat} />
      <points      geometry={vertGeo} material={vertMat} />
    </group>
  )
})

export { TesseractModel }
export default TesseractModel
