import { Experience } from './components/canvas/Experience'
import { useBrainStore } from './store/brainStore'
import { useState } from 'react'
import { FrequencySpectrum } from './components/hud/FrequencySpectrum'
import { CoherenceMeter } from './components/hud/CoherenceMeter'
import { StateIndicator } from './components/hud/StateIndicator'
import { AudioControl } from './components/hud/AudioControl'
import { DebugPanel } from './components/hud/DebugPanel'
import SessionControl from './components/hud/SessionControl'
import MuseControl from './components/hud/MuseControl'
import PracticeMode from './components/modes/PracticeMode'
import AchievementsPanel from './components/hud/AchievementsPanel.jsx'

function App() {
  const { isPlaying } = useBrainStore()
  const [isPracticeMode, setIsPracticeMode] = useState(false)
  const [dataSource, setDataSource] = useState('dataset') // 'dataset' | 'muse'

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Experience />

      {/* UI Overlay - Minimalist Data HUD */}
      <div style={{
        position: 'absolute',
        top: 30,
        left: 30,
        color: 'white',
        pointerEvents: 'auto',
        zIndex: 100,
        fontFamily: "'Courier New', Courier, monospace", // Estilo técnico/científico
        textShadow: '0 0 5px rgba(255,255,255,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h1 style={{ 
          fontSize: '1rem', 
          margin: '0 0 10px 0', 
          opacity: 0.8, 
          letterSpacing: '2px',
          pointerEvents: 'none'
        }}>
          
        </h1>
        <p style={{
          fontSize: '0.7rem',
          opacity: 0.5,
          margin: '0',
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}>
          
        </p>
      </div>

      {/* Metrics Sidebar - Right Side */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100vh',
        width: '320px',
        background: 'linear-gradient(270deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%)',
        backdropFilter: 'blur(10px)',
        borderLeft: '1px solid rgba(100, 200, 255, 0.3)',
        overflowY: 'auto',
        padding: '20px',
        paddingBottom: '80px',
        zIndex: 100,
        pointerEvents: 'auto'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '0.9rem',
          opacity: 0.7,
          letterSpacing: '2px',
          fontFamily: 'monospace',
          color: '#fff',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '10px'
        }}>
          {dataSource === 'muse' ? '🎧 EEG EN VIVO' : '📼 MÉTRICAS'} EN TIEMPO REAL
        </h2>
        
        {/* Source Selector Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '15px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          padding: '4px'
        }}>
          <button
            onClick={() => setDataSource('dataset')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: dataSource === 'dataset' ? 'rgba(100, 100, 255, 0.3)' : 'transparent',
              border: dataSource === 'dataset' ? '1px solid rgba(100, 100, 255, 0.5)' : '1px solid transparent',
              borderRadius: '6px',
              color: dataSource === 'dataset' ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📼 Dataset
          </button>
          <button
            onClick={() => setDataSource('muse')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: dataSource === 'muse' ? 'rgba(0, 255, 136, 0.3)' : 'transparent',
              border: dataSource === 'muse' ? '1px solid rgba(0, 255, 136, 0.5)' : '1px solid transparent',
              borderRadius: '6px',
              color: dataSource === 'muse' ? '#00ff88' : 'rgba(255,255,255,0.5)',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🎧 Muse EEG
          </button>
        </div>
        
        {/* Muse Control (when muse tab selected) */}
        {dataSource === 'muse' && (
          <div style={{ marginBottom: '20px' }}>
            <MuseControl onModeChange={(mode) => setDataSource(mode === 'muse' ? 'muse' : 'dataset')} />
          </div>
        )}
        
        <StateIndicator />
        <div style={{ marginTop: '20px' }}>
          <CoherenceMeter />
        </div>
        <div style={{ marginTop: '20px' }}>
          <FrequencySpectrum />
        </div>
        <div style={{ marginTop: '20px' }}>
          <AudioControl />
        </div>
        <div style={{ marginTop: '20px' }}>
          {/* <DebugPanel /> */}
        </div>
      </div>
      
      {/* Session Player - Bottom Center (only show in dataset mode) */}
      {dataSource === 'dataset' && <SessionControl />}
      
      {/* Live EEG indicator when Muse is active */}
      {dataSource === 'muse' && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(0, 40, 30, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 136, 0.4)',
          borderRadius: '50px',
          padding: '12px 30px',
          fontFamily: 'monospace',
          color: '#00ff88',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span style={{ 
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00ff88',
            animation: 'pulse 1.5s infinite'
          }} />
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
            🎧 MUSE 2 - EEG EN VIVO
          </span>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.7); }
              50% { opacity: 0.5; box-shadow: 0 0 0 10px rgba(0, 255, 136, 0); }
            }
          `}</style>
        </div>
      )}
      
      {/* Practice Mode Panel (conditional) - Top Left */}
      {isPracticeMode && <PracticeMode onClose={() => setIsPracticeMode(false)} />}
      
      {/* Achievements Panel - Top Right, colapsable */}
      {/* <AchievementsPanel onPracticeModeToggle={() => setIsPracticeMode(!isPracticeMode)} isPracticeMode={isPracticeMode} /> */}

      {/* Narrative Context Panel - Left sidebar, colapsable */}
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
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <>
      <style>{scrollStyles}</style>
      
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          position: 'absolute',
          left: isExpanded ? '400px' : '0',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '40px',
          height: '80px',
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderLeft: isExpanded ? '1px solid rgba(255,255,255,0.3)' : 'none',
          borderRadius: isExpanded ? '0 8px 8px 0' : '0 8px 8px 0',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '1.2rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease-out',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          pointerEvents: 'auto'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(0,220,255,0.2)'
          e.target.style.borderColor = 'rgba(0,220,255,0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(10,10,15,0.85)'
          e.target.style.borderColor = 'rgba(255,255,255,0.3)'
        }}
      >
        {isExpanded ? '◀' : '▶'}
      </button>
      
      {/* Sidebar Panel */}
      <div style={{
        position: 'absolute',
        left: isExpanded ? '0' : '-400px',
        top: 0,
        bottom: 0,
        width: '400px',
        color: 'rgba(255,255,255,0.85)',
        background: 'linear-gradient(90deg, rgba(10,10,13,0.95) 0%, rgba(10,10,15,0.85) 100%)',
        padding: '25px',
        paddingBottom: '100px',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '0.75rem',
        borderRight: '2px solid rgba(0,220,255,0.5)',
        backdropFilter: 'blur(10px)',
        lineHeight: '1.7',
        pointerEvents: isExpanded ? 'auto' : 'none',
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        boxShadow: isExpanded ? '0 0 40px rgba(0,220,255,0.2)' : 'none',
        transition: 'left 0.3s ease-out, box-shadow 0.3s',
        zIndex: 100
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
          <h4 style={{ margin: '0 0 5px 0', color: '#ffb700' }}>2. FOCAL POINT (Punto de Atención)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Zonas de <b>luminosidad intensa</b> representan el <b>Focal Point</b>: donde la atención consciente está activa.
            El <b>Factor de Direccionalidad</b> curvando la estructura del espacio para crear una experiencia perceptual (un "quali").
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
          <h4 style={{ margin: '0 0 5px 0', color: '#ff0055' }}>4. DATOS REALES (Sesiones EEG)</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Reproducción de <b>sesiones completas</b> de EEG:
            <br />
            • OpenNeuro ds003969: Meditación (10 min)
            <br />
            • PhysioNet Motor Imagery: Imaginación motora
            <br />
            Presiona <b>PLAY</b> para iniciar la reproducción cronológica.
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



export default App
