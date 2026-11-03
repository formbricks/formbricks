import { describe, expect, test, vi } from "vitest";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
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

const plannedCodeAction = {
  name: "Pricing page",
  description: null,
  type: "code" as const,
  key: "pricing",
  noCodeConfig: null,
};

const planOf = (actionClasses: Map<string, { create: typeof plannedCodeAction }>) => ({
  actionClasses,
  attributeKeysToCreate: [],
  languagesToCreate: [],
  issues: [],
});

describe("applyFormbricksFileReferences", () => {
  test("links a concurrent create by its key, never a same-named action class of another key", async () => {
    const tx = {
      actionClass: {
        // The insert skipped: another transaction took the name or the key after this one's plan.
        createManyAndReturn: vi.fn(async () => []),
        findMany: vi.fn(async () => [
          { id: "action_other", type: "noCode", key: null, noCodeConfig: { type: "click" } },
          { id: "action_same", type: "code", key: "pricing", noCodeConfig: null },
        ]),
      },
    } as never;

    const applied = await applyFormbricksFileReferences(
      tx,
      WORKSPACE_ID,
      planOf(new Map([["file_action_1", { create: plannedCodeAction }]]))
    );

    expect(applied.actionClassIds.get("file_action_1")).toBe("action_same");
    // It is not this import's to report as created.
    expect(applied.created.actionClasses).toEqual([]);
  });

  test("refuses, rather than link, when only a same-named action class of another identity took the name", async () => {
    const tx = {
      actionClass: {
        createManyAndReturn: vi.fn(async () => []),
        findMany: vi.fn(async () => [
          { id: "action_other", type: "noCode", key: null, noCodeConfig: { type: "click" } },
        ]),
      },
    } as never;

    await expect(
      applyFormbricksFileReferences(
        tx,
        WORKSPACE_ID,
        planOf(new Map([["file_action_1", { create: plannedCodeAction }]]))
      )
    ).rejects.toBeInstanceOf(SurveyImportInputError);
  });

  test("reports only the attribute keys and languages this transaction inserted", async () => {
    const tx = {
      actionClass: { createManyAndReturn: vi.fn(async () => []), findMany: vi.fn(async () => []) },
      // One of each was skipped: another import inserted it first.
      contactAttributeKey: { createManyAndReturn: vi.fn(async () => [{ key: "plan" }]) },
      language: { createManyAndReturn: vi.fn(async () => [{ code: "de-DE" }]) },
    } as never;

    const applied = await applyFormbricksFileReferences(tx, WORKSPACE_ID, {
      actionClasses: new Map(),
      attributeKeysToCreate: [
        { key: "plan", name: "Plan", description: null, dataType: "string" },
        { key: "seat", name: "Seat", description: null, dataType: "string" },
      ],
      languagesToCreate: [
        { code: "de-DE", alias: "German" },
        { code: "fr-FR", alias: "French" },
      ],
      issues: [],
    });

    expect(applied.created.attributeKeys).toEqual(["plan"]);
    expect(applied.created.languages).toEqual(["de-DE"]);
  });
});
