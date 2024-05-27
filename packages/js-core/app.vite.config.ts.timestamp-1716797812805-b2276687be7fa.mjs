// app.vite.config.ts
import { resolve } from "path";
import { defineConfig } from "file:///home/shubham/Desktop/formbricks/node_modules/vite/dist/node/index.js";
import dts from "file:///home/shubham/Desktop/formbricks/node_modules/vite-plugin-dts/dist/index.mjs";

// ../../apps/web/package.json
var package_default = {
  name: "@formbricks/web",
  version: "2.0.2",
  private: true,
  scripts: {
    clean: "rimraf .turbo node_modules .next",
    dev: "next dev -p 3000",
    go: "next dev -p 3000",
    build: "next build",
    "build:dev": "next build",
    start: "next start",
    lint: "next lint"
  },
  dependencies: {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@formbricks/api": "workspace:*",
    "@formbricks/database": "workspace:*",
    "@formbricks/ee": "workspace:*",
    "@formbricks/email": "workspace:*",
    "@formbricks/js": "workspace:*",
    "@formbricks/js-core": "workspace:*",
    "@formbricks/lib": "workspace:*",
    "@formbricks/surveys": "workspace:*",
    "@formbricks/tailwind-config": "workspace:*",
    "@formbricks/types": "workspace:*",
    "@formbricks/ui": "workspace:*",
    "@json2csv/node": "^7.0.6",
    "@opentelemetry/auto-instrumentations-node": "^0.46.1",
    "@opentelemetry/exporter-trace-otlp-http": "^0.51.1",
    "@opentelemetry/resources": "^1.24.1",
    "@opentelemetry/sdk-node": "^0.51.1",
    "@opentelemetry/semantic-conventions": "^1.24.1",
    "@paralleldrive/cuid2": "^2.2.2",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@react-email/components": "^0.0.17",
    "@sentry/nextjs": "^8.2.1",
    "@vercel/og": "^0.6.2",
    "@vercel/speed-insights": "^1.0.10",
    bcryptjs: "^2.4.3",
    dotenv: "^16.4.5",
    encoding: "^0.1.13",
    "framer-motion": "11.2.4",
    googleapis: "^137.1.0",
    jiti: "^1.21.0",
    jsonwebtoken: "^9.0.2",
    lodash: "^4.17.21",
    "lru-cache": "^10.2.2",
    "lucide-react": "^0.378.0",
    mime: "^4.0.3",
    next: "14.2.3",
    nodemailer: "^6.9.13",
    otplib: "^12.0.1",
    papaparse: "^5.4.1",
    "posthog-js": "^1.131.4",
    prismjs: "^1.29.0",
    qrcode: "^1.5.3",
    react: "18.3.1",
    "react-dom": "18.3.1",
    "react-hook-form": "^7.51.4",
    "react-hot-toast": "^2.4.1",
    redis: "^4.6.14",
    sharp: "^0.33.4",
    "ua-parser-js": "^1.0.37",
    webpack: "^5.91.0",
    xlsx: "^0.18.5"
  },
  devDependencies: {
    "@formbricks/tsconfig": "workspace:*",
    "@neshca/cache-handler": "^1.3.2",
    "@types/bcryptjs": "^2.4.6",
    "@types/lodash": "^4.17.4",
    "@types/markdown-it": "^14.1.1",
    "@types/papaparse": "^5.3.14",
    "@types/qrcode": "^1.5.5",
    "eslint-config-formbricks": "workspace:*"
  }
};

