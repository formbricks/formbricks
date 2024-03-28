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
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksJsCore",
        formats: ["es", "umd"],
        // the proper extensions will be added
        fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true })],
  });
};

export default config;
