/**
 * Analytics Service
 * Cliente para enviar datos de analytics al backend
 */

const API_URL = import.meta.env.VITE_ANALYTICS_API || 'http://localhost:8000/analytics';

// Cola para batch processing
let eventQueue = [];
let flushTimer = null;
const BATCH_INTERVAL = 30000; // 30 segundos
const MAX_QUEUE_SIZE = 50;

// Tracking de sesión
let totalClicks = 0;
let scrollDepths = [];
let currentSection = null;
let sectionStartTime = null;
let engagementZones = {}; // { section: totalSeconds }

/**
 * Envía petición al backend
 */
async function sendRequest(endpoint, data) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`Analytics error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Analytics request failed:', error);
    return null;
  }
}

/**
 * Flush batch queue
 */
async function flushQueue() {
  if (eventQueue.length === 0) return;

  const sessionId = localStorage.getItem('analytics_session_id');
  if (!sessionId) {
    console.warn('⚠️  Analytics: No session ID, cannot flush queue');
    return;
  }

  const batch = [...eventQueue];
  eventQueue = [];

  console.log('📦 Analytics: Flushing batch queue:', batch.length, 'events');

  // Separar eventos por tipo
  const pageviews = [];
  const events = [];
  const engagement_zones = [];
  const conversions = [];

  batch.forEach(item => {
    if (item.type === 'pageview') {
      pageviews.push(item.data);
    } else if (item.type === 'engagement_zone') {
      engagement_zones.push(item.data);
    } else if (item.type === 'conversion') {
      conversions.push(item.data);
    } else {
      events.push(item.data);
    }
  });

  await sendRequest('/batch', { 
    session_id: sessionId,
    pageviews,
    events,
    engagement_zones,
    conversions
  });
}

/**
 * Agregar evento a la cola
 */
function queueEvent(eventType, data) {
  const sessionId = localStorage.getItem('analytics_session_id');
  if (!sessionId) return;

  eventQueue.push({
    type: eventType,
    data: {
      session_id: sessionId,
      ...data,
    }
  });

  // Si la cola está llena, flush inmediato
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
    clearTimeout(flushTimer);
  } else if (!flushTimer) {
    // Programar flush automático
    flushTimer = setTimeout(() => {
      flushQueue();
      flushTimer = null;
    }, BATCH_INTERVAL);
  }
}

/**
 * Obtener información del dispositivo
 */
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
    deviceType = /tablet|ipad/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Detectar browser
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  // Detectar OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return {
    device_type: deviceType,
    browser,
    os,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Obtener o crear anonymous ID
 */
function getAnonymousId() {
  let id = localStorage.getItem('analytics_anonymous_id');
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('analytics_anonymous_id', id);
  }
  return id;
}

/**
 * Parsear parámetros UTM de la URL
 */
function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    utm_term: params.get('utm_term') || undefined,
  };
}

/**
 * Obtener geolocalización usando ipapi.co
 * NOTA: Esta función ya no se usa porque ipapi.co no soporta CORS.
 * La geolocalización se maneja en el backend.
 */
async function getGeolocation() {
  // Retornar vacío - el backend se encargará de la geolocalización
  return {};
}

/**
 * Hash de IP para privacidad (simple hash)
 */
function hashIP(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Iniciar tracking de engagement en una sección
 */
function startSectionTracking(section) {
  // Finalizar sección anterior
  if (currentSection && sectionStartTime) {
    const timeSpent = Math.floor((Date.now() - sectionStartTime) / 1000);
    engagementZones[currentSection] = (engagementZones[currentSection] || 0) + timeSpent;
  }
  
  // Iniciar nueva sección
  currentSection = section;
  sectionStartTime = Date.now();
}

/**
 * Finalizar tracking de engagement de sección actual
 */
function endSectionTracking() {
  if (currentSection && sectionStartTime) {
    const timeSpent = Math.floor((Date.now() - sectionStartTime) / 1000);
    engagementZones[currentSection] = (engagementZones[currentSection] || 0) + timeSpent;
  }
  currentSection = null;
  sectionStartTime = null;
}

/**
 * Track clicks
 */
function trackClick(event) {
  totalClicks++;
}

/**
 * Track scroll depth
 */
let scrollTimeout = null;
function trackScroll() {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollPercent = Math.round((scrollTop / scrollHeight) * 100);
    
    if (!isNaN(scrollPercent) && scrollPercent >= 0 && scrollPercent <= 100) {
      scrollDepths.push(scrollPercent);
      
      // Mantener solo los últimos 10 valores para no saturar memoria
      if (scrollDepths.length > 10) {
        scrollDepths.shift();
      }
    }
  }, 250); // Debounce de 250ms
}

/**
 * Analytics Service API
 */
export const analyticsService = {
  /**
   * Iniciar sesión de analytics
   */
  async startSession() {
    console.log('🚀 Analytics: Iniciando sesión...');
    
    // Check DNT (Do Not Track)
    if (navigator.doNotTrack === '1') {
      console.log('Analytics: DNT enabled, tracking disabled');
      return null;
    }

    // Obtener geolocalización
    const geolocation = await getGeolocation();

    const sessionData = {
      anonymous_id: getAnonymousId(),
      entry_page: window.location.pathname,
      referrer: document.referrer || undefined,
      ...getDeviceInfo(),
      ...getUtmParams(),
      ...geolocation,
    };
    
    console.log('📤 Analytics: Enviando datos de sesión:', sessionData);
    console.log('🌐 Analytics: API URL:', API_URL);

    const response = await sendRequest('/session/start', sessionData);
    
    console.log('📥 Analytics: Respuesta del servidor:', response);

    if (response?.session_id) {
      localStorage.setItem('analytics_session_id', response.session_id);
      localStorage.setItem('analytics_session_start', Date.now());
      console.log('✅ Analytics: Sesión iniciada:', response.session_id);
      
      // Iniciar tracking de clicks
      document.addEventListener('click', trackClick);
      
      // Iniciar tracking de scroll
      window.addEventListener('scroll', trackScroll);
      
      // Iniciar tracking de sección actual
      const section = getCurrentSection();
      startSectionTracking(section);
    } else {
      console.error('❌ Analytics: No se recibió session_id');
    }

    return response;
  },

  /**
   * Finalizar sesión
   */
  async endSession() {
    const sessionId = localStorage.getItem('analytics_session_id');
    if (!sessionId) return;

    // Finalizar tracking de sección actual
    endSectionTracking();

    // Flush queue antes de terminar
    await flushQueue();

    // Enviar engagement zones
    for (const [zone, timeSpent] of Object.entries(engagementZones)) {
      if (timeSpent > 0) {
        await sendRequest('/engagement', {
          session_id: sessionId,
          zone_id: zone,
          zone_name: zone,
          time_spent: timeSpent,
          page_path: window.location.pathname,
        });
      }
    }

    // Calcular avg_scroll_depth
    const avgScrollDepth = scrollDepths.length > 0 
      ? Math.round(scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length)
      : 0;

    // Enviar datos finales de sesión
    await sendRequest('/session/end', {
      session_id: sessionId,
      exit_page: window.location.pathname,
      total_clicks: totalClicks,
      avg_scroll_depth: avgScrollDepth,
    });

    // Limpiar listeners
    document.removeEventListener('click', trackClick);
    window.removeEventListener('scroll', trackScroll);

    // Resetear contadores
    totalClicks = 0;
    scrollDepths = [];
    engagementZones = {};

    localStorage.removeItem('analytics_session_id');
    localStorage.removeItem('analytics_session_start');
  },

  /**
   * Track pageview
   */
  trackPageview(data = {}) {
    // Cambiar sección cuando cambias de página
    const section = getCurrentSection();
    startSectionTracking(section);
    
    // Limpiar campos no válidos para el modelo PageView
    const { section: _, ...validData } = data;
    
    queueEvent('pageview', {
      page_path: window.location.pathname,
      page_title: document.title,
      page_section: section,
      referrer: document.referrer || undefined,
      ...validData,
    });
  },

  /**
   * Track evento de interacción
   */
  trackEvent(eventType, eventName, target = null) {
    const eventData = {
      event_type: eventType,
      event_name: eventName,
      page_path: window.location.pathname,
      page_section: getCurrentSection(),
    };

    if (target) {
      eventData.target_element = target.tagName?.toLowerCase();
      eventData.target_id = target.id || undefined;
      eventData.target_text = target.textContent?.substring(0, 100) || undefined;
    }

    queueEvent('event', eventData);
  },

  /**
   * Track engagement en zona específica
   */
  trackEngagementZone(zoneId, timeSpent, scrollReached = false, clicked = false) {
    if (timeSpent < 5000) return; // Solo track si > 5 segundos

    queueEvent('engagement_zone', {
      zone_id: zoneId,
      zone_name: zoneId, // Usar el mismo ID como nombre legible
      time_spent: Math.floor(timeSpent / 1000), // Convertir a segundos
      scroll_reached: scrollReached,
      clicked,
      page_path: window.location.pathname,
    });
  },

  /**
   * Track conversión
   */
  trackConversion(conversionType, value = null) {
    queueEvent('conversion', {
      conversion_type: conversionType,
      conversion_value: value,
      page_path: window.location.pathname,
    });
  },

  /**
   * Flush manual de la cola
   */
  flush: flushQueue,

  /**
   * Get summary (para dashboard admin)
   */
  async getSummary(days = 30) {
    try {
      const response = await fetch(`${API_URL}/summary?days=${days}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch analytics summary:', error);
      return null;
    }
  },

  /**
   * Enviar metadata de usuario extraída del storage
   */
  async sendUserMetadata(metadata) {
    const sessionId = localStorage.getItem('analytics_session_id');
    if (!sessionId) {
      console.warn('⚠️  Analytics: No session ID, cannot send user metadata');
      return null;
    }

    console.log('📤 Analytics: Enviando metadata de usuario:', metadata);

    const response = await sendRequest('/user/metadata', {
      session_id: sessionId,
      metadata,
      timestamp: new Date().toISOString()
    });

    if (response) {
      console.log('✅ Analytics: Metadata de usuario guardada');
    }

    return response;
  },
};

/**
 * Obtener sección actual basada en la URL
 */
function getCurrentSection() {
  const path = window.location.pathname;
  if (path === '/') return 'home';
  if (path.startsWith('/work')) return 'work';
  if (path.startsWith('/services')) return 'services';
  if (path.startsWith('/lab')) return 'lab';
  if (path.startsWith('/about')) return 'about';
  return 'other';
}

// Cleanup al cerrar la página
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analyticsService.flush();
    // Usar sendBeacon si está disponible para enviar datos al cerrar
    const sessionId = localStorage.getItem('analytics_session_id');
    if (sessionId && navigator.sendBeacon) {
      const data = JSON.stringify({
        session_id: sessionId,
        exit_page: window.location.pathname,
      });
      navigator.sendBeacon(`${API_URL}/session/end`, data);
    }
  });
}
