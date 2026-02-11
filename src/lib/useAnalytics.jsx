/**
 * Analytics Context & Hooks
 * Sistema de tracking para Random portfolio
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from './analyticsService';

// Context
const AnalyticsContext = createContext(null);

/**
 * Analytics Provider
 * Wrap la app con este provider
 */
export function AnalyticsProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Inicializar sesión
    const initSession = async () => {
      const response = await analyticsService.startSession();
      if (response?.session_id) {
        setSessionId(response.session_id);
        setIsInitialized(true);
      }
    };

    initSession();

    // Cleanup al desmontar
    return () => {
      if (sessionId) {
        analyticsService.endSession();
      }
    };
  }, []);

  return (
    <AnalyticsContext.Provider value={{ sessionId, isInitialized }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook principal de analytics
 */
export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  
  if (!context) {
    console.warn('useAnalytics must be used within AnalyticsProvider');
    return {
      trackEvent: () => {},
      trackConversion: () => {},
      isInitialized: false,
    };
  }

  return {
    sessionId: context.sessionId,
    isInitialized: context.isInitialized,
    trackEvent: analyticsService.trackEvent,
    trackConversion: analyticsService.trackConversion,
  };
}

/**
 * Hook para tracking automático de pageviews
 * Uso: usePageTracking('home') en cada página
 */
export function usePageTracking(section) {
  const location = useLocation();
  const { isInitialized } = useAnalytics();
  const pageStartTime = useRef(null);
  const scrollDepth = useRef(0);
  const clickCount = useRef(0);

  useEffect(() => {
    if (!isInitialized) return;

    // Reset metrics
    pageStartTime.current = Date.now();
    scrollDepth.current = 0;
    clickCount.current = 0;

    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const currentDepth = Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
      
      const previousDepth = scrollDepth.current;
      
      if (currentDepth > scrollDepth.current) {
        scrollDepth.current = currentDepth;
      }

      // Conversion: scroll completo (solo una vez)
      if (currentDepth >= 95 && previousDepth < 95) {
        analyticsService.trackConversion('full_scroll');
      }
    };

    // Track clicks
    const handleClick = () => {
      clickCount.current += 1;
    };

    // Agregar listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick);

    // NO trackeamos pageview al entrar - solo al salir con métricas completas

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick);

      // Track pageview con todas las métricas acumuladas
      if (pageStartTime.current) {
        const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000);
        analyticsService.trackPageview({
          time_on_page: timeOnPage,
          scroll_depth: scrollDepth.current,
          clicks: clickCount.current,
        });
      }
    };
  }, [location.pathname, section, isInitialized]);
}

/**
 * Hook para tracking de eventos específicos
 * Uso: const trackClick = useEventTracking()
 */
export function useEventTracking() {
  const { isInitialized } = useAnalytics();

  const trackClick = (eventName, target = null) => {
    if (!isInitialized) return;
    analyticsService.trackEvent('click', eventName, target);
  };

  const trackHover = (eventName, target = null) => {
    if (!isInitialized) return;
    analyticsService.trackEvent('hover', eventName, target);
  };

  const trackView = (eventName) => {
    if (!isInitialized) return;
    analyticsService.trackEvent('view', eventName);
  };

  return { trackClick, trackHover, trackView };
}

/**
 * Hook para tracking de engagement zones
 * Uso: const ref = useEngagementTracking('hero-section')
 */
export function useEngagementTracking(zoneId) {
  const { isInitialized } = useAnalytics();
  const elementRef = useRef(null);
  const startTime = useRef(null);
  const wasClicked = useRef(false);
  const scrollReached = useRef(false);

  useEffect(() => {
    if (!isInitialized || !elementRef.current) return;

    const element = elementRef.current;
    let observer;

    // Intersection Observer para detectar cuando está visible
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Elemento visible - empezar a contar tiempo
            if (!startTime.current) {
              startTime.current = Date.now();
              scrollReached.current = true;
            }
          } else {
            // Elemento no visible - registrar tiempo
            if (startTime.current) {
              const timeSpent = Date.now() - startTime.current;
              if (timeSpent > 5000) {
                // Solo track si estuvo >5 segundos
                analyticsService.trackEngagementZone(
                  zoneId,
                  timeSpent,
                  scrollReached.current,
                  wasClicked.current
                );
              }
              startTime.current = null;
            }
          }
        });
      },
      { threshold: 0.5 } // 50% del elemento visible
    );

    observer.observe(element);

    // Track clicks en la zona
    const handleClick = () => {
      wasClicked.current = true;
    };

    element.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      if (observer) observer.disconnect();
      element.removeEventListener('click', handleClick);

      // Track final si aún está visible
      if (startTime.current) {
        const timeSpent = Date.now() - startTime.current;
        if (timeSpent > 5000) {
          analyticsService.trackEngagementZone(
            zoneId,
            timeSpent,
            scrollReached.current,
            wasClicked.current
          );
        }
      }
    };
  }, [zoneId, isInitialized]);

  return elementRef;
}

/**
 * Hook para tracking de conversiones
 * Uso en botones/links importantes
 */
export function useConversionTracking() {
  const { isInitialized } = useAnalytics();

  const trackProjectView = (projectId) => {
    if (!isInitialized) return;
    analyticsService.trackConversion('project_view', projectId);
  };

  const trackContactClick = () => {
    if (!isInitialized) return;
    analyticsService.trackConversion('contact_click');
  };

  const trackLabVisit = () => {
    if (!isInitialized) return;
    analyticsService.trackConversion('lab_visit');
  };

  return { trackProjectView, trackContactClick, trackLabVisit };
}
