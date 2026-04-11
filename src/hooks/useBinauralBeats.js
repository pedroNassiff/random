/**
 * useBinauralBeats — Web Audio API hook para frecuencias sintérgicas.
 *
 * Genera beats binaurales: cada oído recibe una frecuencia ligeramente distinta.
 * El cerebro percibe la diferencia como "beat" en la frecuencia objetivo.
 * Requiere auriculares para efecto binaural real.
 *
 * Frecuencias según estado:
 *   delta  → 2 Hz   (sueño profundo)
 *   theta  → 6 Hz   (insight, hipnagógico)
 *   alpha  → 10 Hz  (meditación, calma alerta)  ← default
 *   beta   → 16 Hz  (concentración)
 *   gamma  → 40 Hz  (integración, insight súbito)
 *   schumann → 7.83 Hz (resonancia Schumann)
 */

import { useRef, useState, useCallback } from 'react'

// Frecuencia portadora — 400 Hz: rango óptimo para beats binaurales (300-440 Hz)
// A 200 Hz el tono base es demasiado grave y se percibe molesto en sesiones largas
const CARRIER_FREQ = 400  // Hz

// Fade durations para evitar clicks al iniciar/detener
const FADE_IN_SEC  = 2.0
const FADE_OUT_SEC = 1.0

const BEAT_PRESETS = {
  delta:    2,
  theta:    6,
  alpha:    10,
  beta:     16,
  gamma:    40,
  schumann: 7.83,
}

export function useBinauralBeats() {
  const ctxRef     = useRef(null)
  const leftRef    = useRef(null)
  const rightRef   = useRef(null)
  const mergerRef  = useRef(null)
  const gainRef    = useRef(null)
  const noiseRef   = useRef(null)
  const noiseGainRef = useRef(null)
  const [active, setActive]     = useState(false)
  const [preset, setPreset]     = useState('alpha')
  const [volume, setVolumeState] = useState(0.15)
  const volumeRef = useRef(0.15)

  const _init = () => {
    if (ctxRef.current) return ctxRef.current
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx

    // Channel merger: left → ch0, right → ch1
    const merger = ctx.createChannelMerger(2)
    mergerRef.current = merger

    const gain = ctx.createGain()
    gain.gain.value = volumeRef.current
    gainRef.current = gain

    merger.connect(gain)
    gain.connect(ctx.destination)

    return ctx
  }

  // Genera ruido rosa para enmascarar los tonos puros (opcional)
  const _startPinkNoise = (ctx) => {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const ng = ctx.createGain()
    ng.gain.value = 0.08  // muy sutil — solo para suavizar
    source.connect(ng)
    ng.connect(gainRef.current)
    source.start()
    noiseRef.current = source
    noiseGainRef.current = ng
  }

  const start = useCallback((targetPreset = 'alpha', { pinkNoise = false } = {}) => {
    const ctx = _init()
    if (ctx.state === 'suspended') ctx.resume()

    // Stop any existing oscillators
    leftRef.current?.stop()
    rightRef.current?.stop()
    noiseRef.current?.stop()

    const beatFreq = BEAT_PRESETS[targetPreset] ?? BEAT_PRESETS.alpha

    // Left: carrier
    const left = ctx.createOscillator()
    left.type = 'sine'
    left.frequency.value = CARRIER_FREQ

    // Right: carrier + beat
    const right = ctx.createOscillator()
    right.type = 'sine'
    right.frequency.value = CARRIER_FREQ + beatFreq

    // Route to separate channels
    const leftGain  = ctx.createGain(); leftGain.gain.value = 1
    const rightGain = ctx.createGain(); rightGain.gain.value = 1

    left.connect(leftGain)
    right.connect(rightGain)
    leftGain.connect(mergerRef.current, 0, 0)   // left channel
    rightGain.connect(mergerRef.current, 0, 1)  // right channel

    // Fade in suave (evita clicks)
    gainRef.current.gain.setValueAtTime(0, ctx.currentTime)
    gainRef.current.gain.linearRampToValueAtTime(volumeRef.current, ctx.currentTime + FADE_IN_SEC)

    left.start()
    right.start()

    leftRef.current  = left
    rightRef.current = right

    // Pink noise opcional
    if (pinkNoise) _startPinkNoise(ctx)

    setActive(true)
    setPreset(targetPreset)
    console.log(`[Binaural] Started: ${CARRIER_FREQ} Hz ↔ ${CARRIER_FREQ + beatFreq} Hz → beat ${beatFreq} Hz (${targetPreset})${pinkNoise ? ' + pink noise' : ''}`)
  }, [])

  const stop = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx && gainRef.current && leftRef.current) {
      // Fade out suave (evita clicks)
      const now = ctx.currentTime
      gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now)
      gainRef.current.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC)
      setTimeout(() => {
        leftRef.current?.stop()
        rightRef.current?.stop()
        noiseRef.current?.stop()
        leftRef.current  = null
        rightRef.current = null
        noiseRef.current = null
      }, FADE_OUT_SEC * 1000)
    } else {
      leftRef.current?.stop()
      rightRef.current?.stop()
      noiseRef.current?.stop()
      leftRef.current  = null
      rightRef.current = null
      noiseRef.current = null
    }
    setActive(false)
    console.log('[Binaural] Stopping (fade out)')
  }, [])

  const switchPreset = useCallback((newPreset) => {
    if (active) start(newPreset)
    else setPreset(newPreset)
  }, [active, start])

  const setVolume = useCallback((v) => {
    volumeRef.current = v
    setVolumeState(v)
    if (gainRef.current) gainRef.current.gain.value = v
  }, [])

  return { active, preset, volume, start, stop, switchPreset, setVolume, presets: Object.keys(BEAT_PRESETS) }
}
