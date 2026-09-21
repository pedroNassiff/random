import * as THREE from 'three'

/**
 * Sistema de Partículas GPU
 * 
 * Usa ping-pong buffers con DataTextures para simular miles de partículas
 * en la GPU. Las partículas reaccionan al audio y expresiones faciales.
 * 
 * Arquitectura:
 * 1. Dos RenderTargets para posiciones (ping-pong)
 * 2. Dos RenderTargets para velocidades (ping-pong)
 * 3. Shader de simulación que actualiza posiciones/velocidades
 * 4. Shader de renderizado que dibuja las partículas
 */
export class GPUParticleSystem {
    constructor(renderer, options = {}) {
        this.renderer = renderer
        
        // Configuración
        this.particleCount = options.particleCount || 65536 // 256x256
        this.textureSize = Math.ceil(Math.sqrt(this.particleCount))
        this.particleCount = this.textureSize * this.textureSize // Ajustar a cuadrado perfecto
        
        console.log(`%c✨ GPU Particles: ${this.particleCount} particles (${this.textureSize}x${this.textureSize})`, 
            'color: #ffd43b; font-weight: bold')
        
        // Estados
        this.currentIndex = 0
        this.initialized = false
        
        // Audio data
        this.audioData = {
            bass: 0, mid: 0, treble: 0, volume: 0,
            beat: 0, spectralCentroid: 0, spectralFlux: 0
        }
        
        // Expression data
        this.expressionData = {
            smile: 0, mouthOpen: 0, eyebrowRaise: 0
        }
        
        // Head pose
        this.headPose = { pitch: 0, yaw: 0, roll: 0 }
        
        // Inicializar
        this.init()
    }

