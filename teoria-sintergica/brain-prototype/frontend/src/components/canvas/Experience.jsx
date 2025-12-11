
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { Brain } from './Brain'
import { Leva, useControls } from 'leva' // Import restaurado

import { useBrainStore } from '../../store/brainStore'
import { useEffect } from 'react'

export const Experience = () => {

    const connectToField = useBrainStore(state => state.connectToField)

    useEffect(() => {
        connectToField()
    }, [])

    const { ambientIntensity, environmentPresets } = useControls('Lighting', {
        ambientIntensity: { value: 0.5, min: 0, max: 2 },
        environmentPresets: { options: ['city', 'studio', 'night', 'forest'], value: 'studio' }
    })

    return (
        <>
            <Canvas
                camera={{ position: [0, 0, 1.5], fov: 45 }} // Alejé la cámara (z: 0.4 -> 1.5)
                shadows
                gl={{ antialias: true }}
            >
                <OrbitControls makeDefault enablePan={true} minDistance={0.5} maxDistance={5} />

                <ambientLight intensity={ambientIntensity} />
                <Environment preset={environmentPresets} blur={0.8} background={false} />

                {/* Aquí controlamos la escala inicial */}
                <Brain scale={0.2} />

                <ContactShadows position={[0, -0.15, 0]} opacity={0.4} scale={10} blur={2.5} far={1} />
            </Canvas>
            <Leva collapsed />
        </>
    )
}

