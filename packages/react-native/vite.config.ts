import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const config = () => {
  return defineConfig({
    optimizeDeps: {
      exclude: ["react-native"],
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      sourcemap: true,
      rollupOptions: {
        external: ["react-native"],
      },
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksReactNative",
        formats: ["es", "cjs"],
        fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true, bundledPackages: ["@formbricks/js-core"] })],
  });
};

export default config;
