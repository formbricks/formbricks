import { describe, expect, test } from "vitest";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

/**
 * The SDK loads on every page of every customer site, so its size is held here rather than noticed in
 * review (ENG-3994, T3 · ENG-3911). Both bundles are built the way the production build minifies them
 * (UMD, esbuild) and measured gzipped. Raising a budget is a decision: say why in the PR.
 */

/**
 * js-core was ~11.4 KB gz before creatives; creatives may add ~6 KB (ADR 0003). Raised from 17 500 for
 * Show when (ENG-4002; ~18.9 KB with the feedback button icons): the shared show-conditions evaluator
 * (~0.9 KB) and the visit store (~0.6 KB) that its visit conditions read. Surveys' own show conditions
 * (ENG-3926) use the same two, so that work adds no second copy.
 */
const JS_CORE_MAX_GZIP_BYTES = 19_000;

/** The creatives renderer on its own: `resolve`, `render` and their helpers (ADR 0003: about 6 KB gz). */
const CREATIVES_MAX_GZIP_BYTES = 6_000;

const gzippedSize = async (entry: string): Promise<number> => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": resolve(import.meta.dirname) } },
    build: {
      write: false,
      lib: { entry, name: "bundle", formats: ["umd"], fileName: "bundle" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const [result] = Array.isArray(output) ? output : [output];
  if (!("output" in result)) throw new Error("expected a finished build, not a watcher");
  const code = result.output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("");
  return gzipSync(code).length;
};

describe("bundle size", () => {
  test("js-core stays within its budget", async () => {
    expect(await gzippedSize(resolve(import.meta.dirname, "index.ts"))).toBeLessThanOrEqual(
      JS_CORE_MAX_GZIP_BYTES
    );
  }, 60_000);

  test("the creatives renderer stays within its budget", async () => {
    const creativesEntry = resolve(import.meta.dirname, "../../creatives/src/index.ts");
    expect(await gzippedSize(creativesEntry)).toBeLessThanOrEqual(CREATIVES_MAX_GZIP_BYTES);
  }, 60_000);
});
