import { describe, expect, test, vi } from "vitest";
import { type TDesiredEmbeddedField } from "@formbricks/types/embedded-data-mapping";
import { deriveLegacyEmbeddedData } from "@formbricks/types/embedded-data-resolver";
import {
  type TCurrentEmbeddedField,
  assertLinkableEmbeddedFields,
  planEmbeddedDataReconcile,
  reconcileEmbeddedData,
  resolveDesiredEmbeddedFields,
} from "./reconcile";

const SURVEY_ID = "srv_1";
const OTHER_SURVEY_ID = "srv_2";

const desiredPlan: TDesiredEmbeddedField = {
  storageKey: "plan",
  name: "plan",
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  key: null,
};

const desiredScore: TDesiredEmbeddedField = {
  storageKey: "var_score",
  name: "score",
  source: "computed",
  dataType: "number",
  defaultValue: 0,
  locked: false,
  key: null,
};

/** A hidden field, which is addressed and labelled by the same name. */
const ingested = (name: string): TDesiredEmbeddedField => ({
  storageKey: name,
  name,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  key: null,
});

/** A link to a definition this survey owns — the only kind the legacy cards may edit or delete. */
const localField = (desired: TDesiredEmbeddedField, fieldId: string, order = 0): TCurrentEmbeddedField => ({
  linkId: `link_${fieldId}`,
  storageKey: desired.storageKey,
  order,
  field: {
    id: fieldId,
    surveyId: SURVEY_ID,
    key: null,
    name: desired.name,
    source: desired.source,
    dataType: desired.dataType,
    defaultValue: desired.defaultValue,
    locked: desired.locked,
  },
});

/** A link to a workspace-owned library definition: no owning survey, and a library key. */
const sharedLink = (
  desired: TDesiredEmbeddedField,
  fieldId: string,
  key: string,
  order = 0
): TCurrentEmbeddedField => ({
  ...localField(desired, fieldId, order),
  field: { ...localField(desired, fieldId, order).field, surveyId: null, key },
});

/** The same definition as a desired entry: the pair the editor sends back to keep the link. */
const sharedDesired = (
  desired: TDesiredEmbeddedField,
  fieldId: string,
  key: string
): TDesiredEmbeddedField => ({ ...desired, key, embeddedDataId: fieldId });

