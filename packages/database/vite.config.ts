import path, { resolve } from "node:path";
import { type PluginOption, defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// import dts from "vite-plugin-dts";

const config = () => {
  return defineConfig({
    resolve: {
      extensions: [".ts", ".js"],
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "src/index.ts"),
          applyMigrations: path.resolve(__dirname, "src/scripts/apply-data-migrations.ts"),
        },
        output: {
          inlineDynamicImports: false,
          dir: "dist",
          entryFileNames: (chunkInfo) => {
            // Preserve the folder structure for scripts
            if (chunkInfo.facadeModuleId?.includes("scripts")) {
              return "scripts/[name].js";
            }
            return "[name].js";
          },
          chunkFileNames: "chunks/[name]-[hash].js",
        },
        external: ["child_process"],
      },
      emptyOutDir: false,
      minify: "terser",
      sourcemap: true,
      outDir: "dist",
      lib: {
        entry: [resolve(__dirname, "src/index.ts")],
        name: "formbricks-database",
        formats: ["cjs"],
        fileName: (format, entryName) => {
          // Custom file naming
          if (entryName.includes("scripts")) {
            return `scripts/${entryName}.${format}.js`;
          }
          return `${entryName}.${format}.js`;
        },
      },
    },
    plugins: [
      // dts({
      //   rollupTypes: true,
      //   outDir: "dist/types",
      //   include: ["src/**/*"],
      // }),
      nodePolyfills({ include: ["url", "path", "process"] }) as PluginOption,
    ],
  });
};

export default config;
