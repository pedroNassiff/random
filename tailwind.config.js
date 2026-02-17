/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'geist-sans': ['var(--font-geist-sans)', 'Inter', 'sans-serif'],
        'geist-mono': ['var(--font-geist-mono)', 'monospace'],
        'geist-pixel': ['var(--font-geist-pixel-square)', 'Courier Prime', 'monospace'],
        'mono': ['var(--font-geist-mono)', 'monospace'], // Override default mono
      },
    },
  },
  plugins: [],
}
