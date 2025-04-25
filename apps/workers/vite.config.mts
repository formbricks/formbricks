// vitest.config.ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'node16',
    ssr: true,
    outDir: 'dist',
    rollupOptions: {
      input: 'src/server.ts',
      output: {
        format: 'cjs',
        entryFileNames: 'server.js',
      },
      external: [
        'bullmq',
        'ioredis',
      ]
    },
  },
});
