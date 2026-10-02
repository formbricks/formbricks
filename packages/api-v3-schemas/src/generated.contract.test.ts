import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ADOPTED_OPERATIONS } from "../scripts/adopted";
import { scopeToTags } from "../scripts/scope";
import * as generated from "./generated/zod.gen";
import { readBundle } from "./testing/bundle";
import { collectOperationExamples, validatorFor } from "./testing/examples";
import { diffAgainstSpec, parametersAsObjectSchema, requestBodySchema } from "./testing/fidelity";
import { isJsonObject, schemaNameFromRef } from "./testing/json";
import { EXPECTED_UNENFORCED, unenforcedKey } from "./testing/unenforced";

/**
 * The generated module against the contract it was generated from.
 *
 * The freshness check proves the module is what the pipeline produces today. These tests prove the
 * pipeline is *right*: that the Zod it emits enforces what the spec publishes, at every depth, except for
 * the constraints pinned in `EXPECTED_UNENFORCED` — which consumers must enforce themselves. They are what
 * turns a hey-api upgrade, or a new spec idiom, into a red build instead of a silently weaker API.
 */

const bundle = readBundle();
const scoped = scopeToTags(bundle, ADOPTED_OPERATIONS);
const scopedSchemas =
  isJsonObject(scoped.components) && isJsonObject(scoped.components.schemas) ? scoped.components.schemas : {};

const exports = new Map(
  Object.entries(generated as Record<string, unknown>).filter(
    (entry): entry is [string, z.ZodType] => entry[1] instanceof z.ZodType
  )
);
const components = new Map(
  Object.keys(scopedSchemas).flatMap((name) => {
    const schema = exports.get(`z${name}`);
    return schema ? [[name, schema] as const] : [];
  })
);
const operationIds = Object.values(ADOPTED_OPERATIONS).flat();
const pascal = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

describe("generated module coverage", () => {
  test("every component the adopted operations reach is generated", () => {
    expect(Object.keys(scopedSchemas).filter((name) => !components.has(name))).toEqual([]);
  });

  test("nothing outside the adopted scope is generated", () => {
    const operationSchemas = new Set(
      operationIds.flatMap((id) => ["Body", "Query", "Path"].map((part) => `z${pascal(id)}${part}`))
    );
    const parameters =
      isJsonObject(scoped.components) && isJsonObject(scoped.components.parameters)
        ? scoped.components.parameters
        : {};
    const parameterSchemas = new Set(Object.keys(parameters).map((name) => `z${name}`));
    const stray = [...exports.keys()].filter(
      (name) => !components.has(name.slice(1)) && !operationSchemas.has(name) && !parameterSchemas.has(name)
    );
    expect(stray).toEqual([]);
  });
});

describe("generated components match the contract", () => {
  const diffs = [...components].flatMap(([name, schema]) =>
    diffAgainstSpec(bundle, { $ref: `#/components/schemas/${name}` }, schema).map((diff) => ({
      schema: name,
      ...diff,
    }))
  );

  test("they differ only by the pinned unenforced constraints", () => {
    const pinned = new Set(EXPECTED_UNENFORCED.map(unenforcedKey));
    const unexpected = diffs.filter((diff) => !pinned.has(`${diff.schema} ${diff.path} ${diff.attr}`));
    expect(unexpected).toEqual([]);
  });

  test("every pinned constraint is still a real gap", () => {
    // A pin that no longer differs means the generator now enforces it: drop the pin and the refinement.
    const actual = new Set(diffs.map((diff) => `${diff.schema} ${diff.path} ${diff.attr}`));
    expect(EXPECTED_UNENFORCED.map(unenforcedKey).filter((key) => !actual.has(key))).toEqual([]);
  });
});

describe.each(operationIds)("operation %s", (operationId) => {
  test.each(["query", "path"] as const)("its %s parameters match the contract", (location) => {
    const spec = parametersAsObjectSchema(bundle, operationId, location);
    const schema = exports.get(`z${pascal(operationId)}${location === "query" ? "Query" : "Path"}`);
    if (!spec) {
      expect(schema).toBeUndefined();
      return;
    }
    expect(schema).toBeDefined();
    if (schema) expect(diffAgainstSpec(bundle, spec, schema)).toEqual([]);
  });

  test("its request body is the referenced component, or matches the contract", () => {
    const spec = requestBodySchema(bundle, operationId);
    const schema = exports.get(`z${pascal(operationId)}Body`);
    if (spec === undefined) {
      expect(schema).toBeUndefined();
      return;
    }
    const ref =
      isJsonObject(spec) && typeof spec.$ref === "string" ? schemaNameFromRef(spec.$ref) : undefined;
    // A referenced body is the component itself — the same instance — so the component diff covers it.
    if (ref) expect(schema).toBe(components.get(ref));
    else if (schema) expect(diffAgainstSpec(bundle, spec, schema)).toEqual([]);
    else expect.unreachable(`no generated body for ${operationId}`);
  });
});

describe("contract examples", () => {
  const examples = collectOperationExamples(bundle, new Set(operationIds));

  test("the adopted operations publish examples to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  test.each(examples.map((example) => [example.label, example] as const))("%s parses", (_label, example) => {
    const result = validatorFor(example.schema, components).safeParse(example.value);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  /**
   * The fidelity diff proves closedness structurally, from Zod's own JSON Schema. This proves it at
   * runtime on real payloads: an unknown key beside a valid body is rejected, not stripped — the
   * difference between a 400 `unsupported_field` and a silently ignored field.
   */
  const closedRequestExamples = examples.filter(
    (example) => example.label.includes(" request ") && isJsonObject(example.value)
  );
  test.each(closedRequestExamples.map((example) => [example.label, example] as const))(
    "%s with an unknown key is rejected",
    (_label, example) => {
      const value = isJsonObject(example.value)
        ? { ...example.value, notInTheContract: true }
        : example.value;
      const result = validatorFor(example.schema, components).safeParse(value);
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.some(
          (issue) => issue.code === "unrecognized_keys" || issue.code === "invalid_union"
        )
      ).toBe(true);
    }
  );
});