describe("resolveDesiredEmbeddedFields", () => {
  const currentScore: TDesiredEmbeddedField = { ...desiredScore };
  const currentPlan: TDesiredEmbeddedField = { ...desiredPlan };
  const current = [currentScore, currentPlan];

  test("carries a group over untouched when the payload does not mention it", () => {
    // The whole reason this is a merge. `updateSurveyInternal` and the v3 patch both take partial
    // payloads, and a save that only renames the survey must not read as "delete every field".
    expect(resolveDesiredEmbeddedFields(current, {})).toEqual(current);
  });

  test("treats an explicitly empty list as a clear, not as an omission", () => {
    expect(resolveDesiredEmbeddedFields(current, { variables: [] })).toEqual([currentPlan]);
  });

  test("replaces only the group the payload carried", () => {
    const renamed = { ...desiredScore, name: "total_score" };
    const result = resolveDesiredEmbeddedFields(current, {
      variables: [{ id: renamed.storageKey, name: renamed.name, type: "number", value: 0 }],
    });

    expect(result).toEqual([renamed, currentPlan]);
  });

  test("the ingested group is independent of the computed one", () => {
    const result = resolveDesiredEmbeddedFields(current, {
      hiddenFields: { enabled: true, fieldIds: ["plan", "tier"] },
    });

    expect(result.map(({ storageKey }) => storageKey)).toEqual(["var_score", "plan", "tier"]);
  });

  test("an undefined value is an omission, not a clear", () => {
    // Load-bearing: every write seam spells both keys out and lets Prisma ignore the undefined ones,
    // so an `in` check would read as "the payload carried this" and wipe the rows.
    expect(resolveDesiredEmbeddedFields(current, { variables: undefined, hiddenFields: undefined })).toEqual(
      current
    );
  });

  test("keeps every computed field ahead of every ingested one, which is what order means", () => {
    const result = resolveDesiredEmbeddedFields([currentPlan, currentScore], {
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(result.map(({ source }) => source)).toEqual(["computed", "ingested"]);
  });

  describe("the embeddedFields carrier (ENG-3228)", () => {
    test("is the complete set for both sources, so the legacy keys beside it are ignored", () => {
      const typed = { ...desiredPlan, dataType: "number" as const, defaultValue: 3, locked: true };

      const result = resolveDesiredEmbeddedFields(current, {
        embeddedFields: [{ field: { ...typed, key: null }, link: { storageKey: typed.storageKey } }],
        // Both would each declare a field on the legacy path, and neither may reach the result.
        variables: [{ id: "var_other", name: "other", type: "text", value: "" }],
        hiddenFields: { enabled: true, fieldIds: ["legacy_only"] },
      });

      expect(result).toEqual([typed]);
    });

    test("an empty list clears every field, which the legacy keys can only do one source at a time", () => {
      expect(resolveDesiredEmbeddedFields(current, { embeddedFields: [] })).toEqual([]);
    });

    test("carries the shared link an entry names, so the survey keeps pointing at the library row", () => {
      const result = resolveDesiredEmbeddedFields([], {
        embeddedFields: [
          {
            field: { ...desiredPlan, id: "ed_shared", key: "plan_tier" },
            link: { storageKey: "plan_tier" },
          },
        ],
      });

      expect(result).toEqual([
        { ...desiredPlan, storageKey: "plan_tier", key: "plan_tier", embeddedDataId: "ed_shared" },
      ]);
    });

    test("round-trips the legacy branch for local fields", () => {
      // The property that lets both carriers coexist: sending a survey's legacy declarations as
      // `embeddedFields` has to describe exactly the fields the legacy keys describe, or a V2 save
      // that changed nothing would rewrite rows.
      const legacy = {
        variables: [{ id: "clx0000000000000000000v1", name: "score", type: "number" as const, value: 10 }],
        hiddenFields: { enabled: true, fieldIds: ["plan", "Brand-Name"] },
      };

      expect(resolveDesiredEmbeddedFields([], { embeddedFields: deriveLegacyEmbeddedData(legacy) })).toEqual(
        resolveDesiredEmbeddedFields([], legacy)
      );
    });
  });

  describe("what a legacy payload may not say (ENG-3228)", () => {
    const sharedPlan = sharedDesired(desiredPlan, "ed_shared", "plan");

    test("keeps a shared ingested link a hidden-fields payload resends", () => {
      // The v1 read-modify-write PUT. The columns cannot say "this is a library field", so resending
      // the name must keep the link rather than fork a private copy under the same address.
      expect(
        resolveDesiredEmbeddedFields([sharedPlan], { hiddenFields: { enabled: true, fieldIds: ["plan"] } })
      ).toEqual([sharedPlan]);
    });

    test("keeps a shared computed link a variables payload resends", () => {
      const sharedScore = sharedDesired(desiredScore, "ed_shared_score", "score");

      expect(
        resolveDesiredEmbeddedFields([sharedScore], {
          variables: [{ id: sharedScore.storageKey, name: "score", type: "number", value: 99 }],
        })
      ).toEqual([sharedScore]);
    });

    test("still drops a shared link the payload leaves out", () => {
      expect(
        resolveDesiredEmbeddedFields([sharedPlan], { hiddenFields: { enabled: true, fieldIds: [] } })
      ).toEqual([]);
    });

    test("keeps a lock, which the legacy columns have no carrier for", () => {
      const locked = { ...desiredPlan, locked: true };

      expect(
        resolveDesiredEmbeddedFields([locked], { hiddenFields: { enabled: true, fieldIds: ["plan"] } })
      ).toEqual([locked]);
    });

    test("keeps an ingested field's type and default, for the same reason", () => {
      const typed = { ...desiredPlan, dataType: "number" as const, defaultValue: 7 };

      expect(
        resolveDesiredEmbeddedFields([typed], { hiddenFields: { enabled: true, fieldIds: ["plan"] } })
      ).toEqual([typed]);
    });

    test("a variable still renames and retypes the local field it owns", () => {
      // The other half: what the columns CAN say still governs, or a v1 PUT would stop working.
      const result = resolveDesiredEmbeddedFields([desiredScore], {
        variables: [{ id: desiredScore.storageKey, name: "total", type: "text", value: "none" }],
      });

      expect(result).toEqual([{ ...desiredScore, name: "total", dataType: "string", defaultValue: "none" }]);
    });
  });
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
        locked: false,
      },
    ]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUnlink).toEqual([]);
    expect(plan.toReorder).toEqual([]);
  });

  test("updates a local field that was locked, keeping its row", () => {
    // Locking is a definition change like any other, and it is the one the legacy cards could never
    // make — so it has to be part of the diff or the write would be silently dropped.
    const plan = planEmbeddedDataReconcile(
      SURVEY_ID,
      [localField(desiredPlan, "ed_plan")],
      [{ ...desiredPlan, locked: true }]
    );

    expect(plan.toUpdate).toEqual([
      { fieldId: "ed_plan", name: "plan", dataType: "string", defaultValue: null, locked: true },
    ]);
    expect(plan.toUnlink).toEqual([]);
    expect(plan.toCreate).toEqual([]);
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
    const sharedField = (order = 0): TCurrentEmbeddedField =>
      sharedLink(desiredPlan, "ed_shared", "plan", order);
    const sharedPlan = sharedDesired(desiredPlan, "ed_shared", "plan");

    test("unlinks a shared field without deleting the definition", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], []);
      expect(plan.toUnlink).toEqual([{ linkId: "link_ed_shared", fieldIdToDelete: null }]);
    });

    test("ignores an edit to a shared field, which the workspace owns", () => {
      const edited = { ...sharedPlan, name: "Plan tier", dataType: "number" as const, defaultValue: 1 };
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], [edited]);
      expect(plan).toEqual({ toCreate: [], toUpdate: [], toReorder: [], toUnlink: [] });
    });

    test("ignores a lock on a shared field too — locking is the library's call", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], [{ ...sharedPlan, locked: true }]);
      expect(plan.toUpdate).toEqual([]);
    });

    test("still moves a shared field, because position belongs to the link", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField(3)], [sharedPlan]);
      expect(plan.toReorder).toEqual([{ linkId: "link_ed_shared", order: 0 }]);
      expect(plan.toUpdate).toEqual([]);
    });

    test("a newly linked shared field is a link create, never a definition create", () => {
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [], [sharedPlan]);

      // `embeddedDataId` on the create entry is what tells the executor to link the existing row
      // rather than mint one — without it the survey would get a private copy of a library field.
      expect(plan.toCreate).toEqual([{ ...sharedPlan, order: 0 }]);
      expect(plan.toCreate[0].embeddedDataId).toBe("ed_shared");
      expect(plan.toUpdate).toEqual([]);
    });

    test("re-points a link that now names a different library row", () => {
      const other = sharedDesired(desiredPlan, "ed_other", "plan");
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [sharedField()], [other]);

      expect(plan.toUnlink).toEqual([{ linkId: "link_ed_shared", fieldIdToDelete: null }]);
      expect(plan.toCreate).toEqual([{ ...other, order: 0 }]);
      expect(plan.toUpdate).toEqual([]);
    });
  });

  describe("ownership switches under one storage key", () => {
    test("clone-to-edit unlinks the shared row and creates a local one", () => {
      // Same address, same source, different owner — a link to a workspace-owned row and a row this
      // survey owns are different things, so this has to read as a swap rather than as an edit.
      const plan = planEmbeddedDataReconcile(
        SURVEY_ID,
        [sharedLink(desiredPlan, "ed_shared", "plan")],
        [desiredPlan]
      );

      expect(plan.toUnlink).toEqual([{ linkId: "link_ed_shared", fieldIdToDelete: null }]);
      expect(plan.toCreate).toEqual([{ ...desiredPlan, order: 0 }]);
      expect(plan.toUpdate).toEqual([]);
    });

    test("replacing a local field with the library one deletes the row it owned", () => {
      const sharedPlan = sharedDesired(desiredPlan, "ed_shared", "plan");
      const plan = planEmbeddedDataReconcile(SURVEY_ID, [localField(desiredPlan, "ed_plan")], [sharedPlan]);

      expect(plan.toUnlink).toEqual([{ linkId: "link_ed_plan", fieldIdToDelete: "ed_plan" }]);
      expect(plan.toCreate).toEqual([{ ...sharedPlan, order: 0 }]);
      expect(plan.toUpdate).toEqual([]);
    });
  });

  test("never deletes a local definition owned by another survey", () => {
    // The schema allows a link to a field another survey owns; only this check stops one survey's
    // save from destroying another's definition.
    const foreignField: TCurrentEmbeddedField = {
      ...localField(desiredPlan, "ed_foreign"),
      field: { ...localField(desiredPlan, "ed_foreign").field, surveyId: OTHER_SURVEY_ID },
    };
    const plan = planEmbeddedDataReconcile(SURVEY_ID, [foreignField], []);
    expect(plan.toUnlink).toEqual([{ linkId: "link_ed_foreign", fieldIdToDelete: null }]);
  });
});

