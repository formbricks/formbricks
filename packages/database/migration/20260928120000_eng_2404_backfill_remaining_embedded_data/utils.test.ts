import { describe, expect, test } from "vitest";
import { type TLegacySurveyRow, planSurveySalvage } from "./utils";

/** Deterministic ids so the assertions can name them. */
const sequentialIds = () => {
  let next = 0;
  return () => `id_${(++next).toString()}`;
};

const survey = (overrides: Partial<TLegacySurveyRow> = {}): TLegacySurveyRow => ({
  id: "srv_1",
  workspaceId: "ws_1",
  variables: [],
  hiddenFields: { enabled: false },
  ...overrides,
});

const storageKeys = (plan: ReturnType<typeof planSurveySalvage>) => plan.links.map((link) => link.storageKey);

describe("planSurveySalvage", () => {
  test("plans nothing and loses nothing for a survey with no declarations", () => {
    expect(planSurveySalvage(survey(), sequentialIds())).toEqual({ fields: [], links: [], lost: [] });
  });

  test("keeps every declaration of a clean survey, variables first, at their existing addresses", () => {
    const plan = planSurveySalvage(
      survey({
        variables: [
          { id: "clx000000000000000000002", name: "tier", type: "text", value: "free" },
          { id: "clx000000000000000000001", name: "score", type: "number", value: 7 },
        ],
        hiddenFields: { enabled: true, fieldIds: ["Brand-Name", "plan"] },
      }),
      sequentialIds()
    );

    expect(plan.lost).toEqual([]);
    // Declaration order within each group, which the `order` column then records.
    expect(storageKeys(plan)).toEqual([
      "clx000000000000000000002",
      "clx000000000000000000001",
      "Brand-Name",
      "plan",
    ]);
    expect(plan.links.map((link) => link.order)).toEqual([0, 1, 2, 3]);
    expect(plan.fields[1]).toEqual({
      id: "id_3",
      workspaceId: "ws_1",
      surveyId: "srv_1",
      name: "score",
      source: "computed",
      dataType: "number",
      defaultValue: 7,
    });
    expect(plan.links[1].embeddedDataId).toBe(plan.fields[1].id);
  });

  test("keeps the first occurrence of a repeated storage key and reports the rest", () => {
    // The first backfill skipped this survey outright. Recall and logic resolve a key by first
    // match, so the first occurrence is the one every reader already saw.
    const plan = planSurveySalvage(
      survey({ hiddenFields: { enabled: true, fieldIds: ["plan", "campaign", "plan"] } }),
      sequentialIds()
    );

    expect(storageKeys(plan)).toEqual(["plan", "campaign"]);
    expect(plan.links.map((link) => link.order)).toEqual([0, 1]);
    expect(plan.lost).toEqual(["duplicate ingested field plan; kept the first"]);
  });

  test("drops a malformed element on its own and keeps the rest of the survey", () => {
    const plan = planSurveySalvage(
      survey({
        variables: [
          { id: "clx000000000000000000001", name: "score", type: "number", value: 7 },
          { name: "no_id", type: "text", value: "" },
          "not an object",
          { id: "clx000000000000000000003", type: "text", value: "" },
        ],
        hiddenFields: { enabled: true, fieldIds: ["plan", 42, ""] },
      }),
      sequentialIds()
    );

    expect(storageKeys(plan)).toEqual(["clx000000000000000000001", "plan"]);
    expect(plan.lost).toEqual([
      "variables[1] has no string id",
      "variables[2] is string, not an object",
      "variable clx000000000000000000003 has no string name",
      "hiddenFields.fieldIds[1] is not a non-empty string",
      "hiddenFields.fieldIds[2] is not a non-empty string",
    ]);
  });

  test("keeps a variable whose value is not a scalar, without a default", () => {
    const plan = planSurveySalvage(
      survey({
        variables: [{ id: "clx000000000000000000001", name: "score", type: "text", value: { x: 1 } }],
      }),
      sequentialIds()
    );

    expect(plan.fields[0]).toMatchObject({ name: "score", source: "computed", defaultValue: null });
    expect(plan.lost).toEqual([
      "variable clx000000000000000000001 value is object; stored without a default",
    ]);
  });

  test("reports a whole column that is the wrong shape, and still keeps the other one", () => {
    const plan = planSurveySalvage(
      survey({ variables: { oops: true }, hiddenFields: { enabled: true, fieldIds: ["plan"] } }),
      sequentialIds()
    );

    expect(storageKeys(plan)).toEqual(["plan"]);
    expect(plan.lost).toEqual(["variables is object, not an array"]);

    expect(planSurveySalvage(survey({ hiddenFields: ["plan"] }), sequentialIds()).lost).toEqual([
      "hiddenFields is an array, not an object",
    ]);
    expect(
      planSurveySalvage(survey({ hiddenFields: { enabled: true, fieldIds: "plan" } }), sequentialIds()).lost
    ).toEqual(["hiddenFields.fieldIds is string, not an array"]);
  });

  test("treats null and absent columns as empty, not as lost", () => {
    expect(planSurveySalvage(survey({ variables: null, hiddenFields: null }), sequentialIds())).toEqual({
      fields: [],
      links: [],
      lost: [],
    });
  });
});
