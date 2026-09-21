import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Import shaders
import patternsVertexShader from './src/shaders/patterns/vertex.glsl'
import patternsFragmentShader from './src/shaders/patterns/fragment.glsl'
import holographicVertexShader from './src/shaders/holographic/vertex.glsl'
import holographicFragmentShader from './src/shaders/holographic/fragment.glsl'

// Import tracking, audio and particles
import { FaceTracker } from './src/FaceTracker.js'
import { AudioAnalyzer } from './src/AudioAnalyzer.js'
import { GPUParticleSystem } from './src/GPUParticleSystem.js'

/**
 * Base
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const portraitTexture = textureLoader.load('/lavacafull_image_transparent.png')
portraitTexture.minFilter = THREE.LinearFilter
portraitTexture.magFilter = THREE.LinearFilter

/**
 * Portrait
 */
const geometry = new THREE.PlaneGeometry(2, 2, 128, 128)

/**
 * Pattern Material Factory - Now includes expression uniforms
 */
function createPatternMaterial(patternIndex) {
    return new THREE.ShaderMaterial({
        vertexShader: patternsVertexShader,
        fragmentShader: patternsFragmentShader,
        uniforms: {
            uTexture: { value: portraitTexture },
            uTime: { value: 0 },
            uPattern: { value: patternIndex },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            
            // Audio básico
            uAudioBass: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioTreble: { value: 0 },
            uAudioVolume: { value: 0 },
            
            // Audio avanzado
            uAudioBeat: { value: 0 },
            uAudioSpectralCentroid: { value: 0 },
            uAudioSpectralFlux: { value: 0 },
            uAudioSubBass: { value: 0 },
            uAudioLowBass: { value: 0 },
            uAudioPresence: { value: 0 },
            uAudioBrilliance: { value: 0 },
            
            // Mood
            uMoodColor1: { value: new THREE.Vector3(0.2, 0.3, 0.5) },
            uMoodColor2: { value: new THREE.Vector3(0.4, 0.5, 0.6) },
            uMoodColor3: { value: new THREE.Vector3(0.3, 0.4, 0.3) },
            uMoodIntensity: { value: 0.5 },
            
            // Face
            uFaceTexture: { value: null },
            uHasFace: { value: 0 },
            
            // Expresiones faciales
            uSmile: { value: 0 },
            uMouthOpen: { value: 0 },
            uEyebrowRaise: { value: 0 },
            uEyebrowFrown: { value: 0 },
            uLeftEyeOpen: { value: 1 },
            uRightEyeOpen: { value: 1 },
            
            // Head pose
            uHeadPitch: { value: 0 },
            uHeadYaw: { value: 0 },
            uHeadRoll: { value: 0 },
            
            // Video stream
            uVideoTexture: { value: null },
            uHasVideo: { value: 0 }
        },
        transparent: true,
        side: THREE.DoubleSide
    })
}

/**
 * Holographic Material Factory
 */
function createHolographicMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: holographicVertexShader,
        fragmentShader: holographicFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x00ffff) },
            uTexture: { value: portraitTexture },
            uAudioBass: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioTreble: { value: 0 },
            uAudioVolume: { value: 0 },
            uAudioBeat: { value: 0 },
            uFaceTexture: { value: null },
            uHasFace: { value: 0 },
            // Expresiones
            uSmile: { value: 0 },
            uMouthOpen: { value: 0 },
            uEyebrowRaise: { value: 0 }
        },
        transparent: true,
        side: THREE.DoubleSide
    })
}

/**
 * Face Tracking, Audio & Particles
 */
const faceTracker = new FaceTracker()
const audioAnalyzer = new AudioAnalyzer()

let trackingEnabled = false
let audioEnabled = false
let videoTexture = null
let particleSystem = null
let particlesEnabled = true // Toggle para partículas

// Expression data
let expressionData = {
    smile: 0,
    mouthOpen: 0,
    eyebrowRaise: 0,
    eyebrowFrown: 0,
    leftEyeOpen: 1,
    rightEyeOpen: 1
}

// Head pose data
let headPoseData = {
    pitch: 0,
    yaw: 0,
    roll: 0
}

// UI Button
const initButton = document.createElement('button')
initButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
        <path d="M8 5v14l11-7z" fill="currentColor"/>
    </svg>
    <span>Play</span>
