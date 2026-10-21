import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE=1 → build in un unico file HTML (anteprima/offline)
const single = process.env.SINGLE === '1'

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: single ? { outDir: 'dist-single' } : {},
})
