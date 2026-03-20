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

// Frecuencia portadora (inaudible como tono puro, en rango cómodo)
const CARRIER_FREQ = 200  // Hz

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
  const [active, setActive]     = useState(false)
  const [preset, setPreset]     = useState('alpha')
  const [volume, setVolumeState] = useState(0.3)
  const volumeRef = useRef(0.3)

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

  const start = useCallback((targetPreset = 'alpha') => {
    const ctx = _init()
    if (ctx.state === 'suspended') ctx.resume()

    // Stop any existing oscillators
    leftRef.current?.stop()
    rightRef.current?.stop()

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

    left.start()
    right.start()

    leftRef.current  = left
    rightRef.current = right

    setActive(true)
    setPreset(targetPreset)
    console.log(`[Binaural] Started: ${CARRIER_FREQ} Hz ↔ ${CARRIER_FREQ + beatFreq} Hz → beat ${beatFreq} Hz (${targetPreset})`)
  }, [])

  const stop = useCallback(() => {
    leftRef.current?.stop()
    rightRef.current?.stop()
    leftRef.current  = null
    rightRef.current = null
    setActive(false)
    console.log('[Binaural] Stopped')
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
