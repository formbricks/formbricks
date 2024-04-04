// vite.config.ts
import preact from "file:///Users/johannes/Developer/formbricks/formbricks/node_modules/@preact/preset-vite/dist/esm/index.mjs";
import { resolve } from "path";
import { defineConfig, loadEnv } from "file:///Users/johannes/Developer/formbricks/formbricks/packages/surveys/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/johannes/Developer/formbricks/formbricks/node_modules/vite-plugin-dts/dist/index.mjs";
import tsconfigPaths from "file:///Users/johannes/Developer/formbricks/formbricks/node_modules/vite-tsconfig-paths/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/johannes/Developer/formbricks/formbricks/packages/surveys";
var config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return defineConfig({
    define: {
      "process.env": env
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      sourcemap: true,
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      },
      lib: {
        entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
        name: "formbricksSurveys",
        formats: ["es", "umd"],
        fileName: "index"
      }
    },
    plugins: [preact(), dts({ rollupTypes: true }), tsconfigPaths()]
  });
};
var vite_config_default = config;
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvam9oYW5uZXMvRGV2ZWxvcGVyL2Zvcm1icmlja3MvZm9ybWJyaWNrcy9wYWNrYWdlcy9zdXJ2ZXlzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvam9oYW5uZXMvRGV2ZWxvcGVyL2Zvcm1icmlja3MvZm9ybWJyaWNrcy9wYWNrYWdlcy9zdXJ2ZXlzL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9qb2hhbm5lcy9EZXZlbG9wZXIvZm9ybWJyaWNrcy9mb3JtYnJpY2tzL3BhY2thZ2VzL3N1cnZleXMvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcHJlYWN0IGZyb20gXCJAcHJlYWN0L3ByZXNldC12aXRlXCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgZHRzIGZyb20gXCJ2aXRlLXBsdWdpbi1kdHNcIjtcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gXCJ2aXRlLXRzY29uZmlnLXBhdGhzXCI7XG5cbmNvbnN0IGNvbmZpZyA9ICh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuXG4gIHJldHVybiBkZWZpbmVDb25maWcoe1xuICAgIGRlZmluZToge1xuICAgICAgXCJwcm9jZXNzLmVudlwiOiBlbnYsXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgZW1wdHlPdXREaXI6IGZhbHNlLFxuICAgICAgbWluaWZ5OiBcInRlcnNlclwiLFxuICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBpbmxpbmVEeW5hbWljSW1wb3J0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBsaWI6IHtcbiAgICAgICAgZW50cnk6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9pbmRleC50c1wiKSxcbiAgICAgICAgbmFtZTogXCJmb3JtYnJpY2tzU3VydmV5c1wiLFxuICAgICAgICBmb3JtYXRzOiBbXCJlc1wiLCBcInVtZFwiXSxcbiAgICAgICAgZmlsZU5hbWU6IFwiaW5kZXhcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbcHJlYWN0KCksIGR0cyh7IHJvbGx1cFR5cGVzOiB0cnVlIH0pLCB0c2NvbmZpZ1BhdGhzKCldLFxuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNvbmZpZztcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1gsT0FBTyxZQUFZO0FBQ3JZLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFNBQVM7QUFDaEIsT0FBTyxtQkFBbUI7QUFKMUIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTSxTQUFTLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDM0IsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBRTNDLFNBQU8sYUFBYTtBQUFBLElBQ2xCLFFBQVE7QUFBQSxNQUNOLGVBQWU7QUFBQSxJQUNqQjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sc0JBQXNCO0FBQUEsUUFDeEI7QUFBQSxNQUNGO0FBQUEsTUFDQSxLQUFLO0FBQUEsUUFDSCxPQUFPLFFBQVEsa0NBQVcsY0FBYztBQUFBLFFBQ3hDLE1BQU07QUFBQSxRQUNOLFNBQVMsQ0FBQyxNQUFNLEtBQUs7QUFBQSxRQUNyQixVQUFVO0FBQUEsTUFDWjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFNBQVMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxFQUFFLGFBQWEsS0FBSyxDQUFDLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDakUsQ0FBQztBQUNIO0FBRUEsSUFBTyxzQkFBUTsiLAogICJuYW1lcyI6IFtdCn0K
