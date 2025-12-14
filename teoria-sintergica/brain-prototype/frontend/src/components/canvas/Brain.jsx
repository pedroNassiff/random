import React, { useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBrainStore } from '../../store/brainStore'
import '../../shaders/SyntergicMaterial_v2' // Shader simplificado y claro

export function Brain(props) {
    const { scene } = useGLTF('/models/brain/scene.gltf')
    const group = useRef()

    // Inicialización del material
    useMemo(() => {
        scene.traverse((child) => {
            if (child.isMesh) {
                // child.material = ... (Ya lo maneja <syntergicMaterial /> abajo con el attach)
            }
        })
    }, [scene])

    useFrame((state, delta) => {
        // Rotación base suave
        if (group.current) group.current.rotation.y += delta * 0.05 // Un poco más rápido

        // LEER ESTADO DIRECTAMENTE (Transient Update)
        const { coherence, focalPoint } = useBrainStore.getState()

        // Sincronización del Shader con el Estado del Backend
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material.uniforms) {
                obj.material.uniforms.uTime.value += delta

                // La intensidad del brillo responde a la Coherencia
                // Hacemos que parpadee menos y sea más un "brillo sostenido"
                obj.material.uniforms.uHoverIntensity.value = THREE.MathUtils.lerp(
                    obj.material.uniforms.uHoverIntensity.value,
                    1.0 + (coherence * 3.0), // Base más alta + boost por coherencia
                    0.02 // Lerp más lento
                )

                if (focalPoint) {
                    obj.material.uniforms.uHover.value.lerp(
                        new THREE.Vector3(focalPoint.x, focalPoint.y, focalPoint.z),
                        0.02
                    )
                }

                // Color mapping: Oro (Alta Sintergia) vs Cian/Frio (Baja)
                const hue = coherence > 0.6 ? 0.1 : 0.55 // 0.1 Naranja/Oro, 0.55 Azul
                const sat = 1.0
                const light = 0.5 + (coherence * 0.3)

                const targetColor = new THREE.Color().setHSL(hue, sat, light)
                obj.material.uniforms.uColor.value.lerp(targetColor, 0.05)

                obj.material.wireframe = false // Siempre sólido
            }
        })
    })

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={scene} />

            {/* Instancia del Material Custom aplicado a la escena */}
            <mesh>
                <syntergicMaterial
                    attach="material"
                    ref={(mat) => {
                        if (mat) {
                            scene.traverse(obj => {
                                if (obj.isMesh) obj.material = mat
                            })
                        }
                    }}
                />
            </mesh>
        </group>
    )
}

useGLTF.preload('/models/brain/scene.gltf')
