import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { InvalidInputError } from "@formbricks/types/errors";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey, updateSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { copySurveyToOtherWorkspace } from "@/modules/survey/list/lib/survey";

/**
 * The Embedded Data write bridge against real Postgres (ENG-1978).
 *
 * The reconcile is the only thing keeping the tables in step with what the editor saved, and every
 * rule it enforces is about database state: the unique constraint on `(surveyId, storageKey)`, the
 * cascade when a survey goes, and the ordering needed for a replaced field. The unit suite mocks
 * `@formbricks/database`, so none of that is visible there.
 */

/**
 * Two request-scoped boundaries the copy flow reaches that a node test has no request for: the i18n
 * instance resolves the viewer's locale from the session/headers, and the quota gate calls the
 * enterprise licence service. Neither has anything to do with Embedded Data — they are stubbed so the
 * copy can run, not to change what it does.
 */
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string) => key,
}));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsQuotasEnabled: async () => false,
}));

const seedSurvey = async (): Promise<{ surveyId: string; workspaceId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Reconcile Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Reconcile Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({ data: { name: "Survey", workspaceId: workspace.id } });
  return { surveyId: survey.id, workspaceId: workspace.id };
};

/** What the survey actually has, in the shape the assertions care about. */
const readFields = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: { storageKey: "asc" },
      select: {
        storageKey: true,
        embeddedData: {
          select: { name: true, source: true, dataType: true, defaultValue: true, key: true, surveyId: true },
        },
      },
    })
    .then((links) =>
      links.map((link) => ({
        storageKey: link.storageKey,
        ...link.embeddedData,
      }))
    );

/** Stored positions, read back the way `selectSurveyEmbeddedDataLinks` reads them. */
const readOrder = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: [{ order: "asc" }, { storageKey: "asc" }],
      select: { storageKey: true, order: true },
    })
    .then((links) => links.map((link) => [link.storageKey, link.order]));

const reconcile = (
  surveyId: string,
  workspaceId: string,
  legacy: Parameters<typeof toDesiredEmbeddedFields>[0]
) => prisma.$transaction((tx) => reconcileEmbeddedData(tx, { surveyId, workspaceId, patch: legacy }));

beforeEach(async () => {
  await resetDb();
});

