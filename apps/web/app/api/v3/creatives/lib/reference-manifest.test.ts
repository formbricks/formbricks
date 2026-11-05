import { describe, expect, test } from "vitest";
import { z } from "zod";
import { V3_CREATIVE_BODY_FIELDS } from "./reference-manifest";
import { ZV3CreateCreativeBody, ZV3PatchCreativeBody } from "./schemas";

type TJsonSchema = {
  type?: string | string[];
  format?: string;
  properties?: Record<string, TJsonSchema>;
  items?: TJsonSchema;
  additionalProperties?: TJsonSchema | boolean;
  anyOf?: TJsonSchema[];
  oneOf?: TJsonSchema[];
  allOf?: TJsonSchema[];
};

/** Every field path a body schema accepts, with whether its value is id-shaped. */
const collectPaths = (schema: TJsonSchema, path = "", out = new Map<string, boolean>()) => {
  for (const branch of [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
    collectPaths(branch, path, out);
  }
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const next = path ? `${path}.${name}` : name;
    out.set(next, out.get(next) === true || property.format === "cuid2" || /Id$/.test(name));
    collectPaths(property, next, out);
  }
  if (schema.items) {
    out.set(`${path}[]`, out.get(`${path}[]`) ?? false);
    collectPaths(schema.items, `${path}[]`, out);
  }
  if (typeof schema.additionalProperties === "object") {
    out.set(`${path}{}`, out.get(`${path}{}`) ?? false);
    collectPaths(schema.additionalProperties, `${path}{}`, out);
  }
  return out;
};

const bodyPaths = (): Map<string, boolean> => {
  const paths = new Map<string, boolean>();
  for (const schema of [ZV3CreateCreativeBody, ZV3PatchCreativeBody]) {
    const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as TJsonSchema;
    for (const [path, idShaped] of collectPaths(jsonSchema))
      paths.set(path, paths.get(path) === true || idShaped);
  }
  return paths;
};

/** The roster entry covering `path`: its own, or the nearest `subtree` entry above it. */
const coveringEntry = (path: string): string | undefined => {
  if (V3_CREATIVE_BODY_FIELDS[path]) return path;
  return Object.keys(V3_CREATIVE_BODY_FIELDS)
    .filter((entry) => V3_CREATIVE_BODY_FIELDS[entry].subtree && path.startsWith(entry))
    .sort((left, right) => right.length - left.length)[0];
};

/** A path whose value holds no further fields: where a reference could actually sit. */
const isLeaf = (path: string, paths: Map<string, boolean>): boolean =>
  ![...paths.keys()].some(
    (other) => other.startsWith(`${path}.`) || other.startsWith(`${path}[]`) || other.startsWith(`${path}{}`)
  );

describe("creative write body reference roster", () => {
  const paths = bodyPaths();

  test("classifies every field the create and patch bodies accept", () => {
    const unclassified = [...paths.keys()].filter((path) => isLeaf(path, paths) && !coveringEntry(path));
    expect(unclassified).toEqual([]);
  });

  test("names no field the bodies no longer have", () => {
    const stale = Object.keys(V3_CREATIVE_BODY_FIELDS).filter((entry) => !paths.has(entry));
    expect(stale).toEqual([]);
  });

  test("gives every id-shaped field an entry of its own, so no reference hides in a subtree", () => {
    const hidden = [...paths].filter(([path, idShaped]) => idShaped && !V3_CREATIVE_BODY_FIELDS[path]);
    expect(hidden.map(([path]) => path)).toEqual([]);
  });
});
