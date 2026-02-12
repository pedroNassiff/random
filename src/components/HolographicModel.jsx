import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import holographicVertexShader from '../shaders/holographic/vertex.glsl';
import holographicFragmentShader from '../shaders/holographic/fragment.glsl';

export default function HolographicModel({ 
  scale = 0.1, 
  position = [0, -0.2, 0], 
  rotation = [0, 0, 0],
  autoRotate = false,
  opacity = 1.0,
  // ✨ Props nuevos para tercer ojo
  showThirdEye = false,
  isBreathing = false,
  thirdEyeIntensity = 0,
  onThirdEyePress = () => {},
  onThirdEyeRelease = () => {}
}) {
  const modelRef = useRef();
  const thirdEyeRef = useRef();
  const { camera, gl } = useThree();
  
  // Estados para interacción con tercer ojo
  const [isHoveringThirdEye, setIsHoveringThirdEye] = useState(false);
  const [isPressingThirdEye, setIsPressingThirdEye] = useState(false);

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
    // ✅ Defensive checks para evitar errores de uniformes undefined
    if (material?.uniforms?.uTime) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (material?.uniforms?.uOpacity) {
      material.uniforms.uOpacity.value = opacity;
    }
    
    if (modelRef.current) {
      modelRef.current.position.set(position[0], position[1], position[2]);
      modelRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
      modelRef.current.scale.set(scale, scale, scale);
      
      // Auto-rotación si está activa
      if (autoRotate) {
        modelRef.current.rotation.y += state.clock.getDelta() * 0.2;
      }
    }

    // Animar tercer ojo
    if (thirdEyeRef.current && showThirdEye) {
      const baseScale = 1.0;
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1;
      
      thirdEyeRef.current.scale.set(
        baseScale + pulse,
        baseScale + pulse,
        baseScale + pulse
      );
      
      // Actualizar intensidad del glow
      if (thirdEyeRef.current.material) {
        thirdEyeRef.current.material.emissiveIntensity = 
          isBreathing 
            ? 1.5 + (thirdEyeIntensity * 2) 
            : isHoveringThirdEye 
            ? 1.0 
            : 0.5;
      }
    }
  });

  // 🎯 RAYCASTING para detectar click en tercer ojo
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  const handlePointerMove = (event) => {
    if (!showThirdEye || !thirdEyeRef.current) return;

    const rect = gl.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(thirdEyeRef.current, true);

    setIsHoveringThirdEye(intersects.length > 0);
  };

  const handlePointerDown = (event) => {
    if (!showThirdEye || !isHoveringThirdEye) return;
    
    event.stopPropagation();
    setIsPressingThirdEye(true);
    onThirdEyePress();
  };

  const handlePointerUp = (event) => {
    if (!isPressingThirdEye) return;
    
    event.stopPropagation();
    setIsPressingThirdEye(false);
    onThirdEyeRelease();
  };

  const handleTouchStart = (event) => {
    handlePointerMove(event.touches[0]);
    handlePointerDown(event);
  };

  const handleTouchEnd = (event) => {
    handlePointerUp(event);
  };

  // Event listeners para raycasting
  useEffect(() => {
    const canvas = gl.domElement;
    
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showThirdEye, isHoveringThirdEye, isPressingThirdEye]);

  // Cambiar cursor al hover
  useEffect(() => {
    if (showThirdEye) {
      gl.domElement.style.cursor = isHoveringThirdEye ? 'pointer' : 'default';
    } else {
      gl.domElement.style.cursor = 'default';
    }
  }, [showThirdEye, isHoveringThirdEye, gl]);

  return (
    <group>
      {/* Modelo holográfico principal */}
      <primitive ref={modelRef} object={model} />

      {/* 🧠 TERCER OJO - Glow visual */}
      {showThirdEye && (
        <group 
          position={[
            position[0], 
            position[1] + 1.5,  // ⚠️ AJUSTAR: Altura relativa a la cabeza
            position[2] + 0.15   // ⚠️ AJUSTAR: Profundidad (adelante)
          ]}
          scale={scale}
        >
          {/* Esfera del tercer ojo */}
          <mesh ref={thirdEyeRef}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial
              color={isBreathing ? "#00ffff" : isPressingThirdEye ? "#ff00ff" : "#00ffff"}
              transparent
              opacity={isBreathing ? 0.5 : isHoveringThirdEye ? 0.3 : 0.15}
              emissive="#00ffff"
              emissiveIntensity={isBreathing ? 2.0 : isHoveringThirdEye ? 1.0 : 0.5}
            />
          </mesh>

          {/* Glow exterior */}
          <mesh scale={1.5}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial
              color="#00ffff"
              transparent
              opacity={isBreathing ? 0.15 : isHoveringThirdEye ? 0.1 : 0.05}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Punto de luz */}
          <pointLight
            color="#00ffff"
            intensity={isBreathing ? 3.0 + (thirdEyeIntensity * 2) : isHoveringThirdEye ? 2.0 : 1.0}
            distance={20}
            decay={2}
          />
        </group>
      )}

      {/* ✨ Partículas ascendentes durante inhale */}
      {showThirdEye && isBreathing && (
        <ThirdEyeParticles 
          intensity={thirdEyeIntensity}
          position={position}
          scale={scale}
        />
      )}
    </group>
  );
}

// 🌟 Componente de partículas que suben desde el tercer ojo
function ThirdEyeParticles({ intensity = 0, position = [0, 0, 0], scale = 0.1 }) {
  const pointsRef = useRef();
  const particleCount = 30;

  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      // Posición inicial: alrededor del tercer ojo
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 2.0;
      positions[i * 3] = position[0] + Math.cos(angle) * radius * scale;
      positions[i * 3 + 1] = position[1] + 1.5 * scale; // Altura del tercer ojo
      positions[i * 3 + 2] = position[2] + 0.15 * scale + Math.sin(angle) * radius * scale;

      velocities.push((Math.random() * 0.02 + 0.01) * scale);
    }

    return { positions, velocities };
  }, [position, scale]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < particleCount; i++) {
      // Mover hacia arriba
      positions[i * 3 + 1] += particles.velocities[i] * (1 + intensity);

      // Reset cuando llegan arriba
      const maxHeight = position[1] + 3.0 * scale;
      if (positions[i * 3 + 1] > maxHeight) {
        positions[i * 3 + 1] = position[1] + 1.5 * scale;
      }

      // Ligero movimiento ondulante
      positions[i * 3] += Math.sin(state.clock.elapsedTime + i) * 0.002 * scale;
      positions[i * 3 + 2] += Math.cos(state.clock.elapsedTime + i) * 0.002 * scale;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15 * scale}
        color="#00ffff"
        transparent
        opacity={0.3 * (1 + intensity * 0.5)}
        blending={THREE.AdditiveBlending}
        sizeAttenuation={true}
      />
    </points>
  );
}