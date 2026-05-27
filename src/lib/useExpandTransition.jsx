import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'

const ExpandContext = createContext(null)

export function ExpandTransitionProvider({ children }) {
  const [expanding, setExpanding] = useState(null)
  const overlayRef     = useRef(null)
  const overlayTitleRef = useRef(null)
  const navigate = useNavigate()
  // Keep navigate in a ref so the GSAP effect doesn't re-trigger
  // when React Router updates its navigate reference after navigation
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const tlRef = useRef(null)

  const triggerExpand = useCallback((project, cardRef) => {
    if (!cardRef?.current) {
      sessionStorage.setItem('skipPageTransition', '1')
      navigateRef.current(`/work/${project.id}`)
      return
    }
    const rect   = cardRef.current.getBoundingClientRect()
    const vw     = window.innerWidth
    const vh     = window.innerHeight
    const top    = (rect.top / vh * 100).toFixed(2)
    const right  = ((vw - rect.right) / vw * 100).toFixed(2)
    const bottom = ((vh - rect.bottom) / vh * 100).toFixed(2)
    const left   = (rect.left / vw * 100).toFixed(2)
    setExpanding({
      project,
      clipFrom: `inset(${top}% ${right}% ${bottom}% ${left}% round 16px)`,
    })
  }, [])  // no navigate dep — uses navigateRef

  useEffect(() => {
    if (!expanding || !overlayRef.current) return
    // Kill any previous timeline (guards against double-trigger)
    if (tlRef.current) { tlRef.current.kill(); tlRef.current = null }

    const overlay  = overlayRef.current
    const titleEl  = overlayTitleRef.current

    gsap.set(overlay, { clipPath: expanding.clipFrom, opacity: 1 })
    if (titleEl) gsap.set(titleEl, { opacity: 0 })

    const tl = gsap.timeline()
    tlRef.current = tl

    // 1. Clip-path expands from card to fullscreen
    tl.to(overlay, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)',
      duration: 0.85,
      ease: 'expo.inOut',
    })

    // 2. Title + meta fade in near the end
    if (titleEl) {
      tl.to(titleEl, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '-=0.25')
    }

    // 3. Navigate — overlay PERSISTS because it lives outside <Routes>
    tl.add(() => {
      sessionStorage.setItem('skipPageTransition', '1')
      navigateRef.current(`/work/${expanding.project.id}`)
    })

    // 4. Brief pause so the new page mounts behind the overlay, then dissolve
    tl.to(overlay, { opacity: 0, duration: 0.45, ease: 'power2.inOut' }, '+=0.15')
    tl.add(() => setExpanding(null))
  }, [expanding])  // ← only expanding; navigate is accessed via navigateRef

  return (
    <ExpandContext.Provider value={{ triggerExpand }}>
      {children}

      {/* Persistent overlay — lives outside route switch, no white flash */}
      {expanding && (
        <div
          ref={overlayRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundColor: '#000',
            opacity: 0,
          }}
        >
          <img
            src={expanding.project.heroImage || expanding.project.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {/* Gradient + title at bottom center */}
          <div
            ref={overlayTitleRef}
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              padding: '0 40px 52px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <h2 style={{
              color: '#fff',
              fontSize: 'clamp(2rem, 5vw, 4.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              margin: 0,
            }}>
              {expanding.project.title}
            </h2>
            <div style={{
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              color: 'rgba(255,255,255,0.55)',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}>
              <span>{expanding.project.year}</span>
              <span>·</span>
              <span>{expanding.project.type || expanding.project.category}</span>
            </div>
          </div>
        </div>
      )}
    </ExpandContext.Provider>
  )
}

export function useExpandTransition() {
  return useContext(ExpandContext)
}
