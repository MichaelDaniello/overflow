import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built `dist/` is self-contained and can be served
// from any sub-path (e.g. GitHub Pages at /overflow/blacklog/dist/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
