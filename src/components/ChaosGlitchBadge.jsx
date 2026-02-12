import React, { useState, useEffect, useRef } from 'react';

export default function ChaosGlitchBadge({ text, onGlitchEnd }) {
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchEffect, setGlitchEffect] = useState(0); // 0, 1, 2 para diferentes efectos
  const containerRef = useRef(null);

  useEffect(() => {
    const triggerRandomGlitch = () => {
      // Activar glitch
      setIsGlitching(true);
      setGlitchEffect(Math.floor(Math.random() * 3)); // 0, 1 o 2

      // Desactivar después de 1 segundo
      setTimeout(() => {
        setIsGlitching(false);
        // Notificar que terminó el glitch
        if (onGlitchEnd) onGlitchEnd();
      }, 1000);

      // Programar el siguiente glitch en 1-5 segundos
      const nextGlitchDelay = Math.random() * 4000 + 1000; // 1000-5000ms
      setTimeout(triggerRandomGlitch, nextGlitchDelay);
    };

    // Iniciar el primer glitch después de un delay inicial
    const initialDelay = Math.random() * 3000 + 1000;
    const initialTimeout = setTimeout(triggerRandomGlitch, initialDelay);

    return () => clearTimeout(initialTimeout);
  }, []);

  // Efecto 1: Clip-path glitch (del CSS original)
  const clipPathGlitch = isGlitching && glitchEffect === 0;
  
  // Efecto 2: Color shift glitch
  const colorGlitch = isGlitching && glitchEffect === 1;
  
  // Efecto 3: Shake + distortion
  const shakeGlitch = isGlitching && glitchEffect === 2;

  return (
    <>
      <div 
        ref={containerRef}
        className={`
          inline-flex items-center justify-center border rounded-full w-[320px] h-[36px] overflow-hidden
          relative
          ${isGlitching ? 'glitch-active' : ''}
          ${clipPathGlitch ? 'clip-glitch' : ''}
          ${colorGlitch ? 'color-glitch' : ''}
          ${shakeGlitch ? 'shake-glitch' : ''}
        `}
        style={{
          backgroundColor: isGlitching ? 
            (colorGlitch ? 'rgba(0, 255, 213, 0.1)' : 
             shakeGlitch ? 'rgba(233, 75, 232, 0.1)' : 
             'rgba(0, 0, 0, 0.8)') : 
            'rgba(0, 0, 0, 0.8)',
          borderColor: isGlitching ?
            (colorGlitch ? '#00ffd5' :
             shakeGlitch ? '#E94BE8' :
             '#1df2f0') :
            '#2a2929',
          boxShadow: isGlitching ? '0px 0px 20px rgba(0, 255, 213, 0.3)' : 'none',
          transition: isGlitching ? 'none' : 'all 0.3s ease'
        }}
      >
        {/* Capa de texto duplicada para efecto glitch */}
        {clipPathGlitch && (
          <div 
            className="absolute inset-0 flex items-center justify-center clip-glitch-layer px-4"
            style={{
              color: 'white',
              textShadow: '-3px -3px 0px #1df2f0, 3px 3px 0px #E94BE8'
            }}
          >
            <span className="text-[13px] tracking-[0.5px]">{text}</span>
          </div>
        )}
        
        {/* Texto principal */}
        <div 
          className="relative z-10 w-full flex items-center justify-center px-4"
          style={{
            textShadow: isGlitching ? 
              (colorGlitch ? '2px 2px 0px #00ffd5, -2px -2px 0px #E94BE8' :
               shakeGlitch ? '1px 1px 0px #E94BE8' :
               '-1px -1px 0px #1df2f0, 1px 1px 0px #E94BE8') :
              'none'
          }}
        >
          <span className="text-[13px] text-white tracking-[0.5px]">{text}</span>
        </div>
      </div>

      <style>{`
        @keyframes clip-glitch-anim {
          0% {
            clip-path: inset(50% 50% 50% 50%);
            transform: translate(0px, -10px);
          }
          10% {
            clip-path: inset(31% 0 40% 0);
            transform: translate(-10px, 10px);
          }
          20% {
            clip-path: inset(39% 0 15% 0);
            transform: translate(10px, 0px);
          }
          30% {
            clip-path: inset(45% 0 40% 0);
            transform: translate(-10px, 10px);
          }
          40% {
            clip-path: inset(45% 0 6% 0);
            transform: translate(10px, -10px);
          }
          50% {
            clip-path: inset(14% 0 61% 0);
            transform: translate(-10px, 10px);
          }
          60% {
            clip-path: inset(50% 50% 50% 50%);
            transform: translate(10px, -10px);
          }
          70% {
            clip-path: inset(39% 0 15% 0);
            transform: translate(-10px, 10px);
          }
          80% {
            clip-path: inset(31% 0 40% 0);
            transform: translate(10px, -10px);
          }
          90% {
            clip-path: inset(45% 0 40% 0);
            transform: translate(-10px, 10px);
          }
          100% {
            clip-path: inset(50% 50% 50% 50%);
            transform: translate(0);
          }
        }

        @keyframes color-shift {
          0%, 100% {
            filter: hue-rotate(0deg) saturate(1);
          }
          25% {
            filter: hue-rotate(90deg) saturate(2);
          }
          50% {
            filter: hue-rotate(180deg) saturate(1.5);
          }
          75% {
            filter: hue-rotate(270deg) saturate(2);
          }
        }

        @keyframes shake-chaos {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          10% {
            transform: translate(-3px, 2px) rotate(-1deg);
          }
          20% {
            transform: translate(3px, -2px) rotate(1deg);
          }
          30% {
            transform: translate(-2px, -3px) rotate(-0.5deg);
          }
          40% {
            transform: translate(2px, 3px) rotate(0.5deg);
          }
          50% {
            transform: translate(-3px, -2px) rotate(-1deg);
          }
          60% {
            transform: translate(3px, 2px) rotate(1deg);
          }
          70% {
            transform: translate(-2px, 3px) rotate(-0.5deg);
          }
          80% {
            transform: translate(2px, -3px) rotate(0.5deg);
          }
          90% {
            transform: translate(-3px, 2px) rotate(-1deg);
          }
        }

        @keyframes distortion {
          0%, 100% {
            transform: scaleX(1) scaleY(1);
          }
          25% {
            transform: scaleX(0.98) scaleY(1.02);
          }
          50% {
            transform: scaleX(1.02) scaleY(0.98);
          }
          75% {
            transform: scaleX(0.99) scaleY(1.01);
          }
        }

        .clip-glitch-layer {
          animation: clip-glitch-anim 1s steps(2, end);
        }

        .color-glitch {
          animation: color-shift 0.8s ease-in-out;
        }

        .shake-glitch {
          animation: shake-chaos 0.6s ease-in-out, distortion 0.4s ease-in-out;
        }

        /* Efecto de escaneo aleatorio */
        .glitch-active::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0, 255, 213, 0.3), transparent);
          animation: scan 0.5s ease-in-out;
        }

        @keyframes scan {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
}
