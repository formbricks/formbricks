import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

/**
 * Plugin to strip "use client" directives from bundled dependencies.
 *
 * This fixes warnings from Radix UI and other packages that include "use client"
 * directives for Next.js React Server Components compatibility. When Vite bundles
 * these packages, it emits warnings because module-level directives aren't supported
 * in the bundled output.
 *
 * The "use client" directive is only relevant for Next.js RSC and doesn't affect
 * our library build, so it's safe to remove during bundling.
 *
 * Related issue: https://github.com/TanStack/query/issues/5175
 */
function stripUseClientDirective(): Plugin {
  return {
    name: "strip-use-client-directive",
    transform(code, id) {
      // Only process files from node_modules that contain "use client" directives
      // This prevents unnecessary processing of our own source files
      if (id.includes("node_modules") && code.includes('"use client"')) {
        return {
          // Remove all variations of "use client" directives:
          // - "use client"
          // - 'use client'
          // - "use client";
          // - 'use client';
          code: code.replace(/["']use client["'];?\s*/g, ""),
          map: null, // No source map needed for this transformation
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
  plugins: [
    // Strip "use client" directives before other plugins process the code
    stripUseClientDirective(),
    tsconfigPaths(),
    dts({ include: ["src"] }),
    tailwindcss(),
  ],
});