    init() {
        // Crear render targets para ping-pong
        const options = {
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            depthBuffer: false,
            stencilBuffer: false
        }
        
        // Buffers de posición (ping-pong)
        this.positionRT = [
            new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, options),
            new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, options)
        ]
        
        // Buffers de velocidad (ping-pong)
        this.velocityRT = [
            new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, options),
            new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, options)
        ]
        
        // Crear texturas iniciales
        // this.initializeParticles()
        
        // Crear materiales de simulación
        this.createSimulationMaterials()
        
        // Crear geometría y material de renderizado
        this.createRenderMaterial()
        
        // Escena de simulación (quad fullscreen)
        this.simScene = new THREE.Scene()
        this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        this.simQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.positionSimMaterial
        )
        this.simScene.add(this.simQuad)
        
        this.initialized = true
    }

    initializeParticles() {
        const size = this.textureSize
        const count = size * size * 4 // RGBA
        
        // Datos de posición inicial
        const positionData = new Float32Array(count)
        const velocityData = new Float32Array(count)
        
        for (let i = 0; i < this.particleCount; i++) {
            const i4 = i * 4
            
            // Posición inicial: distribuir en un círculo/esfera
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            const radius = Math.random() * 0.8 + 0.1
            
            positionData[i4 + 0] = Math.sin(phi) * Math.cos(theta) * radius // X
            positionData[i4 + 1] = Math.sin(phi) * Math.sin(theta) * radius // Y
            positionData[i4 + 2] = Math.cos(phi) * radius * 0.1             // Z (aplanado)
            positionData[i4 + 3] = 1.0                                       // Vida
            
            // Velocidad inicial: pequeña aleatoria
            velocityData[i4 + 0] = (Math.random() - 0.5) * 0.01
            velocityData[i4 + 1] = (Math.random() - 0.5) * 0.01
            velocityData[i4 + 2] = (Math.random() - 0.5) * 0.001
            velocityData[i4 + 3] = Math.random() // Fase aleatoria
        }
        
        // Crear DataTextures
        const positionTexture = new THREE.DataTexture(
            positionData,
            size, size,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        positionTexture.needsUpdate = true
        
        const velocityTexture = new THREE.DataTexture(
            velocityData,
            size, size,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        velocityTexture.needsUpdate = true
        
        this.initialPositionTexture = positionTexture
        this.initialVelocityTexture = velocityTexture
        
        // Copiar a los render targets iniciales
        this.copyTextureToRT(positionTexture, this.positionRT[0])
        this.copyTextureToRT(positionTexture, this.positionRT[1])
        this.copyTextureToRT(velocityTexture, this.velocityRT[0])
        this.copyTextureToRT(velocityTexture, this.velocityRT[1])
    }

    copyTextureToRT(texture, renderTarget) {
        const material = new THREE.MeshBasicMaterial({ map: texture })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
        const scene = new THREE.Scene()
        scene.add(mesh)
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        
        this.renderer.setRenderTarget(renderTarget)
        this.renderer.render(scene, camera)
        this.renderer.setRenderTarget(null)
        
        material.dispose()
        mesh.geometry.dispose()
    }

    createSimulationMaterials() {
        // Shader de simulación de posición
        const positionSimVertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `
        
        const positionSimFragmentShader = `
            uniform sampler2D uPositions;
            uniform sampler2D uVelocities;
            uniform float uTime;
            uniform float uDeltaTime;
            
            // Audio
            uniform float uAudioBass;
            uniform float uAudioMid;
            uniform float uAudioTreble;
            uniform float uAudioBeat;
            uniform float uAudioVolume;
            
            // Expressions
            uniform float uSmile;
            uniform float uMouthOpen;
            uniform float uEyebrowRaise;
            
            // Head pose
            uniform float uHeadYaw;
            uniform float uHeadPitch;
            
            varying vec2 vUv;
            
            // Ruido simplex
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                
                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);
                
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;
                
                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    
                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;
                
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }
            
            // Curl noise para movimiento fluido
            vec3 curlNoise(vec3 p) {
                const float e = 0.1;
                
                float n1 = snoise(p + vec3(e, 0, 0));
                float n2 = snoise(p - vec3(e, 0, 0));
                float n3 = snoise(p + vec3(0, e, 0));
                float n4 = snoise(p - vec3(0, e, 0));
                float n5 = snoise(p + vec3(0, 0, e));
                float n6 = snoise(p - vec3(0, 0, e));
                
                float x = (n3 - n4) - (n5 - n6);
                float y = (n5 - n6) - (n1 - n2);
                float z = (n1 - n2) - (n3 - n4);
                
                return normalize(vec3(x, y, z));
            }
            
            void main() {
                vec4 pos = texture2D(uPositions, vUv);
                vec4 vel = texture2D(uVelocities, vUv);
                
                vec3 position = pos.xyz;
                float life = pos.w;
                vec3 velocity = vel.xyz;
                float phase = vel.w;
                
                // ==========================================
                // FUERZAS BASADAS EN AUDIO
                // ==========================================
                
                // Fuerza centrípeta modulada por bass
                vec3 toCenter = -normalize(position) * 0.001 * (1.0 + uAudioBass * 2.0);
                
                // Curl noise para movimiento orgánico
                float noiseScale = 2.0 + uAudioMid * 3.0;
                float noiseTime = uTime * (0.2 + uAudioVolume * 0.3);
                vec3 curl = curlNoise(position * noiseScale + noiseTime) * 0.002;
                curl *= (1.0 + uAudioTreble * 2.0);
                
                // Beat pulse - expansión radial
                float beatForce = uAudioBeat * 0.05;
                vec3 radialPush = normalize(position) * beatForce;
                
                // ==========================================
                // FUERZAS BASADAS EN EXPRESIONES
                // ==========================================
                
                // Sonrisa: partículas se expanden hacia arriba y afuera
                vec3 smileForce = vec3(
                    sign(position.x) * uSmile * 0.002,
                    uSmile * 0.003,
                    0.0
                );
                
                // Boca abierta: crear vórtice en el centro inferior
                float vortexStrength = uMouthOpen * 0.005;
                vec3 vortexCenter = vec3(0.0, -0.3, 0.0);
                vec3 toVortex = vortexCenter - position;
                float vortexDist = length(toVortex);
                vec3 vortexForce = vec3(-toVortex.y, toVortex.x, 0.0) * vortexStrength / (vortexDist + 0.1);
                
                // Cejas levantadas: partículas superiores suben
                float eyebrowForce = uEyebrowRaise * 0.003;
                vec3 browForce = vec3(0.0, position.y > 0.0 ? eyebrowForce : 0.0, 0.0);
                
                // ==========================================
                // FUERZAS BASADAS EN POSE DE CABEZA
                // ==========================================
                
                // Yaw: rotar partículas
                float yawForce = uHeadYaw * 0.01;
                vec3 yawRotation = vec3(-position.y * yawForce, position.x * yawForce, 0.0);
                
                // Pitch: inclinar hacia adelante/atrás
                float pitchForce = uHeadPitch * 0.005;
                vec3 pitchForce3 = vec3(0.0, -pitchForce, position.y * pitchForce * 0.5);
                
                // ==========================================
                // APLICAR FUERZAS
                // ==========================================
                
                velocity += toCenter;
                velocity += curl;
                velocity += radialPush;
                velocity += smileForce;
                velocity += vortexForce * step(0.1, uMouthOpen);
                velocity += browForce;
                velocity += yawRotation;
                velocity += pitchForce3;
                
                // Damping
                velocity *= 0.98;
                
                // Limitar velocidad
                float maxSpeed = 0.05 + uAudioVolume * 0.05;
                float speed = length(velocity);
                if (speed > maxSpeed) {
                    velocity = normalize(velocity) * maxSpeed;
                }
                
                // Actualizar posición
                position += velocity * uDeltaTime * 60.0;
                
                // Mantener dentro de límites
                float bounds = 1.2;
                if (length(position) > bounds) {
                    position = normalize(position) * bounds;
                    velocity *= -0.5; // Rebote
                }
                
                // Actualizar vida
                life -= 0.001;
                if (life <= 0.0) {
                    // Respawn en posición aleatoria cerca del centro
                    float angle = phase * 6.28318;
                    float radius = 0.1 + fract(phase * 7.0) * 0.3;
                    position = vec3(
                        cos(angle) * radius,
                        sin(angle) * radius,
                        (fract(phase * 13.0) - 0.5) * 0.1
                    );
                    velocity = vec3(0.0);
                    life = 1.0;
                }
                
                gl_FragColor = vec4(position, life);
            }
        `
        
        // Shader de simulación de velocidad
        const velocitySimFragmentShader = `
            uniform sampler2D uPositions;
            uniform sampler2D uVelocities;
            uniform float uTime;
            
            varying vec2 vUv;
            
            void main() {
                vec4 vel = texture2D(uVelocities, vUv);
                // La velocidad se calcula en el shader de posición
                // Aquí solo la pasamos
                gl_FragColor = vel;
            }
        `
        
        // Material de simulación de posición
        this.positionSimMaterial = new THREE.ShaderMaterial({
            vertexShader: positionSimVertexShader,
            fragmentShader: positionSimFragmentShader,
            uniforms: {
                uPositions: { value: null },
                uVelocities: { value: null },
                uTime: { value: 0 },
                uDeltaTime: { value: 0.016 },
                
                // Audio
                uAudioBass: { value: 0 },
                uAudioMid: { value: 0 },
                uAudioTreble: { value: 0 },
                uAudioBeat: { value: 0 },
                uAudioVolume: { value: 0 },
                
                // Expressions
                uSmile: { value: 0 },
                uMouthOpen: { value: 0 },
                uEyebrowRaise: { value: 0 },
                
                // Head pose
                uHeadYaw: { value: 0 },
                uHeadPitch: { value: 0 }
            }
        })
    }

    createRenderMaterial() {
        // Crear geometría de puntos
        const positions = new Float32Array(this.particleCount * 3)
        const uvs = new Float32Array(this.particleCount * 2)
        const sizes = new Float32Array(this.particleCount)
        const randoms = new Float32Array(this.particleCount)
        
        for (let i = 0; i < this.particleCount; i++) {
            const x = (i % this.textureSize) / this.textureSize
            const y = Math.floor(i / this.textureSize) / this.textureSize
            
            uvs[i * 2 + 0] = x
            uvs[i * 2 + 1] = y
            
            sizes[i] = Math.random() * 0.5 + 0.5
            randoms[i] = Math.random()
        }
        
        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2))
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
        
        // Shader de renderizado
        const renderVertexShader = `
            uniform sampler2D uPositions;
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uSize;
            uniform float uAudioVolume;
            uniform float uAudioBeat;
            
            attribute vec2 aUv;
            attribute float aSize;
            attribute float aRandom;
            
            varying vec3 vColor;
            varying float vLife;
            varying float vRandom;
            
            void main() {
                vec4 posData = texture2D(uPositions, aUv);
                vec3 pos = posData.xyz;
                float life = posData.w;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                // Tamaño basado en vida, distancia y audio
                float baseSize = uSize * aSize * uPixelRatio;
                float lifeSize = life * 0.8 + 0.2;
                float audioSize = 1.0 + uAudioVolume * 0.5 + uAudioBeat * 0.3;
                float distanceAttenuation = 1.0 / (-mvPosition.z * 0.5 + 1.0);
                
                gl_PointSize = baseSize * lifeSize * audioSize * distanceAttenuation;
                
                // Color basado en posición y vida
                vColor = vec3(
                    0.5 + pos.x * 0.5,
                    0.5 + pos.y * 0.5,
                    0.8 + pos.z * 2.0
                );
                
                // Modular color con audio
                vColor = mix(vColor, vec3(1.0, 0.5, 0.2), uAudioBeat * 0.5);
                
                vLife = life;
                vRandom = aRandom;
            }
        `
        
        const renderFragmentShader = `
            uniform float uTime;
            uniform vec3 uMoodColor1;
            uniform vec3 uMoodColor2;
            
            varying vec3 vColor;
            varying float vLife;
            varying float vRandom;
            
            void main() {
                // Círculo suave
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                
                if (dist > 0.5) discard;
                
                // Gradiente suave
                float alpha = smoothstep(0.5, 0.0, dist);
                alpha *= vLife;
                
                // Color final
                vec3 color = mix(vColor, uMoodColor1, vRandom * 0.3);
                color = mix(color, uMoodColor2, sin(uTime + vRandom * 6.28) * 0.2 + 0.2);
                
                // Glow
                float glow = exp(-dist * 4.0);
                color += vec3(1.0, 0.9, 0.8) * glow * 0.3;
                
                gl_FragColor = vec4(color, alpha * 0.8);
            }
        `
        
        this.renderMaterial = new THREE.ShaderMaterial({
            vertexShader: renderVertexShader,
            fragmentShader: renderFragmentShader,
            uniforms: {
                uPositions: { value: null },
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uSize: { value: 15 },
                uAudioVolume: { value: 0 },
                uAudioBeat: { value: 0 },
                uMoodColor1: { value: new THREE.Color(0.3, 0.5, 1.0) },
                uMoodColor2: { value: new THREE.Color(1.0, 0.3, 0.5) }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        
        // Crear mesh de puntos
        this.points = new THREE.Points(this.geometry, this.renderMaterial)
    }

    update(deltaTime, time) {
        if (!this.initialized) return
        
        // Índices de ping-pong
        const readIndex = this.currentIndex
        const writeIndex = 1 - this.currentIndex
        
        // Actualizar uniforms de simulación
        this.positionSimMaterial.uniforms.uPositions.value = this.positionRT[readIndex].texture
        this.positionSimMaterial.uniforms.uVelocities.value = this.velocityRT[readIndex].texture
        this.positionSimMaterial.uniforms.uTime.value = time
        this.positionSimMaterial.uniforms.uDeltaTime.value = deltaTime
        
        // Audio
        this.positionSimMaterial.uniforms.uAudioBass.value = this.audioData.bass
        this.positionSimMaterial.uniforms.uAudioMid.value = this.audioData.mid
        this.positionSimMaterial.uniforms.uAudioTreble.value = this.audioData.treble
        this.positionSimMaterial.uniforms.uAudioBeat.value = this.audioData.beat
        this.positionSimMaterial.uniforms.uAudioVolume.value = this.audioData.volume
        
        // Expressions
        this.positionSimMaterial.uniforms.uSmile.value = this.expressionData.smile
        this.positionSimMaterial.uniforms.uMouthOpen.value = this.expressionData.mouthOpen
        this.positionSimMaterial.uniforms.uEyebrowRaise.value = this.expressionData.eyebrowRaise
        
        // Head pose
        this.positionSimMaterial.uniforms.uHeadYaw.value = this.headPose.yaw
        this.positionSimMaterial.uniforms.uHeadPitch.value = this.headPose.pitch
        
        // Renderizar simulación de posición
        this.simQuad.material = this.positionSimMaterial
        this.renderer.setRenderTarget(this.positionRT[writeIndex])
        this.renderer.render(this.simScene, this.simCamera)
        
        // Actualizar uniforms de renderizado
        this.renderMaterial.uniforms.uPositions.value = this.positionRT[writeIndex].texture
        this.renderMaterial.uniforms.uTime.value = time
        this.renderMaterial.uniforms.uAudioVolume.value = this.audioData.volume
        this.renderMaterial.uniforms.uAudioBeat.value = this.audioData.beat
        
        // Reset render target
        this.renderer.setRenderTarget(null)
        
        // Swap buffers
        this.currentIndex = writeIndex
    }

    setAudioData(audioData) {
        this.audioData.bass = audioData.smoothBass || audioData.bass || 0
        this.audioData.mid = audioData.smoothMid || audioData.mid || 0
        this.audioData.treble = audioData.smoothTreble || audioData.treble || 0
        this.audioData.beat = audioData.beat || 0
        this.audioData.volume = audioData.volume || 0
        this.audioData.spectralCentroid = audioData.spectralCentroid || 0
        this.audioData.spectralFlux = audioData.spectralFlux || 0
    }

    setExpressionData(expressions) {
        this.expressionData.smile = expressions.smile || 0
        this.expressionData.mouthOpen = expressions.mouthOpen || 0
        this.expressionData.eyebrowRaise = expressions.eyebrowRaise || 0
    }

    setHeadPose(pose) {
        this.headPose.yaw = pose.yaw || 0
        this.headPose.pitch = pose.pitch || 0
        this.headPose.roll = pose.roll || 0
    }

    setMoodColors(color1, color2) {
        this.renderMaterial.uniforms.uMoodColor1.value.set(color1[0], color1[1], color1[2])
        this.renderMaterial.uniforms.uMoodColor2.value.set(color2[0], color2[1], color2[2])
    }

    getMesh() {
        return this.points
    }

    dispose() {
        this.positionRT[0].dispose()
        this.positionRT[1].dispose()
        this.velocityRT[0].dispose()
        this.velocityRT[1].dispose()
        this.geometry.dispose()
        this.positionSimMaterial.dispose()
        this.renderMaterial.dispose()
    }
}