`
initButton.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    padding: 12px 24px;
    background: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    z-index: 1000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    color: #030303;
`
initButton.onmouseover = () => {
    initButton.style.background = '#f0f0f0'
    initButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
}
initButton.onmouseout = () => {
    initButton.style.background = 'white'
    initButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
}
document.body.appendChild(initButton)

// Botón toggle partículas
// const particleToggle = document.createElement('button')
// particleToggle.innerHTML = ' Particles: ON'
// particleToggle.style.cssText = `
//     position: fixed;
//     top: 70px;
//     left: 20px;
//     padding: 8px 16px;
//     background: rgba(255, 215, 0, 0.9);
//     border: none;
//     border-radius: 4px;
//     font-size: 12px;
//     cursor: pointer;
//     z-index: 1000;
//     font-family: system-ui;
//     display: none;
// `
// document.body.appendChild(particleToggle)

// particleToggle.addEventListener('click', () => {
//     particlesEnabled = !particlesEnabled
//     particleToggle.innerHTML = particlesEnabled ? '✨ Particles: ON' : '✨ Particles: OFF'
//     particleToggle.style.background = particlesEnabled ? 'rgba(255, 215, 0, 0.9)' : 'rgba(100, 100, 100, 0.9)'
    
//     if (particleSystem) {
//         particleSystem.getMesh().visible = particlesEnabled
//     }
// })  

