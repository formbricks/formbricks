import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/main.tsx"),
      name: "MyLib",
      // the proper extensions will be added
      fileName: "my-lib",
    },
  },
  plugins: [preact()],
});
