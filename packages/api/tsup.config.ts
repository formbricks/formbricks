import { defineConfig } from "tsup";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  clean: true,
  dts: true,
  splitting: true,
  format: ["cjs", "esm"],
  entry: ["src/index.ts"],
  minify: isProduction,
  sourcemap: true,
});
