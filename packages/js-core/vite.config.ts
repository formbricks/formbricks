import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import webPackageJson from "../../apps/web/package.json";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const config = () => {
  return defineConfig({
    define: {
      "import.meta.env.VERSION": JSON.stringify(webPackageJson.version),
    },
    build: {
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
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
        bundledPackages: ["@formbricks/api", "@formbricks/types"],
      }),
      copyCompiledAssetsPlugin({ filename: "formbricks", distDir: resolve(__dirname, "dist") }),
    ],
  });
};

export default config;
