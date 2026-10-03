/**
 * The generation pipeline: read bundle → scope to the adopted tags → normalize → hey-api (in memory) →
 * Prettier with the repository's own config. `generate.ts` is the CLI around it.
 */
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
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

const formatModule = async (source: string): Promise<string> => {
  const config = (await resolveConfig(OUTPUT_PATH, { editorconfig: true })) ?? {};
  const options = { ...config, filepath: OUTPUT_PATH };
  const once = await format(source, options);
  const twice = await format(once, options);
  // A formatter that is not idempotent on this output would make the freshness check flap.
  if (once !== twice) throw new Error("Prettier is not idempotent on the generated module");
  return once;
};

export const buildModule = async (): Promise<string> => {
  const scoped = scopeToTags(readBundle(), ADOPTED_OPERATIONS);
  const { document } = normalizeForGeneration(scoped);
  return formatModule(await renderZodModule(document, HEADER));
};
