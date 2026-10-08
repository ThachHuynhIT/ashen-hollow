import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Relative base so the same build works on itch.io, a sub-path, Tauri and Capacitor.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; that's expected for a game bundle.
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true, port: 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
