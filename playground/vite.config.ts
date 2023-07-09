import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import DirsPlugin from 'vite-plugin-dirs'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${resolve(fileURLToPath(import.meta.url), '../src')}/`,
    },
  },
  plugins: [
    DirsPlugin(),
  ],
  build: {
    target: 'esnext',
  },
  clearScreen: false,
  optimizeDeps: {
    entries: [],
  },
})
