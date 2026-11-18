import { describe, expect, test } from "vitest";
import { z } from "zod";
import * as schemas from "./index";

/*
 * Columns the server owns. A request body that accepts one lets the caller archive a row, move it to
 * another tenant or forge its author: the server derives them from the route and the session (ENG-7325).
 */
const SERVER_OWNED_FIELDS = new Set(["archivedAt", "organizationId", "createdBy"]);

// What a caller sends: request bodies and their parts. Response schemas legitimately carry these fields.
const INPUT_SCHEMA_NAME = /(Request|Body|Input)(Base)?$/;

type TDef = { type: string; [key: string]: unknown };
const defOf = (schema: unknown): TDef | undefined =>
  (schema as { _zod?: { def?: TDef } } | null | undefined)?._zod?.def;

/** Every `path.to.key` in `schema` whose last segment is server-owned, through wrappers and unions. */
const serverOwnedPaths = (schema: unknown, path = "", seen = new Set<unknown>()): string[] => {
  const def = defOf(schema);
  if (!def || seen.has(schema)) return [];
  seen.add(schema);
  const walk = (child: unknown, childPath = path) => serverOwnedPaths(child, childPath, seen);
  switch (def.type) {
    case "object":
      return Object.entries(def.shape as Record<string, unknown>).flatMap(([key, child]) => [
        ...(SERVER_OWNED_FIELDS.has(key) ? [`${path}${key}`] : []),
        ...walk(child, `${path}${key}.`),
      ]);
    case "union":
      return (def.options as unknown[]).flatMap((option) => walk(option));
    case "intersection":
      return [...walk(def.left), ...walk(def.right)];
    case "array":
      return walk(def.element, `${path}[].`);
    case "record":
      return walk(def.valueType, `${path}{}.`);
    case "pipe":
      return [...walk(def.in), ...walk(def.out)];
    case "lazy":
      return walk((def.getter as () => unknown)());
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "readonly":
    case "catch":
    case "nonoptional":
      return walk(def.innerType);
    default:
      return [];
  }
};

const inputSchemas = Object.entries(schemas).filter(
  ([name, value]) => INPUT_SCHEMA_NAME.test(name) && defOf(value) !== undefined
);

describe("v3 request schemas never accept server-owned columns", () => {
  test("the walker finds a server-owned key however deep it sits", () => {
    const nested = z.strictObject({
      items: z.array(
        z.union([z.string(), z.strictObject({ meta: z.strictObject({ createdBy: z.string() }) })])
      ),
      tenant: z.strictObject({ organizationId: z.string() }).optional(),
    });
    expect(serverOwnedPaths(nested).sort()).toEqual(["items.[].meta.createdBy", "tenant.organizationId"]);
  });

  test("covers the request schemas the spec generates", () => {
    // Guards the name filter: if generation renames request schemas, this suite must not go silently empty.
    expect(inputSchemas.map(([name]) => name)).toEqual(
      expect.arrayContaining(["zCreateResponseRequest", "zPatchResponseRequest", "zCreateCreativeRequest"])
    );
  });

  test.each(inputSchemas)("%s", (_name, schema) => {
    expect(serverOwnedPaths(schema)).toEqual([]);
  });
});
