import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import holographicVertexShader from '../shaders/holographic/vertex.glsl';
import holographicFragmentShader from '../shaders/holographic/fragment.glsl';

export default function HolographicModel({ 
  scale = 0.1, 
  position = [0, -0.5, 0], 
  rotation = [0, 0, 0],
  autoRotate = true 
}) {
  const modelRef = useRef();

  // Load GLTF model
  const gltf = useLoader(GLTFLoader, '/malebase.glb');

  // Create holographic material - memoized to avoid recreating
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: holographicVertexShader,
      fragmentShader: holographicFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#70c1ff') }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, []);

  // Clone model and apply material - only once
  const model = useMemo(() => {
    const clonedScene = gltf.scene.clone();
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
      }
    });
    return clonedScene;
  }, [gltf.scene, material]);

  // Animation loop
  useFrame((state) => {
    // Update shader time
    material.uniforms.uTime.value = state.clock.elapsedTime;
    
    if (modelRef.current) {
      // Apply position from props
      modelRef.current.position.set(position[0], position[1], position[2]);
      
      // Apply scale from props
      modelRef.current.scale.set(scale, scale, scale);
      
      // Apply rotation from props or auto-rotate
      if (autoRotate) {
        modelRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      } else {
        modelRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
      }
    }
  });

  return (
    <primitive 
      ref={modelRef}
      object={model}
    />
  );
}
