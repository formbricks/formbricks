import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@formbricks/survey-ui": path.resolve(__dirname, "../../packages/survey-ui/src"),
    },
  },
});
