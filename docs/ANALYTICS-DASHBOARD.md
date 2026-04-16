# 📊 Analytics Dashboard

Dashboard moderno para visualizar las estadísticas de tu portfolio en tiempo real.

## 🎨 Características

- **Diseño Moderno**: Estilo glassmorphism con gradientes y efectos glow
- **Dark Theme**: Tema oscuro con colores neón (cyan, magenta, amarillo)
- **Responsive**: Adaptado para desktop, tablet y móvil
- **Charts Interactivos**: Usando ApexCharts para visualizaciones dinámicas
- **Tiempo Real**: Datos actualizados según el rango seleccionado (7D, 30D, 90D)

## 📈 Métricas Mostradas

### Stats Cards (6 métricas principales):
1. **Unique Visitors** 👥 - Visitantes únicos
2. **Total Sessions** 📊 - Sesiones totales
3. **Pageviews** 👁️ - Vistas de página
4. **Avg Duration** ⏱️ - Duración promedio de sesión
5. **Bounce Rate** 🎯 - Tasa de rebote
6. **Return Rate** 🔄 - Tasa de retorno

### Gráficos:

1. **Sessions Over Time** (Línea/Área)
   - Muestra evolución de sesiones día a día
   - Gradiente cyan → magenta

2. **Device Breakdown** (Donut)
   - Distribución por tipo de dispositivo
   - Desktop, Mobile, Tablet

3. **Top Pages** (Barras horizontales)
   - Páginas más visitadas
   - Ordenadas por número de views

4. **Top Events** (Lista)
   - Eventos más frecuentes
   - Con ranking visual (1, 2, 3...)
   - Muestra tipo de evento y elemento target

5. **Engagement Zones** (Barras de progreso)
   - Zonas con mayor tiempo de atención
   - Con indicador de duración promedio

6. **Traffic Sources** (Grid de cards)
   - Fuentes de tráfico con iconos
   - Direct 🔗, Google 🔍, LinkedIn 💼, GitHub 🐙
   - Con porcentaje del total

## 🚀 Acceso al Dashboard

### Desktop:
- Ícono de **gráfico (BarChart3)** en la esquina superior derecha del navbar
- Click para acceder a `/analytics`

### Móvil:
- Abrir menú hamburguesa
- Última opción: "📊 Analytics"

## 🔧 Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Development
VITE_ANALYTICS_API=http://localhost:8000/analytics

# Production
# VITE_ANALYTICS_API=https://api.random-studio.io/analytics
```

### 2. Backend Requerido

El dashboard consume la API de analytics del backend. Endpoints usados:

- `GET /analytics/summary?days={7|30|90}`
- `GET /analytics/top-pages?days={days}&limit=10`
- `GET /analytics/top-events?days={days}&limit=10`
- `GET /analytics/top-engagement-zones?days={days}&limit=10`

### 3. Dependencias

```bash
npm install apexcharts react-apexcharts
```

## 📁 Estructura de Archivos

```
src/
├── pages/
│   └── Analytics.jsx          # Componente principal del dashboard
├── services/
│   └── analyticsApi.js        # Cliente HTTP para consumir API
├── styles/
│   └── Analytics.css          # Estilos del dashboard
└── App.jsx                    # Router con ruta /analytics
```

## 🎨 Paleta de Colores

```css
Cyan:    #00F5FF  /* Primario, líneas, botones activos */
Magenta: #FF00FF  /* Secundario, gradientes */
Amarillo:#FFD700  /* Acentos */
Verde:   #00FF88  /* Engagement, tasas positivas */
Rojo:    #FF1744  /* Bounce rate, alertas */
Azul:    #2196F3  /* Return rate */
```

## 🔒 Protección

Por ahora el dashboard es de acceso **público**. Recomendaciones para producción:

1. **Agregar autenticación**: Proteger la ruta `/analytics` con login
2. **Role-based access**: Solo admins pueden ver analytics
3. **IP Whitelist**: Restringir acceso por IP
4. **API Key**: Validar API key en el backend

### Ejemplo de Protección (React):

```jsx
// src/pages/Analytics.jsx
import { useAuth } from '../hooks/useAuth';

const Analytics = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <Loading />;
  
  // Redirigir si no es admin
  if (!user || user.role !== 'admin') {
    navigate('/');
    return null;
  }
  
  // ... resto del código
};
```

## 🧪 Testing

### Verificar que el dashboard funcione:

1. **Backend corriendo**: 
   ```bash
   curl http://localhost:8000/analytics/health
   # Debería responder: {"status": "healthy"}
   ```

2. **Frontend corriendo**:
   ```bash
   npm run dev
   ```

3. **Acceder al dashboard**:
   ```
   http://localhost:5173/analytics
   ```

4. **Verificar datos**:
   - Stats cards deben mostrar números
   - Gráficos deben renderizar
   - Time range buttons deben funcionar (7D, 30D, 90D)

### Datos de prueba:

Si el backend no tiene datos aún, puedes simular tráfico:
1. Navega por tu portfolio (Home, Work, proyectos)
2. Haz clicks en botones
3. Scrollea en diferentes secciones
4. Espera unos minutos
5. Refresca el dashboard

## 📊 Performance

- **Lazy Loading**: Los gráficos se cargan bajo demanda
- **Caching**: Considera implementar cache de 5 minutos para las queries
- **Parallel Requests**: Los 4 endpoints se llaman en paralelo con `Promise.all`
- **Optimistic UI**: Muestra skeleton/loading mientras carga

## 🚀 Mejoras Futuras

1. **Exportar datos**: Botón para descargar CSV/PDF
2. **Comparación de períodos**: "vs. período anterior"
3. **Alertas**: Notificaciones cuando métricas superan umbrales
4. **Filtros avanzados**: Por página, evento, dispositivo
5. **Real-time updates**: WebSocket para datos en vivo
6. **Heatmaps**: Ver dónde hacen click los usuarios
7. **Funnels**: Conversión por pasos
8. **A/B Testing**: Comparar variantes

## 🐛 Troubleshooting

### Error: "Failed to fetch analytics"

**Causa**: Backend no está corriendo o CORS bloqueado

**Solución**:
```bash
# Verificar backend
curl http://localhost:8000/analytics/health

# Verificar CORS en backend/.env
CORS_ORIGINS=http://localhost:5173,https://random-studio.io
```

### Gráficos no se renderizan

**Causa**: ApexCharts no instalado

**Solución**:
```bash
npm install apexcharts react-apexcharts
```

### Datos vacíos

**Causa**: No hay tráfico registrado aún

**Solución**:
1. Integra el sistema de tracking en las páginas (ver `ANALYTICS-INTEGRATION.md`)
2. Navega por el sitio para generar eventos
3. Verifica que los datos lleguen a PostgreSQL:
   ```sql
   SELECT COUNT(*) FROM sessions;
   SELECT COUNT(*) FROM pageviews;
   ```

---

## 📞 Soporte

Si tienes problemas con el dashboard:
1. Revisa logs del backend: `journalctl -u brain-backend -f`
2. Revisa console del navegador (F12)
3. Verifica que las tablas de analytics existan en la BD
4. Confirma que el .env tenga la URL correcta

---

**Hecho con 💜 para .RANDOM()**