describe("reconcileEmbeddedData (real Postgres)", () => {
  test("creates a row and a link for each variable and hidden field", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(await readFields(surveyId)).toEqual([
      {
        storageKey: "clx000000000000000000001",
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
        // Local: owned by this survey and absent from the shared library.
        key: null,
        surveyId,
      },
      {
        storageKey: "plan",
        name: "plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        key: null,
        surveyId,
      },
    ]);
  });

  test("numbers fields by declaration — every variable, then every hidden field", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    // Added in the editor as h1, h2, then the variable, then h3 — but the cards write to two
    // separate arrays, so what survives is "variables first", not the order they were typed in.
    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["h1", "h2", "h3"] },
    });

    expect(await readOrder(surveyId)).toEqual([
      ["clx000000000000000000001", 0],
      ["h1", 1],
      ["h2", 2],
      ["h3", 3],
    ]);
  });

  test("re-numbers the tail when a field is removed from the middle", async () => {
    // The only thing that moves a position in v1 — the cards can append and delete, not reorder.
    // Without this the tail keeps its stale numbers and the next inserted field collides with one.
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, {
      hiddenFields: { enabled: true, fieldIds: ["h1", "h2", "h3"] },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["h1", "h3"] } });

    expect(await readOrder(surveyId)).toEqual([
      ["h1", 0],
      ["h3", 1],
    ]);
  });

  test("repairs positions left behind by something that did not set them", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const legacy = { hiddenFields: { enabled: true, fieldIds: ["h1", "h2", "h3"] } };
    await reconcile(surveyId, workspaceId, legacy);
    await prisma.surveyEmbeddedData.updateMany({ where: { surveyId }, data: { order: 0 } });

    await reconcile(surveyId, workspaceId, legacy);

    expect(await readOrder(surveyId)).toEqual([
      ["h1", 0],
      ["h2", 1],
      ["h3", 2],
    ]);
  });

  test("is idempotent — running it again changes nothing", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const legacy = { hiddenFields: { enabled: true, fieldIds: ["plan", "campaign"] } };

    await reconcile(surveyId, workspaceId, legacy);
    const first = await readFields(surveyId);
    await reconcile(surveyId, workspaceId, legacy);

    expect(await readFields(surveyId)).toEqual(first);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(2);
  });

  test("removes the row and the link for a deleted field", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, {
      hiddenFields: { enabled: true, fieldIds: ["plan", "campaign"] },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    expect((await readFields(surveyId)).map((field) => field.storageKey)).toEqual(["plan"]);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(1);
  });

  test("updates a field whose default value changed, keeping the same row", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const variable = { id: "clx000000000000000000001", name: "score", type: "number" as const };
    await reconcile(surveyId, workspaceId, { variables: [{ ...variable, value: 0 }] });
    const before = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });

    await reconcile(surveyId, workspaceId, { variables: [{ ...variable, value: 99 }] });

    const after = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });
    expect(after.id).toBe(before.id);
    expect(after.defaultValue).toBe(99);
  });

  test("replaces a field whose source changed, which reuses the same storage key", async () => {
    // Unlink has to happen before create or `@@unique([surveyId, storageKey])` rejects the new row.
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    // Both groups, because that is what a save sends — every caller merges over the loaded survey
    // before calling in. Passing `variables` alone is a test-only shape now that an omitted group
    // means "leave it alone": it would carry the ingested `plan` over and collide with the computed
    // one, which `assertNoDuplicateStorageKeys` has always rejected.
    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "plan", name: "plan", type: "text", value: "pro" }],
      hiddenFields: { enabled: true, fieldIds: [] },
    });

    expect(await readFields(surveyId)).toMatchObject([{ storageKey: "plan", source: "computed" }]);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(1);
  });

  test("keeps a legacy hidden field name exactly as stored", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["Brand-Name"] } });

    expect((await readFields(surveyId)).map((field) => field.storageKey)).toEqual(["Brand-Name"]);
  });

  test("rejects a duplicate field name within one survey", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await expect(
      reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan", "plan"] } })
    ).rejects.toThrow(/plan/);

    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(0);
  });

  test("lets two surveys in one workspace both hold a field named plan", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const other = await prisma.survey.create({ data: { name: "Other", workspaceId } });
    const legacy = { hiddenFields: { enabled: true, fieldIds: ["plan"] } };

    await reconcile(surveyId, workspaceId, legacy);
    await reconcile(other.id, workspaceId, legacy);

    // Both rows carry `key: null`, and Postgres treats NULLs as distinct, so the workspace-level
    // unique on `key` does not fire.
    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(2);
  });

  test("unlinks a shared library field without deleting or editing it", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const shared = await prisma.embeddedData.create({
      data: { workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested" },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId, surveyId, embeddedDataId: shared.id, storageKey: "plan_tier", order: 0 },
    });

    // The legacy cards know nothing about the shared library, so a save that omits the field must
    // drop this survey's use of it and leave the workspace-owned definition alone.
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: [] } });

    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(0);
    expect(await prisma.embeddedData.findUnique({ where: { id: shared.id } })).toMatchObject({
      name: "Plan tier",
      key: "plan_tier",
    });
  });

  test("keeps a definition another survey still links to, rather than cascading that link away", async () => {
    // Unreachable today — the reconcile only ever links to rows it just created — but the schema
    // permits the link, and deleting the row would take the other survey's link with it. Leaving an
    // orphaned row behind is the better of the two failures.
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });
    const field = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });

    const borrower = await prisma.survey.create({ data: { name: "Borrower", workspaceId } });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId, surveyId: borrower.id, embeddedDataId: field.id, storageKey: "plan", order: 0 },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: [] } });

    expect(await prisma.embeddedData.findUnique({ where: { id: field.id } })).not.toBeNull();
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId: borrower.id } })).toBe(1);
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(0);
  });

  test("cascades a survey's fields away when the survey is deleted", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    await prisma.survey.delete({ where: { id: surveyId } });

    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(0);
    expect(await prisma.surveyEmbeddedData.count()).toBe(0);
  });

  test("never touches Response", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await prisma.response.create({
      data: { surveyId, finished: true, data: { plan: "pro" }, variables: {}, meta: {}, ttc: {} },
    });

    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });
    await reconcile(surveyId, workspaceId, { hiddenFields: { enabled: true, fieldIds: [] } });

    const response = await prisma.response.findFirstOrThrow({ where: { surveyId } });
    // Removing the definition leaves the stored value alone: the response is keyed by the same
    // storage key, which is exactly why no response migration is needed.
    expect(response.data).toEqual({ plan: "pro" });
  });

  /**
   * ENG-1839. The reserved-name guard is deliberately NOT in this file's production counterpart:
   * `reconcileEmbeddedData` must keep accepting a reserved name, because a survey COPY feeds the
   * whole source survey's fields in as "new" against zero existing rows. A guard here would make
   * duplicating a grandfathered survey fail — which is why these live at the three input boundaries
   * (`updateSurveyInternal`, `createSurvey`, the v3 patch) instead.
   */
  describe("grandfathered reserved names (ENG-1839)", () => {
    test("reconciles a survey that declares `country`, creating the row and the link", async () => {
      const { surveyId, workspaceId } = await seedSurvey();

      await reconcile(surveyId, workspaceId, {
        hiddenFields: { enabled: true, fieldIds: ["country", "url"] },
      });

      expect(await readFields(surveyId)).toEqual([
        expect.objectContaining({ storageKey: "country", name: "country", source: "ingested" }),
        expect.objectContaining({ storageKey: "url", name: "url", source: "ingested" }),
      ]);
    });

    test("DUPLICATING a survey that declares `country` still succeeds", async () => {
      // The shape of `copySurveyToOtherWorkspace`: the copy is its own `survey.create`, and the
      // source survey's declared fields are then reconciled onto it with no rows of its own — every
      // name arrives as "new", reserved ones included.
      const { surveyId, workspaceId } = await seedSurvey();
      const declared = { enabled: true, fieldIds: ["country", "team_size"] };
      await reconcile(surveyId, workspaceId, { hiddenFields: declared });

      const copy = await prisma.survey.create({
        data: { name: "Survey (copy)", workspaceId, hiddenFields: declared },
      });

      await expect(reconcile(copy.id, workspaceId, { hiddenFields: declared })).resolves.not.toThrow();

      // The duplicate has its own rows, and the original is untouched.
      expect(await readFields(copy.id)).toEqual([
        expect.objectContaining({ storageKey: "country", name: "country" }),
        expect.objectContaining({ storageKey: "team_size", name: "team_size" }),
      ]);
      expect(await readFields(surveyId)).toHaveLength(2);
    });

    test("a copy into ANOTHER workspace defines `country` there too", async () => {
      const { surveyId, workspaceId } = await seedSurvey();
      const declared = { enabled: true, fieldIds: ["country"] };
      await reconcile(surveyId, workspaceId, { hiddenFields: declared });

      const { workspaceId: otherWorkspaceId } = await seedSurvey();
      const copy = await prisma.survey.create({
        data: { name: "Survey (copy)", workspaceId: otherWorkspaceId, hiddenFields: declared },
      });

      await reconcile(copy.id, otherWorkspaceId, { hiddenFields: declared });

      expect(await readFields(copy.id)).toEqual([
        expect.objectContaining({ storageKey: "country", name: "country" }),
      ]);
      expect(await prisma.embeddedData.count({ where: { workspaceId: otherWorkspaceId } })).toBe(1);
    });
  });
});

