import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const config = () => {
  return defineConfig({
    build: {
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: {
          app: resolve(__dirname, "src/app.ts"),
          website: resolve(__dirname, "src/website.ts"),
        },
        name: "formbricksJsWrapper",
        formats: ["es", "cjs"],
      },
    },
    plugins: [dts({ rollupTypes: true, bundledPackages: ["@formbricks/js-core"] })],
  });
};

export default config;
