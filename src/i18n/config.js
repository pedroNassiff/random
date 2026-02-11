import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

i18n
  // Detecta el idioma del navegador/sistema automáticamente
  .use(LanguageDetector)
  // Integra con React
  .use(initReactI18next)
  // Inicializa i18next
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      fr: { translation: fr }
    },
    // Idioma por defecto si no se detecta ninguno
    fallbackLng: 'es',
    // Idiomas soportados
    supportedLngs: ['es', 'en', 'fr'],
    // Interpolación
    interpolation: {
      escapeValue: false // React ya escapa por defecto
    },
    // Detección de idioma
    detection: {
      // Orden de detección: localStorage -> navegador -> idioma por defecto
      order: ['localStorage', 'navigator'],
      // Cache del idioma seleccionado
      caches: ['localStorage'],
      // Clave para localStorage
      lookupLocalStorage: 'i18nextLng'
    }
  });

export default i18n;
