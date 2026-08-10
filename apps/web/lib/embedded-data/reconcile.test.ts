import { describe, expect, test } from "vitest";
import { type TDesiredEmbeddedField } from "@formbricks/types/embedded-data-mapping";
import { type TCurrentEmbeddedField, planEmbeddedDataReconcile } from "./reconcile";

const SURVEY_ID = "srv_1";
const OTHER_SURVEY_ID = "srv_2";

const desiredPlan: TDesiredEmbeddedField = {
  storageKey: "plan",
  name: "plan",
  source: "ingested",
  dataType: "string",
  defaultValue: null,
};

const desiredScore: TDesiredEmbeddedField = {
  storageKey: "var_score",
  name: "score",
  source: "computed",
  dataType: "number",
  defaultValue: 0,
};

/** A link to a definition this survey owns — the only kind the legacy cards may edit or delete. */
const localField = (desired: TDesiredEmbeddedField, fieldId: string): TCurrentEmbeddedField => ({
  linkId: `link_${fieldId}`,
  storageKey: desired.storageKey,
  field: {
    id: fieldId,
    surveyId: SURVEY_ID,
    name: desired.name,
    source: desired.source,
    dataType: desired.dataType,
    defaultValue: desired.defaultValue,
  },
});

describe("planEmbeddedDataReconcile", () => {
  test("does nothing when the survey already matches", () => {
    const current = [localField(desiredPlan, "ed_plan"), localField(desiredScore, "ed_score")];
    expect(planEmbeddedDataReconcile(SURVEY_ID, current, [desiredPlan, desiredScore])).toEqual({
      toCreate: [],
      toUpdate: [],
      toUnlink: [],
    });
  });

  test("creates a field the survey does not have yet", () => {
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [], [desiredPlan]);
    expect(plan.toCreate).toEqual([desiredPlan]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toUnlink).toEqual([]);
  });

  test("unlinks and deletes a local field the survey no longer has", () => {
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredPlan, "ed_plan")], []);
    expect(plan.toUnlink).toEqual([{ linkId: "link_ed_plan", fieldIdToDelete: "ed_plan" }]);
    expect(plan.toCreate).toEqual([]);
  });

  test("treats a rename as a delete plus a create, because the storage key moved", () => {
    // Renaming a hidden field changes the address its responses are keyed by, which is exactly why
    // renaming already orphans historical values today. Behaviour here matches that, not worse.
    const renamed = { ...desiredPlan, storageKey: "plan_tier", name: "plan_tier" };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredPlan, "ed_plan")], [renamed]);
    expect(plan.toUnlink).toEqual([{ linkId: "link_ed_plan", fieldIdToDelete: "ed_plan" }]);
    expect(plan.toCreate).toEqual([renamed]);
  });

  test.each([
    ["name", { ...desiredScore, name: "total_score" }],
    ["dataType", { ...desiredScore, dataType: "string" as const, defaultValue: "0" }],
    ["defaultValue", { ...desiredScore, defaultValue: 10 }],
  ])("updates a local field whose %s changed", (_label, updated) => {
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredScore, "ed_score")], [updated]);
    expect(plan.toUpdate).toEqual([
      {
        fieldId: "ed_score",
        name: updated.name,
        dataType: updated.dataType,
        defaultValue: updated.defaultValue,
      },
    ]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUnlink).toEqual([]);
  });

  test("replaces rather than mutates a field whose source changed", () => {
    // A computed and an ingested field that share an address are different fields, so flipping the
    // source in place would silently repoint where the value is read from.
    const nowIngested = { ...desiredScore, source: "ingested" as const };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredScore, "ed_score")], [nowIngested]);
    expect(plan.toUnlink).toEqual([{ linkId: "link_ed_score", fieldIdToDelete: "ed_score" }]);
    expect(plan.toCreate).toEqual([nowIngested]);
    expect(plan.toUpdate).toEqual([]);
  });

  describe("shared library definitions", () => {
    const sharedField: TCurrentEmbeddedField = {
      linkId: "link_shared",
      storageKey: "plan",
      field: { id: "ed_shared", surveyId: null, ...desiredPlan },
    };

    test("unlinks a shared field without deleting the definition", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField], []);
      expect(plan.toUnlink).toEqual([{ linkId: "link_shared", fieldIdToDelete: null }]);
    });

    test("ignores an edit to a shared field, which the workspace owns", () => {
      const edited = { ...desiredPlan, name: "Plan tier", dataType: "number" as const, defaultValue: 1 };
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField], [edited]);
      expect(plan).toEqual({ toCreate: [], toUpdate: [], toUnlink: [] });
    });
  });

  test("never deletes a local definition owned by another survey", () => {
    // The schema allows a link to a field another survey owns; only this check stops one survey's
    // save from destroying another's definition.
    const foreignField: TCurrentEmbeddedField = {
      linkId: "link_foreign",
      storageKey: "plan",
      field: { id: "ed_foreign", surveyId: OTHER_SURVEY_ID, ...desiredPlan },
    };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [foreignField], []);
    expect(plan.toUnlink).toEqual([{ linkId: "link_foreign", fieldIdToDelete: null }]);
  });
});
