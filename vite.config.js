import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le site fonctionne à la racine d'un domaine comme dans un sous-dossier.
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // React et GSAP changent rarement : dans des fichiers à part, ils restent en cache entre deux versions du site.
        manualChunks: { react: ['react', 'react-dom', 'react-dom/client', 'scheduler'], gsap: ['gsap'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
    env: { VITE_USE_BACKEND: 'false' },
  },
});
