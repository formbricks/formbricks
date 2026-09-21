import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
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
describe("the refused-name enumeration in the docs matches the two reserved sets", () => {
  const read = (relativeToRepoRoot: string): string =>
    readFileSync(path.resolve(process.cwd(), "../..", relativeToRepoRoot), "utf8").toLowerCase();

  // Both halves of the refusal surface: the 17 link-contract names AND the auto-captured catalog.
  // The catalog is the larger half and grows (ENG-1858, `locale` via ENG-2472) — pinning only the 17
  // left 26+ names as prose no test could hold to, which is how `embed` went missing the first time.
  const refusedNames = [...RESERVED_DECLARED_FIELD_NAMES, ...RESERVED_FIELD_NAMES];

  const surfaces = [
    "docs/api-v3-reference/src/components/schemas/SurveyHiddenFields.yml",
    "docs/surveys/general-features/hidden-fields.mdx",
    // Create-only variable schemas carry the same rule: `collectDeclaredFieldNames` maps variables
    // too, so a new variable named `country` or `1foo` gets the identical 400.
    "docs/api-v3-reference/src/components/schemas/CreateSurveyTextVariable.yml",
    "docs/api-v3-reference/src/components/schemas/CreateSurveyNumberVariable.yml",
  ];

  test.each(surfaces)("%s names every refused id from both sets", (surface) => {
    const content = read(surface);
    const missing = refusedNames.filter((name) => !content.includes(`\`${name}\``));

    expect(missing).toEqual([]);
  });
});
