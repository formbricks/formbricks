import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts()],
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
