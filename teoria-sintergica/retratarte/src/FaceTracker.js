import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'

/**
 * FaceTracker Avanzado con MediaPipe Face Mesh
 * 
 * Características:
 * - 468 landmarks faciales en tiempo real
 * - Detección de expresiones (sonrisa, cejas, boca, ojos)
 * - Pose de la cabeza (pitch, yaw, roll)
 * - Captura de rostro para texturas
 */
export class FaceTracker {
    constructor() {
        this.video = null
        this.canvas = null
        this.ctx = null
        this.faceMesh = null
        this.camera = null
        this.isTracking = false
        
        // Landmarks crudos (468 puntos)
        this.landmarks = null
        this.rawLandmarks = null
        
        // Posición suavizada
        this.facePosition = { x: 0, y: 0, scale: 1 }
        this.targetPosition = { x: 0, y: 0, scale: 1 }
        this.smoothFactor = 0.15
        
        // Expresiones faciales (0-1)
        this.expressions = {
            smile: 0,           // Sonrisa
            mouthOpen: 0,       // Boca abierta
            eyebrowRaise: 0,    // Cejas levantadas
            eyebrowFrown: 0,    // Ceño fruncido
            leftEyeOpen: 1,     // Ojo izquierdo abierto
            rightEyeOpen: 1,    // Ojo derecho abierto
            leftEyeSquint: 0,   // Ojo izquierdo entrecerrado
            rightEyeSquint: 0,  // Ojo derecho entrecerrado
            jawOpen: 0,         // Mandíbula abierta
            lipsPucker: 0,      // Labios fruncidos
        }
        
        // Expresiones suavizadas
        this.smoothedExpressions = { ...this.expressions }
        this.expressionSmoothFactor = 0.2
        
        // Pose de la cabeza (radianes)
        this.headPose = {
            pitch: 0,   // Arriba/abajo (asentir)
            yaw: 0,     // Izquierda/derecha (negar)
            roll: 0     // Inclinación lateral
        }
        this.smoothedHeadPose = { ...this.headPose }
        this.headPoseSmoothFactor = 0.1
        
        // Captura de rostro
        this.faceCanvas = null
        this.faceCtx = null
        this.lastCaptureTime = 0
        this.captureInterval = 2000
        
        // Estados
        this.faceDetected = false
        this.initialized = false
        
        // Debug
        this.debugEnabled = true
        this.lastDebugTime = 0
        this.debugInterval = 1000
    }

