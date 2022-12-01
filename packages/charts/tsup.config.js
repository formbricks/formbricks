import { defineConfig } from "tsup";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  format: ["cjs", "esm"],
  entry: ["src/index.tsx"],
  clean: isProduction,
  splitting: true,
  dts: true,
  minify: isProduction,
});
