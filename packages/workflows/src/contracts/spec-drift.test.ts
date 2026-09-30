import { readFile, readdir } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { WORKFLOW_PROBLEM_CODES } from "../errors";
import { ZWorkflowRunLogStatus, ZWorkflowRunStatus, ZWorkflowStatus } from "../types";
import {
  WORKFLOW_API_OPERATIONS,
  ZCreateWorkflowInput,
  ZCursorPaginationMeta,
  ZWorkflowListItem,
  ZWorkflowRunListItem,
  ZWorkflowRunResource,
  ZWorkflowRunSummary,
  ZWorkflowTestProblemCode,
  ZWorkflowTestResult,
} from "./index";

/**
 * Drift guard between these operation contracts and their OpenAPI representation in
 * docs/api-v3-reference/src. The spec stays the source of truth for HTTP semantics (status
 * codes, headers, filter syntax); these tests pin the parts both layers must agree on:
 * operation coverage, status enums, resource property sets, and the spec's own examples.
 * Full zod-openapi generation of the spec components is planned once the routes land.
 */

const SPEC_SRC_URL = new URL("../../../../docs/api-v3-reference/src/", import.meta.url);

const loadYaml = async (relativePath: string): Promise<Record<string, unknown>> => {
  // Dynamic import keeps js-yaml out of the static import block, where prettier's sort-imports
  // grouping and eslint's import/order disagree about its position relative to node: builtins.
  const { load } = await import("js-yaml");
  const raw = await readFile(new URL(relativePath, SPEC_SRC_URL), "utf8");
  return load(raw) as Record<string, unknown>;
};

const schemaKeys = (schema: z.ZodObject): string[] => Object.keys(schema.shape).sort();

const yamlPropertyKeys = (yamlSchema: Record<string, unknown>): string[] =>
  Object.keys((yamlSchema.properties as Record<string, unknown> | undefined) ?? {}).sort();

/**
 * The property keys a schema really exposes, following `allOf` branches and the relative `$ref`s
 * between sibling component files.
 *
 * `yamlPropertyKeys` reads `properties` directly, so a composed schema answers `[]` — which reads as
 * "the spec declares nothing" rather than "the properties are one level down". The three assertions
 * above resolve their composition by hand because each is checking something narrower: that a named
 * base is composed with an extension of exactly these fields. Use this one when the question is only
 * what the whole schema ends up carrying.
 */
const composedPropertyKeys = async (relativePath: string): Promise<string[]> => {
  const schema = await loadYaml(relativePath);
  const branches = (schema.allOf as Record<string, unknown>[] | undefined) ?? [schema];
  const keys = new Set<string>();

  for (const branch of branches) {
    const ref = branch.$ref as string | undefined;
    if (ref) {
      for (const key of await composedPropertyKeys(`components/schemas/${ref.replace("./", "")}`)) {
        keys.add(key);
      }
      continue;
    }
    for (const key of yamlPropertyKeys(branch)) keys.add(key);
  }

  return [...keys].sort();
};

describe("operation coverage", () => {
  test("the contracts map covers exactly the workflow operations in the spec", async () => {
    const pathFiles = await readdir(new URL("paths/", SPEC_SRC_URL));
    const specOperationIds: string[] = [];

    for (const pathFile of pathFiles) {
      const pathItem = await loadYaml(`paths/${pathFile}`);
      for (const operation of Object.values(pathItem)) {
        const candidate = operation as { operationId?: string; tags?: string[] };
        if (candidate.tags?.includes("V3 Workflows") && candidate.operationId) {
          specOperationIds.push(candidate.operationId);
        }
      }
    }

    expect(specOperationIds.sort()).toEqual(Object.keys(WORKFLOW_API_OPERATIONS).sort());
  });
});

