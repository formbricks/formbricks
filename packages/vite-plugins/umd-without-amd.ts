import type { Rollup } from "vite";

/**
 * Rollup output options that make a UMD bundle skip its AMD branch (ENG-3657).
 *
 * A UMD wrapper checks `typeof define === "function" && define.amd` before it assigns its browser
 * global. On a host page that runs an AMD loader (RequireJS, Dojo) it hands the factory to that
 * `define()` instead, and an anonymous module from a plain `<script>` tag is never required by
 * anyone — so the factory never runs and `window.formbricks` / `window.formbricksSurveys` stay
 * undefined. Outside CommonJS, our UMD bundles are only loaded through `<script>` tags and read
 * through their globals, so the AMD branch has no caller to serve.
 *
 * `amd.define` renames the function the wrapper looks for. A name no page defines makes that check
 * always false, so the wrapper falls through to the global branch. The CommonJS branch is unchanged.
 */
export const UMD_WITHOUT_AMD_OUTPUT = {
  amd: { define: "__formbricksUmdNoAmd" },
} satisfies Rollup.OutputOptions;
