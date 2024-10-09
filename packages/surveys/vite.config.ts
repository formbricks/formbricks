import preact from "@preact/preset-vite";
import { copyFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

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
      tsconfigPaths(),
      {
        name: "copy-output",
        closeBundle() {
          const outputDir = resolve(__dirname, "../../apps/web/public/js");
          const distDir = resolve(__dirname, "dist");

          const filesToCopy = readdirSync(distDir);

          filesToCopy.forEach((file) => {
            const srcFile = `${distDir}/${file}`;
            const destFile = `${outputDir}/${file.replace("index", "surveys")}`;
            copyFileSync(srcFile, destFile);
          });

          console.log(`Copied ${filesToCopy.length} files to ${outputDir}`);
        },
      },
    ],
  });
};

export default config;