/**
 * ENG-3228: the V2 carrier, against real Postgres.
 *
 * What only a database can show here is the shared library: a link that points at a
 * workspace-owned row rather than one this survey owns, the composite foreign key behind it, and the
 * refusals for a link the workspace cannot honour. The unit plan tests reason about ownership, but
 * nothing there can tell a real row from a fabricated id.
 */
describe("reconcileEmbeddedData with embeddedFields (real Postgres)", () => {
  const localEntry = (
    storageKey: string,
    overrides: Partial<TLinkedEmbeddedField["field"]> = {}
  ): TLinkedEmbeddedField => ({
    field: {
      key: null,
      name: storageKey,
      source: "ingested",
      dataType: "string",
      defaultValue: null,
      locked: false,
      ...overrides,
    },
    link: { storageKey },
  });

  /** A workspace library field, plus the entry a survey sends to link it. */
  const seedSharedField = async (
    workspaceId: string,
    overrides: { key?: string; name?: string; source?: "computed" | "ingested" } = {}
  ) => {
    const key = overrides.key ?? "plan_tier";
    const row = await prisma.embeddedData.create({
      data: {
        workspaceId,
        key,
        name: overrides.name ?? "Plan tier",
        source: overrides.source ?? "ingested",
      },
    });

    return {
      row,
      entry: {
        field: {
          id: row.id,
          key: row.key,
          name: row.name,
          source: row.source,
          dataType: row.dataType,
          defaultValue: row.defaultValue,
          locked: row.locked,
        },
        // Shared ingested fields are addressed by the library key in every survey that links them.
        link: { storageKey: key },
      } satisfies TLinkedEmbeddedField,
    };
  };

  const reconcileFields = (surveyId: string, workspaceId: string, embeddedFields: TLinkedEmbeddedField[]) =>
    prisma.$transaction((tx) =>
      reconcileEmbeddedData(tx, { surveyId, workspaceId, patch: { embeddedFields } })
    );

  test("writes the type, default and lock the legacy columns have no carrier for", async () => {
    const { surveyId, workspaceId } = await seedSurvey();

    await reconcileFields(surveyId, workspaceId, [
      localEntry("seats", { dataType: "number", defaultValue: 5, locked: true }),
    ]);

    expect(await readFields(surveyId)).toEqual([
      {
        storageKey: "seats",
        name: "seats",
        source: "ingested",
        dataType: "number",
        defaultValue: 5,
        key: null,
        surveyId,
      },
    ]);
    expect(await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } })).toMatchObject({
      locked: true,
    });
  });

  test("links a library row instead of creating a private copy of it", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const { row, entry } = await seedSharedField(workspaceId);

    await reconcileFields(surveyId, workspaceId, [entry]);

    // One row in the workspace — the library's — and a link from this survey to it.
    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(1);
    expect(await prisma.surveyEmbeddedData.findFirstOrThrow({ where: { surveyId } })).toMatchObject({
      embeddedDataId: row.id,
      storageKey: "plan_tier",
    });
  });

  test("never writes a shared definition, whatever the payload claims about it", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const { row, entry } = await seedSharedField(workspaceId);

    await reconcileFields(surveyId, workspaceId, [
      { ...entry, field: { ...entry.field, name: "Hijacked", dataType: "number", locked: true } },
    ]);

    expect(await prisma.embeddedData.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
      name: "Plan tier",
      dataType: "string",
      locked: false,
    });
  });

  test("clone-to-edit swaps the link for a row the survey owns, under the same storage key", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    const { row, entry } = await seedSharedField(workspaceId);
    await reconcileFields(surveyId, workspaceId, [entry]);

    await reconcileFields(surveyId, workspaceId, [localEntry("plan_tier", { name: "plan_tier" })]);

    // The library row survives untouched; the survey now owns a definition at the same address, so
    // responses keyed by `plan_tier` keep resolving.
    expect(await prisma.embeddedData.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(await readFields(surveyId)).toEqual([
      expect.objectContaining({ storageKey: "plan_tier", key: null, surveyId }),
    ]);
  });

  test("replacing a local field with the library one deletes the row this survey owned", async () => {
    const { surveyId, workspaceId } = await seedSurvey();
    await reconcileFields(surveyId, workspaceId, [localEntry("plan_tier")]);
    const owned = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });
    const { row, entry } = await seedSharedField(workspaceId);

    await reconcileFields(surveyId, workspaceId, [entry]);

    expect(await prisma.embeddedData.findUnique({ where: { id: owned.id } })).toBeNull();
    expect(await prisma.surveyEmbeddedData.findFirstOrThrow({ where: { surveyId } })).toMatchObject({
      embeddedDataId: row.id,
    });
  });

  describe("a link the workspace cannot honour is refused before anything is written", () => {
    test("a stale id — the library row was deleted", async () => {
      const { surveyId, workspaceId } = await seedSurvey();
      const { row, entry } = await seedSharedField(workspaceId);
      await prisma.embeddedData.delete({ where: { id: row.id } });

      await expect(reconcileFields(surveyId, workspaceId, [entry])).rejects.toThrow(/plan_tier/);
      expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(0);
    });

    test("an id that names a local row, which belongs to one survey and is not the library's", async () => {
      const { surveyId, workspaceId } = await seedSurvey();
      await reconcileFields(surveyId, workspaceId, [localEntry("plan")]);
      const local = await prisma.embeddedData.findFirstOrThrow({ where: { surveyId } });
      const other = await prisma.survey.create({ data: { name: "Other", workspaceId } });

      await expect(
        reconcileFields(other.id, workspaceId, [
          { field: { ...localEntry("plan").field, id: local.id, key: "plan" }, link: { storageKey: "plan" } },
        ])
      ).rejects.toThrow(/plan/);
    });

    test("a library row of the other source", async () => {
      const { surveyId, workspaceId } = await seedSurvey();
      const { entry } = await seedSharedField(workspaceId, { key: "score", source: "computed" });

      await expect(
        reconcileFields(surveyId, workspaceId, [{ ...entry, field: { ...entry.field, source: "ingested" } }])
      ).rejects.toThrow(/score/);
    });

    test("a library row from another workspace", async () => {
      const { surveyId, workspaceId } = await seedSurvey();
      const { workspaceId: otherWorkspaceId } = await seedSurvey();
      const { entry } = await seedSharedField(otherWorkspaceId);

      await expect(reconcileFields(surveyId, workspaceId, [entry])).rejects.toThrow(/plan_tier/);
      expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(0);
    });

    test("a shared entry that names no row at all", async () => {
      const { surveyId, workspaceId } = await seedSurvey();

      await expect(
        reconcileFields(surveyId, workspaceId, [localEntry("plan_tier", { key: "plan_tier" })])
      ).rejects.toThrow(/plan_tier/);
    });
  });
});