initButton.addEventListener('click', async () => {
    if (trackingEnabled || audioEnabled) {
        animationActive = !animationActive
        if (animationActive) {
            initButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
                    <rect x="6" y="5" width="4" height="14" fill="currentColor"/>
                    <rect x="14" y="5" width="4" height="14" fill="currentColor"/>
                </svg>
                <span>Pause</span>
            `
            lastEffectChange = clock.getElapsedTime()
        } else {
            initButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
                    <path d="M8 5v14l11-7z" fill="currentColor"/>
                </svg>
                <span>Play</span>
            `
        }
        return
    }
    
    initButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Iniciando...</span>
    `
    initButton.disabled = true
    
    const faceSuccess = await faceTracker.initialize()
    const audioSuccess = await audioAnalyzer.initialize()
    
    trackingEnabled = faceSuccess
    audioEnabled = audioSuccess
    
    // Crear textura de video
    if (faceSuccess) {
        const videoElement = faceTracker.getVideoElement()
        if (videoElement) {
            videoTexture = new THREE.VideoTexture(videoElement)
            videoTexture.minFilter = THREE.LinearFilter
            videoTexture.magFilter = THREE.LinearFilter
        }
    }
    
    // Inicializar sistema de partículas GPU
    try {
        particleSystem = new GPUParticleSystem(renderer, {
            particleCount: 16384 // 128x128 = 16k particles
        })
        scene.add(particleSystem.getMesh())
        particleToggle.style.display = 'block'
        console.log('%c✨ GPU Particle System initialized', 'color: #ffd43b; font-weight: bold')
    } catch (error) {
        console.warn('GPU Particles not supported:', error)
        particlesEnabled = false
    }
    
    if (faceSuccess || audioSuccess) {
        animationActive = true
        initButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
                <rect x="6" y="5" width="4" height="14" fill="currentColor"/>
                <rect x="14" y="5" width="4" height="14" fill="currentColor"/>
            </svg>
            <span>Pause</span>
        `
        initButton.style.background = 'white'
        initButton.style.color = '#030303'
        initButton.disabled = false
        lastEffectChange = clock.getElapsedTime()
        

    } else {
        initButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;">
                <path d="M8 5v14l11-7z" fill="currentColor"/>
            </svg>
            <span>Error - Reintentar</span>
        `
        initButton.style.background = '#ff4444'
        initButton.style.color = 'white'
        initButton.disabled = false
    }
})

/**
 * Pattern Configuration
 */
const patternNames = {
    [-1]: 'Rest Mode',
    0: 'Distance Circles',
    1: 'Color Grid',
    2: 'Concentric Rings',
    3: 'Truchet Tiles',
    4: 'Noise Waves',
    6: 'Psychedelic Checker',
    7: 'Face Kaleidoscope',
    11: 'Voronoi Cells',
    12: 'Flow Field',
    13: 'Torus Field',
    14: 'Fibonacci Spiral',
    15: 'Vesica Piscis',
    16: 'Expression Aura',
    17: 'Emotion Particles',
    100: 'Holographic'
}

// Incluye patrones 16-17 que reaccionan directamente a expresiones faciales
const availablePatterns = [0, 1, 2, 3, 4, 6, 7, 11, 12, 13, 14, 15, 16, 17]
const REST_MODE_INDEX = -1

function getRandomPattern(excludeCurrent = true) {
    let availableChoices = [...availablePatterns]
    if (excludeCurrent && availableChoices.length > 1) {
        availableChoices = availableChoices.filter(p => p !== currentPatternIndex)
    }
    
    availableChoices.push(100)
    
    const shouldRest = Math.random() < 0.15
    if (shouldRest && currentPatternIndex !== REST_MODE_INDEX) {
        return REST_MODE_INDEX
    }
    
    const randomIndex = Math.floor(Math.random() * availableChoices.length)
    return availableChoices[randomIndex]
}

const patternDisplay = document.createElement('div')
patternDisplay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    font-size: 14px;
    color: #fff;
    z-index: 1000;
    font-family: system-ui;
    transition: all 0.3s;
`
document.body.appendChild(patternDisplay)

// Expression display
const expressionDisplay = document.createElement('div')
expressionDisplay.style.cssText = `
    position: fixed;
    top: 120px;
    left: 20px;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    font-size: 11px;
    color: #0f0;
    z-index: 1000;
    font-family: monospace;
    display: none;
    white-space: pre;
`
document.body.appendChild(expressionDisplay)

/**
 * Meshes
 */
const currentMesh = new THREE.Mesh(geometry, getMaterialForPattern(REST_MODE_INDEX))
const nextMesh = new THREE.Mesh(geometry, createPatternMaterial(0))
currentMesh.position.z = 0.001
scene.add(currentMesh)
scene.add(nextMesh)

/**
 * Effect rotation system
 */
let currentPatternIndex = REST_MODE_INDEX
let nextPatternIndex = 0
let animationActive = false
let lastEffectChange = 0
let transitionProgress = 0
let isTransitioning = false

const EFFECT_DURATION = 6
const TRANSITION_DURATION = 1.2

function getMaterialForPattern(patternIndex) {
    if (patternIndex === REST_MODE_INDEX) {
        return new THREE.MeshBasicMaterial({
            map: portraitTexture,
            transparent: true,
            side: THREE.DoubleSide
        })
    } else if (patternIndex === 100) {
        return createHolographicMaterial()
    } else {
        return createPatternMaterial(patternIndex)
    }
}

function getPatternName(patternIndex) {
    return patternNames[patternIndex] || `Pattern ${patternIndex}`
}

function startTransition() {
    isTransitioning = true
    transitionProgress = 0
    
    nextPatternIndex = getRandomPattern(true)
    
    const nextMaterial = getMaterialForPattern(nextPatternIndex)
    nextMesh.material = nextMaterial
    nextMesh.material.opacity = 0
    
    const currentName = getPatternName(currentPatternIndex)
    const nextName = getPatternName(nextPatternIndex)
    patternDisplay.textContent = `${currentName} → ${nextName}`
    patternDisplay.style.background = 'rgba(100, 50, 150, 0.8)'
}

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const updateResolution = (mesh) => {
        if (mesh.material.uniforms && mesh.material.uniforms.uResolution) {
            mesh.material.uniforms.uResolution.value.set(sizes.width, sizes.height)
        }
    }
    updateResolution(currentMesh)
    updateResolution(nextMesh)
})

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 0, 1.5)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x000000, 1)

/**
 * Update material uniforms - Now includes expressions and head pose
 */