/**
 * The two checks that run before anything is written, against a stub transaction.
 *
 * They are the reconcile's only reads, and both exist to turn a payload the database would reject
 * — or worse, accept — into a 400 naming the field. The integration suite proves they hold against
 * real rows; this proves each refusal fires, and that the reads that back them are workspace-scoped.
 */
describe("reconcileEmbeddedData refusals", () => {
  const WORKSPACE_ID = "ws_1";

  /** Just enough of a transaction client for the guards; nothing here should reach a write. */
  const stubTx = (sharedRows: { id: string; key: string | null; source: string }[]) => ({
    surveyEmbeddedData: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    embeddedData: {
      findMany: vi.fn().mockResolvedValue(sharedRows),
      create: vi.fn().mockResolvedValue({ id: "ed_new" }),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  });

  /** The desired shape as the payload spells it: a definition paired with the link addressing it. */
  const asLinked = (desired: TDesiredEmbeddedField) => ({
    field: {
      id: desired.embeddedDataId,
      key: desired.key,
      name: desired.name,
      source: desired.source,
      dataType: desired.dataType,
      defaultValue: desired.defaultValue,
      locked: desired.locked,
    },
    link: { storageKey: desired.storageKey },
  });

  const reconcile = (tx: ReturnType<typeof stubTx>, desired: TDesiredEmbeddedField[]): Promise<void> =>
    reconcileEmbeddedData(tx as unknown as Parameters<typeof reconcileEmbeddedData>[0], {
      surveyId: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      patch: { embeddedFields: desired.map(asLinked) },
    });

  test("refuses a reserved field, which is a code catalog and never a row", async () => {
    const tx = stubTx([]);
    await expect(reconcile(tx, [{ ...desiredPlan, source: "reserved" }])).rejects.toThrow(
      "Reserved fields are a code catalog and cannot be stored: plan"
    );
    expect(tx.embeddedData.create).not.toHaveBeenCalled();
  });

  test("refuses a shared entry that does not name the row it links", async () => {
    // Treating it as local instead would silently fork a private copy of a library field.
    const tx = stubTx([]);
    await expect(reconcile(tx, [{ ...desiredPlan, key: "plan" }])).rejects.toThrow(
      "Shared embedded data field is missing its id: plan"
    );
    expect(tx.embeddedData.create).not.toHaveBeenCalled();
  });

  test("refuses a link to a row this workspace does not have", async () => {
    const tx = stubTx([]);
    await expect(reconcile(tx, [sharedDesired(desiredPlan, "ed_gone", "plan")])).rejects.toThrow(
      "Unknown shared embedded data field: plan"
    );
    // Scoped, so a row in another workspace reads as absent rather than as linkable.
    expect(tx.embeddedData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["ed_gone"] }, workspaceId: WORKSPACE_ID } })
    );
  });

  test("refuses a link to a local row, which belongs to one survey", async () => {
    const tx = stubTx([{ id: "ed_local", key: null, source: "ingested" }]);
    await expect(reconcile(tx, [sharedDesired(desiredPlan, "ed_local", "plan")])).rejects.toThrow(
      "Unknown shared embedded data field: plan"
    );
  });

  test("refuses a link to a library field of the other source", async () => {
    // The value would be resolved out of the wrong half of the response.
    const tx = stubTx([{ id: "ed_shared", key: "plan", source: "computed" }]);
    await expect(reconcile(tx, [sharedDesired(desiredPlan, "ed_shared", "plan")])).rejects.toThrow(
      "Shared embedded data field plan is computed, not ingested"
    );
  });

  test("links a valid shared entry without writing a definition", async () => {
    const tx = stubTx([{ id: "ed_shared", key: "plan", source: "ingested" }]);
    await reconcile(tx, [sharedDesired(desiredPlan, "ed_shared", "plan")]);

    expect(tx.embeddedData.create).not.toHaveBeenCalled();
    expect(tx.surveyEmbeddedData.create).toHaveBeenCalledWith({
      data: {
        surveyId: SURVEY_ID,
        workspaceId: WORKSPACE_ID,
        embeddedDataId: "ed_shared",
        storageKey: "plan",
        order: 0,
      },
    });
  });

  test("writes a local definition's new type, default and lock under the same address", async () => {
    const tx = stubTx([]);
    tx.surveyEmbeddedData.findMany.mockResolvedValue([
      {
        id: "link_ed_plan",
        storageKey: "plan",
        order: 0,
        embeddedData: {
          id: "ed_plan",
          surveyId: SURVEY_ID,
          key: null,
          name: "plan",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
      },
    ]);

    await reconcile(tx, [
      { ...desiredPlan, dataType: "number", defaultValue: 7, locked: true, name: "plan" },
    ]);

    // An edit in place: the address never moves, so every response already stored under it keeps
    // resolving. `locked` rides along, which is the whole point of the typed payload.
    expect(tx.embeddedData.updateMany).toHaveBeenCalledWith({
      where: { id: "ed_plan", surveyId: SURVEY_ID },
      data: { name: "plan", dataType: "number", defaultValue: 7, locked: true },
    });
    expect(tx.surveyEmbeddedData.create).not.toHaveBeenCalled();
    expect(tx.surveyEmbeddedData.deleteMany).not.toHaveBeenCalled();
  });

  test("refuses two fields at one address before it writes either", async () => {
    const tx = stubTx([]);
    await expect(reconcile(tx, [desiredPlan, { ...desiredPlan, name: "plan" }])).rejects.toThrow(
      "Duplicate embedded data field: plan"
    );
    expect(tx.embeddedData.create).not.toHaveBeenCalled();
  });
});

