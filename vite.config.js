import { defineConfig } from 'vite';

// base './' keeps every asset path relative, so the build works when a portal
// (CrazyGames, Poki, itch.io...) serves the game from a sub folder / iframe.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    rollupOptions: {
      output: {
        // stable file names (the preview link and portal uploads replace files in place)
        entryFileNames: 'assets/game.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: { host: true },
});
