import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../web"),
      "@formbricks/survey-ui": path.resolve(__dirname, "../../packages/survey-ui/src"),
    },
  },
});
