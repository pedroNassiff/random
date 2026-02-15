# Guía de Traducciones - Random Studio

## ✅ Resumen de Actualización

Se han actualizado y completado las traducciones en **3 idiomas** para toda la aplicación:
- 🇪🇸 Español
- 🇬🇧 Inglés  
- 🇫🇷 Francés

## 📁 Archivos de Traducción

```
src/i18n/locales/
├── es.json  (Español)
├── en.json  (Inglés)
└── fr.json  (Francés)
```

## 🆕 Secciones Agregadas

### 1. **Project Detail** (`project_detail`)
```json
{
  "client": "Cliente / Client / Client",
  "next_project": "Siguiente Proyecto / Next Project / Projet Suivant"
}
```

### 2. **Analytics** (`analytics`)
Nuevas traducciones para todo el dashboard de analytics:
- Títulos de métricas: `unique_visitors`, `total_sessions`, `pageviews`, `avg_duration`, `bounce_rate`, `return_rate`
- Secciones de gráficos: `sessions_over_time`, `device_breakdown`, `top_pages`, `top_events`, etc.
- Widget de actividad de usuarios: `user_activity`, `pages_visited`, `visits`, `clicks`, `sessions`, `time`
- Mensajes de estado: `no_data`, `no_geo_data`, `no_user_activity`

### 3. **Cookie Consent** (`cookies`)
Sistema completo de cookies con mensajes personalizados:
- `trust_message`: Mensaje principal del modal
- `helper_message`: Mensaje de ayuda para limpiar tracking
- `see_tracking`: Botón "ver quien me vigila"
- `tracking_title`: Título de la vista de storage
- `delete_all`: Botón eliminar todo
- `back`: Botón volver
- `final_message`: Mensaje final después de limpiar
- Tipos de cookies: `necessary`, `analytics`, `preferences`, `marketing` (con descripciones)
- Botones: `accept_all`, `reject_all`, `customize`
- Storage types: `local_storage`, `session_storage`, `cookies`

## 📝 Textos Existentes (Ya Traducidos)

### Navigation (`nav`)
- home, projects, services, lab, about

### Footer (`footer`)
- projects_title, work, services, lab, info_title, about, contact, rights

### Home (`home`)
- work_title, view_project, cta_description, discover_all
- services_title + 4 servicios (web_dev, cloud, ai, 3d)
- lab_title, go_to_lab
- about_title, about_text_1, about_text_2

### Work (`work`)
- title

## 🔧 Uso en Componentes

### Importar el hook de traducción:
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('analytics.title')}</h1>
      <p>{t('analytics.unique_visitors')}</p>
    </div>
  );
}
```

### Cambiar idioma:
```jsx
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  
  return (
    <>
      <button onClick={() => i18n.changeLanguage('es')}>Español</button>
      <button onClick={() => i18n.changeLanguage('en')}>English</button>
      <button onClick={() => i18n.changeLanguage('fr')}>Français</button>
    </>
  );
}
```

## ⚠️ Textos Hardcodeados Pendientes

Los siguientes archivos tienen textos que **deberían** usar el sistema i18n:

### Analytics.jsx
- ✅ **LISTO**: Todos los textos están en archivos JSON
- ⏳ **PENDIENTE**: Reemplazar strings hardcodeados por `{t('analytics.xxx')}`

```jsx
// ❌ Antes:
<p className="stat-label">Unique Visitors</p>

// ✅ Después:
<p className="stat-label">{t('analytics.unique_visitors')}</p>
```

### ProjectDetail.jsx
- ✅ **LISTO**: Textos agregados a JSON (`client`, `next_project`)
- ⏳ **PENDIENTE**: Reemplazar "Cliente" y "Siguiente Proyecto" por traducciones

```jsx
// ❌ Antes:
<h3 className="text-sm font-mono text-gray-500 uppercase mb-2">Cliente</h3>

// ✅ Después:
<h3 className="text-sm font-mono text-gray-500 uppercase mb-2">{t('project_detail.client')}</h3>
```

### CookieConsent.jsx
- ✅ **LISTO**: Todos los textos en JSON
- ⏳ **PENDIENTE**: Reemplazar textos hardcodeados por traducciones

```jsx
// ❌ Antes:
<p>confía, porque si no confías, no hay confianza</p>

// ✅ Después:
<p>{t('cookies.trust_message')}</p>
```

## 🎯 Próximos Pasos

1. **Implementar traducciones en Analytics.jsx**
   - Reemplazar todos los strings hardcodeados
   - Usar `{t('analytics.xxx')}`

2. **Implementar traducciones en ProjectDetail.jsx**
   - Importar `useTranslation`
   - Usar `{t('project_detail.client')}` y `{t('project_detail.next_project')}`

3. **Implementar traducciones en CookieConsent.jsx**
   - Reemplazar TODOS los textos en español
   - Usar sistema `t('cookies.xxx')`

4. **Agregar selector de idioma visible**
   - Agregar botones en Navbar o Footer
   - Guardar preferencia en localStorage

5. **Testing**
   - Verificar que todos los textos cambien al cambiar idioma
   - Revisar que no haya textos hardcodeados pendientes

## 📊 Estadísticas

- **Total de claves de traducción**: ~80
- **Idiomas soportados**: 3
- **Componentes con traducción**: 6+
- **Completitud**: 100% en archivos JSON, ~30% implementado en componentes

## 🌐 URLs con Idioma

Para cambiar el idioma por defecto, editar `src/i18n/config.js`:

```javascript
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es',  // ← Cambiar aquí el idioma por defecto
    fallbackLng: 'en',
    // ...
  });
```

## 💡 Tips

- Usar claves descriptivas: `analytics.unique_visitors` en vez de `analytics.uv`
- Agrupar por sección: `cookies.*`, `analytics.*`, `home.*`
- Mantener consistencia entre idiomas
- Agregar siempre los 3 idiomas cuando se agrega una nueva clave
- No usar HTML dentro de las traducciones (usar componentes React)
