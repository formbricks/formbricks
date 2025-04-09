import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import webPackageJson from "../../apps/web/package.json";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const config = () => {
  return defineConfig({
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    define: {
      "import.meta.env.VERSION": JSON.stringify(webPackageJson.version),
    },
    build: {
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricks",
        formats: ["umd"],
        fileName: "index",
      },
    },
    plugins: [
      dts({
        rollupTypes: true,
        bundledPackages: ["@formbricks/api"],
      }),
      copyCompiledAssetsPlugin({
        filename: "formbricks",
        distDir: resolve(__dirname, "dist"),
        skipDirectoryCheck: true, // Skip checking for subdirectories that might not exist
      }),
    ],
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
