# 🚀 Despliegue en Vercel

Este documento explica cómo desplegar tu portfolio en Vercel.

## 📦 Instalación Inicial (Solo una vez)

```bash
# Instalar Vercel CLI globalmente
npm install -g vercel
```

## 🔐 Primer Despliegue

### Opción 1: Desde la terminal (Recomendado)

```bash
# 1. Login en Vercel (abre el navegador para autenticar)
vercel login

# 2. Deploy en producción
npm run deploy
```

La primera vez te pedirá:
- **Set up and deploy?** → Yes
- **Which scope?** → Selecciona tu cuenta
- **Link to existing project?** → No (primera vez)
- **What's your project's name?** → random-portfolio (o el que quieras)
- **In which directory is your code located?** → ./ (presiona Enter)
- **Override settings?** → No (usa vercel.json)

### Opción 2: Desde el Dashboard de Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Conecta tu repositorio de GitHub/GitLab/Bitbucket
3. Vercel detectará automáticamente que es un proyecto Vite
4. Haz clic en **Deploy**

## 🔄 Despliegues Posteriores

Una vez configurado, es mucho más simple:

```bash
# Deploy directo a producción
npm run deploy

# Deploy de preview (para testing)
npm run deploy:preview
```

## 📜 Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `npm run dev` | Desarrollo local | Inicia servidor en http://localhost:5173 |
| `npm run build` | Build producción | Crea carpeta `dist/` optimizada |
| `npm run preview` | Preview local | Previsualiza build local |
| `npm run deploy` | Deploy producción | Despliega a Vercel (producción) |
| `npm run deploy:preview` | Deploy preview | Despliega preview en Vercel |

## 🌐 Deploy Automático con Git

Si conectas tu repo de GitHub a Vercel:

- **Push a `main`** → Deploy automático a producción
- **Push a otras ramas** → Deploy automático de preview
- **Pull Requests** → Preview deployment automático

### Configurar:
1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto → Settings → Git
3. Conecta tu repositorio

## 📝 Variables de Entorno (si las necesitas)

Si necesitas agregar variables de entorno:

```bash
# Desde la terminal
vercel env add NOMBRE_VARIABLE

# O desde el dashboard
# Settings → Environment Variables
```

En tu código, accede con:
```javascript
const apiKey = import.meta.env.VITE_API_KEY;
```

## 🔧 Configuración (vercel.json)

El archivo `vercel.json` ya está configurado con:

✅ **React Router** - Todas las rutas redirigen a index.html  
✅ **Cache optimizado** - Assets con cache de 1 año  
✅ **Build automático** - Detecta Vite y construye correctamente

## 🌍 Multi-idioma (i18n)

El sistema i18n funciona automáticamente en Vercel porque:
- La detección de idioma es del lado del cliente (navegador)
- No requiere configuración adicional
- Se despliega como SPA estático

## 📊 Analytics y Monitoring

Vercel incluye gratis:
- **Analytics** - Visitas, performance, etc.
- **Speed Insights** - Core Web Vitals
- **Logs** - Ver errores en producción

Actívalos en: **Settings → Analytics**

## 🐛 Troubleshooting

### Error: "Command not found: vercel"
```bash
# Reinstalar CLI
npm install -g vercel
```

### Error: 404 en rutas
- Verifica que `vercel.json` tenga el rewrite configurado
- El archivo ya está configurado correctamente ✅

### Build falla
```bash
# Probar build localmente primero
npm run build
npm run preview
```

### Archivos grandes (modelos 3D)
Si tienes modelos 3D grandes:
- Considera usar Vercel Blob Storage
- O servir desde CDN externo (Cloudflare R2, AWS S3)

## 🔗 Dominio Custom

Para conectar tu dominio:

1. Ve a **Settings → Domains**
2. Agrega tu dominio (ej: `random.studio`)
3. Configura los DNS según las instrucciones
4. Vercel configura HTTPS automáticamente

## 💡 Pro Tips

- **Preview antes de producción**: Usa `npm run deploy:preview` para probar
- **Inspecciona el build**: Revisa la carpeta `dist/` después de `npm run build`
- **Optimiza imágenes**: Usa formatos modernos (WebP, AVIF)
- **Code splitting**: Vite ya lo hace automáticamente ✅
- **Rollback**: Puedes hacer rollback desde el dashboard si algo falla

## 📧 Soporte

- [Documentación Vercel](https://vercel.com/docs)
- [Vercel + Vite](https://vercel.com/docs/frameworks/vite)
- [Discord de Vercel](https://vercel.com/discord)

---

## 🚀 Resumen Rápido

Para desplegar AHORA (si ya tienes Vercel CLI instalado):

```bash
npm run deploy
```

¡Eso es todo! 🎉
