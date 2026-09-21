# Retrat-arte

Sistema de visualización interactiva que combina una imagen con efectos visuales reactivos al audio y seguimiento facial.

## Qué hace

Toma una imagen base (en este caso, la vaca de La Vaca Coworking) y le aplica diferentes shaders que reaccionan al audio del micrófono y al movimiento de la cara detectada por la cámara. Los patrones van cambiando automáticamente cada 6 segundos, con transiciones suaves entre ellos.

Incluye 7 patrones diferentes (círculos, grids, ondas, túneles, etc.), un efecto holográfico, un caleidoscopio que usa el video de la cámara en vivo, y un modo reposo que muestra la imagen sin efectos.

## Stack

- Three.js para el rendering 3D
- GLSL para los shaders
- Web Audio API para análisis de frecuencias
- Face Detection API para tracking facial
- Vite como bundler

## Uso

```bash
npm install
npm run dev
```

Dale a "Play" y acepta los permisos de cámara/audio. Los patrones empiezan a cambiar solos. Dale "Pause" si querés congelar en un patrón específico.

## Contexto

Pensado originalmente para instalaciones tipo cuadro digital interactivo. La idea es que empresas/espacios puedan tener su logo o imagen representativa con estos efectos visuales en tiempo real.
