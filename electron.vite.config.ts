// electron-vite compila las TRES capas por separado, cada una con su destino:
// main y preload corren en Node/Electron, y el renderer corre en Chromium.
// Entradas por defecto: src/main/index.ts, src/preload/index.ts, src/renderer/index.html

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Un preload con sandbox TIENE que ser CommonJS. Como el package es "type": "module",
        // usamos la extensión .cjs para que Node no lo trate como ESM.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
})
