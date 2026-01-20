import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import planetFragmentShader from '../shaders/hermes/planet/fragment.glsl'
import planetVertexShader from '../shaders/hermes/planet/vertex.glsl'
import smokeFragmentShader from '../shaders/hermes/smoke/fragment.glsl'
import smokeVertexShader from '../shaders/hermes/smoke/vertex.glsl'

/**
 * Hermes - El Maestro de Maestros
 * Calavera mística con planeta y anillos, fumando un pucho loco
 */
class Hermes {
    constructor(scene, camera, gltfLoader, textureLoader) {
        this.scene = scene
        this.camera = camera
        this.gltfLoader = gltfLoader
        this.textureLoader = textureLoader
        this.group = new THREE.Group()
        
        // Componentes
        this.skull = null
        this.skullMixer = null // AnimationMixer para animaciones de Blender
        this.planet = null
        this.rings = null
        this.cigarette = null
        this.cigaretteEmber = null
        this.smoke = null
        
        // Estado
        this.isVisible = false
        this.isLoaded = false
        this.opacity = 0
        this.animationState = 'hidden' // hidden, appearing, idle, smoking
        
        // Parámetros de posición
        this.params = {
            initialPosition: { x: 1.25, y: -0.24, z: 0.5 },
            scale: 0.02,
            rotation: { x: 0, y: 0, z: 0 }
        }

        // Parámetros de animación
        this.animParams = {
            breatheSpeed: 0.5,
            breatheIntensity: 0.01,
            planetRotSpeed: 0.001,
            ringsRotSpeed: 0.002,
            levitationSpeed: 0.3,
            levitationIntensity: 0.0001,
            smokingInterval: 5000, // Fuma cada 5 segundos
            smokingDuration: 2000 // Dura 2 segundos fumando
        }

        // Timer para fumar
        this.lastSmokeTime = 0
        this.isSmoking = false
        this.smokingProgress = 0

        // Animaciones de Blender
        this.animations = {}
        this.currentAction = null

        // Posición inicial
        this.group.position.set(
            this.params.initialPosition.x,
            this.params.initialPosition.y,
            this.params.initialPosition.z
        )
        this.group.scale.set(this.params.scale, this.params.scale, this.params.scale)
    }

    /**
     * Inicializar todos los componentes de Hermes
     */
    async init() {
        console.log('Hermes apareciendo...')
        
        try {
            // Cargar calavera primero (componente principal)
            await this.initSkull()
            
            // Luego los demás componentes
            this.initPlanet()
            this.initRings()
            this.initSmoke() // Sistema de humo del cigarrillo
            
            // Agregar grupo a escena
            this.scene.add(this.group)
            this.isLoaded = true
            
            console.log('Hermes llegando')
        } catch (error) {
            console.error('Error inicializando Hermes:', error)
        }
    }

