import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import hotReloadExtension from 'hot-reload-extension-vite';

export default defineConfig({
  plugins: [
    react(),
    hotReloadExtension({
      log: true,
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.',
        },
      ],
    }),
  ],
  build: {
    outDir: 'build',
    emptyOutDir: false,
    watch: {},
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});