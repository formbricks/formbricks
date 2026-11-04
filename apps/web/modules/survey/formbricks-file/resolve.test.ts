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
  targeting: {
    filters: [
      {
        id: "clfilter0000000000000001",
        connector: null,
        resource: {
          id: "clresource00000000000001",
          root: { type: "attribute", contactAttributeKey: key },
          qualifier: { operator: "equals" },
          value: "pro",
        },
      },
    ],
  },
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

  test.each([
    ["one that is not a safe identifier", "Plan Tier"],
    ["one reserved for a future default attribute", "user_id"],
  ])("refuses to create %s, as every other way of creating a key does", async (_what, key) => {
    const refusal = await planFormbricksFileReferences(emptyReader() as never, {
      workspaceId: WORKSPACE_ID,
      survey: surveyTargeting(key),
      references: references([{ key, name: null }]),
      t: (text: string) => text,
      fieldPrefix: "file",
    }).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(SurveyImportInputError);
    expect((refusal as SurveyImportInputError).invalidParams).toEqual([
      expect.objectContaining({ name: "file.references.attributeKeys.0.key" }),
    ]);
  });

  test("names a refused key at its place in the file, past keys the survey doesn't use", async () => {
    const refusal = await planFormbricksFileReferences(emptyReader() as never, {
      workspaceId: WORKSPACE_ID,
      survey: surveyTargeting("Plan Tier"),
      references: references([
        { key: "unused", name: null },
        { key: "Plan Tier", name: null },
      ]),
      t: (text: string) => text,
      fieldPrefix: "file",
    }).catch((error: unknown) => error);

    expect((refusal as SurveyImportInputError).invalidParams).toEqual([
      expect.objectContaining({ name: "file.references.attributeKeys.1.key" }),
    ]);
  });

  test("links a key the workspace already has, whatever it is called", async () => {
    const reader = emptyReader();
    reader.contactAttributeKey.findMany = vi.fn(async () => [{ key: "userId" }]) as never;

    const plan = await planFormbricksFileReferences(reader as never, {
      workspaceId: WORKSPACE_ID,
      survey: surveyTargeting("userId"),
      references: references([{ key: "userId", name: "User Id" }]),
      t: (text: string) => text,
      fieldPrefix: null,
    });

    expect(plan.attributeKeysToCreate).toEqual([]);
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

  test("keeps a keyless code action and a no-code action distinct when both were skipped", async () => {
    const tx = {
      actionClass: {
        createManyAndReturn: vi.fn(async () => []),
        findMany: vi.fn(async () => [
          { id: "code_row", type: "code", key: null, noCodeConfig: null },
          { id: "nocode_row", type: "noCode", key: null, noCodeConfig: null },
        ]),
      },
    } as never;

    const applied = await applyFormbricksFileReferences(tx, WORKSPACE_ID, {
      actionClasses: new Map([
        [
          "file_code",
          { create: { name: "Code action", description: null, type: "code", key: null, noCodeConfig: null } },
        ],
        [
          "file_nocode",
          {
            create: {
              name: "No-code action",
              description: null,
              type: "noCode",
              key: null,
              noCodeConfig: null,
            },
          },
        ],
      ]),
      attributeKeysToCreate: [],
      languagesToCreate: [],
      issues: [],
    });

    expect(applied.actionClassIds.get("file_code")).toBe("code_row");
    expect(applied.actionClassIds.get("file_nocode")).toBe("nocode_row");
  });

  test("names an attribute key the file gives no name after its key, as the other create paths do", async () => {
    const createManyAndReturn = vi.fn(async () => [{ key: "plan_tier" }]);
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      actionClass: { createManyAndReturn: vi.fn(async () => []), findMany: vi.fn(async () => []) },
      contactAttributeKey: { count: vi.fn(async () => 0), createManyAndReturn },
      language: { createManyAndReturn: vi.fn(async () => []) },
    } as never;

    await applyFormbricksFileReferences(tx, WORKSPACE_ID, {
      actionClasses: new Map(),
      attributeKeysToCreate: [{ key: "plan_tier", name: null, description: null, dataType: "string" }],
      languagesToCreate: [],
      issues: [],
    });

    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ key: "plan_tier", name: "Plan Tier" })] })
    );
  });

  test("holds the workspace's attribute key cap again inside the transaction, under a lock", async () => {
    const executeRaw = vi.fn(async () => 0);
    const createManyAndReturn = vi.fn(async () => []);
    const tx = {
      $executeRaw: executeRaw,
      actionClass: { createManyAndReturn: vi.fn(async () => []), findMany: vi.fn(async () => []) },
      // Another import filled the workspace between this one's plan and its write.
      contactAttributeKey: { count: vi.fn(async () => 150), createManyAndReturn },
      language: { createManyAndReturn: vi.fn(async () => []) },
    } as never;

    const refusal = await applyFormbricksFileReferences(tx, WORKSPACE_ID, {
      actionClasses: new Map(),
      attributeKeysToCreate: [{ key: "plan", name: "Plan", description: null, dataType: "string" }],
      languagesToCreate: [],
      issues: [],
    }).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(SurveyImportInputError);
    expect(executeRaw).toHaveBeenCalled();
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  test("reports only the attribute keys and languages this transaction inserted", async () => {
    const tx = {
      actionClass: { createManyAndReturn: vi.fn(async () => []), findMany: vi.fn(async () => []) },
      // One of each was skipped: another import inserted it first.
      $executeRaw: vi.fn(async () => 0),
      contactAttributeKey: {
        count: vi.fn(async () => 0),
        createManyAndReturn: vi.fn(async () => [{ key: "plan" }]),
      },
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