    /**
     * Cargar modelo de calavera desde Blender (GLB)
     */
    initSkull() {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                '/models/hermes/skull.glb', // Ruta al modelo exportado de Blender
                (gltf) => {
                    console.log(' Calavera cargada:', gltf)
                    
                    this.skull = gltf.scene
                    
                    // Si el modelo tiene animaciones de Blender
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.skullMixer = new THREE.AnimationMixer(this.skull)
                        
                        // Guardar todas las animaciones por nombre
                        gltf.animations.forEach(clip => {
                            this.animations[clip.name] = clip
                            console.log(`Animación encontrada: ${clip.name}`)
                        })

                        // Si hay una animación de "smoking", prepararla
                        if (this.animations['smoking']) {
                            this.smokingAction = this.skullMixer.clipAction(this.animations['smoking'])
                            this.smokingAction.loop = THREE.LoopOnce
                            this.smokingAction.clampWhenFinished = true
                        }
                    }
                    
                    // Aplicar shader místico a la calavera (opcional, o usar material de Blender)
                    // this.applyMysticShader()
                    
                    // Agregar al grupo
                    this.group.add(this.skull)
                    
                    resolve()
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(2)
                    console.log(`Cargando calavera: ${percent}%`)
                },
                (error) => {
                    console.error('Error cargando calavera:', error)
                    reject(error)
                }
            )
        })
    }

    /**
     * Crear planeta con shader procedural
     */
    initPlanet() {
        const planetGeometry = new THREE.SphereGeometry(0.3, 64, 64)
        
        const planetMaterial = new THREE.ShaderMaterial({
            vertexShader: planetVertexShader,
            fragmentShader: planetFragmentShader,
            uniforms: {
                uTime: new THREE.Uniform(0),
                uBaseColor: new THREE.Uniform(new THREE.Color('#8B4513')), // Marrón tierra
                uSecondaryColor: new THREE.Uniform(new THREE.Color('#D2691E')), // Marrón claro
            },
            // transparent: true,
            // depthWrite: false,
        })
        
        this.planet = new THREE.Mesh(planetGeometry, planetMaterial)
        this.planet.position.y = -0.5 // Debajo de la calavera
        
        this.group.add(this.planet)
        
        console.log('🌍 Planeta creado')
    }

    /**
     * Crear anillos estilo Saturno
     */
    initRings() {
        const ringsGeometry = new THREE.RingGeometry(0.4, 0.7, 64)
        
        const ringsMaterial = new THREE.MeshBasicMaterial({
            color: 0xD4AF37, // Dorado
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        })
        
        this.rings = new THREE.Mesh(ringsGeometry, ringsMaterial)
        this.rings.rotation.x = Math.PI / 2.5 // Inclinación
        this.rings.position.y = -0.5 // Misma altura que planeta
        
        this.group.add(this.rings)
        
        console.log('💍 Anillos creados')
    }

    /**
     * Crear cigarrillo con brasa
     */
    initCigarette() {
        // Grupo del cigarrillo
        const cigaretteGroup = new THREE.Group()
        
        // Cuerpo del cigarrillo (cilindro blanco)
        const bodyGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8)
        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xF5F5DC }) // Beige
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
        body.rotation.z = Math.PI / 2 // Horizontal
        
        // Brasa (esfera roja en la punta)
        const emberGeometry = new THREE.SphereGeometry(0.015, 16, 16)
        const emberMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF4500, // Naranja rojizo
            emissive: 0xFF4500,
            emissiveIntensity: 2
        })
        this.cigaretteEmber = new THREE.Mesh(emberGeometry, emberMaterial)
        this.cigaretteEmber.position.x = 0.075 // Punta del cigarrillo
        
        cigaretteGroup.add(body)
        cigaretteGroup.add(this.cigaretteEmber)
        
        // Posicionar el cigarrillo
        // Si NO hay animación de Blender, posicionarlo manualmente cerca de la boca
        cigaretteGroup.position.set(0.15, 0.1, 0.1)
        cigaretteGroup.rotation.z = -Math.PI / 6
        
        this.cigarette = cigaretteGroup
        this.group.add(this.cigarette)
        
        console.log('🚬 Cigarrillo creado')
    }

    /**
     * Crear sistema de humo con shader procedural
     */
    initSmoke() {
        // Cargar textura de perlin noise
        const perlinTexture = this.textureLoader.load('/perlin.png')
        perlinTexture.wrapS = THREE.RepeatWrapping
        perlinTexture.wrapT = THREE.RepeatWrapping

        // Geometría del humo
        const smokeGeometry = new THREE.PlaneGeometry(1, 1, 16, 64)
        smokeGeometry.translate(0, 0.5, 0)
        smokeGeometry.scale(0.15, 0.6, 0.15) // Escalado para el tamaño de Hermes

        // Material con shaders personalizados
        const smokeMaterial = new THREE.ShaderMaterial({
            vertexShader: smokeVertexShader,
            fragmentShader: smokeFragmentShader,
            side: THREE.DoubleSide,
            uniforms: {
                uTime: new THREE.Uniform(0),
                uPerlinTexture: new THREE.Uniform(perlinTexture),
            },
            transparent: true,
            depthWrite: false,
        })

        this.smoke = new THREE.Mesh(smokeGeometry, smokeMaterial)
        
        // Posicionar el humo en la punta del cigarrillo
        // Ajustar según tu modelo
        this.smoke.position.set(0.15, 0.15, 0.1)
        
        // El humo inicialmente invisible, solo visible cuando fuma
        this.smoke.visible = false
        
        this.group.add(this.smoke)
        
        console.log('💨 Sistema de humo creado')
    }

    /**
     * Aparecer con fade-in
     */
    appear(currentTime, duration = 3000) {
        if (this.animationState !== 'hidden') return
        
        this.isVisible = true
        this.animationState = 'appearing'
        this.appearStartTime = currentTime
        this.appearDuration = duration
        
        console.log('✨ Hermes apareciendo...')
    }

    /**
     * Actualizar animación de aparición
     */
    updateAppearAnimation(currentTime) {
        const elapsed = currentTime - this.appearStartTime
        const progress = Math.min(elapsed / this.appearDuration, 1)
        
        // Ease in cubic
        const easeProgress = progress * progress * progress
        
        // Fade in opacity
        this.opacity = easeProgress
        
        // Aplicar opacidad a materiales
        if (this.planet) {
            this.planet.material.opacity = easeProgress
            this.planet.material.transparent = true
        }
        
        if (this.rings) {
            this.rings.material.opacity = easeProgress * 0.6
        }
        
        // Slight scale animation
        const scale = this.params.scale + (easeProgress * 0.003)
        this.group.scale.set(scale, scale, scale)
        

        // 4.5 Actualizar shader de humo
        if (this.smoke && this.smoke.material.uniforms) {
            this.smoke.material.uniforms.uTime.value = time
        }
        // Rotación inicial sutil
        this.group.rotation.y = easeProgress * Math.PI * 0.2
        
        // Cambiar a idle cuando termine
        if (progress >= 1) {
            this.animationState = 'idle'
            console.log('🔮 Hermes en modo idle')
        }
    }

    /**
     * Animaciones idle continuas
     */
    updateIdleAnimation(time, deltaTime) {
        if (this.animationState !== 'idle') return
        
        // 1. Respiración sutil de la calavera
        if (this.skull) {
            const breathe = Math.sin(time * this.animParams.breatheSpeed) * this.animParams.breatheIntensity
            this.skull.scale.y = 1 + breathe
        }
        
        // 2. Rotación del planeta
        if (this.planet) {
            this.planet.rotation.y += this.animParams.planetRotSpeed
            // Actualizar uniform de tiempo si usa shader
            if (this.planet.material.uniforms && this.planet.material.uniforms.uTime) {
                this.planet.material.uniforms.uTime.value = time
            }
        }
        
        // 3. Rotación de anillos (opuesta)
        if (this.rings) {
            this.rings.rotation.z += this.animParams.ringsRotSpeed
        }
        
        // 4. Pulsación de brasa
        if (this.cigaretteEmber) {
            const emberPulse = (Math.sin(time * 2) * 0.5 + 0.5) * 0.5 + 0.5
            this.cigaretteEmber.material.emissiveIntensity = emberPulse * 2
        }
        
        // 5. Levitación sutil
        const levitation = Math.sin(time * this.animParams.levitationSpeed) * this.animParams.levitationIntensity
        this.group.position.y = this.params.initialPosition.y + levitation
        
        // 6. Sistema de fumar periódico
        this.updateSmokingCycle(time, deltaTime)
    }

    /**Mostrar humo
        if (this.smoke) {
            this.smoke.visible = true
        }
        
        // 
     * Ciclo de fumar periódico
     */
    updateSmokingCycle(time, deltaTime) {
        const timeSinceLastSmoke = time - this.lastSmokeTime
        
        // ¿Es hora de fumar?
        if (!this.isSmoking && timeSinceLastSmoke > this.animParams.smokingInterval / 1000) {
            this.startSmoking(time)
        }
        //Ocultar humo después de un delay (fade out natural)
        if (this.smoke) {
            setTimeout(() => {
                if (this.smoke && !this.isSmoking) {
                    this.smoke.visible = false
                }
            }, 1000) // 1 segundo después para que se disipe
        }
        
        // 
        
        // Si está fumando, actualizar animación
        if (this.isSmoking) {
            this.smokingProgress += deltaTime / (this.animParams.smokingDuration / 1000)
            
            // Mover cigarrillo a la boca (si no hay animación de Blender)
            if (!this.smokingAction && this.cigarette) {
                // Interpolación suave hacia la posición de "boca"
                const t = this.easeInOutCubic(Math.min(this.smokingProgress, 1))
                
                // Posición inicial y final del cigarrillo
                const startPos = { x: 0.15, y: 0.1, z: 0.1 }
                const endPos = { x: 0.05, y: 0.05, z: 0.15 } // Cerca de donde estaría la boca
                
                this.cigarette.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, t)
                this.cigarette.position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, t)
                this.cigarette.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, t)
            }
            
            // Terminar de fumar
            if (this.smokingProgress >= 1) {
                this.stopSmoking()
            }
        }
    }

    /**
     * Iniciar animación de fumar
     */
    startSmoking(time) {
        this.isSmoking = true
        this.smokingProgress = 0
        this.lastSmokeTime = time
        
        console.log('🚬 Hermes fumando...')
        
        // Si hay animación de Blender, reproducirla
        if (this.smokingAction) {
            this.smokingAction.reset()
            this.smokingAction.play()
        }
    }

    /**
     * Terminar animación de fumar
     */
    stopSmoking() {
        this.isSmoking = false
        this.smokingProgress = 0
        
        // Volver cigarrillo a posición inicial
        if (this.cigarette && !this.smokingAction) {
            // Animación de vuelta (ya manejada por el ciclo)
        }
    }

    /**
     * Easing function
     */
    easeInOutCubic(t) {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    /**
     * Update loop principal
     */
    update(time, scrollProgress, deltaTime) {
        if (!this.isLoaded) return
        
        // Actualizar AnimationMixer de Blender si existe
        if (this.skullMixer) {
            this.skullMixer.update(deltaTime)
        }
        
        // State machine de animaciones
        switch (this.animationState) {
            case 'appearing':
                this.updateAppearAnimation(time)
                break
            
            case 'idle':
                this.updateIdleAnimation(time, deltaTime)
                break
        }
    }

    /**

        if (this.smoke) {
            this.smoke.geometry.dispose()
            this.smoke.material.dispose()
            if (this.smoke.material.uniforms.uPerlinTexture.value) {
                this.smoke.material.uniforms.uPerlinTexture.value.dispose()
            }
        }
     * Limpiar recursos
     */
    dispose() {
        if (this.skull) {
            this.skull.traverse(child => {
                if (child.geometry) child.geometry.dispose()
                if (child.material) child.material.dispose()
            })
        }
        
        if (this.planet) {
            this.planet.geometry.dispose()
            this.planet.material.dispose()
        }
        
        if (this.rings) {
            this.rings.geometry.dispose()
            this.rings.material.dispose()
        }
        
        this.scene.remove(this.group)
        
        console.log('🗑️ Hermes limpiado')
    }
}

export default Hermes