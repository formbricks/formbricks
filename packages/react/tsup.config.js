import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  entry: ["src/index.tsx"],
  clean: true,
  splitting: true,
  dts: true,
});