/**
 * The library's definition wins over the payload's claim about it.
 *
 * `buildReconcilePlan` never writes a row this survey does not own, so a wrong `dataType` on a
 * shared entry cannot reach the library. It can reach the **legacy columns**, which
 * `toLegacyEmbeddedFields` derives from these same entries and `updateSurveyInternal` does write —
 * so without this a survey could store `variables` describing a shared field differently from the
 * row beside it, which is the drift the derivation exists to prevent.
 */
describe("assertLinkableEmbeddedFields canonicalizes shared entries", () => {
  const WORKSPACE_ID = "ws_1";
  const row = {
    id: "ed_shared",
    key: "plan_tier",
    source: "ingested" as const,
    name: "Plan tier",
    dataType: "number" as const,
    defaultValue: 7,
    locked: true,
  };

  const stubTx = (rows: (typeof row)[]) =>
    ({ embeddedData: { findMany: vi.fn().mockResolvedValue(rows) } }) as unknown as Parameters<
      typeof assertLinkableEmbeddedFields
    >[0];

  test("replaces the payload's definition with the row's", async () => {
    // Every field of the claim is wrong on purpose, and none of it survives.
    const lying: TDesiredEmbeddedField = {
      ...desiredPlan,
      storageKey: "plan",
      key: "not_the_rows_key",
      name: "Not the row's name",
      dataType: "string",
      defaultValue: "made up",
      locked: false,
      embeddedDataId: "ed_shared",
    };

    const [canonical] = await assertLinkableEmbeddedFields(stubTx([row]), {
      workspaceId: WORKSPACE_ID,
      desired: [lying],
    });

    expect(canonical).toStrictEqual({
      // The address stays the survey's: it is where THIS survey reads the value.
      storageKey: "plan",
      source: "ingested",
      embeddedDataId: "ed_shared",
      key: "plan_tier",
      name: "Plan tier",
      dataType: "number",
      defaultValue: 7,
      locked: true,
    });
  });

  test("leaves a local entry exactly as declared", async () => {
    // A local field has no library row to be canonical; its definition is the payload's to set.
    const local: TDesiredEmbeddedField = { ...desiredPlan, name: "My own field" };

    expect(
      await assertLinkableEmbeddedFields(stubTx([]), { workspaceId: WORKSPACE_ID, desired: [local] })
    ).toStrictEqual([local]);
  });
});
