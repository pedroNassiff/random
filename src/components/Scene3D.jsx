import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Componente helper para actualizar la posición y orientación de la cámara
function CameraController({ position, lookAt }) {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    camera.updateProjectionMatrix();
  }, [camera, position, lookAt]);
  
  return null;
}

export default function Scene3D({ 
  children,
  camera = { position: [0, 0, 4], fov: 45 },
  lookAt = [0, 0, 0],
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
        
        {/* Camera controller */}
        <CameraController position={camera.position} lookAt={lookAt} />
        
        {/* Camera controls */}
        {controls && <OrbitControls enableZoom={false} enablePan={false} />}
        
        {/* Content */}
        {children}
      </Canvas>
    </div>
  );
}