function updateMaterialUniforms(material, elapsedTime, audioData, faceTexture, expressions, headPose) {
    if (!material.uniforms) return
    
    const u = material.uniforms
    
    if (u.uTime) u.uTime.value = elapsedTime
    
    // Audio
    if (u.uAudioBass) u.uAudioBass.value = audioData.smoothBass
    if (u.uAudioMid) u.uAudioMid.value = audioData.smoothMid
    if (u.uAudioTreble) u.uAudioTreble.value = audioData.smoothTreble
    if (u.uAudioVolume) u.uAudioVolume.value = audioData.volume
    if (u.uAudioBeat) u.uAudioBeat.value = audioData.beat
    if (u.uAudioSpectralCentroid) u.uAudioSpectralCentroid.value = audioData.spectralCentroid
    if (u.uAudioSpectralFlux) u.uAudioSpectralFlux.value = audioData.spectralFlux
    if (u.uAudioSubBass) u.uAudioSubBass.value = audioData.subBass
    if (u.uAudioLowBass) u.uAudioLowBass.value = audioData.lowBass
    if (u.uAudioPresence) u.uAudioPresence.value = audioData.presence
    if (u.uAudioBrilliance) u.uAudioBrilliance.value = audioData.brilliance
    
    // Mood
    if (u.uMoodColor1 && audioData.moodColor1) {
        u.uMoodColor1.value.set(audioData.moodColor1[0], audioData.moodColor1[1], audioData.moodColor1[2])
    }
    if (u.uMoodColor2 && audioData.moodColor2) {
        u.uMoodColor2.value.set(audioData.moodColor2[0], audioData.moodColor2[1], audioData.moodColor2[2])
    }
    if (u.uMoodColor3 && audioData.moodColor3) {
        u.uMoodColor3.value.set(audioData.moodColor3[0], audioData.moodColor3[1], audioData.moodColor3[2])
    }
    if (u.uMoodIntensity) u.uMoodIntensity.value = audioData.moodIntensity
    
    // Face texture
    if (u.uFaceTexture && faceTexture) {
        u.uFaceTexture.value = faceTexture
        u.uHasFace.value = 1
    }
    
    // Expressions
    if (u.uSmile) u.uSmile.value = expressions.smile
    if (u.uMouthOpen) u.uMouthOpen.value = expressions.mouthOpen
    if (u.uEyebrowRaise) u.uEyebrowRaise.value = expressions.eyebrowRaise
    if (u.uEyebrowFrown) u.uEyebrowFrown.value = expressions.eyebrowFrown
    if (u.uLeftEyeOpen) u.uLeftEyeOpen.value = expressions.leftEyeOpen
    if (u.uRightEyeOpen) u.uRightEyeOpen.value = expressions.rightEyeOpen
    
    // Head pose
    if (u.uHeadPitch) u.uHeadPitch.value = headPose.pitch
    if (u.uHeadYaw) u.uHeadYaw.value = headPose.yaw
    if (u.uHeadRoll) u.uHeadRoll.value = headPose.roll
    
    // Video
    if (u.uVideoTexture && videoTexture) {
        u.uVideoTexture.value = videoTexture
        u.uHasVideo.value = 1
    }
}

/**
 * Smoothed values
 */
