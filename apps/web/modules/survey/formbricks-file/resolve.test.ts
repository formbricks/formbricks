import { describe, expect, test, vi } from "vitest";
import type { TFormbricksFileReferences } from "./envelope";
import { planFormbricksFileReferences } from "./resolve";

const WORKSPACE_ID = "clxx1234567890123456789012";

/** The resolver's reads, as this test reaches them: the workspace has none of the references yet. */
const emptyReader = () => ({
  actionClass: { findMany: vi.fn(async () => []) },
  contactAttributeKey: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  language: { findMany: vi.fn(async () => []) },
  embeddedData: {},
  $queryRaw: vi.fn(),
});

/** A survey whose targeting names one contact attribute key. */
const surveyTargeting = (key: string) => ({
  type: "app",
  defaultLanguage: "en-US",
  targeting: { filters: [{ resource: { root: { type: "attribute", contactAttributeKey: key } } }] },
});

const references = (attributeKeys: { key: string; name: string | null }[]): TFormbricksFileReferences => ({
  actionClasses: [],
  attributeKeys: attributeKeys.map(({ key, name }) => ({
    key,
    name,
    description: null,
    dataType: "string",
  })),
  embeddedFields: [],
  languages: [],
});

describe("planFormbricksFileReferences", () => {
  test("creates an attribute key a file names more than once once, with its first definition", async () => {
    const plan = await planFormbricksFileReferences(emptyReader() as never, {
      workspaceId: WORKSPACE_ID,
      survey: surveyTargeting("plan"),
      references: references([
        { key: "plan", name: "Plan" },
        { key: "plan", name: "Plan, again" },
      ]),
      t: (key: string) => key,
      fieldPrefix: null,
    });

    expect(plan.attributeKeysToCreate).toEqual([
      { key: "plan", name: "Plan", description: null, dataType: "string" },
    ]);
    expect(plan.issues.filter((issue) => issue.code === "attribute_key_created")).toHaveLength(1);
  });
});
