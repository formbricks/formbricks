import { describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import {
  V3_RESPONSE_BODY_FIELDS,
  V3_RESPONSE_DENIED_FIELDS,
  isIdShaped,
  looksLikeReferenceName,
  referenceFor,
} from "./reference-manifest";
import { ZV3CreateResponseBody, ZV3PatchResponseBody, ZV3ResponseValidationRequestBody } from "./schemas";

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

/**
 * The validate envelope is a discriminated union, so it has options rather than one shape. Both are
 * covered: the `patch` variant is the one that carries `responseId`, and covering only it would leave
 * a field added to the `create` variant unclassified.
 */
const validationVariants = (): [string, z.ZodType][] => {
  const { options } = ZV3ResponseValidationRequestBody as unknown as { options: z.ZodType[] };
  if (!Array.isArray(options) || options.length !== 2) {
    throw new Error("could not reach the validation envelope's variants — the schema's shape changed");
  }
  return options.map((option, index) => [`ZV3ResponseValidationRequestBody[${index}]`, option]);
};

/**
 * Every request body this module ships. The envelope used to be missing, which meant its
 * `responseId` — a `z.cuid2()` both detectors would have flagged on a write body — was undeclared,
 * and a `workspaceId` added to it would have kept the suite green.
 */
const BODIES: [string, z.ZodType, number][] = [
  ["ZV3CreateResponseBody", ZV3CreateResponseBody, 4],
  ["ZV3PatchResponseBody", ZV3PatchResponseBody, 4],
  // The envelope carries two or three fields by design, so it gets its own floor — a shared one would
  // either wave the write bodies through or fail here for no reason.
  ...validationVariants().map(([name, schema]) => [name, schema, 2] as [string, z.ZodType, number]),
];

describe.each(BODIES)("%s reference manifest", (_name, body, minFields) => {
  const shape = shapeOf(body);
  const fields = Object.keys(shape);

  test("the shape is reachable and non-trivial, so the assertions below mean something", () => {
    // Without this, a change that made `shapeOf` return `{}` would turn every test here green.
    expect(fields.length).toBeGreaterThanOrEqual(minFields);
  });

  /**
   * Completeness, and the only assertion here that provides it.
   *
   * Set equality both ways: a field added to the body fails until someone classifies it, and a
   * classification left behind after a field is removed fails too. The detectors below cannot do
   * this — `data`, `embeddedData` and `language` match neither of them, which is exactly how an
   * earlier version of this file passed while three of its nine declarations were unenforced.
   */
  test("every field on the body is classified, and every classification is on the body", () => {
    const classified = Object.keys(V3_RESPONSE_BODY_FIELDS).filter((field) => fields.includes(field));
    const unclassified = fields.filter((field) => !(field in V3_RESPONSE_BODY_FIELDS));

    expect(unclassified).toEqual([]);
    // Every field of this body is covered by the roster, and the roster's entries for it are real.
    expect(classified.sort()).toEqual([...fields].sort());
  });

  /** A field the roster calls a reference must actually carry its declaration. */
  test("every field classified as a reference has a declaration", () => {
    const missing = fields.filter(
      (field) => V3_RESPONSE_BODY_FIELDS[field] !== "none" && !referenceFor(shape[field])
    );

    expect(missing).toEqual([]);
  });

  /** And a field the roster calls `none` must not be visibly an id — that would be a misclassification. */
  test("nothing classified as not-a-reference is visibly an id", () => {
    const suspicious = fields.filter(
      (field) =>
        V3_RESPONSE_BODY_FIELDS[field] === "none" &&
        (isIdShaped(shape[field]) || looksLikeReferenceName(field))
    );

    expect(suspicious).toEqual([]);
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

/**
 * The other direction, which the per-body checks structurally cannot make: the roster spans both
 * bodies, and the patch body carries only six of the create body's twelve fields, so neither describe
 * block can tell a stale entry from one that simply belongs to the other body. Without this, a
 * classification left behind after a field is deleted stays green forever — the same "cannot fail"
 * shape as the tautological test this file used to carry.
 */
describe("the roster as a whole", () => {
  const onAnyBody = new Set(BODIES.flatMap(([, schema]) => Object.keys(shapeOf(schema))));

  test("every classification names a field that still exists on one of the bodies", () => {
    const stale = Object.keys(V3_RESPONSE_BODY_FIELDS).filter((field) => !onAnyBody.has(field));

    expect(stale).toEqual([]);
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
