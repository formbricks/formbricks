import { Options, defineConfig } from "tsup";

export default defineConfig((options: Options) => ({
  ...options,
  entry: {
    index: "src/index.ts",
  },
  banner: {
    js: "'use client'",
  },
  clean: true,
  format: ["cjs", "esm"],
  external: ["react"],
  experimentalDts: true,
}));
