import { resolve } from "node:path";
import { type UserConfig, defineConfig } from "vite";
import dts from "vite-plugin-dts";

const config = (): UserConfig => {
  return defineConfig({
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksLogger",
        formats: ["es", "cjs"],
        fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true })],
  });
};

export default config;
