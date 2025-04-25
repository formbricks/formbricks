// vitest.config.ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'node18',
    ssr: true,
    outDir: 'dist',
    rollupOptions: {
      input: 'server.ts',
      output: {
        format: 'cjs',
        entryFileNames: 'server.js',
      },
      external: [
        'express',
        'bullmq',
        '@bull-board/api',
        '@bull-board/express',
        'ioredis',
      ]
    },
  },
});
