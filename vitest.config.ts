import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Solo cubre la feature Fútbol Vaquero. El resto del SPA (JSX legacy) queda fuera de este gate.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/vaca-futbolera/**/*.test.{ts,tsx}'],
    setupFiles: ['src/vaca-futbolera/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/vaca-futbolera/**/*.{ts,tsx}'],
      exclude: ['src/vaca-futbolera/**/*.test.{ts,tsx}', 'src/vaca-futbolera/test/**', 'src/vaca-futbolera/types.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
})
