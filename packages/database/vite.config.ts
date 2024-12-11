import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const config = () => {
  return defineConfig({
    build: {
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
      outDir: "dist",
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricks-database",
        formats: ["umd"],
        fileName: "index",
      },
    },
    plugins: [
      dts({
        rollupTypes: true,
      }),
    ],
  });
};

export default config;
