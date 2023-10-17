import {resolve} from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  // build: {
  //   minify: "terser",
  //   sourcemap: true,
  //   lib: {
  //     // Could also be a dictionary or array of multiple entry points
  //     entry: resolve(__dirname, "src/main.tsx"),
  //     name: "QuestionDate",
  //     // formats: ["cjs", "es", "umd"],
  //     // the proper extensions will be added
  //     fileName: "indexCopy",
  //   },
  //   // rollupOptions: {
  //   //   external: ["preact"],
  //   //   output: {
  //   //     globals: {
  //   //       preact: "preact",
  //   //     },
  //   //   },
  //   // }
  // },

  build: {
    minify: "terser",
    // lib: {
    //   entry: resolve(__dirname, "src/main.tsx"),
    //   name: "QuestionDate",
    //   fileName: "indexCopy",
    // }
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/main.tsx"),
      },
      output: {
        entryFileNames: "indexCopy.js",
        // format: "es",
        globals: {
          preact: "preact",
        },
      },
    }
  },
  plugins: [preact()],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    }
  }
});
