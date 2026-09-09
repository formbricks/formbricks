import { describe, expect, test } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { normalizeFieldName, normalizeImportedFieldNames } from "./embedded-data";

const workspaceId = "clxx1234567890123456789012";

const document = () => ({
  name: "Fields",
  type: "link",
  status: "draft",
  defaultLanguage: "en-US",
  languages: [{ code: "en-US", default: true, enabled: true }],
  welcomeCard: { enabled: false },
  hiddenFields: { enabled: true, fieldIds: ["Customer-ID", "plan", "userId", "2nd_touch"] },
  variables: [
    { id: "clvar12345678901234567890", name: "Score Total", type: "number", value: 0 },
    { id: "clvar12345678901234567891", name: "plan", type: "text", value: "" },
  ],
  blocks: [
    {
      id: "b1",
      name: "Block",
      elements: [
        {
          id: "q1",
          type: "openText",
          headline: { "en-US": "Hello #recall:Customer-ID/fallback:there#, how is #recall:plan/fallback:#?" },
          required: false,
        },
        { id: "q2", type: "openText", headline: { "en-US": "Second" }, required: false },
      ],
      logic: [
        {
          id: "l1",
          conditions: {
            id: "c1",
            connector: "and",
            conditions: [
              {
                id: "cc1",
                leftOperand: { type: "hiddenField", value: "Customer-ID" },
                operator: "equals",
                rightOperand: { type: "static", value: "42" },
              },
            ],
          },
          actions: [{ id: "a1", objective: "jumpToBlock", target: "b2" }],
        },
      ],
    },
    {
      id: "b2",
      name: "Block 2",
      elements: [{ id: "q3", type: "openText", headline: { "en-US": "Third" }, required: false }],
    },
  ],
  endings: [{ id: "e1", type: "endScreen", headline: { "en-US": "Bye #recall:userId/fallback:#" } }],
});

describe("normalizeFieldName", () => {
  test.each([
    ["plan", "plan", false, false],
    ["Customer-ID", "customer_id", false, true],
    ["2nd touch", "f_2nd_touch", false, true],
    ["userId", "userid_imported", true, false],
    ["  ", "field", false, true],
  ])("%s → %s", (source, fieldId, refused, renamed) => {
    expect(normalizeFieldName(source)).toEqual({ source, fieldId, refused, renamed });
  });
});

describe("normalizeImportedFieldNames", () => {
  test("renames hidden fields and variables, rewrites logic operands and recall strings, reports each change", () => {
    const doc = document();
    const issues = normalizeImportedFieldNames(doc);

    expect(doc.hiddenFields.fieldIds).toEqual(["customer_id", "plan", "userid_imported", "f_2nd_touch"]);
    // A variable that collides with a hidden field name after normalization gets a suffix.
    expect(doc.variables.map((variable) => variable.name)).toEqual(["score_total", "plan_2"]);
    expect(doc.blocks[0].logic?.[0].conditions.conditions[0].leftOperand).toEqual({
      type: "hiddenField",
      value: "customer_id",
    });
    expect(doc.blocks[0].elements[0].headline["en-US"]).toBe(
      "Hello #recall:customer_id/fallback:there#, how is #recall:plan/fallback:#?"
    );
    expect(doc.endings[0].headline["en-US"]).toBe("Bye #recall:userid_imported/fallback:#");
    expect(issues.map((issue) => [issue.code, issue.vars])).toEqual([
      ["field_renamed", { from: "Customer-ID", to: "customer_id" }],
      ["embedded_data_name_refused", { name: "userId", renamed: "userid_imported" }],
      ["field_renamed", { from: "2nd_touch", to: "f_2nd_touch" }],
      ["field_renamed", { from: "Score Total", to: "score_total" }],
      ["field_renamed", { from: "plan", to: "plan_2" }],
    ]);
    expect(issues.every((issue) => issue.severity === "warning")).toBe(true);

    const preparation = prepareV3SurveyCreateInput({ workspaceId, ...doc });
    expect(preparation.ok, JSON.stringify(!preparation.ok && preparation.validation)).toBe(true);
  });

  test("is idempotent and leaves conforming names alone", () => {
    const doc = document();
    normalizeImportedFieldNames(doc);
    const snapshot = JSON.stringify(doc);

    expect(normalizeImportedFieldNames(doc)).toEqual([]);
    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(normalizeImportedFieldNames({ name: "No fields" })).toEqual([]);
  });
});
