import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Auto-copy brain model if not exists
const brainModelPath = resolve(__dirname, 'static/models/brain')
const brainModelSource = resolve(__dirname, 'teoria-sintergica/brain-prototype/frontend/public/models/brain')

if (!fs.existsSync(brainModelPath) && fs.existsSync(brainModelSource)) {
  fs.mkdirSync(resolve(__dirname, 'static/models'), { recursive: true })
  fs.cpSync(brainModelSource, brainModelPath, { recursive: true })
  console.log('✅ Brain model copied to static/models/brain')
}

export default {
    root: 'src/',
    // root is src/, but .env.production / .env.development live at the repo
    // root (where Vercel and local `vite` are invoked from) — without this,
    // Vite looks for them under src/ and silently never finds them.
    envDir: resolve(__dirname, '.'),
    publicDir: '../static/',
    base: '/',
    server:
    {
        host: true,
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env),
        proxy: {
            '/api/analytics': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/analytics/, '/analytics')
            },
            '/api/automation': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/automation/, '/automation')
            }
        }
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true // Add sourcemap
    },
    optimizeDeps: {
        include: ['react-grid-layout']
    },
    plugins:
    [
        react(), // React plugin for JSX support
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        glsl() // Handle shader files
    ]
}