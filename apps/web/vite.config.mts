// vitest.config.ts
import tsconfigPaths from 'vite-tsconfig-paths';
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['playwright/**', 'node_modules/**'],
    setupFiles: ['../../packages/lib/vitestSetup.ts'],
    env: loadEnv('', process.cwd(), ''),
    coverage: {
      provider: 'v8',            // Use V8 as the coverage provider
      reporter: ['text', 'html', 'lcov'], // Generate text summary and HTML reports
      reportsDirectory: './coverage', // Output coverage reports to the coverage/ directory
    },
  },
  plugins: [tsconfigPaths()],
});