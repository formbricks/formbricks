import { copyFileSync, readdirSync } from "fs";
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
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricks",
        formats: ["umd"],
        fileName: "js-core",
      },
    },
    plugins: [
      dts({
        rollupTypes: true,
        bundledPackages: ["@formbricks/api", "@formbricks/types"],
      }),
      {
        name: "copy-output",
        closeBundle() {
          const outputDir = resolve(__dirname, "../../apps/web/public/js");
          const distDir = resolve(__dirname, "dist");

          const filesToCopy = readdirSync(distDir);

          filesToCopy.forEach((file) => {
            const srcFile = `${distDir}/${file}`;
            const destFile = `${outputDir}/${file}`;
            copyFileSync(srcFile, destFile);
          });

          console.log(`Copied ${filesToCopy.length} files to ${outputDir}`);
        },
      },
    ],
  });
};

export default config;