describe("status enums", () => {
  test.each([
    ["WorkflowStatus", ZWorkflowStatus.options],
    ["WorkflowRunStatus", ZWorkflowRunStatus.options],
    ["WorkflowRunLogStatus", ZWorkflowRunLogStatus.options],
  ])("%s enum matches the shared schema", async (schemaName, zodOptions) => {
    const yamlSchema = await loadYaml(`components/schemas/${schemaName}.yml`);
    expect(yamlSchema.enum).toEqual([...zodOptions]);
  });
});

describe("resource shapes", () => {
  test("WorkflowListItem properties match the contract shape", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowListItem.yml");
    expect(yamlPropertyKeys(yamlSchema)).toEqual(schemaKeys(ZWorkflowListItem));
    expect([...((yamlSchema.required as string[] | undefined) ?? [])].sort()).toEqual(
      schemaKeys(ZWorkflowListItem)
    );
  });

  test("WorkflowRunSummary properties match the contract shape", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowRunSummary.yml");
    expect(yamlPropertyKeys(yamlSchema)).toEqual(schemaKeys(ZWorkflowRunSummary));
    expect([...((yamlSchema.required as string[] | undefined) ?? [])].sort()).toEqual(
      schemaKeys(ZWorkflowRunSummary)
    );
  });

  test("WorkflowRunListItem extends the summary with the workflow name", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowRunListItem.yml");
    const [summaryRef, extension] = yamlSchema.allOf as [Record<string, string>, Record<string, unknown>];
    expect(summaryRef.$ref).toContain("WorkflowRunSummary");
    const summaryKeys = schemaKeys(ZWorkflowRunSummary);
    const extensionKeys = yamlPropertyKeys(extension);
    expect([...summaryKeys, ...extensionKeys].sort()).toEqual(schemaKeys(ZWorkflowRunListItem));
  });

  test("WorkflowResource composes the list item with a definition", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowResource.yml");
    const [listItemRef, extension] = yamlSchema.allOf as [Record<string, string>, Record<string, unknown>];
    expect(listItemRef.$ref).toContain("WorkflowListItem");
    expect(yamlPropertyKeys(extension)).toEqual(["definition"]);
  });

  test("WorkflowRunResource extends the summary with the debug payload", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowRunResource.yml");
    const [summaryRef, extension] = yamlSchema.allOf as [Record<string, string>, Record<string, unknown>];
    expect(summaryRef.$ref).toContain("WorkflowRunSummary");
    const summaryKeys = schemaKeys(ZWorkflowRunSummary);
    const extensionKeys = yamlPropertyKeys(extension);
    expect([...summaryKeys, ...extensionKeys].sort()).toEqual(schemaKeys(ZWorkflowRunResource));
  });

  test("CursorPaginationMeta matches the contract shape", async () => {
    // Composed rather than inline since ENG-3113: the fields live in `ListPaginationMeta`, shared
    // with every other v3 list, and this schema exists to close it.
    expect(await composedPropertyKeys("components/schemas/CursorPaginationMeta.yml")).toEqual(
      schemaKeys(ZCursorPaginationMeta)
    );
  });

  test("CursorPaginationMeta adds nothing of its own to the shared base", async () => {
    const yamlSchema = await loadYaml("components/schemas/CursorPaginationMeta.yml");
    const branches = yamlSchema.allOf as Record<string, string>[];

    expect(branches).toHaveLength(1);
    expect(branches[0].$ref).toContain("ListPaginationMeta");
    // The close has to be `unevaluatedProperties`, not `additionalProperties`: inside an `allOf` the
    // latter sees the base's own properties as additional and rejects every valid response.
    expect(yamlSchema.unevaluatedProperties).toBe(false);
  });

  /**
   * The echo reports the page size the server applied; it does not bound what may be asked for. A
   * `maximum` here is also the trap described on `ZCursorPaginationMeta`: `validateOutput` turns a
   * failing echo into a logged 500, so a cap that disagrees with the input schema converts a caller's
   * 400 into a server error.
   */
  test("the limit echo carries no upper bound, in either layer", async () => {
    const base = await loadYaml("components/schemas/ListPaginationMeta.yml");
    const limit = (base.properties as Record<string, Record<string, unknown>>).limit;

    expect(limit.minimum).toBe(1);
    expect(limit.maximum).toBeUndefined();
    expect(ZCursorPaginationMeta.safeParse({ limit: 1000, nextCursor: null }).success).toBe(true);
    // The lower bound is the half the assertions above do not reach: the spec says `minimum: 1`, so
    // the zod echo has to refuse 0 rather than merely not cap the top end.
    expect(ZCursorPaginationMeta.safeParse({ limit: 0, nextCursor: null }).success).toBe(false);
  });

  /**
   * The base's own stated guarantee, and the one with a named precedent: a shared envelope whose
   * fields drift to optional is how v3's predecessor stopped honouring its pagination contract with
   * nothing going red (ENG-2622). Deleting the `required` block left every other test here green.
   */
  test("the shared base requires both of its fields", async () => {
    const base = await loadYaml("components/schemas/ListPaginationMeta.yml");

    expect([...((base.required as string[] | undefined) ?? [])].sort()).toEqual(["limit", "nextCursor"]);
  });

  /**
   * The zod half of "closed". The YAML half is asserted above via `unevaluatedProperties`; without
   * this, `strictObject` could become `object` and the two layers would disagree silently.
   */
  test("the zod echo refuses a key the spec does not declare", () => {
    expect(ZCursorPaginationMeta.safeParse({ limit: 20, nextCursor: null, hasMore: true }).success).toBe(
      false
    );
  });

  test("WorkflowTestResult properties match the contract shape", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowTestResult.yml");
    expect(yamlPropertyKeys(yamlSchema)).toEqual(schemaKeys(ZWorkflowTestResult));
    expect([...((yamlSchema.required as string[] | undefined) ?? [])].sort()).toEqual(
      schemaKeys(ZWorkflowTestResult)
    );
  });

  test("WorkflowTestResult problem codes match the shared enum", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowTestResult.yml");
    // The problem-code enum is inlined on `problems.items` rather than a named component, so it is
    // reached by path instead of loaded as its own schema file.
    const problems = (yamlSchema.properties as Record<string, { items: Record<string, unknown> }>).problems;
    const code = (problems.items.properties as Record<string, { enum: string[] }>).code;
    expect(code.enum).toEqual([...ZWorkflowTestProblemCode.options]);
  });

  test("every problem code this package emits is published in Problem.yml", async () => {
    const yamlSchema = await loadYaml("components/schemas/Problem.yml");
    const code = (yamlSchema.properties as Record<string, { enum: string[] }>).code;

    // A subset of the v3 API's vocabulary, checked against the spec rather than against
    // `V3_PROBLEM_CODES` directly: this package is a leaf and cannot import from `apps/web`, so the
    // shared YAML is what keeps the two lists from drifting apart.
    expect(code.enum).toEqual(expect.arrayContaining([...WORKFLOW_PROBLEM_CODES]));
  });
});

describe("spec examples", () => {
  test("the create example parses with ZCreateWorkflowInput", async () => {
    const pathItem = await loadYaml("paths/api_v3_workflows.yml");
    const post = pathItem.post as {
      requestBody: {
        content: Record<string, { examples: Record<string, { value: unknown }> }>;
      };
    };
    const example = post.requestBody.content["application/json"].examples.responseCompletedEmail.value;
    expect(() => ZCreateWorkflowInput.parse(example)).not.toThrow();
  });

  test("the dry-run validation examples parse with ZWorkflowTestResult", async () => {
    const pathItem = await loadYaml("paths/api_v3_workflows_{workflowId}_test.yml");
    const post = pathItem.post as {
      responses: Record<
        string,
        { content: Record<string, { examples: Record<string, { value: { data: unknown } }> }> }
      >;
    };
    const examples = post.responses["200"].content["application/json"].examples;
    for (const example of Object.values(examples)) {
      expect(() => ZWorkflowTestResult.parse(example.value.data)).not.toThrow();
    }
  });
});