    async initialize() {
        try {
            console.log('%c🎭 Initializing MediaPipe Face Mesh...', 'color: #ff6b6b; font-weight: bold')
            
            // Crear video oculto
            this.video = document.createElement('video')
            this.video.style.display = 'none'
            this.video.playsInline = true
            document.body.appendChild(this.video)
            
            // Canvas para debug (opcional)
            this.canvas = document.createElement('canvas')
            this.canvas.width = 640
            this.canvas.height = 480
            this.canvas.style.display = 'none'
            this.ctx = this.canvas.getContext('2d')
            document.body.appendChild(this.canvas)
            
            // Canvas para captura de rostro
            this.faceCanvas = document.createElement('canvas')
            this.faceCanvas.width = 256
            this.faceCanvas.height = 256
            this.faceCtx = this.faceCanvas.getContext('2d')
            
            // Inicializar MediaPipe Face Mesh
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                }
            })
            
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,  // Incluye iris y labios detallados
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            })
            
            this.faceMesh.onResults(this.onResults.bind(this))
            
            // Inicializar cámara
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.faceMesh && this.isTracking) {
                        await this.faceMesh.send({ image: this.video })
                    }
                },
                width: 640,
                height: 480
            })
            
            await this.camera.start()
            
            this.isTracking = true
            this.initialized = true
            
            console.log('%c✓ Face Mesh initialized with 468 landmarks', 'color: #51cf66; font-weight: bold')
            console.log('   Expressions tracking: smile, mouth, eyebrows, eyes')
            console.log('   Head pose tracking: pitch, yaw, roll')
            
            return true
        } catch (error) {
            console.error('Error initializing Face Mesh:', error)
            return false
        }
    }

    onResults(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            this.faceDetected = false
            return
        }
        
        this.faceDetected = true
        this.rawLandmarks = results.multiFaceLandmarks[0]
        this.landmarks = this.rawLandmarks
        
        // Calcular posición del rostro
        this.calculateFacePosition()
        
        // Calcular expresiones
        this.calculateExpressions()
        
        // Calcular pose de la cabeza
        this.calculateHeadPose()
        
        // Suavizar valores
        this.smoothValues()
        
        // Capturar rostro periódicamente
        const now = Date.now()
        if (now - this.lastCaptureTime > this.captureInterval) {
            this.captureFace()
            this.lastCaptureTime = now
        }
        
        // Debug logging
        if (this.debugEnabled && now - this.lastDebugTime > this.debugInterval) {
            this.logDebugInfo()
            this.lastDebugTime = now
        }
    }

    calculateFacePosition() {
        if (!this.landmarks) return
        
        // Usar el centro de la cara (punta de la nariz como referencia)
        const nose = this.landmarks[4] // Punta de la nariz
        
        // Normalizar a -1 a 1
        this.targetPosition.x = (nose.x - 0.5) * -2 // Invertir X para efecto espejo
        this.targetPosition.y = (nose.y - 0.5) * -2
        
        // Calcular escala basada en distancia entre ojos
        const leftEye = this.landmarks[33]
        const rightEye = this.landmarks[263]
        const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) + 
            Math.pow(rightEye.y - leftEye.y, 2)
        )
        this.targetPosition.scale = eyeDistance * 5 // Normalizar
    }

    calculateExpressions() {
        if (!this.landmarks) return
        
        const lm = this.landmarks
        
        // ==========================================
        // SONRISA - distancia entre comisuras de labios
        // ==========================================
        const leftMouth = lm[61]   // Comisura izquierda
        const rightMouth = lm[291] // Comisura derecha
        const upperLip = lm[13]    // Centro labio superior
        const lowerLip = lm[14]    // Centro labio inferior
        
        const mouthWidth = this.distance(leftMouth, rightMouth)
        const mouthHeight = this.distance(upperLip, lowerLip)
        
        // La sonrisa agranda horizontalmente la boca
        // Ratio típico en reposo: ~0.5, sonriendo: ~0.7+
        const smileRatio = mouthWidth / (mouthHeight + 0.001)
        this.expressions.smile = this.clamp((smileRatio - 3) / 4, 0, 1)
        
        // ==========================================
        // BOCA ABIERTA
        // ==========================================
        // Distancia vertical entre labios normalizada
        const jawTop = lm[0]     // Parte superior del mentón
        const jawBottom = lm[17] // Parte inferior del mentón
        const faceHeight = this.distance(lm[10], lm[152]) // Frente a mentón
        
        this.expressions.mouthOpen = this.clamp(mouthHeight / (faceHeight * 0.15), 0, 1)
        this.expressions.jawOpen = this.expressions.mouthOpen
        
        // ==========================================
        // CEJAS - altura relativa a los ojos
        // ==========================================
        // Ceja izquierda
        const leftBrowInner = lm[107]
        const leftBrowOuter = lm[70]
        const leftEyeTop = lm[159]
        
        // Ceja derecha
        const rightBrowInner = lm[336]
        const rightBrowOuter = lm[300]
        const rightEyeTop = lm[386]
        
        // Distancia ceja-ojo (normalizada)
        const leftBrowHeight = (leftEyeTop.y - leftBrowInner.y) / faceHeight
        const rightBrowHeight = (rightEyeTop.y - rightBrowInner.y) / faceHeight
        const avgBrowHeight = (leftBrowHeight + rightBrowHeight) / 2
        
        // Cejas levantadas (sorpresa)
        this.expressions.eyebrowRaise = this.clamp((avgBrowHeight - 0.04) * 15, 0, 1)
        
        // Ceño fruncido (distancia entre cejas internas)
        const browDistance = this.distance(leftBrowInner, rightBrowInner)
        const normalBrowDistance = this.distance(lm[33], lm[263]) * 0.3 // Referencia
        this.expressions.eyebrowFrown = this.clamp(1 - (browDistance / normalBrowDistance), 0, 1)
        
        // ==========================================
        // OJOS - apertura
        // ==========================================
        // Ojo izquierdo
        const leftEyeUpper = lm[159]
        const leftEyeLower = lm[145]
        const leftEyeHeight = this.distance(leftEyeUpper, leftEyeLower)
        const leftEyeWidth = this.distance(lm[33], lm[133])
        
        // Ojo derecho
        const rightEyeUpper = lm[386]
        const rightEyeLower = lm[374]
        const rightEyeHeight = this.distance(rightEyeUpper, rightEyeLower)
        const rightEyeWidth = this.distance(lm[362], lm[263])
        
        // Ratio altura/ancho del ojo (cerrado ~0.1, abierto ~0.3)
        const leftEyeRatio = leftEyeHeight / (leftEyeWidth + 0.001)
        const rightEyeRatio = rightEyeHeight / (rightEyeWidth + 0.001)
        
        this.expressions.leftEyeOpen = this.clamp(leftEyeRatio * 4, 0, 1)
        this.expressions.rightEyeOpen = this.clamp(rightEyeRatio * 4, 0, 1)
        
        // Ojos entrecerrados (squint) - opuesto a apertura máxima
        this.expressions.leftEyeSquint = this.clamp(1 - this.expressions.leftEyeOpen - 0.3, 0, 1)
        this.expressions.rightEyeSquint = this.clamp(1 - this.expressions.rightEyeOpen - 0.3, 0, 1)
        
        // ==========================================
        // LABIOS FRUNCIDOS (pucker/kiss)
        // ==========================================
        // Cuando los labios se fruncen, se hacen más pequeños y redondos
        const lipRatio = mouthWidth / (mouthHeight + 0.001)
        this.expressions.lipsPucker = this.clamp((3 - lipRatio) / 2, 0, 1)
    }

    calculateHeadPose() {
        if (!this.landmarks) return
        
        const lm = this.landmarks
        
        // Puntos de referencia para la pose
        const nose = lm[4]           // Punta de la nariz
        const leftEye = lm[33]       // Ojo izquierdo
        const rightEye = lm[263]     // Ojo derecho
        const forehead = lm[10]      // Frente
        const chin = lm[152]         // Mentón
        
        // ==========================================
        // YAW (rotación izquierda/derecha)
        // ==========================================
        // Basado en la posición relativa de la nariz entre los ojos
        const eyeCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        }
        const noseOffset = nose.x - eyeCenter.x
        this.headPose.yaw = noseOffset * Math.PI * 2 // Aproximación
        
        // ==========================================
        // PITCH (rotación arriba/abajo)
        // ==========================================
        // Basado en la posición vertical de la nariz relativa a frente y mentón
        const faceHeight = chin.y - forehead.y
        const noseVerticalRatio = (nose.y - forehead.y) / faceHeight
        // En reposo ~0.45, mirando arriba <0.4, mirando abajo >0.5
        this.headPose.pitch = (noseVerticalRatio - 0.45) * Math.PI
        
        // ==========================================
        // ROLL (inclinación lateral)
        // ==========================================
        // Basado en la línea entre los ojos
        const eyeAngle = Math.atan2(
            rightEye.y - leftEye.y,
            rightEye.x - leftEye.x
        )
        this.headPose.roll = eyeAngle
    }

    smoothValues() {
        // Suavizar posición
        this.facePosition.x += (this.targetPosition.x - this.facePosition.x) * this.smoothFactor
        this.facePosition.y += (this.targetPosition.y - this.facePosition.y) * this.smoothFactor
        this.facePosition.scale += (this.targetPosition.scale - this.facePosition.scale) * this.smoothFactor
        
        // Suavizar expresiones
        for (const key in this.expressions) {
            this.smoothedExpressions[key] += 
                (this.expressions[key] - this.smoothedExpressions[key]) * this.expressionSmoothFactor
        }
        
        // Suavizar pose
        for (const key in this.headPose) {
            this.smoothedHeadPose[key] += 
                (this.headPose[key] - this.smoothedHeadPose[key]) * this.headPoseSmoothFactor
        }
    }

    captureFace() {
        if (!this.video || !this.landmarks) return
        
        // Calcular bounding box del rostro
        let minX = 1, maxX = 0, minY = 1, maxY = 0
        
        for (const point of this.landmarks) {
            minX = Math.min(minX, point.x)
            maxX = Math.max(maxX, point.x)
            minY = Math.min(minY, point.y)
            maxY = Math.max(maxY, point.y)
        }
        
        // Agregar padding
        const padding = 0.15
        minX = Math.max(0, minX - padding)
        maxX = Math.min(1, maxX + padding)
        minY = Math.max(0, minY - padding)
        maxY = Math.min(1, maxY + padding)
        
        // Convertir a píxeles
        const sx = minX * this.video.videoWidth
        const sy = minY * this.video.videoHeight
        const sw = (maxX - minX) * this.video.videoWidth
        const sh = (maxY - minY) * this.video.videoHeight
        
        // Hacer cuadrado
        const size = Math.max(sw, sh)
        const cx = sx + sw / 2
        const cy = sy + sh / 2
        
        // Dibujar en canvas de captura
        this.faceCtx.fillStyle = '#000'
        this.faceCtx.fillRect(0, 0, 256, 256)
        
        this.faceCtx.drawImage(
            this.video,
            cx - size / 2, cy - size / 2, size, size,
            0, 0, 256, 256
        )
        
        console.log('%c📸 Face captured', 'color: #74c0fc')
    }

    // ==========================================
    // UTILIDADES
    // ==========================================
    
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) +
            Math.pow((p2.z || 0) - (p1.z || 0), 2)
        )
    }
    
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value))
    }

    logDebugInfo() {
        const exp = this.smoothedExpressions
        const pose = this.smoothedHeadPose
        
        const bar = (v) => {
            const filled = Math.round(v * 10)
            return '█'.repeat(filled) + '░'.repeat(10 - filled)
        }
        
        console.log(
            '%c🎭 Face Tracking',
            'color: #ff6b6b; font-weight: bold',
            `\n   😊 Smile:     ${bar(exp.smile)} ${(exp.smile * 100).toFixed(0)}%` +
            `\n   😮 Mouth:     ${bar(exp.mouthOpen)} ${(exp.mouthOpen * 100).toFixed(0)}%` +
            `\n   🤨 Brow Up:   ${bar(exp.eyebrowRaise)} ${(exp.eyebrowRaise * 100).toFixed(0)}%` +
            `\n   😠 Brow Down: ${bar(exp.eyebrowFrown)} ${(exp.eyebrowFrown * 100).toFixed(0)}%` +
            `\n   👁️ L Eye:     ${bar(exp.leftEyeOpen)} ${(exp.leftEyeOpen * 100).toFixed(0)}%` +
            `\n   👁️ R Eye:     ${bar(exp.rightEyeOpen)} ${(exp.rightEyeOpen * 100).toFixed(0)}%` +
            `\n   Head Yaw:   ${(pose.yaw * 180 / Math.PI).toFixed(1)}°` +
            `\n   Head Pitch: ${(pose.pitch * 180 / Math.PI).toFixed(1)}°` +
            `\n   Head Roll:  ${(pose.roll * 180 / Math.PI).toFixed(1)}°`
        )
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    getPosition() {
        return {
            x: this.facePosition.x,
            y: this.facePosition.y,
            scale: this.facePosition.scale
        }
    }

    getExpressions() {
        return { ...this.smoothedExpressions }
    }

    getHeadPose() {
        return { ...this.smoothedHeadPose }
    }

    getLandmarks() {
        return this.landmarks
    }

    getFaceCanvas() {
        return this.faceCanvas
    }

    hasFaceTexture() {
        return this.faceCanvas && this.lastCaptureTime > 0
    }

    isFaceDetected() {
        return this.faceDetected
    }

    getVideoElement() {
        return this.video
    }

    setDebug(enabled) {
        this.debugEnabled = enabled
    }

    dispose() {
        this.isTracking = false
        if (this.camera) {
            this.camera.stop()
        }
        if (this.faceMesh) {
            this.faceMesh.close()
        }
        if (this.video) {
            this.video.remove()
        }
        if (this.canvas) {
            this.canvas.remove()
        }
    }
}