/** A minimal but valid survey body — `updateSurvey` runs the payload through `ZSurvey`. */
const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

/**
 * ENG-3228: the survey write path, end to end.
 *
 * `updateSurvey` is where the two descriptions of a survey are written together, and the rule this
 * covers is the one a unit test cannot: a payload that declares its fields as rows owns BOTH the rows
 * and the legacy columns, and a payload that does not is left exactly as it was.
 */
describe("updateSurvey accepts embeddedFields (real Postgres)", () => {
  const VARIABLE_ID = "clvar123456789012345678902";

  const seedEditableSurvey = async (legacy?: {
    variables?: unknown[];
    hiddenFields?: { enabled: boolean; fieldIds?: string[] };
  }) => {
    const organization = await prisma.organization.create({ data: { name: "Write Path Org" } });
    const workspace = await prisma.workspace.create({
      data: { name: "Write Path Workspace", organizationId: organization.id },
    });
    const created = await prisma.survey.create({
      data: {
        name: "Write Path Survey",
        type: "link",
        status: "draft",
        workspaceId: workspace.id,
        blocks: BLOCKS as never,
        variables: (legacy?.variables ?? []) as never,
        hiddenFields: (legacy?.hiddenFields ?? { enabled: false }) as never,
      },
      select: selectSurvey,
    });
    await prisma.$transaction((tx) =>
      reconcileEmbeddedData(tx, { surveyId: created.id, workspaceId: workspace.id, patch: created })
    );

    return { workspaceId: workspace.id, survey: await loadSurvey(created.id) };
  };

  const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
    prisma.survey
      .findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
      .then((survey) => transformPrismaSurvey<TSurvey>(survey));

  const readColumns = async (surveyId: string) =>
    prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: { variables: true, hiddenFields: true },
    });

  test("writes the rows and derives both legacy columns from them", async () => {
    const { survey } = await seedEditableSurvey();

    const saved = await updateSurvey({
      ...survey,
      embeddedFields: [
        {
          field: {
            key: null,
            name: "score",
            source: "computed",
            dataType: "number",
            defaultValue: 7,
            locked: false,
          },
          link: { storageKey: VARIABLE_ID },
        },
        {
          field: {
            key: null,
            name: "seats",
            source: "ingested",
            dataType: "number",
            defaultValue: 2,
            locked: true,
          },
          link: { storageKey: "seats" },
        },
      ],
      // Deliberately contradicting the rows: the reconcile ignores them and the columns are derived,
      // so nothing a V2 payload happens to carry here can reach the database.
      variables: [{ id: "clvar123456789012345678909", name: "stale", type: "text", value: "" }],
      hiddenFields: { enabled: false, fieldIds: ["stale_hidden_field"] },
    });

    expect(await readFields(survey.id)).toEqual([
      expect.objectContaining({ storageKey: VARIABLE_ID, name: "score", dataType: "number" }),
      expect.objectContaining({ storageKey: "seats", name: "seats", dataType: "number" }),
    ]);
    expect(await prisma.embeddedData.findFirstOrThrow({ where: { name: "seats" } })).toMatchObject({
      locked: true,
      defaultValue: 2,
    });
    expect(await readColumns(survey.id)).toEqual({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      // `enabled` turns on because the survey now has an ingested field.
      hiddenFields: { enabled: true, fieldIds: ["seats"] },
    });
    // The return is read back AFTER the reconcile, so the editor's next save can address these rows.
    expect(saved.embeddedFields?.map(({ field }) => [field.name, field.locked, typeof field.id])).toEqual([
      ["score", false, "string"],
      ["seats", true, "string"],
    ]);
  });

  test("a legacy-only payload writes exactly what it always did", async () => {
    const { survey } = await seedEditableSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    const { embeddedFields: _embeddedFields, ...legacyPut } = survey;
    await updateSurvey({ ...legacyPut, hiddenFields: { enabled: true, fieldIds: ["plan", "tier"] } });

    expect(await readColumns(survey.id)).toEqual({
      variables: [],
      hiddenFields: { enabled: true, fieldIds: ["plan", "tier"] },
    });
    expect((await readFields(survey.id)).map((field) => field.storageKey)).toEqual(["plan", "tier"]);
  });

  test("a variables-only PUT keeps a shared computed link the editor made", async () => {
    // The read-modify-write an integration does: it resends the derived column and knows nothing
    // about the library. Localizing the field here would fork a private copy of a shared definition.
    const { workspaceId, survey } = await seedEditableSurvey();
    const shared = await prisma.embeddedData.create({
      data: { workspaceId, key: "score", name: "Score", source: "computed", dataType: "number" },
    });
    await updateSurvey({
      ...survey,
      embeddedFields: [
        {
          field: {
            id: shared.id,
            key: "score",
            name: "Score",
            source: "computed",
            dataType: "number",
            defaultValue: null,
            locked: false,
          },
          link: { storageKey: VARIABLE_ID },
        },
      ],
    });

    const linked = await loadSurvey(survey.id);
    const { embeddedFields: _embeddedFields, ...legacyPut } = linked;
    await updateSurvey({ ...legacyPut, name: "Renamed via PUT" });

    expect(
      await prisma.surveyEmbeddedData.findFirstOrThrow({ where: { surveyId: survey.id } })
    ).toMatchObject({ embeddedDataId: shared.id, storageKey: VARIABLE_ID });
    expect(await prisma.embeddedData.count({ where: { surveyId: survey.id } })).toBe(0);
    // The derived column names the field by its library key, which is the only spelling of a shared
    // field that `ZSurveyVariable` accepts.
    expect((await readColumns(survey.id)).variables).toEqual([
      { id: VARIABLE_ID, name: "score", type: "number", value: 0 },
    ]);
  });

  test("a computed storage key the variables column could not hold is a 400", async () => {
    // The columns are still written and still parsed by `ZSurvey` on every load, so a storage key
    // the client minted badly would persist a survey that then fails to load. Refused where the
    // columns are derived, not in the reconcile — the survey copy legitimately feeds that storage
    // keys the backfill moved across from columns no schema ever vetted.
    //
    // Two guards now derive those columns and refuse them: `surveyRefinement` (ENG-2628) reaches
    // this payload first through `validateInputs([updatedSurvey, ZSurvey])`, and
    // `assertDerivedLegacyColumnsAreStorable` still covers the internal callers that skip it. Both
    // answer 400, which is what this test is named for, so it asserts the status and the absent
    // write rather than which of the two got there.
    const { survey } = await seedEditableSurvey();

    await expect(
      updateSurvey({
        ...survey,
        embeddedFields: [
          {
            field: {
              key: null,
              name: "score",
              source: "computed",
              dataType: "number",
              defaultValue: 0,
              locked: false,
            },
            // Charset-legal, so `ZSurvey` lets it through; not a cuid, so `ZSurveyVariable.id` would
            // refuse the column derived from it.
            link: { storageKey: "Not_A_Cuid" },
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId: survey.id } })).toBe(0);
  });

  test("a stale shared link is a 400 rather than a half-written survey", async () => {
    const { survey } = await seedEditableSurvey();

    await expect(
      updateSurvey({
        ...survey,
        name: "Renamed",
        embeddedFields: [
          {
            field: {
              id: "clx000000000000000000009",
              key: "plan_tier",
              name: "Plan tier",
              source: "ingested",
              dataType: "string",
              defaultValue: null,
              locked: false,
            },
            link: { storageKey: "plan_tier" },
          },
        ],
      })
    ).rejects.toBeInstanceOf(InvalidInputError);

    // The whole transaction rolled back: not the fields, and not the rename beside them.
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId: survey.id } })).toBe(0);
    expect((await loadSurvey(survey.id)).name).toBe("Write Path Survey");
  });
});

