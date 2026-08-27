import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { RESERVED_DECLARED_FIELD_NAMES } from "./validation";

/**
 * Anti-drift check for ENG-2539's decision docs: both public surfaces enumerate the refused
 * declared-field names concretely, and the lists are hand-maintained — a name added to
 * `FORBIDDEN_IDS` or `LINK_SURVEY_SYSTEM_PARAMS` fails no other check (the review round on the
 * ticket found exactly that: 17 names in the set, 16 in the docs — `embed` was missing).
 *
 * Deliberately couples this test to the docs' location and to the backtick convention: names appear
 * as `` `name` `` in both files, and matching on the delimited form is what keeps short names like
 * `end` or `start` from passing vacuously off ordinary prose. If a doc moves, this failing IS the
 * signal that its enumeration needs to move with it.
 */
describe("the refused-name enumeration in the docs matches RESERVED_DECLARED_FIELD_NAMES", () => {
  const read = (relativeToRepoRoot: string): string =>
    readFileSync(path.resolve(process.cwd(), "../..", relativeToRepoRoot), "utf8").toLowerCase();

  const surfaces = [
    "docs/api-v3-reference/src/components/schemas/SurveyHiddenFields.yml",
    "docs/surveys/general-features/hidden-fields.mdx",
  ];

  test.each(surfaces)("%s names every refused id", (surface) => {
    const content = read(surface);
    const missing = [...RESERVED_DECLARED_FIELD_NAMES].filter((name) => !content.includes(`\`${name}\``));

    expect(missing).toEqual([]);
  });
});
