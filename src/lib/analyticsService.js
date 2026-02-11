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

  const batch = [...eventQueue];
  eventQueue = [];

  await sendRequest('/batch', { events: batch });
}

/**
 * Agregar evento a la cola
 */
function queueEvent(eventType, data) {
  const sessionId = localStorage.getItem('analytics_session_id');
  if (!sessionId) return;

  eventQueue.push({
    type: eventType,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    ...data,
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
 * Analytics Service API
 */
export const analyticsService = {
  /**
   * Iniciar sesión de analytics
   */
  async startSession() {
    // Check DNT (Do Not Track)
    if (navigator.doNotTrack === '1') {
      console.log('Analytics: DNT enabled, tracking disabled');
      return null;
    }

    const response = await sendRequest('/session/start', {
      anonymous_id: getAnonymousId(),
      entry_page: window.location.pathname,
      referrer: document.referrer || undefined,
      ...getDeviceInfo(),
      ...getUtmParams(),
    });

    if (response?.session_id) {
      localStorage.setItem('analytics_session_id', response.session_id);
      localStorage.setItem('analytics_session_start', Date.now());
    }

    return response;
  },

  /**
   * Finalizar sesión
   */
  async endSession() {
    const sessionId = localStorage.getItem('analytics_session_id');
    if (!sessionId) return;

    // Flush queue antes de terminar
    await flushQueue();

    await sendRequest('/session/end', {
      session_id: sessionId,
      exit_page: window.location.pathname,
    });

    localStorage.removeItem('analytics_session_id');
    localStorage.removeItem('analytics_session_start');
  },

  /**
   * Track pageview
   */
  trackPageview(data) {
    queueEvent('pageview', {
      page_path: window.location.pathname,
      page_title: document.title,
      page_section: data.section || 'other',
      referrer: document.referrer || undefined,
      ...data,
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

    queueEvent('engagement', {
      zone_id: zoneId,
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
