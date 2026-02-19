import React, { useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * SyntergicBrain — R3F component
 * Reads live EEG data from a shared ref (no re-renders, no Zustand).
 * Shader: regional frequency coloring (delta/theta/alpha/beta/gamma)
 * + coherence glow + focal point pulse.
 *
 * @prop {React.MutableRefObject} brainStateRef  — updated by WebSocket outside R3F
 */
export function SyntergicBrain({ brainStateRef, scale = 0.2, autoRotate = true }) {
  const { scene } = useGLTF('/models/brain/scene.gltf')
  const group   = useRef()

  // ── Band colors (fixed, no need to memo-update) ───────────────────
  const bandColors = useMemo(() => ({
    delta: new THREE.Color('#8b5cf6'), // purple  — centro
    theta: new THREE.Color('#3b82f6'), // blue    — temporal
    alpha: new THREE.Color('#10b981'), // green   — occipital
    beta:  new THREE.Color('#f59e0b'), // amber   — frontal
    gamma: new THREE.Color('#ef4444'), // red     — prefrontal
  }), [])

  // ── ShaderMaterial (created once, mutated in useFrame) ───────────
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:           { value: 0 },
      uCoherence:      { value: 0 },
      uDeltaIntensity: { value: 0.15 },
      uThetaIntensity: { value: 0.15 },
      uAlphaIntensity: { value: 0.15 },
      uBetaIntensity:  { value: 0.15 },
      uGammaIntensity: { value: 0.15 },
      uFocalPoint:     { value: new THREE.Vector3(0, 0, 0) },
      uDeltaColor:     { value: bandColors.delta },
      uThetaColor:     { value: bandColors.theta },
      uAlphaColor:     { value: bandColors.alpha },
      uBetaColor:      { value: bandColors.beta },
      uGammaColor:     { value: bandColors.gamma },
    },

    vertexShader: /* glsl */`
      varying vec3 vPosition;
      varying vec3 vNormal;
      uniform float uTime;
      uniform float uCoherence;
      uniform vec3  uFocalPoint;

      void main() {
        vPosition = position;
        vNormal   = normalize(normalMatrix * normal);

        // Focal pulse displacement
        float distToFocal  = distance(position, uFocalPoint);
        float focalInfluence = smoothstep(2.5, 0.0, distToFocal);
        float pulse          = sin(uTime * 3.0) * 0.5 + 0.5;
        vec3  displaced      = position + normal * focalInfluence * uCoherence * pulse * 0.12;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,

    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uCoherence;
      uniform float uDeltaIntensity;
      uniform float uThetaIntensity;
      uniform float uAlphaIntensity;
      uniform float uBetaIntensity;
      uniform float uGammaIntensity;
      uniform vec3  uFocalPoint;
      uniform vec3  uDeltaColor;
      uniform vec3  uThetaColor;
      uniform vec3  uAlphaColor;
      uniform vec3  uBetaColor;
      uniform vec3  uGammaColor;

      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vec3 n = normalize(vPosition);

        // Regional influence maps
        float frontal    = smoothstep(-0.2, 1.0, n.z) * smoothstep(-0.3, 0.5, n.y);
        float prefrontal = smoothstep( 0.3, 1.0, n.z) * smoothstep( 0.2, 1.0, n.y);
        float occipital  = smoothstep( 0.2,-1.0, n.z) * smoothstep(-0.5, 0.5, n.y);
        float temporal   = smoothstep( 0.2, 1.0, abs(n.x)) * smoothstep(0.5,-0.5, abs(n.y));
        float central    = 1.0 - smoothstep(0.0, 0.8, length(n));

        // Accumulate colors
        vec3 c = vec3(0.04, 0.04, 0.07);
        c += uDeltaColor * uDeltaIntensity * central    * 3.0;
        c += uThetaColor * uThetaIntensity * temporal   * 3.0;
        c += uAlphaColor * uAlphaIntensity * occipital  * 3.0;
        c += uBetaColor  * uBetaIntensity  * frontal    * 3.0;
        c += uGammaColor * uGammaIntensity * prefrontal * 4.0;

        // Coherence glow
        c += c * uCoherence * 0.9;

        // Pulse
        c *= sin(uTime * 1.5) * 0.05 + 1.0;

        // Diffuse lighting
        vec3 lightDir = normalize(vec3(1.0, 1.5, 1.0));
        c *= dot(vNormal, lightDir) * 0.4 + 0.6;

        // Fresnel rim
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
        c += mix(uDeltaColor, uGammaColor, uCoherence) * fresnel * 0.35;

        gl_FragColor = vec4(c, 1.0);
      }
    `,

    wireframe: true,
    side:      THREE.DoubleSide,
  }), [bandColors])

  // Apply material to all meshes once
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) child.material = material
    })
  }, [scene, material])

  const LER = 0.06 // interpolation factor

  useFrame((state, delta) => {
    if (!group.current) return

    // Rotate
    if (autoRotate) group.current.rotation.y += delta * 0.05

    // Tick time
    material.uniforms.uTime.value += delta

    // Read shared brainState ref (zero GC, no re-render)
    const bs = brainStateRef?.current
    if (!bs) return

    const u = material.uniforms
    const b = bs.bands || {}

    u.uDeltaIntensity.value = THREE.MathUtils.lerp(u.uDeltaIntensity.value, b.delta || 0.15, LER)
    u.uThetaIntensity.value = THREE.MathUtils.lerp(u.uThetaIntensity.value, b.theta || 0.15, LER)
    u.uAlphaIntensity.value = THREE.MathUtils.lerp(u.uAlphaIntensity.value, b.alpha || 0.15, LER)
    u.uBetaIntensity.value  = THREE.MathUtils.lerp(u.uBetaIntensity.value,  b.beta  || 0.15, LER)
    u.uGammaIntensity.value = THREE.MathUtils.lerp(u.uGammaIntensity.value, b.gamma || 0.15, LER)
    u.uCoherence.value      = THREE.MathUtils.lerp(u.uCoherence.value,      bs.coherence || 0, 0.04)

    if (bs.focalPoint) {
      const fp = bs.focalPoint
      u.uFocalPoint.value.lerp(new THREE.Vector3(fp.x || 0, fp.y || 0, fp.z || 0), 0.04)
    }
  })

  return (
    <group ref={group} scale={scale} dispose={null}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/brain/scene.gltf')
