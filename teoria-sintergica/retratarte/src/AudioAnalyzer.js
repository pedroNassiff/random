export class AudioAnalyzer {
    constructor() {
        this.audioContext = null
        this.analyser = null
        this.microphone = null
        this.dataArray = null
        this.bufferLength = 0
        this.isListening = false
        
        // Datos de frecuencias básicos
        this.bass = 0
        this.mid = 0
        this.treble = 0
        this.volume = 0
        
        // Bandas de frecuencia detalladas
        this.subBass = 0
        this.lowBass = 0
        this.lowMid = 0
        this.midRange = 0
        this.highMid = 0
        this.presence = 0
        this.brilliance = 0
        
        // Beat detection - MEJORADO
        this.beatHistory = new Float32Array(60) // ~1 segundo a 60fps
        this.beatHistoryIndex = 0
        this.beatThreshold = 1.6 // Más alto = menos sensible
        this.lastBeatTime = 0
        this.minBeatInterval = 280 // ms mínimo entre beats (más conservador)
        this.beat = 0
        this.beatDecay = 0.85 // Decay más rápido
        this.beatCount = 0 // Contador de beats para debug
        
        // Spectral features
        this.spectralCentroid = 0
        this.spectralFlux = 0
        this.previousSpectrum = null
        
        // Smoothed values - más suavizado
        this.smoothedBass = 0
        this.smoothedMid = 0
        this.smoothedTreble = 0
        this.smoothingFactor = 0.15 // Más suave (era 0.3)
        
        // Mood detection
        this.mood = 'calm'
        this.moodIntensity = 0
        this.moodHistory = []
        this.moodColors = [[0.2, 0.3, 0.5], [0.4, 0.5, 0.6], [0.3, 0.4, 0.3]]
        
        // Debug logging
        this.debugEnabled = true
        this.lastLogTime = 0
        this.logInterval = 500 // Log cada 500ms
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
            
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            })

            this.microphone = this.audioContext.createMediaStreamSource(stream)
            this.analyser = this.audioContext.createAnalyser()
            
            this.analyser.fftSize = 4096
            this.analyser.smoothingTimeConstant = 0.75
            
            this.bufferLength = this.analyser.frequencyBinCount
            this.dataArray = new Uint8Array(this.bufferLength)
            this.previousSpectrum = new Uint8Array(this.bufferLength)
            
            this.microphone.connect(this.analyser)
            
            this.isListening = true
            this.startAnalyzing()
            
            console.log('%c🎵 Audio Analyzer Initialized', 'color: #00ff00; font-weight: bold')
            console.log(`   FFT size: ${this.analyser.fftSize}`)
            console.log(`   Frequency bins: ${this.bufferLength}`)
            console.log(`   Sample rate: ${this.audioContext.sampleRate} Hz`)
            console.log(`   Beat threshold: ${this.beatThreshold}`)
            console.log(`   Min beat interval: ${this.minBeatInterval}ms`)
            
            return true
        } catch (error) {
            console.error('Error initializing audio:', error)
            return false
        }
    }

    binToFrequency(bin) {
        return bin * this.audioContext.sampleRate / this.analyser.fftSize
    }

    frequencyToBin(frequency) {
        return Math.round(frequency * this.analyser.fftSize / this.audioContext.sampleRate)
    }

    getFrequencyRange(lowFreq, highFreq) {
        const lowBin = this.frequencyToBin(lowFreq)
        const highBin = this.frequencyToBin(highFreq)
        
        let sum = 0
        let count = 0
        for (let i = lowBin; i <= highBin && i < this.bufferLength; i++) {
            sum += this.dataArray[i]
            count++
        }
        
        return count > 0 ? sum / count / 255 : 0
    }

    // Beat detection MEJORADO
    detectBeat() {
        // Usar principalmente sub-bass y bass para detectar kicks
        const energy = this.subBass * 1.5 + this.lowBass * 1.2 + this.lowMid * 0.3
        
        // Agregar al historial circular
        this.beatHistory[this.beatHistoryIndex] = energy
        this.beatHistoryIndex = (this.beatHistoryIndex + 1) % this.beatHistory.length
        
        // Calcular promedio y varianza del historial
        let sum = 0
        let validCount = 0
        for (let i = 0; i < this.beatHistory.length; i++) {
            if (this.beatHistory[i] > 0) {
                sum += this.beatHistory[i]
                validCount++
            }
        }
        
        // Necesitamos al menos la mitad del buffer lleno
        if (validCount < this.beatHistory.length / 2) {
            this.beat *= this.beatDecay
            return false
        }
        
        const avgEnergy = sum / validCount
        
        let varianceSum = 0
        for (let i = 0; i < this.beatHistory.length; i++) {
            if (this.beatHistory[i] > 0) {
                varianceSum += Math.pow(this.beatHistory[i] - avgEnergy, 2)
            }
        }
        const variance = varianceSum / validCount
        const stdDev = Math.sqrt(variance)
        
        // Threshold dinámico - más conservador
        const dynamicThreshold = avgEnergy + stdDev * this.beatThreshold
        
        // También requerir un mínimo absoluto de energía
        const minEnergyForBeat = 0.15
        
        const now = performance.now()
        const timeSinceLastBeat = now - this.lastBeatTime
        
        // Detectar beat
        const isBeat = energy > dynamicThreshold && 
                       energy > minEnergyForBeat && 
                       timeSinceLastBeat > this.minBeatInterval
        
        if (isBeat) {
            this.lastBeatTime = now
            this.beat = 1.0
            this.beatCount++
            
            if (this.debugEnabled) {
                console.log(`%c🥁 BEAT #${this.beatCount}`, 'color: #ff6600; font-weight: bold', {
                    energy: energy.toFixed(3),
                    threshold: dynamicThreshold.toFixed(3),
                    avgEnergy: avgEnergy.toFixed(3),
                    stdDev: stdDev.toFixed(3),
                    timeSinceLast: `${timeSinceLastBeat.toFixed(0)}ms`
                })
            }
            return true
        }
        
        // Decay del beat
        this.beat *= this.beatDecay
        
        // Clamp a 0 si es muy bajo
        if (this.beat < 0.01) this.beat = 0
        
        return false
    }

    calculateSpectralCentroid() {
        let numerator = 0
        let denominator = 0
        
        for (let i = 0; i < this.bufferLength; i++) {
            const frequency = this.binToFrequency(i)
            numerator += frequency * this.dataArray[i]
            denominator += this.dataArray[i]
        }
        
        if (denominator === 0) return 0
        
        const centroidHz = numerator / denominator
        return Math.min(centroidHz / 10000, 1)
    }

    calculateSpectralFlux() {
        let flux = 0
        
        for (let i = 0; i < this.bufferLength; i++) {
            const diff = this.dataArray[i] - this.previousSpectrum[i]
            if (diff > 0) {
                flux += diff
            }
        }
        
        for (let i = 0; i < this.bufferLength; i++) {
            this.previousSpectrum[i] = this.dataArray[i]
        }
        
        return flux / this.bufferLength / 255
    }

    detectMood() {
        let detectedMood = 'calm'
        
        if (this.beat > 0.5 && this.lowBass > 0.4) {
            detectedMood = 'energetic'
        } else if (this.spectralCentroid > 0.5 && this.volume > 0.2) {
            detectedMood = 'bright'
        } else if (this.subBass > 0.35 && this.midRange < 0.2) {
            detectedMood = 'deep'
        } else if (this.volume < 0.05) {
            detectedMood = 'silent'
        } else if (this.spectralFlux > 0.12) {
            detectedMood = 'chaotic'
        } else if (this.midRange > 0.25 && this.presence > 0.15) {
            detectedMood = 'harmonic'
        }
        
        this.moodHistory.push(detectedMood)
        if (this.moodHistory.length > 45) this.moodHistory.shift() // Más historial
        
        const moodCounts = {}
        this.moodHistory.forEach(m => moodCounts[m] = (moodCounts[m] || 0) + 1)
        const entries = Object.entries(moodCounts)
        entries.sort((a, b) => b[1] - a[1])
        
        const newMood = entries[0][0]
        
        // Solo cambiar mood si es muy diferente
        if (newMood !== this.mood) {
            const confidence = entries[0][1] / this.moodHistory.length
            if (confidence > 0.4) { // 40% de confianza mínima
                this.mood = newMood
            }
        }
        
        const intensities = {
            'calm': 0.3,
            'energetic': 1.0,
            'bright': 0.7,
            'deep': 0.5,
            'silent': 0.1,
            'chaotic': 0.9,
            'harmonic': 0.6
        }
        this.moodIntensity = intensities[this.mood] || 0.5
        
        const palettes = {
            'calm': [[0.2, 0.3, 0.5], [0.4, 0.5, 0.6], [0.3, 0.4, 0.3]],
            'energetic': [[1.0, 0.2, 0.3], [1.0, 0.6, 0.0], [1.0, 1.0, 0.2]],
            'bright': [[0.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0]],
            'deep': [[0.1, 0.0, 0.2], [0.0, 0.1, 0.3], [0.2, 0.0, 0.1]],
            'silent': [[0.1, 0.1, 0.1], [0.2, 0.2, 0.2], [0.15, 0.15, 0.18]],
            'chaotic': [[0.8, 0.2, 0.5], [0.2, 0.8, 0.5], [0.5, 0.2, 0.8]],
            'harmonic': [[0.3, 0.5, 0.7], [0.5, 0.7, 0.5], [0.7, 0.5, 0.3]]
        }
        this.moodColors = palettes[this.mood] || palettes['calm']
    }

    // Log periódico del estado del audio
    logAudioState() {
        const now = performance.now()
        if (now - this.lastLogTime < this.logInterval) return
        this.lastLogTime = now
        
        const barLength = 20
        const makeBar = (value) => {
            const filled = Math.round(value * barLength)
            return '█'.repeat(filled) + '░'.repeat(barLength - filled)
        }
        
        console.log(
            `%c📊 Audio State`,
            'color: #00aaff; font-weight: bold',
            `\n   Volume:  ${makeBar(this.volume)} ${(this.volume * 100).toFixed(0)}%` +
            `\n   Bass:    ${makeBar(this.bass)} ${(this.bass * 100).toFixed(0)}%` +
            `\n   Mid:     ${makeBar(this.mid)} ${(this.mid * 100).toFixed(0)}%` +
            `\n   Treble:  ${makeBar(this.treble)} ${(this.treble * 100).toFixed(0)}%` +
            `\n   Beat:    ${makeBar(this.beat)} ${(this.beat * 100).toFixed(0)}%` +
            `\n   Centroid: ${this.spectralCentroid.toFixed(2)} | Flux: ${this.spectralFlux.toFixed(2)}` +
            `\n   Mood: ${this.mood} (${(this.moodIntensity * 100).toFixed(0)}%)`
        )
    }

    startAnalyzing() {
        const analyze = () => {
            if (!this.isListening) return

            this.analyser.getByteFrequencyData(this.dataArray)
            
            // Bandas de frecuencia detalladas
            this.subBass = this.getFrequencyRange(20, 60)
            this.lowBass = this.getFrequencyRange(60, 250)
            this.lowMid = this.getFrequencyRange(250, 500)
            this.midRange = this.getFrequencyRange(500, 2000)
            this.highMid = this.getFrequencyRange(2000, 4000)
            this.presence = this.getFrequencyRange(4000, 6000)
            this.brilliance = this.getFrequencyRange(6000, 16000)
            
            // Valores simplificados
            this.bass = (this.subBass + this.lowBass) / 2
            this.mid = (this.lowMid + this.midRange) / 2
            this.treble = (this.highMid + this.presence + this.brilliance) / 3
            
            // Volumen general (RMS-like)
            let sumSquares = 0
            for (let i = 0; i < this.bufferLength; i++) {
                const normalized = this.dataArray[i] / 255
                sumSquares += normalized * normalized
            }
            this.volume = Math.sqrt(sumSquares / this.bufferLength)
            
            // Valores suavizados (más suaves ahora)
            this.smoothedBass += (this.bass - this.smoothedBass) * this.smoothingFactor
            this.smoothedMid += (this.mid - this.smoothedMid) * this.smoothingFactor
            this.smoothedTreble += (this.treble - this.smoothedTreble) * this.smoothingFactor
            
            // Características espectrales
            this.spectralCentroid = this.calculateSpectralCentroid()
            this.spectralFlux = this.calculateSpectralFlux()
            
            // Beat detection
            this.detectBeat()
            
            // Mood detection
            this.detectMood()
            
            // Log periódico
            if (this.debugEnabled) {
                this.logAudioState()
            }
            
            requestAnimationFrame(analyze)
        }

        analyze()
    }

    // Activar/desactivar debug
    setDebug(enabled) {
        this.debugEnabled = enabled
        console.log(`Audio debug: ${enabled ? 'ON' : 'OFF'}`)
    }

    getFrequencies() {
        return {
            // Valores básicos
            bass: this.bass,
            mid: this.mid,
            treble: this.treble,
            volume: this.volume,
            
            // Valores suavizados
            smoothBass: this.smoothedBass,
            smoothMid: this.smoothedMid,
            smoothTreble: this.smoothedTreble,
            
            // Bandas detalladas
            subBass: this.subBass,
            lowBass: this.lowBass,
            lowMid: this.lowMid,
            midRange: this.midRange,
            highMid: this.highMid,
            presence: this.presence,
            brilliance: this.brilliance,
            
            // Beat detection
            beat: this.beat,
            isBeat: this.beat > 0.8,
            
            // Características espectrales
            spectralCentroid: this.spectralCentroid,
            spectralFlux: this.spectralFlux,
            
            // Valores derivados
            energy: (this.bass + this.mid + this.treble) / 3,
            bassBoost: Math.pow(this.bass, 1.5),
            kick: this.beat > 0.8 ? 1 : 0,
            
            // Mood
            mood: this.mood,
            moodIntensity: this.moodIntensity,
            moodColor1: this.moodColors[0],
            moodColor2: this.moodColors[1],
            moodColor3: this.moodColors[2]
        }
    }

    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.dataArray)
        return this.dataArray
    }
    
    getWaveformData() {
        const waveformArray = new Uint8Array(this.analyser.fftSize)
        this.analyser.getByteTimeDomainData(waveformArray)
        return waveformArray
    }

    dispose() {
        this.isListening = false
        if (this.microphone) {
            this.microphone.disconnect()
        }
        if (this.analyser) {
            this.analyser.disconnect()
        }
        if (this.audioContext) {
            this.audioContext.close()
        }
    }
}
