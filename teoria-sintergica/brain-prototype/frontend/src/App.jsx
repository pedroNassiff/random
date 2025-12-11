import { Experience } from './components/canvas/Experience'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Experience />

      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Syntergic Prototype v0.1</h1>
        <p style={{ opacity: 0.7 }}>Latency: 12ms | Coherence: 0.85</p>
      </div>
    </div>
  )
}

export default App
