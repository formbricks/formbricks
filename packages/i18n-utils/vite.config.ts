import { resolve } from "node:path";
import { PluginOption, defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "i18nUtils",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
    }) as PluginOption,
  ],
});
