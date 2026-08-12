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

      expect(plan).toEqual({ status: "skipped", duplicateStorageKeys: ["plan"] });
    });

    test("skips a survey whose hidden field name matches a variable's cuid", () => {
      const plan = planSurveyBackfill(
        survey({
          variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 0 }],
          hiddenFields: { enabled: true, fieldIds: ["clx000000000000000000001"] },
        }),
        sequentialIds()
      );

      expect(plan).toEqual({ status: "skipped", duplicateStorageKeys: ["clx000000000000000000001"] });
    });

    test("reports each colliding key once", () => {
      const plan = planSurveyBackfill(
        survey({ hiddenFields: { enabled: true, fieldIds: ["plan", "plan", "plan", "tier", "tier"] } }),
        sequentialIds()
      );

      expect(plan).toEqual({ status: "skipped", duplicateStorageKeys: ["plan", "tier"] });
    });
  });
});
