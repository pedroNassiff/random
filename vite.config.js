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
    publicDir: '../static/',
    base: './',
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true // Add sourcemap
    },
    plugins:
    [
        react(), // React plugin for JSX support
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        glsl() // Handle shader files
    ]
}