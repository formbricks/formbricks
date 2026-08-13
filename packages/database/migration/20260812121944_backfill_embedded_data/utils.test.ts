import { describe, expect, test } from "vitest";
import { type TLegacySurveyRow, planSurveyBackfill } from "./utils";

/** Deterministic ids so the assertions can name them. */
const sequentialIds = () => {
  let next = 0;
  return () => `id_${(++next).toString()}`;
};

const survey = (overrides: Partial<TLegacySurveyRow> = {}): TLegacySurveyRow => ({
  id: "srv_1",
  workspaceId: "ws_1",
  variables: [],
  hiddenFields: { enabled: true, fieldIds: [] },
  ...overrides,
});

describe("planSurveyBackfill", () => {
  test("plans nothing for a survey with no declarations", () => {
    expect(planSurveyBackfill(survey(), sequentialIds())).toEqual({
      status: "ok",
      fields: [],
      links: [],
    });
  });

  test("keeps a variable's cuid and a hidden field's name as the storage key", () => {
    // The two invariants the whole migration exists to hold.
    const plan = planSurveyBackfill(
      survey({
        variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
        hiddenFields: { enabled: true, fieldIds: ["Brand-Name"] },
      }),
      sequentialIds()
    );

    expect(plan.status).toBe("ok");
    if (plan.status !== "ok") return;
    expect(plan.links.map((link) => link.storageKey)).toEqual(["clx000000000000000000001", "Brand-Name"]);
  });

  test("writes rows and links that reference each other, scoped to the survey's workspace", () => {
    const plan = planSurveyBackfill(
      survey({ hiddenFields: { enabled: true, fieldIds: ["plan"] } }),
      sequentialIds()
    );

    expect(plan).toEqual({
      status: "ok",
      fields: [
        {
          id: "id_1",
          workspaceId: "ws_1",
          surveyId: "srv_1",
          name: "plan",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
        },
      ],
      links: [
        {
          id: "id_2",
          workspaceId: "ws_1",
          surveyId: "srv_1",
          embeddedDataId: "id_1",
          storageKey: "plan",
        },
      ],
    });
  });

  test("carries a variable's declared type and value onto the row", () => {
    const plan = planSurveyBackfill(
      survey({
        variables: [
          { id: "clx000000000000000000001", name: "score", type: "number", value: 7 },
          { id: "clx000000000000000000002", name: "tier", type: "text", value: "gold" },
        ],
      }),
      sequentialIds()
    );

    expect(plan.status).toBe("ok");
    if (plan.status !== "ok") return;
    expect(
      plan.fields.map(({ source, dataType, defaultValue }) => ({ source, dataType, defaultValue }))
    ).toEqual([
      { source: "computed", dataType: "number", defaultValue: 7 },
      { source: "computed", dataType: "string", defaultValue: "gold" },
    ]);
  });

  describe("surveys that cannot be migrated", () => {
    // `@@unique([surveyId, storageKey])` would reject these, and the runner puts the whole backfill
    // in one transaction — so a survey like this has to be reported, not inserted.
    test("skips a survey declaring the same hidden field twice", () => {
      const plan = planSurveyBackfill(
        survey({ hiddenFields: { enabled: true, fieldIds: ["plan", "plan"] } }),
        sequentialIds()
      );

      expect(plan).toEqual({ status: "skipped", reason: "duplicate-address", detail: ["plan"] });
    });

    test("skips a survey whose hidden field name matches a variable's cuid", () => {
      const plan = planSurveyBackfill(
        survey({
          variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 0 }],
          hiddenFields: { enabled: true, fieldIds: ["clx000000000000000000001"] },
        }),
        sequentialIds()
      );

      expect(plan).toEqual({
        status: "skipped",
        reason: "duplicate-address",
        detail: ["clx000000000000000000001"],
      });
    });

    test("reports each colliding key once", () => {
      const plan = planSurveyBackfill(
        survey({ hiddenFields: { enabled: true, fieldIds: ["plan", "plan", "plan", "tier", "tier"] } }),
        sequentialIds()
      );

      expect(plan).toEqual({ status: "skipped", reason: "duplicate-address", detail: ["plan", "tier"] });
    });
  });

  describe("malformed declarations", () => {
    // The columns are raw JSON here. `toDesiredEmbeddedFields` maps them with `?? []`, which catches
    // null and undefined but not a wrong type — so without these checks the survey reaches `.map()`
    // and throws inside the runner's single transaction, rolling back every survey before it.
    test.each([
      ["variables is an object", { variables: { oops: true } }, "variables is object, not an array"],
      ["variables is a string", { variables: "nope" }, "variables is string, not an array"],
      ["variables holds null", { variables: [null] }, "variables contains a non-object element"],
      [
        "a variable has no id",
        { variables: [{ name: "score", type: "number", value: 0 }] },
        "variables contains an element without a string id",
      ],
      [
        "fieldIds is a string",
        { hiddenFields: { enabled: true, fieldIds: "plan" } },
        "hiddenFields.fieldIds is string, not an array",
      ],
      [
        "fieldIds holds a number",
        { hiddenFields: { enabled: true, fieldIds: [42] } },
        "hiddenFields.fieldIds contains a non-string entry",
      ],
    ])("skips a survey where %s", (_label, overrides, problem) => {
      const plan = planSurveyBackfill(survey(overrides), sequentialIds());

      expect(plan).toEqual({ status: "skipped", reason: "malformed-declarations", detail: [problem] });
    });

    test("still migrates a survey whose malformed-looking column is simply absent", () => {
      // A SQL NULL column is not malformed — it just declares nothing.
      const plan = planSurveyBackfill(
        survey({ variables: null, hiddenFields: { enabled: true, fieldIds: ["plan"] } }),
        sequentialIds()
      );

      expect(plan.status).toBe("ok");
    });
  });
});
