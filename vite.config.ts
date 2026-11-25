import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: true,
    watch: { ignored: ['**/.qa/**', '**/.tmp/**'] },
  },
  build: {
    target: 'es2020',
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: the boot gate and the film can be updated
        // without re-downloading React or GSAP, and the two stay independently
        // cacheable.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/node_modules[\\/]gsap[\\/]/.test(id)) return 'gsap';
          return undefined;
        },
      },
    },
  },
});
