import { describe, expect, test } from "vitest";
import type { JsonObject } from "../src/testing/json";
import { scopeToTags } from "./scope";

const document = (): JsonObject => ({
  openapi: "3.1.1",
  info: { title: "t", version: "1" },
  paths: {
    "/a": {
      parameters: [{ $ref: "#/components/parameters/Shared" }],
      get: { operationId: "getA", tags: ["A"], responses: { "200": { $ref: "#/components/responses/Ok" } } },
      post: {
        operationId: "createA",
        tags: ["A"],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Union" } } } },
      },
    },
    "/b": { get: { operationId: "getB", tags: ["B"], requestBody: { $ref: "#/components/schemas/OnlyB" } } },
  },
  components: {
    schemas: {
      Union: {
        oneOf: [{ $ref: "#/components/schemas/Left" }],
        discriminator: { propertyName: "k", mapping: { x: "#/components/schemas/Mapped" } },
      },
      Left: { type: "object", properties: { nested: { $ref: "#/components/schemas/Leaf" } } },
      Leaf: { type: "string" },
      Mapped: { type: "object" },
      OnlyB: { type: "object" },
      Problem: { type: "object" },
    },
    parameters: {
      Shared: { name: "s", in: "query", schema: { type: "string" } },
      Unused: { name: "u", in: "query" },
    },
    responses: {
      Ok: { content: { "application/json": { schema: { $ref: "#/components/schemas/Problem" } } } },
    },
    securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
  },
});

describe("scopeToTags", () => {
  test("keeps only the adopted operations and the components they reach, transitively", () => {
    const scoped = scopeToTags(document(), { A: ["getA", "createA"] });

    expect(Object.keys(scoped.paths as JsonObject)).toEqual(["/a"]);
    const components = scoped.components as Record<string, JsonObject>;
    // Leaf is reached through Left; Mapped only through a discriminator mapping; Problem through a response.
    expect(Object.keys(components.schemas)).toEqual(["Union", "Left", "Leaf", "Mapped", "Problem"]);
    expect(Object.keys(components.parameters)).toEqual(["Shared"]);
    expect(Object.keys(components.responses)).toEqual(["Ok"]);
    expect(components.securitySchemes).toEqual(
      document().components && (document().components as JsonObject).securitySchemes
    );
  });

  test("keeps path-level parameters of a kept path", () => {
    const scoped = scopeToTags(document(), { A: ["getA", "createA"] });
    expect(((scoped.paths as JsonObject)["/a"] as JsonObject).parameters).toEqual([
      { $ref: "#/components/parameters/Shared" },
    ]);
  });

  test("fails when an adopted tag gained, lost or renamed an operation", () => {
    expect(() => scopeToTags(document(), { A: ["getA"] })).toThrow(/unexpected \[createA\]/);
    expect(() => scopeToTags(document(), { A: ["getA", "createA", "deleteA"] })).toThrow(
      /missing \[deleteA\]/
    );
    expect(() => scopeToTags(document(), { Renamed: ["getA", "createA"] })).toThrow(/"Renamed": missing/);
  });

  test("a property named `mapping` and a `$ref` inside example data are not references", () => {
    const spec = document();
    const schemas = (spec.components as JsonObject).schemas as JsonObject;
    schemas.Left = {
      type: "object",
      properties: { mapping: { type: "string" }, nested: { $ref: "#/components/schemas/Leaf" } },
      example: { $ref: "#/components/schemas/OnlyB" },
    };
    const scoped = scopeToTags(spec, { A: ["getA", "createA"] });

    expect(Object.keys((scoped.components as Record<string, JsonObject>).schemas)).not.toContain("OnlyB");
  });

  test("fails on an unresolvable reference rather than generating less", () => {
    const broken = document();
    ((broken.components as JsonObject).schemas as JsonObject).Left = { $ref: "#/components/schemas/Gone" };
    expect(() => scopeToTags(broken, { A: ["getA", "createA"] })).toThrow(
      /Unresolvable reference #\/components\/schemas\/Gone/
    );
  });
});
