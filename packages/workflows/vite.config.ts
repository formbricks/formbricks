import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      // Sonar reads `coverage/lcov.info`; vitest's default reporters emit clover.xml instead, so this
      // package's coverage was invisible to the scan until lcov was added (ENG-2432).
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  plugins: [
    dts({
      // Emit declarations rooted at `src` so the types sit next to the JS they describe
      // (`dist/index.d.ts` beside `dist/index.js`) instead of under a nested `dist/src/`.
      entryRoot: "src",
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    }),
  ],
  build: {
    minify: false,
    lib: {
      // Two entries: the browser-safe contracts/types (`.`) and the server-only handlers/service
      // (`./server`). Keeping them separate stops Prisma/runtime concerns from leaking into the
      // browser bundle that the dashboard imports.
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        server: resolve(__dirname, "src/server/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // `@prisma/client` is type-only here and is provided by the host app at runtime; never bundle it.
      external: ["zod", "@prisma/client", "server-only", /^node:/],
    },
  },
});
