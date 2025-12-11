import React, { useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { useBrainStore } from '../../store/brainStore'
import '../../shaders/SyntergicMaterial' // Importar para registrar el shader con 'extend'

export function Brain(props) {
    const { scene } = useGLTF('/models/brain/scene.gltf')
    const group = useRef()

    const { wireframe, color, intensity, position } = useControls('Syntergic Field', {
        wireframe: false,
        color: '#00ffee',
        intensity: { value: 0.0, min: 0, max: 2.0 },
        position: { value: [0, 20, 0], step: 1 }
    })

    // Referencia al material global
    // Usamos el hook useMemo para evitar recreaciones innecesarias
    // pero el <syntergicMaterial> lo hace por nosotros en el render.

    useFrame((state, delta) => {
        if (group.current) group.current.rotation.y += delta * 0.01

        // Actualizamos uniformes en todos los meshes de la escena
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material.uniforms) {
                obj.material.uniforms.uTime.value += delta
                obj.material.uniforms.uHoverIntensity.value = intensity
                obj.material.uniforms.uHover.value.set(...position)
                obj.material.uniforms.uColor.value.set(color)
                obj.material.wireframe = wireframe
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
                            // Asignar este material único a todos los hijos del cerebro
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
