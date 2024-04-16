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
        // entry: resolve(__dirname, "src/index.ts"),
        entry: {
          "in-app": resolve(__dirname, "src/in-app.ts"),
          website: resolve(__dirname, "src/website.ts"),
        },
        name: "formbricksJsWrapper",
        // formats: ["es", "umd"],
        formats: ["es", "cjs"],
        // the proper extensions will be added
        // fileName: (_format, entryName) => `${entryName}.js`,
        // fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true })],
  });
};

export default config;
