import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './PageTransition.css'

const PageTransition = ({ children }) => {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const prevLocationRef = useRef(location.pathname)
  const isInitialMount = useRef(true)

  // Transición inicial al cargar la página
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      setIsTransitioning(true)
      
      // Mostrar contenido cuando las barras cubren todo
      const showTimer = setTimeout(() => {
        setShowContent(true)
      }, 1400)
      
      // Terminar transición inicial
      const endTimer = setTimeout(() => {
        setIsTransitioning(false)
      }, 2800)
      
      return () => {
        clearTimeout(showTimer)
        clearTimeout(endTimer)
      }
    }
  }, [])

  // Transición entre páginas
  useEffect(() => {
    if (!isInitialMount.current && location.pathname !== prevLocationRef.current) {
      // Ocultar contenido viejo inmediatamente
      setShowContent(false)
      setIsTransitioning(true)
      
      // Mostrar contenido nuevo cuando las barras cubren todo
      const showTimer = setTimeout(() => {
        prevLocationRef.current = location.pathname
        setShowContent(true)
        window.scrollTo(0, 0)
      }, 1900)
      
      // Terminar transición
      const endTimer = setTimeout(() => {
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
      <div className="page-content" style={{ 
        opacity: showContent ? 1 : 0,
        visibility: showContent ? 'visible' : 'hidden',
        transition: 'opacity 0.3s ease-in-out'
      }}>
        {children}
      </div>
    </>
  )
}

export default PageTransition
