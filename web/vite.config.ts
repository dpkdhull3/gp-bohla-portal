import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base works on GitHub Pages and any static host subdirectory.
export default defineConfig({
  plugins: [react()],
  base: './',
})
