import { describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import {
  V3_RESPONSE_DENIED_FIELDS,
  isIdShaped,
  looksLikeReferenceName,
  referenceFor,
} from "./reference-manifest";
import { ZV3CreateResponseBody, ZV3PatchResponseBody } from "./schemas";

vi.mock("server-only", () => ({}));

/**
 * The guard ENG-2861 exists for.
 *
 * Twelve shipped security fixes on responses were one shape — an id in the request body that nobody
 * checked against the caller's tenant. Each was fixed individually, and nothing stopped the next,
 * because the checks lived in the code that happened to run rather than in anything that knew the set
 * of references.
 *
 * These tests read the **schema**, so they fail on a field that exists rather than on one someone
 * remembered. A new reference is caught two ways: structurally, because `z.cuid2()` is recognisable
 * whatever the field is called, and by name, for the ids that are plain strings.
 */

const shapeOf = (schema: z.ZodType): Record<string, z.ZodType> => {
  // Both bodies are wrapped — `.strict()` on create, `.refine()` on patch — so the object with the
  // shape sits one or two levels in. Walking beats reaching, since which wrapper is outermost is the
  // schema author's choice and not something this test should pin.
  let current: unknown = schema;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const def = (current as { _zod?: { def?: Record<string, unknown> }; def?: Record<string, unknown> })._zod
      ?.def;
    if (def?.shape) return def.shape as Record<string, z.ZodType>;
    current = def?.innerType ?? def?.in ?? def?.schema;
  }

  throw new Error("could not reach the object shape — the schema's wrappers changed");
};

const BODIES: [string, z.ZodType][] = [
  ["ZV3CreateResponseBody", ZV3CreateResponseBody],
  ["ZV3PatchResponseBody", ZV3PatchResponseBody],
];

describe.each(BODIES)("%s reference manifest", (_name, body) => {
  const shape = shapeOf(body);
  const fields = Object.keys(shape);

  test("the shape is reachable and non-trivial, so the assertions below mean something", () => {
    // Without this, a change that made `shapeOf` return `{}` would turn every test here green.
    expect(fields.length).toBeGreaterThan(3);
  });

  /**
   * The structural half. `z.cuid2()` carries `format: "cuid2"`, and an array exposes its element, so
   * this catches a new id-shaped field whatever it is named — including one named nothing like a
   * reference, which is the case a naming rule cannot see.
   */
  test("every id-shaped field is declared", () => {
    const undeclared = fields.filter((field) => isIdShaped(shape[field]) && !referenceFor(shape[field]));

    expect(undeclared).toEqual([]);
  });

  /**
   * The naming half, for ids that are plain strings: `endingId` is a survey-local id and `singleUseId`
   * is a token, so neither is cuid2-validated and neither would be caught above.
   */
  test("every field named like a reference is declared", () => {
    const undeclared = fields.filter((field) => looksLikeReferenceName(field) && !referenceFor(shape[field]));

    expect(undeclared).toEqual([]);
  });

  /** Keeps the manifest from rotting: a declaration for a field that no longer exists is a lie. */
  test("every declaration names a field the body still has", () => {
    const declared = fields.filter((field) => referenceFor(shape[field]));

    expect(declared.length).toBeGreaterThan(0);
    for (const field of declared) {
      expect(shape[field]).toBeDefined();
    }
  });

  /**
   * The second artifact. The manifest can assert *declared ⇒ resolved*; it cannot assert
   * *forbidden ⇒ absent*, because a field nobody added is a field nobody declared. Tenancy the caller
   * must not choose, and identity the server derives, are the ones whose presence would be the bug.
   */
  test("no denied field appears on the body", () => {
    const present = V3_RESPONSE_DENIED_FIELDS.filter((denied) => fields.includes(denied));

    expect(present).toEqual([]);
  });
});

describe("the detectors themselves", () => {
  // These are what every assertion above rests on, so a detector that quietly stopped detecting would
  // take the whole file green with it.
  test("id-shaped detection sees through optional, nullable and arrays", async () => {
    const { z: zod } = await import("zod");

    expect(isIdShaped(zod.cuid2())).toBe(true);
    expect(isIdShaped(zod.cuid2().optional())).toBe(true);
    expect(isIdShaped(zod.array(zod.cuid2()).optional())).toBe(true);
    expect(isIdShaped(zod.string())).toBe(false);
    expect(isIdShaped(zod.string().min(1).max(255))).toBe(false);
  });

  test("the name rule matches id suffixes and not ordinary fields", () => {
    expect(["surveyId", "contactId", "tagIds"].every(looksLikeReferenceName)).toBe(true);
    expect(["finished", "data", "language", "meta"].some(looksLikeReferenceName)).toBe(false);
  });
});
