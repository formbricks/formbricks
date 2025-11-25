import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = ({ mode }) => {
  loadEnv(mode, process.cwd(), "");

  return defineConfig({
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    build: {
      emptyOutDir: true,
      minify: "terser",
      sourcemap: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksUI",
        formats: ["es", "umd"],
        fileName: "index",
      },
    },
    plugins: [
      react(),
      dts({
        rollupTypes: true,
        outDir: "dist",
        include: ["src/**/*"],
        exclude: ["src/**/*.test.*", "src/**/*.spec.*"],
      }),
      tsconfigPaths(),
    ],
  });
};

export default config;

