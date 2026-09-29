import { readFile, readdir } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { ZMcpListMeta } from "@/modules/mcp/tools/output-schemas";

/**
 * Drift guard for the shared list `meta`, which every v3 collection endpoint composes since ENG-3113.
 *
 * The composition is the risk. `additionalProperties: false` is the reflex for closing a schema and
 * it is wrong inside an `allOf`: it treats the base branch's own `limit` and `nextCursor` as
 * additional and rejects every valid response. `unevaluatedProperties: false` is the one that sees
 * the sibling branches. Nothing else compares them — redocly lints the document, not this rule — so
 * the mistake would surface as a contract-test failure against correct responses.
 *
 * Mirrors `packages/workflows/src/contracts/spec-drift.test.ts`, which owns the same guard for the
 * workflows side and for the zod echo.
 */

const SPEC_SRC_URL = new URL("../../../../../../docs/api-v3-reference/src/", import.meta.url);

type SpecSchema = {
  required?: string[];
  properties?: Record<string, SpecSchema>;
  allOf?: SpecSchema[];
  $ref?: string;
  minimum?: number;
  maximum?: number;
  additionalProperties?: unknown;
  unevaluatedProperties?: unknown;
};

const loadSchema = async (relativePath: string): Promise<SpecSchema> => {
  // Dynamic import keeps the YAML parser out of the static block, where prettier's grouping and
  // eslint's import/order disagree about its position relative to `node:` builtins.
  const { parse } = await import("yaml");
  return parse(await readFile(new URL(relativePath, SPEC_SRC_URL), "utf8")) as SpecSchema;
};

/** The property names and required set a meta really carries, following `allOf` and sibling `$ref`s. */
const resolveMeta = async (file: string): Promise<{ properties: string[]; required: string[] }> => {
  const schema = await loadSchema(`components/schemas/${file}`);
  const properties = new Set<string>();
  const required = new Set<string>();

  for (const branch of schema.allOf ?? []) {
    const nested = branch.$ref
      ? await resolveMeta(branch.$ref.replace("./", ""))
      : { properties: Object.keys(branch.properties ?? {}), required: branch.required ?? [] };
    for (const property of nested.properties) properties.add(property);
    for (const name of nested.required) required.add(name);
  }
  for (const property of Object.keys(schema.properties ?? {})) properties.add(property);
  for (const name of schema.required ?? []) required.add(name);

  return { properties: [...properties].sort(), required: [...required].sort() };
};

describe("v3 list meta contract", () => {
  test("every meta composing the shared base closes with `unevaluatedProperties`", async () => {
    const files = (await readdir(new URL("components/schemas/", SPEC_SRC_URL))).filter((file) =>
      file.endsWith("Meta.yml")
    );
    const composing: string[] = [];

    for (const file of files) {
      const schema = await loadSchema(`components/schemas/${file}`);
      if (!schema.allOf?.some((branch) => branch.$ref?.includes("ListPaginationMeta"))) continue;

      composing.push(file);
      expect({ file, closedWith: "additionalProperties", value: schema.additionalProperties }).toEqual({
        file,
        closedWith: "additionalProperties",
        value: undefined,
      });
      expect({ file, closedWith: "unevaluatedProperties", value: schema.unevaluatedProperties }).toEqual({
        file,
        closedWith: "unevaluatedProperties",
        value: false,
      });
    }

    // Names the composers that exist today so a broken glob cannot pass this vacuously, without
    // pinning the set — a fourth composer is covered by the loop, not a failure here.
    expect(composing).toEqual(
      expect.arrayContaining(["CursorPaginationMeta.yml", "ResponseListMeta.yml", "SurveyListMeta.yml"])
    );
  });

  test("each collection's `meta` resolves to the envelope it documents", async () => {
    expect(await resolveMeta("ResponseListMeta.yml")).toEqual({
      properties: ["limit", "nextCursor", "totalCount", "totalCountRelation"],
      required: ["limit", "nextCursor", "totalCount", "totalCountRelation"],
    });
    expect(await resolveMeta("SurveyListMeta.yml")).toEqual({
      properties: ["limit", "nextCursor", "totalCount", "workspaceSurveyCount"],
      required: ["limit", "nextCursor", "totalCount", "workspaceSurveyCount"],
    });
    // `action-classes` and `contact-attribute-keys` both point here.
    expect(await resolveMeta("CursorPaginationMeta.yml")).toEqual({
      properties: ["limit", "nextCursor"],
      required: ["limit", "nextCursor"],
    });
  });

  /**
   * The same envelope is declared twice — once in the spec for HTTP callers, once in zod for the MCP
   * tool that wraps the same operation. They have already drifted once: `ZMcpListMeta` shipped
   * declaring `hasMore` and `total`, neither of which the operation emits.
   */
  test("the documented response `meta` and the MCP envelope carry the same keys", async () => {
    const documented = await resolveMeta("ResponseListMeta.yml");

    expect(Object.keys(ZMcpListMeta.shape).sort()).toEqual(documented.properties);
  });
});