// app.vite.config.ts
var __vite_injected_original_dirname = "/home/shubham/Desktop/formbricks/packages/js-core";
var config = () => {
  return defineConfig({
    define: {
      "import.meta.env.VERSION": JSON.stringify(package_default.version)
    },
    build: {
      rollupOptions: {
        output: { inlineDynamicImports: true }
      },
      emptyOutDir: false,
      // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
      lib: {
        entry: resolve(__vite_injected_original_dirname, "src/app/index.ts"),
        name: "formbricks",
        formats: ["umd"],
        fileName: "app"
      }
    },
    plugins: [
      dts({
        rollupTypes: true,
        bundledPackages: ["@formbricks/api", "@formbricks/types"]
      })
    ]
  });
};
var app_vite_config_default = config;
export {
  app_vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwLnZpdGUuY29uZmlnLnRzIiwgIi4uLy4uL2FwcHMvd2ViL3BhY2thZ2UuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL3NodWJoYW0vRGVza3RvcC9mb3JtYnJpY2tzL3BhY2thZ2VzL2pzLWNvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3NodWJoYW0vRGVza3RvcC9mb3JtYnJpY2tzL3BhY2thZ2VzL2pzLWNvcmUvYXBwLnZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3NodWJoYW0vRGVza3RvcC9mb3JtYnJpY2tzL3BhY2thZ2VzL2pzLWNvcmUvYXBwLnZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IGR0cyBmcm9tIFwidml0ZS1wbHVnaW4tZHRzXCI7XG5cbmltcG9ydCB3ZWJQYWNrYWdlSnNvbiBmcm9tIFwiLi4vLi4vYXBwcy93ZWIvcGFja2FnZS5qc29uXCI7XG5cbmNvbnN0IGNvbmZpZyA9ICgpID0+IHtcbiAgcmV0dXJuIGRlZmluZUNvbmZpZyh7XG4gICAgZGVmaW5lOiB7XG4gICAgICBcImltcG9ydC5tZXRhLmVudi5WRVJTSU9OXCI6IEpTT04uc3RyaW5naWZ5KHdlYlBhY2thZ2VKc29uLnZlcnNpb24pLFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7IGlubGluZUR5bmFtaWNJbXBvcnRzOiB0cnVlIH0sXG4gICAgICB9LFxuICAgICAgZW1wdHlPdXREaXI6IGZhbHNlLCAvLyBrZWVwIHRoZSBkaXN0IGZvbGRlciB0byBhdm9pZCBlcnJvcnMgd2l0aCBwbnBtIGdvIHdoZW4gZm9sZGVyIGlzIGVtcHR5IGR1cmluZyBidWlsZFxuICAgICAgbWluaWZ5OiBcInRlcnNlclwiLFxuICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgICAgbGliOiB7XG4gICAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvYXBwL2luZGV4LnRzXCIpLFxuICAgICAgICBuYW1lOiBcImZvcm1icmlja3NcIixcbiAgICAgICAgZm9ybWF0czogW1widW1kXCJdLFxuICAgICAgICBmaWxlTmFtZTogXCJhcHBcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBkdHMoe1xuICAgICAgICByb2xsdXBUeXBlczogdHJ1ZSxcbiAgICAgICAgYnVuZGxlZFBhY2thZ2VzOiBbXCJAZm9ybWJyaWNrcy9hcGlcIiwgXCJAZm9ybWJyaWNrcy90eXBlc1wiXSxcbiAgICAgIH0pLFxuICAgIF0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgIntcbiAgXCJuYW1lXCI6IFwiQGZvcm1icmlja3Mvd2ViXCIsXG4gIFwidmVyc2lvblwiOiBcIjIuMC4yXCIsXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwiY2xlYW5cIjogXCJyaW1yYWYgLnR1cmJvIG5vZGVfbW9kdWxlcyAubmV4dFwiLFxuICAgIFwiZGV2XCI6IFwibmV4dCBkZXYgLXAgMzAwMFwiLFxuICAgIFwiZ29cIjogXCJuZXh0IGRldiAtcCAzMDAwXCIsXG4gICAgXCJidWlsZFwiOiBcIm5leHQgYnVpbGRcIixcbiAgICBcImJ1aWxkOmRldlwiOiBcIm5leHQgYnVpbGRcIixcbiAgICBcInN0YXJ0XCI6IFwibmV4dCBzdGFydFwiLFxuICAgIFwibGludFwiOiBcIm5leHQgbGludFwiXG4gIH0sXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBkbmQta2l0L2NvcmVcIjogXCJeNi4xLjBcIixcbiAgICBcIkBkbmQta2l0L3NvcnRhYmxlXCI6IFwiXjguMC4wXCIsXG4gICAgXCJAZm9ybWJyaWNrcy9hcGlcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZGF0YWJhc2VcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZWVcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZW1haWxcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvanNcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvanMtY29yZVwiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAZm9ybWJyaWNrcy9saWJcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3Mvc3VydmV5c1wiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAZm9ybWJyaWNrcy90YWlsd2luZC1jb25maWdcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvdHlwZXNcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvdWlcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGpzb24yY3N2L25vZGVcIjogXCJeNy4wLjZcIixcbiAgICBcIkBvcGVudGVsZW1ldHJ5L2F1dG8taW5zdHJ1bWVudGF0aW9ucy1ub2RlXCI6IFwiXjAuNDYuMVwiLFxuICAgIFwiQG9wZW50ZWxlbWV0cnkvZXhwb3J0ZXItdHJhY2Utb3RscC1odHRwXCI6IFwiXjAuNTEuMVwiLFxuICAgIFwiQG9wZW50ZWxlbWV0cnkvcmVzb3VyY2VzXCI6IFwiXjEuMjQuMVwiLFxuICAgIFwiQG9wZW50ZWxlbWV0cnkvc2RrLW5vZGVcIjogXCJeMC41MS4xXCIsXG4gICAgXCJAb3BlbnRlbGVtZXRyeS9zZW1hbnRpYy1jb252ZW50aW9uc1wiOiBcIl4xLjI0LjFcIixcbiAgICBcIkBwYXJhbGxlbGRyaXZlL2N1aWQyXCI6IFwiXjIuMi4yXCIsXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtY29sbGFwc2libGVcIjogXCJeMS4wLjNcIixcbiAgICBcIkByZWFjdC1lbWFpbC9jb21wb25lbnRzXCI6IFwiXjAuMC4xN1wiLFxuICAgIFwiQHNlbnRyeS9uZXh0anNcIjogXCJeOC4yLjFcIixcbiAgICBcIkB2ZXJjZWwvb2dcIjogXCJeMC42LjJcIixcbiAgICBcIkB2ZXJjZWwvc3BlZWQtaW5zaWdodHNcIjogXCJeMS4wLjEwXCIsXG4gICAgXCJiY3J5cHRqc1wiOiBcIl4yLjQuM1wiLFxuICAgIFwiZG90ZW52XCI6IFwiXjE2LjQuNVwiLFxuICAgIFwiZW5jb2RpbmdcIjogXCJeMC4xLjEzXCIsXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiMTEuMi40XCIsXG4gICAgXCJnb29nbGVhcGlzXCI6IFwiXjEzNy4xLjBcIixcbiAgICBcImppdGlcIjogXCJeMS4yMS4wXCIsXG4gICAgXCJqc29ud2VidG9rZW5cIjogXCJeOS4wLjJcIixcbiAgICBcImxvZGFzaFwiOiBcIl40LjE3LjIxXCIsXG4gICAgXCJscnUtY2FjaGVcIjogXCJeMTAuMi4yXCIsXG4gICAgXCJsdWNpZGUtcmVhY3RcIjogXCJeMC4zNzguMFwiLFxuICAgIFwibWltZVwiOiBcIl40LjAuM1wiLFxuICAgIFwibmV4dFwiOiBcIjE0LjIuM1wiLFxuICAgIFwibm9kZW1haWxlclwiOiBcIl42LjkuMTNcIixcbiAgICBcIm90cGxpYlwiOiBcIl4xMi4wLjFcIixcbiAgICBcInBhcGFwYXJzZVwiOiBcIl41LjQuMVwiLFxuICAgIFwicG9zdGhvZy1qc1wiOiBcIl4xLjEzMS40XCIsXG4gICAgXCJwcmlzbWpzXCI6IFwiXjEuMjkuMFwiLFxuICAgIFwicXJjb2RlXCI6IFwiXjEuNS4zXCIsXG4gICAgXCJyZWFjdFwiOiBcIjE4LjMuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiMTguMy4xXCIsXG4gICAgXCJyZWFjdC1ob29rLWZvcm1cIjogXCJeNy41MS40XCIsXG4gICAgXCJyZWFjdC1ob3QtdG9hc3RcIjogXCJeMi40LjFcIixcbiAgICBcInJlZGlzXCI6IFwiXjQuNi4xNFwiLFxuICAgIFwic2hhcnBcIjogXCJeMC4zMy40XCIsXG4gICAgXCJ1YS1wYXJzZXItanNcIjogXCJeMS4wLjM3XCIsXG4gICAgXCJ3ZWJwYWNrXCI6IFwiXjUuOTEuMFwiLFxuICAgIFwieGxzeFwiOiBcIl4wLjE4LjVcIlxuICB9LFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJAZm9ybWJyaWNrcy90c2NvbmZpZ1wiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAbmVzaGNhL2NhY2hlLWhhbmRsZXJcIjogXCJeMS4zLjJcIixcbiAgICBcIkB0eXBlcy9iY3J5cHRqc1wiOiBcIl4yLjQuNlwiLFxuICAgIFwiQHR5cGVzL2xvZGFzaFwiOiBcIl40LjE3LjRcIixcbiAgICBcIkB0eXBlcy9tYXJrZG93bi1pdFwiOiBcIl4xNC4xLjFcIixcbiAgICBcIkB0eXBlcy9wYXBhcGFyc2VcIjogXCJeNS4zLjE0XCIsXG4gICAgXCJAdHlwZXMvcXJjb2RlXCI6IFwiXjEuNS41XCIsXG4gICAgXCJlc2xpbnQtY29uZmlnLWZvcm1icmlja3NcIjogXCJ3b3Jrc3BhY2U6KlwiXG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlUsU0FBUyxlQUFlO0FBQ3JXLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUzs7O0FDRmhCO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsSUFDVCxPQUFTO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxJQUFNO0FBQUEsSUFDTixPQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLGlCQUFpQjtBQUFBLElBQ2pCLHFCQUFxQjtBQUFBLElBQ3JCLG1CQUFtQjtB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
