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
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksRedis",
        formats: ["es", "cjs"],
        fileName: "index",
      },
      rollupOptions: {
        external: ["ioredis"],
      },
    },
    plugins: [dts({ rollupTypes: true })],
  });
};

export default config;