let smoothedScale = 1.0
let smoothedRotation = 0.0
const scaleSmoothingFactor = 0.08
const rotationSmoothingFactor = 0.1

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // Get face tracking data
    let facePos = { x: 0, y: 0, scale: 1 }
    if (trackingEnabled) {
        facePos = faceTracker.getPosition()
        
        // Get expressions
        const rawExpressions = faceTracker.getExpressions()
        expressionData = {
            smile: rawExpressions.smile || 0,
            mouthOpen: rawExpressions.mouthOpen || 0,
            eyebrowRaise: rawExpressions.eyebrowRaise || 0,
            eyebrowFrown: rawExpressions.eyebrowFrown || 0,
            leftEyeOpen: rawExpressions.leftEyeOpen || 1,
            rightEyeOpen: rawExpressions.rightEyeOpen || 1
        }
        
        // Get head pose
        const rawPose = faceTracker.getHeadPose()
        headPoseData = {
            pitch: rawPose.pitch || 0,
            yaw: rawPose.yaw || 0,
            roll: rawPose.roll || 0
        }
        
        // Show expression display
        // if (faceTracker.isFaceDetected()) {
        //     expressionDisplay.style.display = 'block'
        //     const bar = (v) => {
        //         const filled = Math.round(Math.abs(v) * 10)
        //         return '█'.repeat(Math.min(filled, 10)) + '░'.repeat(10 - Math.min(filled, 10))
        //     }
        //     expressionDisplay.textContent = 
        //         ` Smile:  ${bar(expressionData.smile)} ${(expressionData.smile * 100).toFixed(0)}%\n` +
        //         ` Mouth:  ${bar(expressionData.mouthOpen)} ${(expressionData.mouthOpen * 100).toFixed(0)}%\n` +
        //         ` Brows:  ${bar(expressionData.eyebrowRaise)} ${(expressionData.eyebrowRaise * 100).toFixed(0)}%\n` +
        //         ` Eyes:   ${bar((expressionData.leftEyeOpen + expressionData.rightEyeOpen) / 2)}\n` +
        //         `↔ Yaw:    ${(headPoseData.yaw * 180 / Math.PI).toFixed(1)}°\n` +
        //         `↕Pitch:  ${(headPoseData.pitch * 180 / Math.PI).toFixed(1)}°`
        // } else {
        //     expressionDisplay.style.display = 'none'
        // }
    }

    // Get audio data
    let audioData = {
        bass: 0, mid: 0, treble: 0, volume: 0,
        smoothBass: 0, smoothMid: 0, smoothTreble: 0,
        beat: 0, spectralCentroid: 0, spectralFlux: 0,
        subBass: 0, lowBass: 0, presence: 0, brilliance: 0,
        energy: 0, kick: 0, mood: 'calm', moodIntensity: 0.5,
        moodColor1: [0.2, 0.3, 0.5],
        moodColor2: [0.4, 0.5, 0.6],
        moodColor3: [0.3, 0.4, 0.3]
    }
    if (audioEnabled) {
        audioData = audioAnalyzer.getFrequencies()
    }

    // Update particle system
    if (particleSystem && particlesEnabled) {
        particleSystem.setAudioData(audioData)
        particleSystem.setExpressionData(expressionData)
        particleSystem.setHeadPose(headPoseData)
        
        if (audioData.moodColor1 && audioData.moodColor2) {
            particleSystem.setMoodColors(audioData.moodColor1, audioData.moodColor2)
        }
        
        particleSystem.update(deltaTime, elapsedTime)
    }

    // Face tracking - smooth movement
    const faceInfluence = 0.4
    currentMesh.position.x = facePos.x * faceInfluence
    currentMesh.position.y = facePos.y * faceInfluence
    nextMesh.position.x = facePos.x * faceInfluence
    nextMesh.position.y = facePos.y * faceInfluence

    // Expression-based scaling
    // Mouth open = slightly bigger, smile = slight pulse
    const expressionScale = 1.0 + expressionData.mouthOpen * 0.05 + expressionData.smile * 0.03
    
    // Audio-based scaling
    const targetScale = expressionScale + audioData.smoothBass * 0.1 + audioData.beat * 0.06
    smoothedScale += (targetScale - smoothedScale) * scaleSmoothingFactor
    
    currentMesh.scale.set(smoothedScale, smoothedScale, 1)
    nextMesh.scale.set(smoothedScale, smoothedScale, 1)

    // Head-based rotation + audio
    const targetRotation = headPoseData.roll + audioData.smoothMid * 0.03
    smoothedRotation += (targetRotation - smoothedRotation) * rotationSmoothingFactor
    
    currentMesh.rotation.z = smoothedRotation
    nextMesh.rotation.z = smoothedRotation

    // Face texture
    let faceTexture = null
    if (trackingEnabled && faceTracker.hasFaceTexture()) {
        const faceCanvas = faceTracker.getFaceCanvas()
        faceTexture = new THREE.CanvasTexture(faceCanvas)
        faceTexture.needsUpdate = true
    }

    // Update uniforms
    updateMaterialUniforms(currentMesh.material, elapsedTime, audioData, faceTexture, expressionData, headPoseData)
    updateMaterialUniforms(nextMesh.material, elapsedTime, audioData, faceTexture, expressionData, headPoseData)

    // Handle transitions
    if (isTransitioning) {
        transitionProgress += deltaTime / TRANSITION_DURATION
        
        if (transitionProgress >= 1.0) {
            transitionProgress = 1.0
            isTransitioning = false
            
            const tempMaterial = currentMesh.material
            currentMesh.material = nextMesh.material
            nextMesh.material = tempMaterial
            
            currentMesh.material.opacity = 1.0
            nextMesh.material.opacity = 0.0
            
            currentPatternIndex = nextPatternIndex
            lastEffectChange = elapsedTime
            
            patternDisplay.textContent = getPatternName(currentPatternIndex)
            patternDisplay.style.background = currentPatternIndex === REST_MODE_INDEX 
                ? 'rgba(100, 100, 100, 0.7)' 
                : 'rgba(0, 0, 0, 0.7)'
        } else {
            const eased = transitionProgress * transitionProgress * (3.0 - 2.0 * transitionProgress)
            currentMesh.material.opacity = 1.0 - eased
            nextMesh.material.opacity = eased
        }
    } else {
        if (animationActive) {
            const currentDuration = currentPatternIndex === REST_MODE_INDEX ? 4 : EFFECT_DURATION
            if (elapsedTime - lastEffectChange > currentDuration) {
                startTransition()
            }
        }
        
        if (!patternDisplay.textContent.includes('→')) {
            patternDisplay.textContent = getPatternName(currentPatternIndex)
        }
    }

    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

// Initial display
patternDisplay.textContent = getPatternName(currentPatternIndex)

tick()
