import { describe, expect, test, vi } from "vitest";
import type { TFormbricksFileReferences } from "./envelope";
import { applyFormbricksFileReferences, planFormbricksFileReferences } from "./resolve";

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

describe("applyFormbricksFileReferences", () => {
  test("links an action class a concurrent create took, instead of failing on its unique key", async () => {
    const tx = {
      // The insert skipped the row: another transaction created the same action after this one's plan.
      actionClass: {
        createManyAndReturn: vi.fn(async () => []),
        findMany: vi.fn(async () => [{ id: "action_existing", name: "Pricing page", key: "pricing" }]),
      },
    } as never;

    const applied = await applyFormbricksFileReferences(tx, WORKSPACE_ID, {
      actionClasses: new Map([
        [
          "file_action_1",
          {
            create: {
              name: "Pricing page",
              description: null,
              type: "code",
              key: "pricing",
              noCodeConfig: null,
            },
          },
        ],
      ]),
      attributeKeysToCreate: [],
      languagesToCreate: [],
      issues: [],
    });

    expect(applied.actionClassIds.get("file_action_1")).toBe("action_existing");
    // It is not this import's to report as created.
    expect(applied.created.actionClasses).toEqual([]);
  });
});
