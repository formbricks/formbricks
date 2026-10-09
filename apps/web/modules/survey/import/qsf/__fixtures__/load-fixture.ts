import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLarge150Qsf, buildOverLimitQsf } from "./qsf-builders";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

/** The fixtures built in memory rather than committed, being the largest. */
const BUILT_FIXTURES: ReadonlyMap<string, () => Record<string, unknown>> = new Map([
  ["large-150.qsf", buildLarge150Qsf],
  ["over-limit.qsf", buildOverLimitQsf],
]);

/**
 * A fixture as the route receives it: parsed by `JSON.parse`, which keeps an own `__proto__` key. A
 * built one goes through `JSON.stringify` and back, so it is exactly what its file would have been.
 */
export const loadQsfFixture = (name: string): Record<string, unknown> => {
  const build = BUILT_FIXTURES.get(name);
  const text = build ? JSON.stringify(build()) : readFileSync(join(FIXTURE_DIR, name), "utf8");
  return JSON.parse(text) as Record<string, unknown>;
};

/** Every fixture an import must turn into a survey. */
export const IMPORTABLE_QSF_FIXTURES = [
  "simple.qsf",
  "multilang-en-de.qsf",
  "logic-skip-display-branch.qsf",
  "matrix-slider-ranking.qsf",
  "pages-and-blocks.qsf",
  "embedded-data.qsf",
  "large-150.qsf",
  "legacy-object-payload.qsf",
  "nps-and-numeric-scales.qsf",
  "labels-and-languages.qsf",
  "rich-text.qsf",
  "prompt-injection.qsf",
  "pollution.qsf",
] as const;

export type TImportableQsfFixture = (typeof IMPORTABLE_QSF_FIXTURES)[number];
