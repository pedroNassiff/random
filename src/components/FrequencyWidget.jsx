import { useEffect, useRef } from 'react';

/**
 * FrequencyWidget — "señal emergiendo del ruido"
 *
 * Hover effect: caos → calma (enfoque, respiración, flujo)
 * Al hacer hover, calmProgress transiciona 0→1:
 *  - velocidad baja suavemente a ~25% del base
 *  - amplitudes se nivelan hacia una ola limpia
 *  - glitches desaparecen
 *  - scan line se ralentiza
 */
export default function FrequencyWidget({
  color = '#E85A4F',
  barCount = 38,
  speed = 1,
  profile = 'interference',
  sharedScan = null,   // ref con valor 0→4 compartido entre las 4 cards
  cardIndex = 0,       // índice de esta card (0–3)
}) {
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const hoverRef   = useRef(false);   // ¿mouse encima?
  const calmRef    = useRef(0);       // 0 = caos, 1 = calma (se interpola)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const bars = Array.from({ length: barCount }, () => ({
      phase: Math.random() * Math.PI * 2,
      freq:  0.3 + Math.random() * 1.4,
      noise: Math.random(),
    }));

    const peaks = new Float32Array(barCount).fill(0);
    const peakV = new Float32Array(barCount).fill(0);

    let scanX      = 0;
    let glitchBar  = -1;
    let glitchTTL  =  0;
    let nextGlitch =  2 + Math.random() * 4;
    let lastTime   =  0;
    // tiempo acumulado real (no afectado por speed) para fases absolutas
    let absTime    =  0;

    function hexRgb(hex) {
      const h = hex.replace('#', '');
      return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
    }
    const rgb = hexRgb(color);

    // ── hover listeners ────────────────────────────────────────────────
    const onEnter = () => { hoverRef.current = true; };
    const onLeave = () => { hoverRef.current = false; };
    canvas.addEventListener('mouseenter', onEnter);
    canvas.addEventListener('mouseleave', onLeave);

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width  = rect.width  + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // ── amplitud por perfil ────────────────────────────────────────────
    // Caos reducido: multiplicadores bajados ~30% vs anterior
    function getAmpChaos(i, t) {
      const b = bars[i];
      const n = i / (barCount - 1);

      if (profile === 'interference') {
        const w1 = Math.sin(n * Math.PI * 3 + t * b.freq       + b.phase);
        const w2 = Math.sin(n * Math.PI * 5 - t * b.freq * 0.7 + b.phase * 1.3);
        return Math.max(0.04, Math.abs((w1 + w2) / 2) * 0.62 + 0.06 * b.noise);

      } else if (profile === 'coherent') {
        const envelope = 0.3 + 0.7 * Math.sin(n * Math.PI);
        return Math.max(0.04, envelope * (0.4 + 0.4 * Math.sin(t * b.freq * 0.6 + b.phase)));

      } else if (profile === 'chaos') {
        const shot = Math.sin(t * b.freq * 3.1 + b.phase) * Math.cos(t * b.freq * 2.3 + b.phase * 0.7);
        return Math.max(0.04, Math.abs(shot) * 0.65 + 0.05);

      } else {
        // harmonic
        const fund = Math.sin(n * Math.PI     + t * 0.5  + b.phase);
        const h2   = Math.sin(n * Math.PI * 2 + t * 1.0  + b.phase) * 0.5;
        const h3   = Math.sin(n * Math.PI * 3 + t * 1.5  + b.phase) * 0.25;
        return Math.max(0.04, Math.abs((fund + h2 + h3) / 1.75) * 0.65);
      }
    }

    // Amplitud "calma": ola suave centrada, respiración lenta
    function getAmpCalm(i, t) {
      const b = bars[i];
      const n = i / (barCount - 1);
      const envelope = 0.25 + 0.55 * Math.sin(n * Math.PI);
      return Math.max(0.04, envelope * (0.45 + 0.35 * Math.sin(t * 0.35 + b.phase)));
    }

    function getAmp(i, t, calm) {
      const ampC = getAmpChaos(i, t);
      const ampS = getAmpCalm(i, t);
      return ampC + (ampS - ampC) * calm;
    }

    function draw(ts) {
      const dt   = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime   = ts;
      absTime   += dt;

      // ── calma: interpolar calmRef según hover ──────────────────────
      const calmTarget = hoverRef.current ? 1 : 0;
      // velocidad de transición: entra despacio (2s), sale más rápido (0.8s)
      const calmRate = hoverRef.current ? dt / 2.0 : dt / 0.8;
      calmRef.current = calmRef.current + (calmTarget - calmRef.current) * Math.min(1, calmRate * 6);
      const calm = calmRef.current;

      // velocidad efectiva: baja hasta 22% en calma total
      const effectiveSpeed = speed * (1 - calm * 0.78);
      const t = absTime * effectiveSpeed;

      const W  = canvas.width  / dpr;
      const H  = canvas.height / dpr;
      const CY = H / 2;

      ctx.clearRect(0, 0, W, H);

      // ── 1. phosphor trail ─────────────────────────────────────────
      // Calcular sx: desde sharedScan (global) o interno
      let sx = null;
      if (sharedScan != null) {
        const g = sharedScan.current; // 0→4
        if (Math.floor(g) % 4 === cardIndex) {
          sx = (g % 1) * W;
        }
        // else: no es nuestra carta, no dibujamos scan
      } else {
        scanX = (scanX + dt * 0.16 * (1 - calm * 0.75) * speed) % 1;
        sx = scanX * W;
      }

      if (sx !== null) {
        const tg = ctx.createLinearGradient(Math.max(0, sx - 80), 0, sx, 0);
        tg.addColorStop(0, `rgba(${rgb},0)`);
        tg.addColorStop(1, `rgba(${rgb},${0.05 - calm * 0.03})`);
        ctx.fillStyle = tg;
        ctx.fillRect(Math.max(0, sx - 80), 0, 80, H);
      }

      // ── 2. noise floor — se atenúa con la calma ───────────────────
      const noiseAlpha = 0.07 * (1 - calm * 0.85);
      if (noiseAlpha > 0.005) {
        const noiseCount = barCount * 2;
        for (let i = 0; i < noiseCount; i++) {
          const nx = (i / noiseCount) * W;
          const nh = 1 + Math.abs(Math.sin(t * 9.1 + i * 1.9 + bars[i % barCount].phase)) * H * 0.07;
          ctx.fillStyle = `rgba(${rgb},${noiseAlpha})`;
          ctx.fillRect(nx, CY - nh / 2, 1, nh);
        }
      }

      // ── 3. barras simétricas ──────────────────────────────────────
      const gap  = 2;
      const barW = (W - gap * (barCount - 1)) / barCount;
      const ampValues = new Float32Array(barCount);

      for (let i = 0; i < barCount; i++) {
        // glitch solo cuando no hay calma
        let amp = getAmp(i, t, calm);
        if (i === glitchBar && glitchTTL > 0 && calm < 0.15) {
          amp = 0.82 + Math.random() * 0.12;
        }
        ampValues[i] = amp;

        if (amp >= peaks[i]) { peaks[i] = amp; peakV[i] = 0; }
        else { peakV[i] += dt * 1.4; peaks[i] = Math.max(0, peaks[i] - peakV[i] * dt); }

        const barH = amp * CY * 0.88;
        const x    = i * (barW + gap);
        const isG  = i === glitchBar && glitchTTL > 0 && calm < 0.15;

        const gTop = ctx.createLinearGradient(0, CY - barH, 0, CY);
        gTop.addColorStop(0, isG ? `rgba(255,255,255,0.95)` : `rgba(${rgb},0.85)`);
        gTop.addColorStop(1, `rgba(${rgb},0.08)`);
        ctx.fillStyle = gTop;
        ctx.beginPath();
        ctx.roundRect(x, CY - barH, barW, barH, [1.5, 1.5, 0, 0]);
        ctx.fill();

        const gBot = ctx.createLinearGradient(0, CY, 0, CY + barH);
        gBot.addColorStop(0, `rgba(${rgb},0.08)`);
        gBot.addColorStop(1, isG ? `rgba(255,255,255,0.4)` : `rgba(${rgb},0.28)`);
        ctx.fillStyle = gBot;
        ctx.beginPath();
        ctx.roundRect(x, CY, barW, barH, [0, 0, 1.5, 1.5]);
        ctx.fill();

        if (peaks[i] > 0.1) {
          ctx.fillStyle = `rgba(${rgb},0.75)`;
          ctx.beginPath();
          ctx.arc(x + barW / 2, CY - peaks[i] * CY * 0.88, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 4. traza de señal ─────────────────────────────────────────
      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + gap) + barW / 2;
        const y = CY - ampValues[i] * CY * 0.88;
        if (i === 0) { ctx.moveTo(x, y); continue; }
        const px  = (i - 1) * (barW + gap) + barW / 2;
        const py  = CY - ampValues[i - 1] * CY * 0.88;
        const cpx = (px + x) / 2;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
      // la traza se hace más brillante y definida en calma
      ctx.strokeStyle = `rgba(${rgb},${0.55 + calm * 0.3})`;
      ctx.lineWidth   = 1.5 + calm * 0.5;
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + gap) + barW / 2;
        const y = CY + ampValues[i] * CY * 0.88;
        if (i === 0) { ctx.moveTo(x, y); continue; }
        const px  = (i - 1) * (barW + gap) + barW / 2;
        const py  = CY + ampValues[i - 1] * CY * 0.88;
        const cpx = (px + x) / 2;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
      ctx.strokeStyle = `rgba(${rgb},0.18)`;
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.strokeStyle = `rgba(${rgb},0.12)`;
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(W, CY); ctx.stroke();

      // ── 5. scan line — se ralentiza en calma ─────────────────────
      if (sx !== null) {
        ctx.strokeStyle = `rgba(${rgb},${0.55 - calm * 0.2})`;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, H);
        ctx.stroke();
        ctx.fillStyle = `rgba(${rgb},${0.95 - calm * 0.3})`;
        ctx.fillRect(sx - 3, CY - 1, 6, 2);
      }

      // ── 6. glitch — solo cuando calm < 0.1 ───────────────────────
      if (calm < 0.1) {
        if (glitchTTL > 0) {
          glitchTTL--;
        } else {
          nextGlitch -= dt;
          if (nextGlitch <= 0) {
            glitchBar  = Math.floor(Math.random() * barCount);
            glitchTTL  = 2 + Math.floor(Math.random() * 3);
            nextGlitch = 1.8 + Math.random() * 5;
          }
        }
      } else {
        glitchTTL = 0; // apagar glitch activo si entra hover
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [color, barCount, speed, profile]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}