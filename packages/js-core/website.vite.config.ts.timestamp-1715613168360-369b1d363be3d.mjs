// website.vite.config.ts
import { resolve } from "path";
import { defineConfig } from "file:///Users/piyush/Desktop/code/formbricks/formbricks/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/piyush/Desktop/code/formbricks/formbricks/node_modules/vite-plugin-dts/dist/index.mjs";

// ../../apps/web/package.json
var package_default = {
  name: "@formbricks/web",
  version: "2.0.0",
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
    "@formbricks/api": "workspace:*",
    "@formbricks/database": "workspace:*",
    "@formbricks/ee": "workspace:*",
    "@formbricks/js": "workspace:*",
    "@formbricks/js-core": "workspace:*",
    "@formbricks/lib": "workspace:*",
    "@formbricks/surveys": "workspace:*",
    "@formbricks/tailwind-config": "workspace:*",
    "@formbricks/types": "workspace:*",
    "@formbricks/ui": "workspace:*",
    "@formbricks/email": "workspace:*",
    "@headlessui/react": "^2.0.3",
    "@json2csv/node": "^7.0.6",
    "@opentelemetry/auto-instrumentations-node": "^0.46.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.51.1",
    "@opentelemetry/resources": "^1.24.1",
    "@opentelemetry/sdk-node": "^0.51.1",
    "@opentelemetry/semantic-conventions": "^1.24.1",
    "@paralleldrive/cuid2": "^2.2.2",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@react-email/components": "^0.0.17",
    "@sentry/nextjs": "^7.113.0",
    "@vercel/og": "^0.6.2",
    "@vercel/speed-insights": "^1.0.10",
    bcryptjs: "^2.4.3",
    dotenv: "^16.4.5",
    encoding: "^0.1.13",
    "framer-motion": "11.1.9",
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
    "posthog-js": "^1.131.0",
    prismjs: "^1.29.0",
    qrcode: "^1.5.3",
    react: "18.3.1",
    "react-beautiful-dnd": "^13.1.1",
    "react-dom": "18.3.1",
    "react-hook-form": "^7.51.4",
    "react-hot-toast": "^2.4.1",
    redis: "^4.6.13",
    sharp: "^0.33.3",
    "ua-parser-js": "^1.0.37",
    webpack: "^5.91.0",
    xlsx: "^0.18.5"
  },
  devDependencies: {
    "@formbricks/tsconfig": "workspace:*",
    "@neshca/cache-handler": "^1.3.1",
    "@types/bcryptjs": "^2.4.6",
    "@types/lodash": "^4.17.1",
    "@types/markdown-it": "^14.1.1",
    "@types/papaparse": "^5.3.14",
    "@types/qrcode": "^1.5.5",
    "eslint-config-formbricks": "workspace:*"
  }
};

