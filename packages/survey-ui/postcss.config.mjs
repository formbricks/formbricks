import tailwindcss from "@tailwindcss/postcss";
// Same three #fbjs-scoping plugins used by @formbricks/surveys. Tailwind v4
// emits `@layer properties`, `@layer theme { :root, :host }` and
// `@property --tw-*` globally (by spec), which leak into and break host-page
// styles when the survey widget injects this bundle. These plugins confine
// them to #fbjs. They MUST run after Tailwind has compiled, so the Tailwind
// PostCSS plugin is processed here (not via @tailwindcss/vite) to guarantee
// ordering. See packages/vite-plugins/postcss-scope-fbjs.cjs and
// https://github.com/formbricks/js/issues/46.
import scopeFbjs from "../vite-plugins/postcss-scope-fbjs.cjs";

export default {
  plugins: [tailwindcss(), ...scopeFbjs.scopeFbjsPlugins()],
};
