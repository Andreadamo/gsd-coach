/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE=1 → build in un unico file HTML (anteprima/offline)
const single = process.env.SINGLE === '1'

/** genera sw.js con l'elenco di tutti i file della build (app apribile senza rete anche su pagine mai visitate) */
function serviceWorker(): Plugin {
  return {
    name: 'gsd-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const pub = readdirSync('public').filter((f) => !f.startsWith('.'))
      const files = ['./', ...pub.map((f) => './' + f), ...Object.keys(bundle).map((f) => './' + f)]
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12)
      const src = readFileSync('sw/sw.js', 'utf8')
        .replace("const VERSION = '__VERSION__'", `const VERSION = ${JSON.stringify(version)}`)
        .replace('const PRECACHE = __PRECACHE__', `const PRECACHE = ${JSON.stringify(files)}`)
      if (src.includes('__PRECACHE__') || src.includes('__VERSION__')) this.error('sw.js: segnaposto non sostituiti')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [serviceWorker()])],
  build: single ? { outDir: 'dist-single' } : {},
  test: { environment: 'node' },
})
