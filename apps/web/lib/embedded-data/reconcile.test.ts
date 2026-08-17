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

/** A hidden field, which is addressed and labelled by the same name. */
const ingested = (name: string): TDesiredEmbeddedField => ({
  storageKey: name,
  name,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
});

/** A link to a definition this survey owns — the only kind the legacy cards may edit or delete. */
const localField = (desired: TDesiredEmbeddedField, fieldId: string, order = 0): TCurrentEmbeddedField => ({
  linkId: `link_${fieldId}`,
  storageKey: desired.storageKey,
  order,
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
    const current = [localField(desiredPlan, "ed_plan", 0), localField(desiredScore, "ed_score", 1)];
    expect(planEmbeddedDataReconcile(SURVEY_ID, current, [desiredPlan, desiredScore])).toEqual({
      toCreate: [],
      toUpdate: [],
      toReorder: [],
      toUnlink: [],
    });
  });

  test("creates a field the survey does not have yet", () => {
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [], [desiredPlan]);
    expect(plan.toCreate).toEqual([{ ...desiredPlan, order: 0 }]);
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
    expect(plan.toCreate).toEqual([{ ...renamed, order: 0 }]);
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
    expect(plan.toReorder).toEqual([]);
  });

  test("replaces rather than mutates a field whose source changed", () => {
    // A computed and an ingested field that share an address are different fields, so flipping the
    // source in place would silently repoint where the value is read from.
    const nowIngested = { ...desiredScore, source: "ingested" as const };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredScore, "ed_score")], [nowIngested]);
    expect(plan.toUnlink).toEqual([{ linkId: "link_ed_score", fieldIdToDelete: "ed_score" }]);
    expect(plan.toCreate).toEqual([{ ...nowIngested, order: 0 }]);
    expect(plan.toUpdate).toEqual([]);
  });

  describe("order", () => {
    const h1 = ingested("h1");
    const h2 = ingested("h2");
    const h3 = ingested("h3");

    test("re-numbers the tail when a field is removed from the middle", () => {
      // The path that actually moves fields in v1. There is no drag-to-reorder UI for embedded
      // fields — the cards only append and filter — so positions shift when a middle field is
      // deleted, or when an API PATCH sends a reordered array. A two-field swap would not cover it.
      const current = [localField(h1, "ed_h1", 0), localField(h2, "ed_h2", 1), localField(h3, "ed_h3", 2)];
      const plan = planEmbeddedDataReconcile(SURVEY_ID, current, [h1, h3]);

      expect(plan.toUnlink).toEqual([{ linkId: "link_ed_h2", fieldIdToDelete: "ed_h2" }]);
      // Only h3 moved, and the link on its way out is not also reordered.
      expect(plan.toReorder).toEqual([{ linkId: "link_ed_h3", order: 1 }]);
    });

    test("gives a newly inserted field its position and pushes the rest down", () => {
      const current = [localField(h1, "ed_h1", 0), localField(h2, "ed_h2", 1)];
      const plan = planEmbeddedDataReconcile(SURVEY_ID, current, [desiredScore, h1, h2]);

      expect(plan.toCreate).toEqual([{ ...desiredScore, order: 0 }]);
      expect(plan.toReorder).toEqual([
        { linkId: "link_ed_h1", order: 1 },
        { linkId: "link_ed_h2", order: 2 },
      ]);
    });

    test("repairs links left at the wrong position, so a save is self-healing", () => {
      // What a survey looks like if it never ran the backfill, or was written by something that did
      // not set order. Comparing against the desired index rather than the current arrangement is
      // what lets the next ordinary save fix it.
      const current = [localField(h1, "ed_h1", 0), localField(h2, "ed_h2", 0), localField(h3, "ed_h3", 0)];
      const plan = planEmbeddedDataReconcile(SURVEY_ID, current, [h1, h2, h3]);

      expect(plan.toReorder).toEqual([
        { linkId: "link_ed_h2", order: 1 },
        { linkId: "link_ed_h3", order: 2 },
      ]);
      expect(plan.toUpdate).toEqual([]);
    });
  });

  describe("shared library definitions", () => {
    const sharedField = (order = 0): TCurrentEmbeddedField => ({
      linkId: "link_shared",
      storageKey: "plan",
      order,
      field: { id: "ed_shared", surveyId: null, ...desiredPlan },
    });

    test("unlinks a shared field without deleting the definition", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], []);
      expect(plan.toUnlink).toEqual([{ linkId: "link_shared", fieldIdToDelete: null }]);
    });

    test("ignores an edit to a shared field, which the workspace owns", () => {
      const edited = { ...desiredPlan, name: "Plan tier", dataType: "number" as const, defaultValue: 1 };
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], [edited]);
      expect(plan).toEqual({ toCreate: [], toUpdate: [], toReorder: [], toUnlink: [] });
    });

    test("still moves a shared field, because position belongs to the link", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField(3)], [desiredPlan]);
      expect(plan.toReorder).toEqual([{ linkId: "link_shared", order: 0 }]);
      expect(plan.toUpdate).toEqual([]);
    });
  });

  test("never deletes a local definition owned by another survey", () => {
    // The schema allows a link to a field another survey owns; only this check stops one survey's
    // save from destroying another's definition.
    const foreignField: TCurrentEmbeddedField = {
      linkId: "link_foreign",
      storageKey: "plan",
      order: 0,
      field: { id: "ed_foreign", surveyId: OTHER_SURVEY_ID, ...desiredPlan },
    };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [foreignField], []);
    expect(plan.toUnlink).toEqual([{ linkId: "link_foreign", fieldIdToDelete: null }]);
  });
});
