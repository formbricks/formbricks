import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

/** A fixture as the route receives it: parsed by `JSON.parse`, which keeps an own `__proto__` key. */
export const loadQsfFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as Record<string, unknown>;

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
