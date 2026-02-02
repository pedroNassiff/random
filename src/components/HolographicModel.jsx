import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import holographicVertexShader from '../shaders/holographic/vertex.glsl';
import holographicFragmentShader from '../shaders/holographic/fragment.glsl';

export default function HolographicModel({ 
  scale = 0.1, 
  position = [0, -0.2, 0], 
  rotation = [0, 0, 0],
  autoRotate = false,
  opacity = 1.0
}) {
  const modelRef = useRef();

  const gltf = useLoader(GLTFLoader, '/malebase.glb');

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: holographicVertexShader,
      fragmentShader: holographicFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#70c1ff') },
        uOpacity: { value: 1.0 }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, []);

  const model = useMemo(() => {
    const clonedScene = gltf.scene.clone();
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
        child.frustumCulled = false;
      }
    });
    return clonedScene;
  }, [gltf.scene, material]);

useFrame((state) => {
  material.uniforms.uTime.value = state.clock.elapsedTime;
  material.uniforms.uOpacity.value = opacity;
  
  if (modelRef.current) {
    // 🔥 QUITAR ESTO - no usar visible
    // modelRef.current.visible = opacity > 0.01;
    
    modelRef.current.position.set(position[0], position[1], position[2]);
    modelRef.current.scale.set(scale, scale, scale);
  }
});

  return <primitive ref={modelRef} object={model} />;
}