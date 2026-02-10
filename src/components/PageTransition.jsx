import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './PageTransition.css'

const PageTransition = ({ children }) => {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showContent, setShowContent] = useState(true)
  const prevLocationRef = useRef(location.pathname)

  console.log('🎬 PageTransition render:', {
    currentPath: location.pathname,
    prevPath: prevLocationRef.current,
    isTransitioning,
    showContent
  })

  useEffect(() => {
    if (location.pathname !== prevLocationRef.current) {
      console.log('✨ Starting transition from', prevLocationRef.current, 'to', location.pathname)
      
      // Ocultar contenido viejo inmediatamente
      setShowContent(false)
      setIsTransitioning(true)
      
      // Mostrar contenido nuevo cuando las barras cubren todo
      const showTimer = setTimeout(() => {
        console.log('🔄 Showing new content')
        prevLocationRef.current = location.pathname
        setShowContent(true)
        window.scrollTo(0, 0)
      }, 1400)
      
      // Terminar transición
      const endTimer = setTimeout(() => {
        console.log('✅ Transition complete')
        setIsTransitioning(false)
      }, 2800)
      
      return () => {
        clearTimeout(showTimer)
        clearTimeout(endTimer)
      }
    }
  }, [location.pathname])

  return (
    <>
      {/* Contenedor de barras de transición */}
      <div className={`page-transition ${isTransitioning ? 'active' : ''}`}>
        {[...Array(8)].map((_, i) => (
          <div 
            key={i} 
            className="transition-bar"
            style={{ 
              '--delay': `${i * 0.12}s`,
              '--reverse-delay': `${(7 - i) * 0.12}s`
            }}
          />
        ))}
      </div>
      
      {/* Contenido de la página */}
      <div className="page-content" style={{ opacity: showContent ? 1 : 0 }}>
        {children}
      </div>
    </>
  )
}

export default PageTransition
