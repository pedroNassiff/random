import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function Scene3D({ 
  children,
  camera = { position: [0, 0, 4], fov: 45 },
  controls = true,
  ...props 
}) {
  return (
    <div className="w-full h-full" {...props}>
      <Canvas 
        camera={camera}
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }}
        dpr={[1, 2]}
      >
        {/* Dark background for better holographic visibility */}
        <color attach="background" args={['#0a0a0a']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, -5, -5]} intensity={0.4} />
        
        {/* Camera controls */}
        {controls && <OrbitControls enableZoom={false} enablePan={false} />}
        
        {/* Content */}
        {children}
      </Canvas>
    </div>
  );
}
