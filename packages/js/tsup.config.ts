import type { Options } from "tsup";

const config: Options = {
  entryPoints: ["src/index.ts"],
  target: "es2015",
  format: ["cjs", "esm"],
  minify: true,
};

export default config;
