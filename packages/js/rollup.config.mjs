import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: [
      { 
        file: "dist/index.umd.js",
        format: "umd",
      },
      { file: "dist/index.js", format: "cjs" },
      { file: "dist/index.esm.js", format: "esm" },
    ],
    plugins: [typescript(), resolve(), commonjs(), json()],
  },
];
