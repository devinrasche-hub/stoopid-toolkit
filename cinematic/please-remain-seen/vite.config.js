import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained HTML file (three.js, shaders, audio engine and
// styles inlined) so the cinematic plays offline with no CDN.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 2000 },
});
