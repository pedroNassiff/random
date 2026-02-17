import React, { useState, useEffect } from 'react';
import { X, Settings, Trash2, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '../lib/analyticsService';

export default function CookieConsent() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyHelper, setShowPrivacyHelper] = useState(false);
  const [showStorageView, setShowStorageView] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  
  const [cookies, setCookies] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false
  });

  const [storageData, setStorageData] = useState({
    localStorage: [],
    sessionStorage: [],
    cookies: []
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      const glitchInterval = setInterval(() => {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 300);
      }, Math.random() * 5000 + 3000);

      return () => clearInterval(glitchInterval);
    }
  }, [isVisible]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true
    };
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    setShowPrivacyHelper(true);
  };

  const handleRejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false
    };
    localStorage.setItem('cookieConsent', JSON.stringify(onlyNecessary));
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(cookies));
    setIsVisible(false);
  };

  const toggleCookie = (type) => {
    if (type === 'necessary') return;
    setCookies(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const getAllStorageData = () => {
    const localItems = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      localItems.push({ key, value, type: 'localStorage' });
    }

    const sessionItems = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      sessionItems.push({ key, value, type: 'sessionStorage' });
    }

    const cookieItems = document.cookie.split(';').map(cookie => {
      const [key, ...valueParts] = cookie.trim().split('=');
      return { key, value: valueParts.join('='), type: 'cookie' };
    }).filter(item => item.key);

    setStorageData({
      localStorage: localItems,
      sessionStorage: sessionItems,
      cookies: cookieItems
    });
  };

  const handleShowStorage = () => {
    getAllStorageData();
    setShowStorageView(true);
  };

  const deleteStorageItem = (type, key) => {
    if (type === 'localStorage') {
      localStorage.removeItem(key);
    } else if (type === 'sessionStorage') {
      sessionStorage.removeItem(key);
    } else if (type === 'cookie') {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
    getAllStorageData();
  };

  const deleteAllStorage = () => {
    const consent = localStorage.getItem('cookieConsent');
    
    // 1. EXTRAER DATOS IMPORTANTES ANTES DE BORRAR
    const extractedData = extractUserMetadata();
    
    // 2. ENVIAR AL BACKEND
    if (Object.keys(extractedData).length > 0) {
      analyticsService.sendUserMetadata(extractedData).catch(err => {
        console.error('Error enviando metadata:', err);
      });
    }
    
    // 3. LIMPIAR STORAGE
    localStorage.clear();
    sessionStorage.clear();
    
    document.cookie.split(';').forEach(cookie => {
      const [key] = cookie.trim().split('=');
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });

    // 4. RESTAURAR COOKIE CONSENT
    if (consent) {
      localStorage.setItem('cookieConsent', consent);
    }
    
    // 5. MOSTRAR MENSAJE FINAL Y EFECTO GLITCH
    setShowFinalMessage(true);
    
    let intensity = 0;
    const glitchInterval = setInterval(() => {
      intensity += 0.05;
      setGlitchIntensity(intensity);
      
      if (intensity >= 1) {
        clearInterval(glitchInterval);
        setTimeout(() => {
          setIsVisible(false);
          setShowFinalMessage(false);
          setGlitchIntensity(0);
          setShowStorageView(false);
          setShowPrivacyHelper(false);
        }, 300);
      }
    }, 150);
  };

  /**
   * Extrae metadata importante del usuario desde localStorage, sessionStorage y cookies
   */
  const extractUserMetadata = () => {
    const metadata = {};
    
    // Patrones de búsqueda para datos importantes
    const patterns = {
      email: ['email', 'userEmail', 'user_email', 'e-mail', 'correo'],
      name: ['name', 'userName', 'user_name', 'username', 'fullName', 'full_name', 'nombre'],
      userId: ['userId', 'user_id', 'uid', 'id', 'user'],
      phone: ['phone', 'phoneNumber', 'phone_number', 'telefono', 'tel'],
      location: ['location', 'city', 'ciudad', 'country', 'pais', 'region'],
      language: ['language', 'lang', 'i18nextLng', 'locale', 'idioma'],
      timezone: ['timezone', 'tz'],
      company: ['company', 'empresa', 'organization'],
      role: ['role', 'userRole', 'tipo_usuario']
    };

    // Función auxiliar para buscar en un objeto de storage
    const searchInStorage = (storage, type) => {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const value = storage.getItem(key);
        
        // Saltar datos de analytics internos y cookie consent
        if (key.startsWith('analytics_') || key === 'cookieConsent') continue;
        
        try {
          // Intentar parsear JSON
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) {
            searchInObject(parsed, key, type);
          } else {
            checkValue(key, value, type);
          }
        } catch {
          // No es JSON, buscar por key
          checkValue(key, value, type);
        }
      }
    };

    // Buscar en un objeto parseado
    const searchInObject = (obj, parentKey, storageType) => {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          searchInObject(value, `${parentKey}.${key}`, storageType);
        } else {
          checkValue(key, value, storageType, parentKey);
        }
      });
    };

    // Verificar si una key coincide con algún patrón
    const checkValue = (key, value, storageType, parentKey = '') => {
      const lowerKey = key.toLowerCase();
      
      Object.entries(patterns).forEach(([dataType, patternList]) => {
        if (!metadata[dataType]) { // Solo tomar el primer match
          patternList.forEach(pattern => {
            if (lowerKey.includes(pattern) && value && typeof value === 'string') {
              // Validaciones básicas
              if (dataType === 'email' && !value.includes('@')) return;
              if (dataType === 'phone' && value.length < 7) return;
              if (value.length > 200) return; // Evitar datos muy largos
              
              metadata[dataType] = {
                value: value,
                source: storageType,
                key: parentKey || key
              };
            }
          });
        }
      });
    };

    // Buscar en localStorage
    searchInStorage(localStorage, 'localStorage');
    
    // Buscar en sessionStorage
    searchInStorage(sessionStorage, 'sessionStorage');
    
    // Buscar en cookies
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const [key, value] = cookie.trim().split('=').map(s => s.trim());
      if (key && value) {
        checkValue(key, decodeURIComponent(value), 'cookie');
      }
    });

    // Agregar metadata del navegador
    metadata.browser = {
      value: navigator.userAgent,
      source: 'navigator'
    };
    
    metadata.viewport = {
      value: `${window.innerWidth}x${window.innerHeight}`,
      source: 'window'
    };

    metadata.currentPage = {
      value: window.location.pathname,
      source: 'location'
    };

    console.log('📊 Metadata extraída:', metadata);
    
    return metadata;
  };

  if (!isVisible) return null;

  return (
    <>
      <style>
        {`
          @keyframes cookie-scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
          
          @keyframes cookie-glitch-border {
            0% { clip-path: inset(40% 0 50% 0); }
            20% { clip-path: inset(90% 0 1% 0); }
            40% { clip-path: inset(10% 0 85% 0); }
            60% { clip-path: inset(65% 0 5% 0); }
            80% { clip-path: inset(30% 0 65% 0); }
            100% { clip-path: inset(5% 0 90% 0); }
          }
        `}
      </style>
      <div 
        className={`fixed bottom-4 left-4 z-[9999] w-[340px] transition-all duration-300 ${
          isGlitching ? 'glitch-active' : ''
        }`}
      >
        <div 
          className="relative bg-black/95 backdrop-blur-xl border rounded-xl"
          style={{
            borderColor: isGlitching || glitchIntensity > 0 ? '#00FFD1' : '#2a2929',
            boxShadow: isGlitching || glitchIntensity > 0
              ? '0px 0px 30px rgba(0, 255, 209, 0.4), inset 0px 0px 20px rgba(0, 255, 209, 0.1)' 
              : '0px 4px 24px rgba(0, 0, 0, 0.8)',
            transition: isGlitching || glitchIntensity > 0 ? 'none' : 'all 0.3s ease',
            maxHeight: showStorageView ? '520px' : 'auto',
            overflow: 'hidden',
            transform: glitchIntensity > 0 ? `
              translateX(${Math.sin(glitchIntensity * 20) * glitchIntensity * 10}px)
              translateY(${Math.cos(glitchIntensity * 15) * glitchIntensity * 10}px)
              scale(${1 - glitchIntensity * 0.2})
            ` : 'none',
            opacity: 1 - glitchIntensity * 0.5,
            filter: glitchIntensity > 0.5 ? `blur(${glitchIntensity * 3}px)` : 'none'
          }}
        >
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 209, 0.03) 2px, rgba(0, 255, 209, 0.03) 4px)',
            animation: 'cookie-scan 8s linear infinite'
          }}
        />

        <div className="relative p-4">
          {showFinalMessage ? (
            <>
              <div className="mb-3">
                <p 
                  className="text-sm font-medium text-white leading-relaxed text-center font-geist-pixel"
                  style={{
                    textShadow: `${glitchIntensity * 2}px ${glitchIntensity * 2}px 0px #00FFD1, -${glitchIntensity * 2}px -${glitchIntensity * 2}px 0px #FF6B2C`,
                    transform: `translateX(${Math.sin(glitchIntensity * 10) * glitchIntensity * 5}px)`,
                    opacity: 1 - glitchIntensity * 0.3
                  }}
                >
                  {t('cookies.final_message')}
                </p>
              </div>
            </>
          ) : showPrivacyHelper && !showStorageView ? (
            <>
              <div className="mb-3">
                <p 
                  className="text-sm font-medium text-white leading-relaxed font-geist-pixel"
                  style={{
                    textShadow: isGlitching 
                      ? '1px 1px 0px #00FFD1, -1px -1px 0px #FF6B2C' 
                      : 'none',
                  }}
                >
                  {t('cookies.helper_message')}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleShowStorage}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium text-black transition-all duration-200 relative overflow-hidden group flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#00FFD1' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0px 0px 15px rgba(0, 255, 209, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Eye size={14} />
                  <span className="relative z-10">{t('cookies.see_tracking')}</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <X size={16} />
                </button>
              </div>
            </>
          ) : showStorageView ? (
            <>
              <div className="mb-3">
                <h3 className="text-sm font-medium text-white mb-2">{t('cookies.tracking_title')}</h3>
              </div>

              <div 
                className="mb-3 space-y-2 pr-1" 
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#00FFD1 rgba(255,255,255,0.1)'
                }}
              >
                {storageData.localStorage.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-[#00FFD1] font-medium mb-1.5">LocalStorage ({storageData.localStorage.length})</p>
                    {storageData.localStorage.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded p-2 mb-1.5">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs text-white font-medium truncate">{item.key}</p>
                          <p className="text-[10px] text-white/50 truncate">{item.value.substring(0, 30)}...</p>
                        </div>
                        <button
                          onClick={() => deleteStorageItem('localStorage', item.key)}
                          className="p-1.5 rounded hover:bg-[#FF6B2C]/20 transition-colors duration-200"
                        >
                          <Trash2 size={12} className="text-[#FF6B2C]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {storageData.sessionStorage.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-[#00FFD1] font-medium mb-1.5">SessionStorage ({storageData.sessionStorage.length})</p>
                    {storageData.sessionStorage.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded p-2 mb-1.5">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs text-white font-medium truncate">{item.key}</p>
                          <p className="text-[10px] text-white/50 truncate">{item.value.substring(0, 30)}...</p>
                        </div>
                        <button
                          onClick={() => deleteStorageItem('sessionStorage', item.key)}
                          className="p-1.5 rounded hover:bg-[#FF6B2C]/20 transition-colors duration-200"
                        >
                          <Trash2 size={12} className="text-[#FF6B2C]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {storageData.cookies.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-[#00FFD1] font-medium mb-1.5">Cookies ({storageData.cookies.length})</p>
                    {storageData.cookies.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded p-2 mb-1.5">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs text-white font-medium truncate">{item.key}</p>
                          <p className="text-[10px] text-white/50 truncate">{item.value.substring(0, 30)}...</p>
                        </div>
                        <button
                          onClick={() => deleteStorageItem('cookie', item.key)}
                          className="p-1.5 rounded hover:bg-[#FF6B2C]/20 transition-colors duration-200"
                        >
                          <Trash2 size={12} className="text-[#FF6B2C]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {storageData.localStorage.length === 0 && 
                 storageData.sessionStorage.length === 0 && 
                 storageData.cookies.length === 0 && (
                  <p className="text-xs text-white/60 text-center py-4">No hay datos almacenados</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={deleteAllStorage}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium text-white transition-all duration-200 relative overflow-hidden group"
                  style={{ 
                    backgroundColor: '#FF6B2C',
                    border: '1px solid rgba(255, 107, 44, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0px 0px 15px rgba(255, 107, 44, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span className="relative z-10">{t('cookies.delete_all')}</span>
                  <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                </button>

                <button
                  onClick={() => {
                    setShowStorageView(false);
                    setShowPrivacyHelper(false);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium text-white transition-all duration-200 border border-white/20 hover:border-[#00FFD1] hover:bg-[#00FFD1]/10"
                >
                  {t('cookies.back')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <h3 
                  className="text-sm font-medium text-white tracking-wide font-geist-pixel"
                  style={{
                    textShadow: isGlitching 
                      ? '1px 1px 0px #00FFD1, -1px -1px 0px #FF6B2C' 
                      : 'none',
                  }}
                >
                 {t('cookies.trust_message')}
                </h3>
              </div>

              {showSettings && (
                <div className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white font-medium">{t('cookies.necessary')}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{t('cookies.necessary_desc')}</p>
                    </div>
                    <div className="w-8 h-5 bg-[#00FFD1] rounded-full flex items-center px-0.5">
                      <div className="w-3.5 h-3.5 bg-black rounded-full ml-auto" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white font-medium">{t('cookies.analytics')}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{t('cookies.analytics_desc')}</p>
                    </div>
                    <button
                      onClick={() => toggleCookie('analytics')}
                      className={`w-8 h-5 rounded-full flex items-center px-0.5 transition-colors duration-200 ${
                        cookies.analytics ? 'bg-[#00FFD1]' : 'bg-white/20'
                      }`}
                    >
                      <div 
                        className={`w-3.5 h-3.5 bg-black rounded-full transition-all duration-200 ${
                          cookies.analytics ? 'ml-auto' : 'ml-0'
                        }`} 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white font-medium">{t('cookies.marketing')}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{t('cookies.marketing_desc')}</p>
                    </div>
                    <button
                      onClick={() => toggleCookie('marketing')}
                      className={`w-8 h-5 rounded-full flex items-center px-0.5 transition-colors duration-200 ${
                        cookies.marketing ? 'bg-[#00FFD1]' : 'bg-white/20'
                      }`}
                    >
                      <div 
                        className={`w-3.5 h-3.5 bg-black rounded-full transition-all duration-200 ${
                          cookies.marketing ? 'ml-auto' : 'ml-0'
                        }`} 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white font-medium">{t('cookies.preferences')}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{t('cookies.preferences_desc')}</p>
                    </div>
                    <button
                      onClick={() => toggleCookie('preferences')}
                      className={`w-8 h-5 rounded-full flex items-center px-0.5 transition-colors duration-200 ${
                        cookies.preferences ? 'bg-[#00FFD1]' : 'bg-white/20'
                      }`}
                    >
                      <div 
                        className={`w-3.5 h-3.5 bg-black rounded-full transition-all duration-200 ${
                          cookies.preferences ? 'ml-auto' : 'ml-0'
                        }`} 
                      />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {showSettings ? (
                  <>
                    <button
                      onClick={handleSavePreferences}
                      className="w-full py-2.5 rounded-lg text-xs font-medium text-black transition-all duration-200 relative overflow-hidden group"
                      style={{ backgroundColor: '#00FFD1' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0px 0px 15px rgba(0, 255, 209, 0.5)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <span className="relative z-10">{t('cookies.save_preferences')}</span>
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                    </button>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-full py-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all duration-200"
                    >
                      {t('cookies.back')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAcceptAll}
                      className="w-full py-2.5 rounded-lg text-xs font-medium text-black transition-all duration-200 relative overflow-hidden group"
                      style={{ backgroundColor: '#00FFD1' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0px 0px 15px rgba(0, 255, 209, 0.5)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <span className="relative z-10">{t('cookies.accept_all')}</span>
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleRejectAll}
                        className="flex-1 py-2.5 rounded-lg text-xs font-medium text-white transition-all duration-200 relative overflow-hidden group"
                        style={{ 
                          backgroundColor: '#FF6B2C',
                          border: '1px solid rgba(255, 107, 44, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0px 0px 15px rgba(255, 107, 44, 0.5)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <span className="relative z-10">{t('cookies.reject_all')}</span>
                        <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200" />
                      </button>

                      <button
                        onClick={() => setShowSettings(true)}
                        className="flex-1 py-2.5 rounded-lg text-xs font-medium text-white transition-all duration-200 border border-white/20 hover:border-[#00FFD1] hover:bg-[#00FFD1]/10 flex items-center justify-center gap-1.5"
                      >
                        <Settings size={13} />
                        {t('cookies.customize')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {(isGlitching || glitchIntensity > 0) && (
          <>
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                border: '2px solid #00FFD1',
                animation: 'cookie-glitch-border 0.3s steps(2, end) infinite',
                opacity: glitchIntensity > 0 ? 0.3 + glitchIntensity * 0.7 : 1
              }}
            />
            {glitchIntensity > 0.3 && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(${glitchIntensity * 360}deg, rgba(0, 255, 209, ${glitchIntensity * 0.3}), rgba(233, 75, 232, ${glitchIntensity * 0.3}))`,
                  mixBlendMode: 'difference'
                }}
              />
            )}
            {glitchIntensity > 0.6 && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 209, 0.2) 2px, rgba(0, 255, 209, 0.2) 4px)',
                  transform: `translateY(${Math.sin(glitchIntensity * 30) * 100}px)`
                }}
              />
            )}
          </>
        )}
        </div>
      </div>
    </>
  );
}
