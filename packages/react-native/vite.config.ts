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
    optimizeDeps: {
      exclude: ["react-native"],
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      sourcemap: true,
      rollupOptions: {
        external: [
          "react",
          "react-native",
          "react-dom",
          "react-native-webview",
          "@react-native-async-storage/async-storage",
        ],
      },
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksReactNative",
        formats: ["es", "cjs"],
        fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true, bundledPackages: ["@formbricks/api", "@formbricks/types"] })],
    test: {
      setupFiles: ["./vitest.setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["src/lib/**/*.ts"],
      },
    },
  });
};

export default config;
