/**
 * The generation pipeline: read bundle → scope to the adopted tags → normalize → hey-api (in memory) →
 * oxfmt with the repository's own config. `generate.ts` is the CLI around it.
 */
import { fileURLToPath } from "node:url";
import { type OxfmtConfig, format } from "oxfmt";
import { readBundle } from "../src/testing/bundle";
import { ADOPTED_OPERATIONS } from "./adopted";
import { normalizeForGeneration } from "./normalize";
import { renderZodModule } from "./render";
import { scopeToTags } from "./scope";

export const OUTPUT_PATH = fileURLToPath(new URL("../src/generated/zod.gen.ts", import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const HEADER = [
  "// GENERATED FILE — do not edit. Source of truth: docs/api-v3-reference/src/ (bundled to openapi.yml).",
  "// Regenerate with `pnpm api:v3:schemas`; CI verifies freshness with `pnpm api:v3:schemas:check`.",
  `// Scope: ${Object.keys(ADOPTED_OPERATIONS).join(", ")} — see packages/api-v3-schemas/scripts/adopted.ts.`,
].join("\n");

// oxfmt's `format()` takes options as they are and discovers no config file, so the repository config is
// loaded and passed in. A runtime import keeps the root config file out of this package's TypeScript
// program. Its file-selection keys (which files to skip, per-path Tailwind themes) don't apply to one file
// whose path is fixed.
const loadFormatOptions = async () => {
  const configUrl = new URL("../../../oxfmt.config.mts", import.meta.url).href;
  const { default: config } = (await import(configUrl)) as { default: OxfmtConfig };
  const { ignorePatterns: _ignorePatterns, overrides: _overrides, ...options } = config;
  return options;
};

const formatOnce = async (source: string): Promise<string> => {
  const { code, errors } = await format(OUTPUT_PATH, source, await loadFormatOptions());
  if (errors.length > 0) {
    throw new Error(
      `oxfmt could not format the generated module: ${errors.map((e) => e.message).join("; ")}`
    );
  }
  return code;
};

const formatModule = async (source: string): Promise<string> => {
  const once = await formatOnce(source);
  const twice = await formatOnce(once);
  // A formatter that is not idempotent on this output would make the freshness check flap.
  if (once !== twice) throw new Error("oxfmt is not idempotent on the generated module");
  return once;
};

export const buildModule = async (): Promise<string> => {
  const scoped = scopeToTags(readBundle(), ADOPTED_OPERATIONS);
  const { document } = normalizeForGeneration(scoped);
  return formatModule(await renderZodModule(document, HEADER));
};
