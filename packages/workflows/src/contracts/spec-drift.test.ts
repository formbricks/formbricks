import { readFile, readdir } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { ZWorkflowRunLogStatus, ZWorkflowRunStatus, ZWorkflowStatus } from "../types";
import {
  WORKFLOW_API_OPERATIONS,
  ZCreateWorkflowInput,
  ZCursorPaginationMeta,
  ZWorkflowListItem,
  ZWorkflowRunResource,
  ZWorkflowRunSummary,
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
    const yamlSchema = await loadYaml("components/schemas/CursorPaginationMeta.yml");
    expect(yamlPropertyKeys(yamlSchema)).toEqual(schemaKeys(ZCursorPaginationMeta));
  });

  test("WorkflowTestResult properties match the contract shape", async () => {
    const yamlSchema = await loadYaml("components/schemas/WorkflowTestResult.yml");
    expect(yamlPropertyKeys(yamlSchema)).toEqual(schemaKeys(ZWorkflowTestResult));
    expect([...((yamlSchema.required as string[] | undefined) ?? [])].sort()).toEqual(
      schemaKeys(ZWorkflowTestResult)
    );
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
