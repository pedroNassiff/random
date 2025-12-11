import { Experience } from './components/canvas/Experience'
import { useBrainStore } from './store/brainStore'
import { useState } from 'react'

function App() {
  const { isPlaying } = useBrainStore()

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Experience />

      {/* UI Overlay - Minimalist Data HUD */}
      <div style={{
        position: 'absolute',
        top: 30,
        left: 30,
        color: 'white',
        pointerEvents: 'none',
        fontFamily: "'Courier New', Courier, monospace", // Estilo técnico/científico
        textShadow: '0 0 5px rgba(255,255,255,0.5)',
      }}>
        <h1 style={{ fontSize: '1rem', margin: '0 0 10px 0', opacity: 0.8, letterSpacing: '2px' }}>
          PROTOTIPO SINTÉRGICO <span style={{ fontSize: '0.6em' }}></span>
        </h1>

        <DataMonitor />
      </div>

      {/* Mode Selector - Top Right */}
      <div style={{ position: 'absolute', top: 30, right: 30, opacity: 1, transition: 'opacity 1s ease' }}>
        <ModeSelector />
      </div>

      {/* Narrative Context Panel */}
      <ContextPanel />
    </div>
  )
}

// Estilos globales simulados para scrollbar oculto
const scrollStyles = `
      .scroller::-webkit-scrollbar {
        width: 4px;
  }
      .scroller::-webkit-scrollbar-track {
        background: transparent;
  }
      .scroller::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
  }
      .scroller {
        mask - image: linear-gradient(to bottom, black 85%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
  }
      `

function ContextPanel() {
  return (
    <>
      <style>{scrollStyles}</style>
      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 40,
        width: '380px',
        maxHeight: '400px', // Limitar altura para hacer scroll
        color: 'rgba(255,255,255,0.85)',
        background: 'linear-gradient(180deg, rgba(10,10,13,0.5) 0%, rgba(10,10,15,0.1) 100%)', // Más transparencia 
        padding: '25px',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '0.75rem',
        borderLeft: '2px solid rgba(255,255,255,0.5)',
        backdropFilter: 'blur(5px)', // Reducir blur para ver mejor el fondo
        lineHeight: '1.7',
        pointerEvents: 'auto', // Permitir scroll
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }} className="scroller">

        <h3 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '3px', color: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px' }}>
          // NEURO-SYNTERGIC LOG
        </h3>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#00dcff' }}>1. LA LATTICE (La Estructura)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            La malla tenue de fondo representa la <b>Lattice</b>: la matriz informacional del espacio-tiempo en estado de reposo (simetría perfecta).
            Sin un observador, es invisible y contiene todas las posibilidades cuánticas.
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#ffb700' }}>2. DISTORSIÓN DEL CAMPO (Focal Point)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Observa cómo la malla se <b>deforma físicamente</b> alrededor de la Orbe Blanca.
            Esto es el <b>Factor de Direccionalidad</b>: La atención consciente curvando la estructura del espacio para crear una experiencia perceptual (un "quali").
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 5px 0', color: '#00ff9d' }}>3. SINTERGIA (Coherencia)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            El color cuenta la historia de la unificación:
            <br />
            <span style={{ color: 'cyan' }}>Cyan (Izq)</span> vs <span style={{ color: 'magenta' }}>Magenta (Der)</span>: Baja coherencia. Hemisferios desconectados (Lógica vs Intuición).
            <br />
            <span style={{ color: '#ffd700', textShadow: '0 0 5px gold' }}>Dorado (Centro)</span>: <b>Alta Sintergia</b>. Unificación total. El cerebro entra en resonancia con la Lattice.
          </p>
        </div>

        <div>
          <h4 style={{ margin: '0 0 5px 0', color: '#ff0055' }}>4. EL EXPERIMENTO (Dataset)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Datos del <b>PhysioNet EEG Database</b>.
            <br />
            Switch <b>RELAX</b>: Visualiza ondas Alpha (Meditación/Calma).
            <br />
            Switch <b>FOCUS</b>: Visualiza ondas Beta/Gamma (Imaginación Motora Activa).
          </p>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.6rem' }}>
          ▼ SCROLL FOR RAW DATA STREAM ▼
        </div>
      </div>
    </>
  )
}

// Componente para leer datos sin re-renderizar toda la App
function DataMonitor() {
  const { coherence, entropy } = useBrainStore()

  // Frecuencia simulada basada en coherencia (simulando bandas cerebrales)
  const frequency = (10 + (coherence * 30)).toFixed(1)
  const band = frequency < 13 ? 'ALPHA' : frequency < 30 ? 'BETA' : 'GAMMA'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ opacity: 0.5 }}>COHERENCE</span>
        <div style={{ width: '100px', height: '2px', background: '#333' }}>
          <div style={{ width: `${coherence * 100}%`, height: '100%', background: 'white' }} />
        </div>
        <span>{coherence.toFixed(3)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ opacity: 0.5 }}>ENTROPY  </span>
        <span>{entropy.toFixed(3)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ opacity: 0.5 }}>FREQUENCY</span>
        <span>{frequency} Hz [{band}]</span>
      </div>
    </div>
  )
}



function ModeSelector() {
  const { setMode } = useBrainStore()
  const [active, setActive] = useState('focus')

  const handleMode = (mode) => {
    setActive(mode)
    setMode(mode)
  }

  const btnStyle = (mode) => ({
    background: active === mode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.5)',
    color: active === mode ? 'black' : 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'all 0.3s ease'
  })

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button onClick={() => handleMode('relax')} style={btnStyle('relax')}>
        RELAX (ALPHA)
      </button>
      <button onClick={() => handleMode('focus')} style={btnStyle('focus')}>
        FOCUS (BETA/GAMMA)
      </button>
    </div>
  )
}

export default App