/**
 * ENG-3228: what a duplicate does with the source survey's Embedded Data.
 *
 * `copySurveyToOtherWorkspace` used to read the source's legacy columns, which cannot say that a
 * field is a link to the workspace library — so every copy silently localized every shared field.
 * It now reads the rows and decides per field, and the three outcomes are only distinguishable
 * against a real database with two workspaces and two libraries in it.
 */
describe("copySurveyToOtherWorkspace carries Embedded Data ownership (real Postgres)", () => {
  const seedWorkspace = async (name: string) => {
    const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
    const workspace = await prisma.workspace.create({
      data: { name, organizationId: organization.id },
    });
    return workspace.id;
  };

  const seedCopyFixture = async () => {
    const workspaceId = await seedWorkspace("Copy Source");
    const user = await prisma.user.create({
      data: { email: `copy-${workspaceId}@example.com`, name: "Copier", emailVerified: true },
    });
    const survey = await prisma.survey.create({
      data: { name: "Copy Source Survey", type: "link", workspaceId, blocks: BLOCKS as never },
    });
    return { workspaceId, surveyId: survey.id, userId: user.id };
  };

  /** The copy's fields, as the ownership question asks them: local, or a link to which row. */
  const readCopiedOwnership = async (surveyId: string) =>
    prisma.surveyEmbeddedData
      .findMany({
        where: { surveyId },
        orderBy: [{ order: "asc" }, { storageKey: "asc" }],
        select: {
          storageKey: true,
          embeddedData: { select: { id: true, key: true, name: true, surveyId: true } },
        },
      })
      .then((links) =>
        links.map(({ storageKey, embeddedData }) => ({
          storageKey,
          key: embeddedData.key,
          name: embeddedData.name,
          isLocalToTheCopy: embeddedData.surveyId === surveyId,
          fieldId: embeddedData.id,
        }))
      );

  test("re-links the same library row when the copy stays in the workspace", async () => {
    const { workspaceId, surveyId, userId } = await seedCopyFixture();
    const shared = await prisma.embeddedData.create({
      data: { workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested" },
    });
    await prisma.$transaction((tx) =>
      reconcileEmbeddedData(tx, {
        surveyId,
        workspaceId,
        patch: {
          embeddedFields: [
            {
              field: {
                id: shared.id,
                key: "plan_tier",
                name: "Plan tier",
                source: "ingested",
                dataType: "string",
                defaultValue: null,
                locked: false,
              },
              link: { storageKey: "plan_tier" },
            },
          ],
        },
      })
    );

    const copy = await copySurveyToOtherWorkspace(workspaceId, surveyId, workspaceId, userId);

    expect(await readCopiedOwnership(copy.id)).toEqual([
      {
        storageKey: "plan_tier",
        key: "plan_tier",
        name: "Plan tier",
        isLocalToTheCopy: false,
        fieldId: shared.id,
      },
    ]);
    // Still one definition in the workspace: the two surveys share it, they do not each own one.
    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(1);
  });

  test("links the target workspace's field of the same key, and localizes when it has none", async () => {
    const { workspaceId, surveyId, userId } = await seedCopyFixture();
    const targetWorkspaceId = await seedWorkspace("Copy Target");
    const sourceLibrary = await Promise.all(
      (["plan_tier", "cohort"] as const).map((key) =>
        prisma.embeddedData.create({
          data: { workspaceId, key, name: `Source ${key}`, source: "ingested" },
        })
      )
    );
    // The target library holds one of the two, under the same key, source and type.
    const targetMatch = await prisma.embeddedData.create({
      data: {
        workspaceId: targetWorkspaceId,
        key: "plan_tier",
        name: "Target plan tier",
        source: "ingested",
      },
    });
    await prisma.$transaction((tx) =>
      reconcileEmbeddedData(tx, {
        surveyId,
        workspaceId,
        patch: {
          embeddedFields: sourceLibrary.map((row) => ({
            field: {
              id: row.id,
              key: row.key,
              name: row.name,
              source: row.source,
              dataType: row.dataType,
              defaultValue: row.defaultValue,
              locked: row.locked,
            },
            link: { storageKey: row.key as string },
          })),
        },
      })
    );

    const copy = await copySurveyToOtherWorkspace(workspaceId, surveyId, targetWorkspaceId, userId);

    expect(await readCopiedOwnership(copy.id)).toEqual([
      {
        storageKey: "plan_tier",
        key: "plan_tier",
        name: "Target plan tier",
        isLocalToTheCopy: false,
        fieldId: targetMatch.id,
      },
      // No `cohort` in the target library, so the copy keeps the field as its own rather than losing
      // it — named by the library key, which is what the derived columns and recall address it by.
      {
        storageKey: "cohort",
        key: null,
        name: "cohort",
        isLocalToTheCopy: true,
        fieldId: expect.any(String),
      },
    ]);
    expect(await prisma.embeddedData.count({ where: { workspaceId } })).toBe(2);
  });

  test("a survey with only local fields copies exactly as it always did", async () => {
    const { workspaceId, surveyId, userId } = await seedCopyFixture();
    await reconcile(surveyId, workspaceId, {
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });
    const targetWorkspaceId = await seedWorkspace("Copy Plain Target");

    const copy = await copySurveyToOtherWorkspace(workspaceId, surveyId, targetWorkspaceId, userId);

    expect(await readCopiedOwnership(copy.id)).toEqual([
      expect.objectContaining({ storageKey: "clx000000000000000000001", key: null, isLocalToTheCopy: true }),
      expect.objectContaining({ storageKey: "plan", key: null, isLocalToTheCopy: true }),
    ]);
    expect(
      await prisma.survey.findUniqueOrThrow({
        where: { id: copy.id },
        select: { variables: true, hiddenFields: true },
      })
    ).toEqual({
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });
  });
});