// website.vite.config.ts
var __vite_injected_original_dirname = "/Users/piyush/Desktop/code/formbricks/formbricks/packages/js-core";
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
        entry: resolve(__vite_injected_original_dirname, "src/website/index.ts"),
        name: "formbricks",
        formats: ["umd"],
        fileName: "website"
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
export {
  config
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsid2Vic2l0ZS52aXRlLmNvbmZpZy50cyIsICIuLi8uLi9hcHBzL3dlYi9wYWNrYWdlLmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvcGl5dXNoL0Rlc2t0b3AvY29kZS9mb3JtYnJpY2tzL2Zvcm1icmlja3MvcGFja2FnZXMvanMtY29yZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3BpeXVzaC9EZXNrdG9wL2NvZGUvZm9ybWJyaWNrcy9mb3JtYnJpY2tzL3BhY2thZ2VzL2pzLWNvcmUvd2Vic2l0ZS52aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvcGl5dXNoL0Rlc2t0b3AvY29kZS9mb3JtYnJpY2tzL2Zvcm1icmlja3MvcGFja2FnZXMvanMtY29yZS93ZWJzaXRlLnZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IGR0cyBmcm9tIFwidml0ZS1wbHVnaW4tZHRzXCI7XG5cbmltcG9ydCB3ZWJQYWNrYWdlSnNvbiBmcm9tIFwiLi4vLi4vYXBwcy93ZWIvcGFja2FnZS5qc29uXCI7XG5cbmV4cG9ydCBjb25zdCBjb25maWcgPSAoKSA9PiB7XG4gIHJldHVybiBkZWZpbmVDb25maWcoe1xuICAgIGRlZmluZToge1xuICAgICAgXCJpbXBvcnQubWV0YS5lbnYuVkVSU0lPTlwiOiBKU09OLnN0cmluZ2lmeSh3ZWJQYWNrYWdlSnNvbi52ZXJzaW9uKSxcbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDogeyBpbmxpbmVEeW5hbWljSW1wb3J0czogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIGVtcHR5T3V0RGlyOiBmYWxzZSwgLy8ga2VlcCB0aGUgZGlzdCBmb2xkZXIgdG8gYXZvaWQgZXJyb3JzIHdpdGggcG5wbSBnbyB3aGVuIGZvbGRlciBpcyBlbXB0eSBkdXJpbmcgYnVpbGRcbiAgICAgIG1pbmlmeTogXCJ0ZXJzZXJcIixcbiAgICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAgIGxpYjoge1xuICAgICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL3dlYnNpdGUvaW5kZXgudHNcIiksXG4gICAgICAgIG5hbWU6IFwiZm9ybWJyaWNrc1wiLFxuICAgICAgICBmb3JtYXRzOiBbXCJ1bWRcIl0sXG4gICAgICAgIGZpbGVOYW1lOiBcIndlYnNpdGVcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBkdHMoe1xuICAgICAgICByb2xsdXBUeXBlczogdHJ1ZSxcbiAgICAgICAgYnVuZGxlZFBhY2thZ2VzOiBbXCJAZm9ybWJyaWNrcy9hcGlcIiwgXCJAZm9ybWJyaWNrcy90eXBlc1wiXSxcbiAgICAgIH0pLFxuICAgIF0sXG4gIH0pO1xufTtcbiIsICJ7XG4gIFwibmFtZVwiOiBcIkBmb3JtYnJpY2tzL3dlYlwiLFxuICBcInZlcnNpb25cIjogXCIyLjAuMFwiLFxuICBcInByaXZhdGVcIjogdHJ1ZSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImNsZWFuXCI6IFwicmltcmFmIC50dXJibyBub2RlX21vZHVsZXMgLm5leHRcIixcbiAgICBcImRldlwiOiBcIm5leHQgZGV2IC1wIDMwMDBcIixcbiAgICBcImdvXCI6IFwibmV4dCBkZXYgLXAgMzAwMFwiLFxuICAgIFwiYnVpbGRcIjogXCJuZXh0IGJ1aWxkXCIsXG4gICAgXCJidWlsZDpkZXZcIjogXCJuZXh0IGJ1aWxkXCIsXG4gICAgXCJzdGFydFwiOiBcIm5leHQgc3RhcnRcIixcbiAgICBcImxpbnRcIjogXCJuZXh0IGxpbnRcIlxuICB9LFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJAZm9ybWJyaWNrcy9hcGlcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZGF0YWJhc2VcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZWVcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvanNcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvanMtY29yZVwiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAZm9ybWJyaWNrcy9saWJcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3Mvc3VydmV5c1wiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAZm9ybWJyaWNrcy90YWlsd2luZC1jb25maWdcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvdHlwZXNcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvdWlcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGZvcm1icmlja3MvZW1haWxcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQGhlYWRsZXNzdWkvcmVhY3RcIjogXCJeMi4wLjNcIixcbiAgICBcIkBqc29uMmNzdi9ub2RlXCI6IFwiXjcuMC42XCIsXG4gICAgXCJAb3BlbnRlbGVtZXRyeS9hdXRvLWluc3RydW1lbnRhdGlvbnMtbm9kZVwiOiBcIl4wLjQ2LjBcIixcbiAgICBcIkBvcGVudGVsZW1ldHJ5L2V4cG9ydGVyLXRyYWNlLW90bHAtaHR0cFwiOiBcIl4wLjUxLjFcIixcbiAgICBcIkBvcGVudGVsZW1ldHJ5L3Jlc291cmNlc1wiOiBcIl4xLjI0LjFcIixcbiAgICBcIkBvcGVudGVsZW1ldHJ5L3Nkay1ub2RlXCI6IFwiXjAuNTEuMVwiLFxuICAgIFwiQG9wZW50ZWxlbWV0cnkvc2VtYW50aWMtY29udmVudGlvbnNcIjogXCJeMS4yNC4xXCIsXG4gICAgXCJAcGFyYWxsZWxkcml2ZS9jdWlkMlwiOiBcIl4yLjIuMlwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LWNvbGxhcHNpYmxlXCI6IFwiXjEuMC4zXCIsXG4gICAgXCJAcmVhY3QtZW1haWwvY29tcG9uZW50c1wiOiBcIl4wLjAuMTdcIixcbiAgICBcIkBzZW50cnkvbmV4dGpzXCI6IFwiXjcuMTEzLjBcIixcbiAgICBcIkB2ZXJjZWwvb2dcIjogXCJeMC42LjJcIixcbiAgICBcIkB2ZXJjZWwvc3BlZWQtaW5zaWdodHNcIjogXCJeMS4wLjEwXCIsXG4gICAgXCJiY3J5cHRqc1wiOiBcIl4yLjQuM1wiLFxuICAgIFwiZG90ZW52XCI6IFwiXjE2LjQuNVwiLFxuICAgIFwiZW5jb2RpbmdcIjogXCJeMC4xLjEzXCIsXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiMTEuMS45XCIsXG4gICAgXCJnb29nbGVhcGlzXCI6IFwiXjEzNy4xLjBcIixcbiAgICBcImppdGlcIjogXCJeMS4yMS4wXCIsXG4gICAgXCJqc29ud2VidG9rZW5cIjogXCJeOS4wLjJcIixcbiAgICBcImxvZGFzaFwiOiBcIl40LjE3LjIxXCIsXG4gICAgXCJscnUtY2FjaGVcIjogXCJeMTAuMi4yXCIsXG4gICAgXCJsdWNpZGUtcmVhY3RcIjogXCJeMC4zNzguMFwiLFxuICAgIFwibWltZVwiOiBcIl40LjAuM1wiLFxuICAgIFwibmV4dFwiOiBcIjE0LjIuM1wiLFxuICAgIFwibm9kZW1haWxlclwiOiBcIl42LjkuMTNcIixcbiAgICBcIm90cGxpYlwiOiBcIl4xMi4wLjFcIixcbiAgICBcInBhcGFwYXJzZVwiOiBcIl41LjQuMVwiLFxuICAgIFwicG9zdGhvZy1qc1wiOiBcIl4xLjEzMS4wXCIsXG4gICAgXCJwcmlzbWpzXCI6IFwiXjEuMjkuMFwiLFxuICAgIFwicXJjb2RlXCI6IFwiXjEuNS4zXCIsXG4gICAgXCJyZWFjdFwiOiBcIjE4LjMuMVwiLFxuICAgIFwicmVhY3QtYmVhdXRpZnVsLWRuZFwiOiBcIl4xMy4xLjFcIixcbiAgICBcInJlYWN0LWRvbVwiOiBcIjE4LjMuMVwiLFxuICAgIFwicmVhY3QtaG9vay1mb3JtXCI6IFwiXjcuNTEuNFwiLFxuICAgIFwicmVhY3QtaG90LXRvYXN0XCI6IFwiXjIuNC4xXCIsXG4gICAgXCJyZWRpc1wiOiBcIl40LjYuMTNcIixcbiAgICBcInNoYXJwXCI6IFwiXjAuMzMuM1wiLFxuICAgIFwidWEtcGFyc2VyLWpzXCI6IFwiXjEuMC4zN1wiLFxuICAgIFwid2VicGFja1wiOiBcIl41LjkxLjBcIixcbiAgICBcInhsc3hcIjogXCJeMC4xOC41XCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiQGZvcm1icmlja3MvdHNjb25maWdcIjogXCJ3b3Jrc3BhY2U6KlwiLFxuICAgIFwiQG5lc2hjYS9jYWNoZS1oYW5kbGVyXCI6IFwiXjEuMy4xXCIsXG4gICAgXCJAdHlwZXMvYmNyeXB0anNcIjogXCJeMi40LjZcIixcbiAgICBcIkB0eXBlcy9sb2Rhc2hcIjogXCJeNC4xNy4xXCIsXG4gICAgXCJAdHlwZXMvbWFya2Rvd24taXRcIjogXCJeMTQuMS4xXCIsXG4gICAgXCJAdHlwZXMvcGFwYXBhcnNlXCI6IFwiXjUuMy4xNFwiLFxuICAgIFwiQHR5cGVzL3FyY29kZVwiOiBcIl4xLjUuNVwiLFxuICAgIFwiZXNsaW50LWNvbmZpZy1mb3JtYnJpY2tzXCI6IFwid29ya3NwYWNlOipcIlxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFZLFNBQVMsZUFBZTtBQUM3WixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFNBQVM7OztBQ0ZoQjtBQUFBLEVBQ0UsTUFBUTtBQUFBLEVBQ1IsU0FBVztBQUFBLEVBQ1gsU0FBVztBQUFBLEVBQ1gsU0FBVztBQUFBLElBQ1QsT0FBUztBQUFBLElBQ1QsS0FBTztBQUFBLElBQ1AsSUFBTTtBQUFBLElBQ04sT0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsT0FBUztBQUFBLElBQ1QsTUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGNB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
