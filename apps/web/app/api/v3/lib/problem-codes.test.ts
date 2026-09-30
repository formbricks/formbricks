import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { INTERNAL_PROBLEM_CODES, INVALID_PARAM_CODES, V3_PROBLEM_CODES } from "./response";

/**
 * Drift guard between the problem vocabularies the v3 code emits and the ones its OpenAPI contract
 * publishes.
 *
 * The spec's enums are hand-authored, and nothing used to check them against the emitters — so a new
 * `code` could ship undocumented, or a documented one could be silently dropped, and clients that
 * branch on `code` (`parseV3ApiError`, the MCP tool-result mapper, the AI error messages) would be
 * reading a contract the API no longer honours. This test is the check.
 */

const SPEC_SRC_URL = new URL("../../../../../../docs/api-v3-reference/src/", import.meta.url);

const loadSpecEnum = async (relativePath: string): Promise<string[]> => {
  // Dynamic import mirrors `packages/workflows/src/contracts/spec-drift.test.ts`: it keeps the YAML
  // parser out of the static import block, where prettier's grouping and eslint's import/order
  // disagree about its position relative to `node:` builtins.
  const { parse } = await import("yaml");
  const raw = await readFile(new URL(relativePath, SPEC_SRC_URL), "utf8");
  const schema = parse(raw) as { properties: { code: { enum: string[] } } };
  return schema.properties.code.enum;
};

describe("v3 problem code vocabulary", () => {
  test("Problem.yml publishes exactly the codes the API can emit", async () => {
    const specCodes = await loadSpecEnum("components/schemas/Problem.yml");

    // Exact equality, both directions: an undocumented code is a contract gap, and a documented code
    // nothing emits is a promise the API does not keep.
    expect([...specCodes].sort()).toEqual([...V3_PROBLEM_CODES].sort());
  });

  test("the registry is sorted and free of duplicates, so additions stay reviewable", () => {
    expect([...V3_PROBLEM_CODES]).toEqual([...V3_PROBLEM_CODES].sort());
    expect(new Set(V3_PROBLEM_CODES).size).toBe(V3_PROBLEM_CODES.length);
  });

  /**
   * The other direction of the same guard. Routes under `app/api/(internal)` reuse these helpers but
   * publish no contract, so their codes must stay out of `Problem.yml` — putting one there would
   * promise every public client a discriminator no public operation returns. The equality test above
   * already fails if an internal code is added to `V3_PROBLEM_CODES`; this says why, and catches the
   * subtler case of someone adding it to the spec alone.
   */
  test("internal-only codes are a separate vocabulary and stay out of the published contract", async () => {
    const specCodes = await loadSpecEnum("components/schemas/Problem.yml");

    for (const code of INTERNAL_PROBLEM_CODES) {
      expect(V3_PROBLEM_CODES).not.toContain(code);
      expect(specCodes).not.toContain(code);
    }

    expect([...INTERNAL_PROBLEM_CODES]).toEqual([...INTERNAL_PROBLEM_CODES].sort());
    expect(new Set(INTERNAL_PROBLEM_CODES).size).toBe(INTERNAL_PROBLEM_CODES.length);
  });

  test("every invalid_param code this app emits is published in InvalidParam.yml", async () => {
    const specCodes = await loadSpecEnum("components/schemas/InvalidParam.yml");

    // A subset, not an equality: the spec also publishes `invalid_graph`, which only
    // `@formbricks/workflows` emits (its codes never pass through `INVALID_PARAM_CODES`).
    expect(specCodes).toEqual(expect.arrayContaining([...INVALID_PARAM_CODES]));
  });
});
