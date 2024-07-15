import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import webPackageJson from "../../apps/web/package.json";

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
        entry: resolve(__dirname, "src/app/index.ts"),
        name: "formbricks",
        formats: ["umd"],
        fileName: "app",
      },
    },
    plugins: [
      dts({
        rollupTypes: true,
        bundledPackages: ["@formbricks/api", "@formbricks/types"],
      }),
    ],
  });
};

export default config;
