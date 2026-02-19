/**
 * CodeEditor — shared live shader editor components
 * Used by LabDetail (R3F experiments) and RetratarteDetail (vanilla Three.js)
 */
import { useState, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────
// Shared CSS
// ─────────────────────────────────────────────
export const EDITOR_STYLES = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .lab-editor { font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace; }
  .lab-editor *::-webkit-scrollbar        { width: 5px; height: 5px; }
  .lab-editor *::-webkit-scrollbar-track  { background: transparent; }
  .lab-editor *::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.07); border-radius: 3px; }
  .lab-editor *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
  .lab-ta { caret-color: #00FFD1; }
  .lab-ta::selection { background: rgba(0,255,209,0.18); }
  .lab-tab-strip { overflow-x: auto; scrollbar-width: none; }
  .lab-tab-strip::-webkit-scrollbar { display: none; }
  .lab-tab-strip:active { cursor: grabbing !important; }
  .lab-tab-btn { transition: color 0.12s, background 0.12s; }
  .lab-tab-btn:hover { color: rgba(255,255,255,0.75) !important; }
  .lab-resize { transition: background 0.15s; }
  .lab-resize:hover, .lab-resize:active { background: rgba(0,255,209,0.3) !important; }

  @keyframes glitch-clip {
    0%   { clip-path: inset(40% 0 50% 0); transform: translateY(-50%) rotate(180deg) translate(-2px,0); }
    10%  { clip-path: inset(10% 0 80% 0); transform: translateY(-50%) rotate(180deg) translate(2px,0);  }
    20%  { clip-path: inset(70% 0 10% 0); transform: translateY(-50%) rotate(180deg) translate(0,0);    }
    30%  { clip-path: inset(30% 0 40% 0); transform: translateY(-50%) rotate(180deg) translate(-1px,0); }
    40%  { clip-path: inset(80% 0  5% 0); transform: translateY(-50%) rotate(180deg) translate(1px,0);  }
    50%  { clip-path: inset(50% 0 30% 0); transform: translateY(-50%) rotate(180deg) translate(0,0);    }
    100% { clip-path: inset(40% 0 50% 0); transform: translateY(-50%) rotate(180deg) translate(-2px,0); }
  }
  .lab-source-btn {
    transition: color 0.2s, background 0.2s, border-color 0.2s;
    position: relative;
  }
  .lab-source-btn::before,
  .lab-source-btn::after {
    content: attr(data-text);
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    writing-mode: vertical-rl;
    font: inherit; letter-spacing: inherit;
    pointer-events: none; opacity: 0;
    padding: inherit;
  }
  .lab-source-btn::before { color: #E040FB; left: -1px; }
  .lab-source-btn::after  { color: #00B4FF; left:  1px; }
  .lab-source-btn:hover::before,
  .lab-source-btn:hover::after {
    opacity: 0.7;
    animation: glitch-clip 0.35s steps(1) infinite;
  }
  .lab-source-btn:hover::after {
    animation-delay: 0.05s;
    animation-direction: reverse;
  }
`

// ─────────────────────────────────────────────
// CodeArea — line numbers + editable textarea
// ─────────────────────────────────────────────
function CodeArea({ value, onChange, onCursorChange, onForceCompile, fontSize = 12 }) {
  const taRef   = useRef(null)
  const numsRef = useRef(null)
  const lineCount = (value.match(/\n/g) || []).length + 1

  const syncScroll = () => {
    if (numsRef.current && taRef.current)
      numsRef.current.scrollTop = taRef.current.scrollTop
  }

  const reportCursor = () => {
    const ta = taRef.current
    if (!ta || !onCursorChange) return
    const before = ta.value.slice(0, ta.selectionStart)
    const lines  = before.split('\n')
    onCursorChange({ ln: lines.length, col: lines[lines.length - 1].length + 1 })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const { selectionStart: ss, selectionEnd: se } = e.target
      const next = value.slice(0, ss) + '  ' + value.slice(se)
      onChange(next)
      requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.selectionStart = taRef.current.selectionEnd = ss + 2
          reportCursor()
        }
      })
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onForceCompile?.()
      return
    }
  }

  const lh = 20

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={numsRef}
        aria-hidden
        style={{
          flexShrink: 0, width: 48,
          paddingTop: 14, paddingBottom: 20, paddingRight: 12,
          textAlign: 'right',
          color: 'rgba(255,255,255,0.12)',
          fontSize, lineHeight: lh + 'px',
          userSelect: 'none', overflowY: 'hidden', overflowX: 'hidden',
          background: '#060910',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: lh }}>{i + 1}</div>
        ))}
      </div>

      <textarea
        ref={taRef}
        className="lab-ta"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        onClick={reportCursor}
        onKeyUp={reportCursor}
        onSelect={reportCursor}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none', outline: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'text',
          fontFamily: 'inherit',
          fontSize, lineHeight: lh + 'px',
          paddingTop: 14, paddingBottom: 32,
          paddingLeft: 12, paddingRight: 16,
          resize: 'none', tabSize: 2,
          whiteSpace: 'pre', overflowWrap: 'normal',
          overflowX: 'auto', overflowY: 'auto',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// SourceButton — vertical pill tab on right edge
// ─────────────────────────────────────────────
export function SourceButton({ onClick }) {
  return (
    <button
      className="lab-source-btn"
      data-text=">_ source"
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 0, top: '50%',
        transform: 'translateY(-50%) rotate(180deg)',
        zIndex: 150,
        writingMode: 'vertical-rl',
        background: 'rgba(0,255,209,0.04)',
        border: '1px solid rgba(0,255,209,0.25)',
        borderRight: 'none',
        borderRadius: '6px 0 0 6px',
        color: '#00FFD1',
        padding: '14px 7px',
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
        fontSize: '10px',
        letterSpacing: '0.18em',
        cursor: 'none',
        pointerEvents: 'auto',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,255,209,0.1)'
        e.currentTarget.style.borderColor = 'rgba(0,255,209,0.5)'
        e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,209,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(0,255,209,0.04)'
        e.currentTarget.style.borderColor = 'rgba(0,255,209,0.25)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      &gt;_ source
    </button>
  )
}

// ─────────────────────────────────────────────
// MarkdownView — read-only prose display for .md tabs
// ─────────────────────────────────────────────
function MarkdownView({ content }) {
  const lines = content.split('\n')
  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '32px 36px 48px',
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      fontSize: 12,
    }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <div key={i} style={{
              color: '#00FFD1',
              fontSize: 13,
              letterSpacing: '0.12em',
              marginBottom: 28,
              paddingBottom: 10,
              borderBottom: '1px solid rgba(0,255,209,0.12)',
              fontWeight: 600,
            }}>{line.slice(2)}</div>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <div key={i} style={{
              color: 'rgba(0,255,209,0.6)',
              fontSize: 11,
              letterSpacing: '0.1em',
              marginTop: 20, marginBottom: 10,
            }}>{line.slice(3)}</div>
          )
        }
        if (line.startsWith('// ')) {
          return (
            <div key={i} style={{
              color: 'rgba(255,255,255,0.18)',
              fontStyle: 'italic',
              lineHeight: '1.9',
              letterSpacing: '0.03em',
            }}>{line}</div>
          )
        }
        if (line.startsWith('— ')) {
          return (
            <div key={i} style={{
              color: 'rgba(255,255,255,0.22)',
              marginTop: 28,
              letterSpacing: '0.08em',
              fontSize: 10,
            }}>{line}</div>
          )
        }
        if (line.trim() === '') {
          return <div key={i} style={{ height: 14 }} />
        }
        return (
          <div key={i} style={{
            color: 'rgba(255,255,255,0.62)',
            lineHeight: '1.9',
            letterSpacing: '0.03em',
          }}>{line}</div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// EditorPanel — resizable live code editor
// ─────────────────────────────────────────────
export function EditorPanel({ files, liveCode, onChange, errorMsg, shaderPending, onClose, onForceCompile }) {
  const [activeTab,  setActiveTab]  = useState(0)
  const [panelWidth, setPanelWidth] = useState(460)
  const [cursor,     setCursor]     = useState({ ln: 1, col: 1 })
  const [tabOverflow, setTabOverflow] = useState(false)
  const dragRef    = useRef(null)
  const tabStripRef = useRef(null)
  const tabDragRef  = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false })

  // Check if tab strip overflows (show fade indicator)
  useEffect(() => {
    const el = tabStripRef.current
    if (!el) return
    const check = () => setTabOverflow(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [files])

  // Drag-to-scroll on tab strip
  const onTabStripMouseDown = (e) => {
    if (e.button !== 0) return
    const el = tabStripRef.current
    if (!el) return
    tabDragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    e.stopPropagation()
  }
  const onTabStripMouseMove = (e) => {
    const d = tabDragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    if (d.moved && tabStripRef.current) {
      tabStripRef.current.scrollLeft = d.scrollLeft - dx
    }
    e.stopPropagation()
  }
  const onTabStripMouseUp = (e) => {
    tabDragRef.current.active = false
    e.stopPropagation()
  }
  // Allow wheel scroll on tab strip without propagating to 3D scene
  const onTabStripWheel = (e) => {
    const el = tabStripRef.current
    if (el) el.scrollLeft += e.deltaY || e.deltaX
    e.stopPropagation()
    e.preventDefault()
  }

  // about.md always first
  const orderedFiles = [...files].sort((a, b) => {
    if (a.name === 'about.md') return -1
    if (b.name === 'about.md') return 1
    return 0
  })

  useEffect(() => { setActiveTab(0) }, [files])

  const file  = orderedFiles[activeTab]
  const value = liveCode[file?.name] ?? file?.code ?? ''
  const lang  = file?.lang ?? 'js'

  // ── Resize drag (capture phase to bypass stopPropagation) ──
  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (ev) => {
      const delta = startX - ev.clientX
      setPanelWidth(Math.min(900, Math.max(300, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup',   onUp,   true)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup',   onUp,   true)
  }

  const stopAll = (e) => e.stopPropagation()

  const extColor = (name) => {
    if (name.endsWith('.glsl')) return '#00B4FF'
    if (name.endsWith('.js'))   return '#E040FB'
    if (name.endsWith('.md'))   return '#00FFD1'
    return 'rgba(255,255,255,0.38)'
  }

  const isEs = typeof navigator !== 'undefined' && navigator.language?.startsWith('es')
  const langLabel = lang === 'glsl' ? 'GLSL' : lang === 'js' ? 'JavaScript' : lang === 'markdown' ? (isEs ? 'esencia' : 'essence') : lang.toUpperCase()
  const hasError  = !!errorMsg

  return (
    <div
      className="lab-editor"
      onPointerDown={stopAll} onPointerMove={stopAll} onPointerUp={stopAll}
      onMouseDown={stopAll}   onMouseMove={stopAll}
      onTouchStart={stopAll}  onWheel={stopAll}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: panelWidth,
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        background: '#080b10',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        fontSize: 12,
        animation: 'slideInRight 0.2s ease',
        cursor: 'default',
      }}
    >
      <style>{EDITOR_STYLES}</style>

      {/* Resize handle */}
      <div
        ref={dragRef}
        className="lab-resize"
        onMouseDown={startResize}
        title="Drag to resize"
        style={{
          position: 'absolute', left: -3, top: 0, bottom: 0, width: 6,
          cursor: 'ew-resize', zIndex: 10,
          background: 'transparent',
        }}
      />

      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'stretch', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#04070c',
        height: 38,
      }}>
        {/* Brand close */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={onClose}
            title="close editor"
            style={{
              background: 'none',
              border: '1px solid rgba(0,255,209,0.22)',
              borderRadius: 2,
              color: 'rgba(0,255,209,0.45)',
              cursor: 'pointer',
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              fontSize: 9,
              letterSpacing: '0.12em',
              padding: '3px 8px',
              lineHeight: 1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#00FFD1'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.55)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(0,255,209,0.45)'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.22)'
            }}
          >×</button>
        </div>

        {/* Scrollable tab strip — drag or horizontal scroll */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {tabOverflow && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
              background: 'linear-gradient(to right, transparent, #04070c)',
              zIndex: 2, pointerEvents: 'none',
            }} />
          )}
        <div
          ref={tabStripRef}
          className="lab-tab-strip"
          onMouseDown={onTabStripMouseDown}
          onMouseMove={onTabStripMouseMove}
          onMouseUp={onTabStripMouseUp}
          onMouseLeave={onTabStripMouseUp}
          onWheel={onTabStripWheel}
          style={{ display: 'flex', height: '100%', alignItems: 'stretch', cursor: 'grab' }}>
          {orderedFiles.map((f, i) => (
            <button
              key={i}
              className="lab-tab-btn"
              onClick={() => { if (!tabDragRef.current?.moved) setActiveTab(i) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: i === activeTab ? '2px solid #00FFD1' : '2px solid transparent',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                color: i === activeTab ? '#fff' : 'rgba(255,255,255,0.32)',
                cursor: 'pointer',
                fontSize: 11, letterSpacing: '0.03em',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ color: extColor(f.name), fontSize: 8 }}>⬤</span>
              {f.name}
            </button>
          ))}
        </div>
        </div>{/* end tab strip wrapper */}
      </div>

      {/* Error banner */}
      {hasError && (
        <div style={{
          flexShrink: 0,
          padding: '6px 14px',
          background: 'rgba(255,95,87,0.08)',
          borderBottom: '1px solid rgba(255,95,87,0.2)',
          color: '#ff5f57',
          fontSize: 11, lineHeight: '16px',
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* Code area or prose view */}
      {file?.lang === 'markdown'
        ? <MarkdownView content={value} />
        : <CodeArea
            value={value}
            onChange={(v) => onChange(file.name, v)}
            onCursorChange={setCursor}
            onForceCompile={onForceCompile}
          />
      }

      {/* Status bar */}
      <div style={{
        flexShrink: 0, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#02050a',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0 10px',
        fontSize: 10, letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.28)',
        userSelect: 'none',
        fontFamily: 'inherit',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: lang === 'glsl' ? 'rgba(0,180,255,0.12)' : lang === 'markdown' ? 'rgba(0,255,209,0.08)' : 'rgba(224,64,251,0.12)',
            color: lang === 'glsl' ? '#00B4FF' : lang === 'markdown' ? '#00FFD1' : '#E040FB',
            padding: '1px 6px', borderRadius: 2,
            fontSize: 9, letterSpacing: '0.08em',
          }}>{langLabel}</span>
          {shaderPending && !hasError && (
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>compiling…</span>
          )}
          {!shaderPending && !hasError && file?.live && (
            <span style={{ color: 'rgba(0,255,209,0.45)' }}>● ready</span>
          )}
          {hasError && (
            <span style={{ color: '#ff5f57' }}>⚠ error</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Ln {cursor.ln}, Col {cursor.col}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>⌘↵ compile</span>
        </div>
      </div>
    </div>
  )
}
