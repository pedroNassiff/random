
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { Brain } from './Brain'
import { RegionalBrainActivity } from './RegionalBrainActivity'
import { BrainRegionLabels } from './BrainRegionLabels'
import { Leva, useControls } from 'leva' // Import restaurado

import { useBrainStore } from '../../store/brainStore'
import { useEffect } from 'react'

export const Experience = () => {

    const connectToField = useBrainStore(state => state.connectToField)

    useEffect(() => {
        connectToField()
    }, [])

    const { ambientIntensity, environmentPresets, useRegionalView, showLabels } = useControls('Lighting', {
        ambientIntensity: { value: 0.5, min: 0, max: 2 },
        environmentPresets: { options: ['city', 'studio', 'night', 'forest'], value: 'studio' },
        useRegionalView: { value: true, label: 'Regional Frequencies' },
        showLabels: { value: true, label: 'Show Region Labels' }
    })

    return (
        <>
            <Canvas
                camera={{ position: [0, 0, 1.5], fov: 45 }} // Alejé la cámara (z: 0.4 -> 1.5)
                shadows
                gl={{ antialias: true }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
            >
                <OrbitControls makeDefault enablePan={true} minDistance={0.5} maxDistance={5} />

                <ambientLight intensity={ambientIntensity} />
                <Environment preset={environmentPresets} blur={0.8} background={false} />

                {/* Selector entre vista regional (nueva) y vista tradicional */}
                {useRegionalView ? (
                    <>
                        <RegionalBrainActivity scale={0.2} />
                        <BrainRegionLabels visible={showLabels} />
                    </>
                ) : (
                    <Brain scale={0.2} />
                )}

                <ContactShadows position={[0, -0.15, 0]} opacity={0.4} scale={10} blur={2.5} far={1} />
            </Canvas>
            <Leva collapsed />
        </>
    )
}

