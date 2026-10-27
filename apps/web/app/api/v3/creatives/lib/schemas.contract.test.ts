import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import * as generated from "@formbricks/api-v3-schemas";
import {
  EXPECTED_UNENFORCED,
  collectOperationExamples,
  diffAgainstSpec,
  parametersAsObjectSchema,
  readBundle,
  validatorFor,
} from "@formbricks/api-v3-schemas/testing";
import {
  ZV3CreateCreativeBody,
  ZV3CreativeIdParams,
  ZV3CreativeStatsQuery,
  ZV3PatchCreativeBody,
  ZV3PauseCreativesBody,
} from "./schemas";

vi.mock("server-only", () => ({}));

/**
 * The creative route schemas against the contract. They wrap the generated ones with refinements only
 * (Show when rules, NULL bytes, web link hosts), which JSON Schema can't show, so a wrapper that weakened
 * a field would surface here as a difference. The one expected difference is the `web-url` format the
 * generator can't carry, pinned in `EXPECTED_UNENFORCED` and enforced by the refinement.
 */
describe("the creative route schemas match the contract", () => {
  const bundle = readBundle();
  const pinned = (schema: string) =>
    EXPECTED_UNENFORCED.filter((pin) => pin.schema === schema)
      .map((pin) => `${pin.path} ${pin.keyword}`)
      .sort();

  test.each([
    ["CreateCreativeRequest", ZV3CreateCreativeBody],
    ["PatchCreativeRequest", ZV3PatchCreativeBody],
    ["PauseCreativesRequest", ZV3PauseCreativesBody],
  ])("%s differs from its contract schema only by its pinned constraints", (name, schema) => {
    const diffs = diffAgainstSpec(bundle, { $ref: `#/components/schemas/${name}` }, schema);
    expect(diffs.map((diff) => `${diff.path} ${diff.attr}`).sort()).toEqual(pinned(name));
  });

  /** OpenAPI can't close a parameter list; the routes refuse unknown ones, which is the only difference. */
  test.each([
    "getCreativeV3",
    "patchCreativeV3",
    "deleteCreativeV3",
    "archiveCreativeV3",
    "restoreCreativeV3",
    "duplicateCreativeV3",
    "getCreativeStatsV3",
  ])("%s path parameters match the contract, closed", (operationId) => {
    const spec = parametersAsObjectSchema(bundle, operationId, "path");
    expect(spec).toBeDefined();
    if (spec) {
      expect(diffAgainstSpec(bundle, spec, ZV3CreativeIdParams)).toEqual([
        { path: "$", attr: "closed", spec: false, zod: true },
      ]);
    }
  });

  test("getCreativeStatsV3 query parameters match the contract, closed", () => {
    const spec = parametersAsObjectSchema(bundle, "getCreativeStatsV3", "query");
    expect(spec).toBeDefined();
    if (spec) {
      expect(diffAgainstSpec(bundle, spec, ZV3CreativeStatsQuery)).toEqual([
        { path: "$", attr: "closed", spec: false, zod: true },
      ]);
    }
  });

  const components = new Map<string, z.ZodType>([
    ...Object.entries(generated as Record<string, unknown>).flatMap(([name, value]) =>
      value instanceof z.ZodType && name.startsWith("z") ? [[name.slice(1), value] as const] : []
    ),
    ["CreateCreativeRequest", ZV3CreateCreativeBody],
    ["PatchCreativeRequest", ZV3PatchCreativeBody],
  ]);
  const examples = collectOperationExamples(
    bundle,
    new Set([
      "getCreativesV3",
      "createCreativeV3",
      "getCreativeV3",
      "patchCreativeV3",
      "deleteCreativeV3",
      "archiveCreativeV3",
      "restoreCreativeV3",
      "duplicateCreativeV3",
      "getCreativeStatsV3",
      "pauseCreativesV3",
    ])
  );

  test("the operations carry request and response examples", () => {
    expect(examples.some((example) => example.label.includes(" request "))).toBe(true);
    expect(examples.some((example) => / 20\d /.test(example.label))).toBe(true);
  });

  test.each(examples.map((example) => [example.label, example] as const))(
    "the contract example %s parses through the schemas",
    (_label, example) => {
      const result = validatorFor(example.schema, components).safeParse(example.value);
      expect(result.error?.issues ?? []).toEqual([]);
    }
  );
});
