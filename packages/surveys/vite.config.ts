import preact from "@preact/preset-vite";
import { resolve } from "path";
import { ConfigEnv, defineConfig, loadEnv } from "vite";
import dts from "vite-plugin-dts";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const config = async ({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Dynamically import vite-tsconfig-paths
  const tsconfigPaths = await import("vite-tsconfig-paths");

  return defineConfig({
    define: {
      "process.env": env,
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksSurveys",
        formats: ["es", "umd"],
        fileName: "index",
      },
    },
    plugins: [
      preact(),
      dts({ rollupTypes: true }),
      tsconfigPaths.default(), // Use .default() for ESM imports
      copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
    ],
  });
};

export default config;
