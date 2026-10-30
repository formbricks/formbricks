import { createId } from "@paralleldrive/cuid2";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { exportSurveyOperation } from "@/app/api/internal/surveys/[surveyId]/export/lib/operations";
import { streamSurveyImport } from "@/app/api/internal/surveys/import/lib/operations";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import type { TSurveyImportMatch } from "@/modules/survey/import/types";
import { updateSurveyContent } from "./operations";

/**
 * Updating a matched survey from a Formbricks file (ENG-6851), seam 1, against real PostgreSQL, SpiceDB
 * and Redis: a survey is exported, its file edited and previewed back into the same workspace as a
 * Match, and committed through the Update. The stale file, "Update anyway", the active lock and a
 * survey going live while the Update waits are each checked against what is in the database after.
 *
 * The plan's entitlements are the one boundary faked: external URLs are a licence question this
 * harness has no licence for.
 */

const entitlements = vi.hoisted(() => ({ contacts: true, externalUrls: true }));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => entitlements.contacts,
}));
vi.mock("@/modules/survey/lib/permission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/lib/permission")>()),
  getExternalUrlsPermission: async () => entitlements.externalUrls,
}));

// i18next-icu's ESM build cannot construct IntlMessageFormat under Node's own module loader, so outside
// Next's bundler `t` returns messages uninterpolated. Names are checked with the en-US strings,
// interpolated as ICU would.
vi.mock("@/lingodotdev/server", async () => {
  const { default: enUS } = await import("@/locales/en-US.json");
  const lookup = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enUS);
  return {
    getTranslate:
      async () =>
      (key: string, options: Record<string, unknown> = {}) =>
        String(lookup(key) ?? key).replaceAll(/\{(\w+)\}/g, (match, name: string) =>
          name in options ? String(options[name]) : match
        ),
  };
});

let fixture: TDashboardsFixture;
let checkoutId: string;
let pricingId: string;

const owner = () => sessionOf(fixture.users.owner);

const choice = (id: string, label: string) => ({ id, label: { default: label } });

const BLOCKS = [
  {
    id: createId(),
    name: "Block 1",
    elements: [
      {
        id: "color",
        type: "multipleChoiceSingle",
        headline: { default: "Which color?" },
        required: true,
        shuffleOption: "none",
        choices: [choice("red", "Red"), choice("blue", "Blue"), choice("green", "Green")],
      },
      {
        id: "feedback",
        type: "openText",
        headline: { default: "Anything else?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

type TFile = Record<string, unknown> & { survey: Record<string, unknown> };

/** A survey in the fixture's workspace, with what an Update must keep: its name, status and styling. */
const seedSurvey = async ({
  status,
  type = "link",
  triggerIds = [],
  visibility = "workspace",
}: {
  status: "draft" | "inProgress" | "paused" | "completed";
  type?: "link" | "app";
  triggerIds?: string[];
  visibility?: "workspace" | "restricted";
}) => {
  const survey = await prisma.survey.create({
    data: {
      name: "Onboarding",
      type,
      status,
      visibility,
      workspaceId: fixture.workspaceId,
      ownerId: fixture.users.owner,
      blocks: BLOCKS,
      endings: [{ id: createId(), type: "endScreen", headline: { default: "Thanks!" } }],
      styling: { allowStyleOverwrite: true, brandColor: { light: "#ff0000" } },
      metadata: { title: { default: "Share title" } },
      ...(triggerIds.length > 0
        ? { triggers: { create: triggerIds.map((actionClassId) => ({ actionClassId })) } }
        : {}),
    },
    select: { id: true },
  });
  await synchronizeAuthzedIntegrationFixture();
  return survey.id;
};

/** The survey's Formbricks file, as the card menu downloads it. */
const exportFile = async (surveyId: string): Promise<TFile> => {
  const response = await exportSurveyOperation({
    surveyId,
    format: "json",
    authentication: owner(),
    requestId: "req_export",
    instance: `/api/internal/surveys/${surveyId}/export`,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as TFile;
};

/** The file with its survey edited, the way a user or an AI assistant edits it. */
const editFile = (file: TFile, edit: (survey: Record<string, unknown>) => void): TFile => {
  const copy = structuredClone(file);
  edit(copy.survey);
  return copy;
};

type TPreviewDone = {
  payload: Record<string, unknown>;
  references: Record<string, unknown>;
  report: { issues: { code: string; questionTag?: string; params?: Record<string, unknown> }[] };
  match?: TSurveyImportMatch;
};

/** Preview a file's bytes into the fixture's workspace, as the dialog uploads them. */
const preview = async (file: unknown, authentication: TV3Authentication = owner()): Promise<TPreviewDone> => {
  const response = await streamSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
    authentication,
    workspaceId: fixture.workspaceId,
    file: new File([JSON.stringify(file)], "Onboarding.formbricks.json"),
    requestId: "req_preview",
    instance: "/api/internal/surveys/import/stream",
  });
  expect(response.status).toBe(200);
  const done = (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .find((event) => event.type === "done");
  if (!done) throw new Error("The preview did not finish");
  return done as TPreviewDone;
};

const auditLogStub = (): TV3AuditLog =>
  ({
    action: "updated",
    targetType: "survey",
    userId: fixture.users.owner,
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    userType: "user",
  }) as TV3AuditLog;

/** Commit a previewed Match as an Update, as the dialog does. */
const update = (
  surveyId: string,
  done: TPreviewDone,
  { updatedAt, triggers = "file" }: { updatedAt: string; triggers?: "file" | "keep" },
  auditLog?: TV3AuditLog
) => {
  const { workspaceId: _workspaceId, ...survey } = done.payload;
  return updateSurveyContent({
    surveyId,
    body: { survey, references: done.references, updatedAt, triggers },
    authentication: owner(),
    requestId: "req_update",
    instance: `/api/internal/surveys/${surveyId}/content`,
    auditLog,
  });
};

const storedSurvey = (surveyId: string) =>
  prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: {
      name: true,
      status: true,
      styling: true,
      metadata: true,
      blocks: true,
      endings: true,
      updatedAt: true,
      triggers: { select: { actionClassId: true } },
    },
  });

/** Change the survey the way the editor does, moving its `updatedAt` on. */
const editSurvey = (surveyId: string, data: { name?: string; status?: "inProgress" }) =>
  prisma.survey.update({ where: { id: surveyId }, data, select: { updatedAt: true } });

const headlineOf = (survey: { blocks: unknown }) =>
  ((survey.blocks as typeof BLOCKS)[0].elements[0].headline as Record<string, string>).default;

/** The exported file with its first question reworded. */
const reworded = (file: TFile, headline = "Which colour do you like?") =>
  editFile(file, (survey) => {
    const blocks = survey.blocks as { elements: { headline: Record<string, string> }[] }[];
    blocks[0].elements[0].headline = { "en-US": headline };
  });

/** The exported file with its trigger pointed at another action the file carries. */
const withTrigger = (file: TFile, actionClassId: string, key: string): TFile => ({
  ...file,
  references: {
    ...(file.references as Record<string, unknown>),
    actionClasses: [
      { id: actionClassId, name: key, description: null, type: "code", key, noCodeConfig: null },
    ],
  },
  survey: {
    ...file.survey,
    distribution: {
      ...(file.survey.distribution as Record<string, unknown>),
      triggers: [{ actionClassId }],
    },
  },
});

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  const workspaceId = fixture.workspaceId;
  await prisma.language.create({ data: { code: "en-US", workspaceId } });
  const [checkout, pricing] = await Promise.all([
    prisma.actionClass.create({ data: { name: "Checkout", type: "code", key: "checkout", workspaceId } }),
    prisma.actionClass.create({ data: { name: "Pricing", type: "code", key: "pricing", workspaceId } }),
  ]);
  checkoutId = checkout.id;
  pricingId = pricing.id;
}, 120_000);

beforeEach(() => {
  entitlements.contacts = true;
  entitlements.externalUrls = true;
});

describe("a Formbricks file of a survey in this workspace", () => {
  test("is a Match, and Update replaces the content while keeping the id, name, status, settings and styling", async () => {
    const surveyId = await seedSurvey({ status: "paused" });
    const file = await exportFile(surveyId);
    const before = await storedSurvey(surveyId);

    const done = await preview(reworded(file));

    expect(done.match).toEqual({
      surveyId,
      name: "Onboarding",
      status: "paused",
      updatedAt: before.updatedAt.toISOString(),
      exportedUpdatedAt: before.updatedAt.toISOString(),
      triggers: "same",
      issues: [],
      updateRefusal: [],
    });

    const auditLog = auditLogStub();
    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt }, auditLog);

    expect(response.status).toBe(200);
    const after = await storedSurvey(surveyId);
    expect(await response.json()).toEqual({
      data: { id: surveyId, updatedAt: after.updatedAt.toISOString() },
    });
    expect(headlineOf(after)).toBe("Which colour do you like?");
    expect(after).toMatchObject({
      name: before.name,
      status: "paused",
      styling: before.styling,
      metadata: before.metadata,
    });
    expect(
      await prisma.survey.count({
        where: { workspaceId: fixture.workspaceId, name: { contains: "imported" } },
      })
    ).toBe(0);
    expect(auditLog).toMatchObject({ targetId: surveyId, organizationId: fixture.organizationId });
  });

  test("Update never writes the share metadata, even from an older file that carries it", async () => {
    const surveyId = await seedSurvey({ status: "paused" });
    const file = editFile(await exportFile(surveyId), (survey) => {
      survey.metadata = { title: { "en-US": "Title from the file" } };
    });
    expect((await exportFile(surveyId)).survey).not.toHaveProperty("metadata");

    const done = await preview(reworded(file));
    expect(done.report.issues).toContainEqual({
      code: "unknown_key_dropped",
      severity: "warning",
      params: { field: "survey.metadata" },
    });
    expect(done.payload).not.toHaveProperty("metadata");

    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt });

    expect(response.status).toBe(200);
    expect((await storedSurvey(surveyId)).metadata).toEqual({ title: { default: "Share title" } });
  });

  test("is no match for a user who cannot edit the survey, or in another workspace", async () => {
    const restrictedId = await seedSurvey({ status: "draft", visibility: "restricted" });
    const restrictedFile = await exportFile(restrictedId);

    // The editor may write in the workspace, but not in a survey restricted to its owner.
    expect((await preview(restrictedFile, sessionOf(fixture.users.editor))).match).toBeUndefined();
    expect((await preview(restrictedFile)).match).toMatchObject({ surveyId: restrictedId });

    const elsewhere = await prisma.survey.create({
      data: { name: "Elsewhere", type: "link", workspaceId: fixture.otherWorkspaceId, blocks: BLOCKS },
      select: { id: true },
    });
    await synchronizeAuthzedIntegrationFixture();
    const fromElsewhere = await exportFile(elsewhere.id);
    expect((await preview(fromElsewhere)).match).toBeUndefined();

    // The Update itself refuses such a survey as if it did not exist.
    const done = await preview(restrictedFile);
    const { workspaceId: _workspaceId, ...survey } = done.payload;
    const refused = await updateSurveyContent({
      surveyId: restrictedId,
      body: {
        survey,
        references: done.references,
        updatedAt: done.match!.updatedAt,
        triggers: "keep",
      },
      authentication: sessionOf(fixture.users.editor),
      requestId: "req_update",
      instance: "/api/internal/surveys/content",
    });
    expect(refused.status).toBe(403);
  });
});

describe("a file an Update would refuse", () => {
  test("is offered with the reasons in the preview, and the Update it describes is the 422 it predicts", async () => {
    const surveyId = await seedSurvey({ status: "paused" });
    // The first question's id changed, on a survey that is no longer a draft, and the type too.
    const file = editFile(await exportFile(surveyId), (survey) => {
      const blocks = survey.blocks as { elements: { id: string }[] }[];
      blocks[0].elements[0].id = "colour";
    });

    const done = await preview(file);

    expect(done.match).toMatchObject({ surveyId, triggers: "same" });
    expect(done.match?.updateRefusal).toEqual([
      expect.objectContaining({
        name: "survey.blocks.0.elements.0.id",
        code: "immutable_identifier",
        reason: expect.stringContaining("color"),
      }),
    ]);

    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt });
    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params).toEqual(done.match?.updateRefusal);
  });

  test("names a file of another survey type", async () => {
    const surveyId = await seedSurvey({ status: "draft" });
    const file = editFile(await exportFile(surveyId), (survey) => {
      survey.type = "app";
    });

    const done = await preview(file);

    expect(done.match?.updateRefusal).toEqual([
      expect.objectContaining({ name: "survey.type", code: "read_only_field" }),
    ]);
  });
});

describe("a survey that changed after the export", () => {
  test("refuses the stale file with a 409 carrying the current updatedAt, and writes nothing", async () => {
    const surveyId = await seedSurvey({ status: "draft", type: "app", triggerIds: [checkoutId] });
    const file = await exportFile(surveyId);
    const { updatedAt } = await editSurvey(surveyId, { name: "Onboarding v2" });
    const actionClassesBefore = await prisma.actionClass.count({
      where: { workspaceId: fixture.workspaceId },
    });

    // The file brings a trigger the workspace lacks, which a commit would create.
    const done = await preview(withTrigger(reworded(file), "clnewaction0000000000001", "signup"));
    expect(done.match).toMatchObject({ updatedAt: updatedAt.toISOString(), triggers: "differ" });

    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "conflict",
      details: { currentUpdatedAt: updatedAt.toISOString() },
    });
    const after = await storedSurvey(surveyId);
    expect(headlineOf(after)).toBe("Which color?");
    expect(after.updatedAt).toEqual(updatedAt);
    expect(await prisma.actionClass.count({ where: { workspaceId: fixture.workspaceId } })).toBe(
      actionClassesBefore
    );
  });

  test("'Update anyway' writes against the updatedAt the review read, and is refused if it changed again", async () => {
    const surveyId = await seedSurvey({ status: "draft" });
    const file = await exportFile(surveyId);
    await editSurvey(surveyId, { name: "Onboarding v2" });
    const done = await preview(reworded(file));

    const anyway = await update(surveyId, done, { updatedAt: done.match!.updatedAt });

    expect(anyway.status).toBe(200);
    expect(headlineOf(await storedSurvey(surveyId))).toBe("Which colour do you like?");

    // The same review again: the survey moved on with the Update itself.
    const again = await update(
      surveyId,
      { ...done, payload: reworded(file, "Third wording").survey },
      {
        updatedAt: done.match!.updatedAt,
      }
    );
    expect(again.status).toBe(409);
    expect(headlineOf(await storedSurvey(surveyId))).toBe("Which colour do you like?");
  });
});

describe("an active survey", () => {
  test("is offered locked, and an Update of it is refused with a 422 and writes nothing", async () => {
    const surveyId = await seedSurvey({ status: "inProgress" });
    const file = await exportFile(surveyId);

    const done = await preview(reworded(file));
    expect(done.match).toMatchObject({ surveyId, status: "inProgress" });

    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "survey_active" });
    expect(headlineOf(await storedSurvey(surveyId))).toBe("Which color?");
  });

  test("is refused when it goes live after the review, with 'Update anyway' too", async () => {
    const surveyId = await seedSurvey({ status: "paused" });
    const done = await preview(reworded(await exportFile(surveyId)));
    await editSurvey(surveyId, { status: "inProgress" });

    const response = await update(surveyId, done, { updatedAt: done.match!.updatedAt });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "survey_active" });
    expect(headlineOf(await storedSurvey(surveyId))).toBe("Which color?");
  });

  test("is refused when it goes live while the Update waits for it, rather than overwritten", async () => {
    const surveyId = await seedSurvey({ status: "paused" });
    const done = await preview(reworded(await exportFile(surveyId)));

    // Another writer takes the survey live and holds its row until the Update is waiting for it.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let activated: () => void = () => undefined;
    const isActivated = new Promise<void>((resolve) => {
      activated = resolve;
    });
    const activation = prisma.$transaction(async (tx) => {
      await tx.survey.update({ where: { id: surveyId }, data: { status: "inProgress" } });
      activated();
      await held;
    });
    await isActivated;

    const pending = update(surveyId, done, { updatedAt: done.match!.updatedAt });
    // Long enough for the Update to read, check and reach the survey's row.
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await activation;
    const response = await pending;

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "survey_active" });
    const after = await storedSurvey(surveyId);
    expect(after.status).toBe("inProgress");
    expect(headlineOf(after)).toBe("Which color?");
  });
});

describe("triggers", () => {
  test("the same triggers offer no choice; different ones are replaced, or kept with 'Keep current'", async () => {
    const surveyId = await seedSurvey({ status: "paused", type: "app", triggerIds: [checkoutId] });
    const file = await exportFile(surveyId);

    expect((await preview(file)).match?.triggers).toBe("same");

    // The file's trigger is the workspace's "pricing" action, matched by key.
    const done = await preview(withTrigger(file, "clfileaction000000000001", "pricing"));
    expect(done.match?.triggers).toBe("differ");

    const kept = await update(surveyId, done, { updatedAt: done.match!.updatedAt, triggers: "keep" });
    expect(kept.status).toBe(200);
    const afterKeep = await storedSurvey(surveyId);
    expect(afterKeep.triggers).toEqual([{ actionClassId: checkoutId }]);

    const used = await update(surveyId, done, {
      updatedAt: afterKeep.updatedAt.toISOString(),
      triggers: "file",
    });
    expect(used.status).toBe(200);
    expect((await storedSurvey(surveyId)).triggers).toEqual([{ actionClassId: pricingId }]);
  });

  test("'Use the file's' takes only the file's triggers, and keeps the survey's display settings", async () => {
    const surveyId = await seedSurvey({ status: "paused", type: "app", triggerIds: [checkoutId] });
    const displaySettings = {
      displayOption: "displayMultiple",
      displayPercentage: 50,
      recontactDays: 14,
      autoClose: 30,
      autoComplete: 100,
      delay: 5,
    } as const;
    await prisma.survey.update({ where: { id: surveyId }, data: displaySettings });
    const file = withTrigger(await exportFile(surveyId), "clfileaction000000000002", "pricing");
    // The file's own display settings differ from the survey's.
    file.survey.distribution = {
      ...(file.survey.distribution as Record<string, unknown>),
      displayOption: "displayOnce",
      displayPercentage: null,
      recontactDays: null,
      autoClose: null,
      autoComplete: null,
      delay: 0,
    };

    const done = await preview(file);
    expect(done.match?.triggers).toBe("differ");
    const response = await update(surveyId, done, { updatedAt: done.match!.updatedAt, triggers: "file" });

    expect(response.status).toBe(200);
    const after = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: {
        displayOption: true,
        displayPercentage: true,
        recontactDays: true,
        autoClose: true,
        autoComplete: true,
        delay: true,
        triggers: { select: { actionClassId: true } },
      },
    });
    // A decimal column, read back as a Decimal.
    expect({ ...after, displayPercentage: Number(after.displayPercentage) }).toEqual({
      ...displaySettings,
      triggers: [{ actionClassId: pricingId }],
    });
  });

  test("'Keep current' creates none of the actions the file's triggers would need", async () => {
    const surveyId = await seedSurvey({ status: "paused", type: "app", triggerIds: [checkoutId] });
    const done = await preview(
      withTrigger(await exportFile(surveyId), "clnewaction0000000000002", "upgrade")
    );
    expect(done.match?.triggers).toBe("differ");

    const kept = await update(surveyId, done, { updatedAt: done.match!.updatedAt, triggers: "keep" });

    expect(kept.status).toBe(200);
    expect(
      await prisma.actionClass.count({ where: { workspaceId: fixture.workspaceId, key: "upgrade" } })
    ).toBe(0);
    expect((await storedSurvey(surveyId)).triggers).toEqual([{ actionClassId: checkoutId }]);
  });

  test("are locked to the current ones when the file's would leave a live app survey with nothing to show it", async () => {
    const surveyId = await seedSurvey({ status: "paused", type: "app", triggerIds: [checkoutId] });
    const file = await exportFile(surveyId);
    const withoutTriggers: TFile = {
      ...file,
      survey: {
        ...file.survey,
        distribution: { ...(file.survey.distribution as Record<string, unknown>), triggers: [] },
      },
    };

    const done = await preview(withoutTriggers);
    expect(done.match?.triggers).toBe("keep_only");

    // The server holds the same rule, whatever the client sends.
    const refused = await update(surveyId, done, { updatedAt: done.match!.updatedAt, triggers: "file" });
    expect(refused.status).toBe(422);
    expect((await storedSurvey(surveyId)).triggers).toEqual([{ actionClassId: checkoutId }]);
  });
});

describe("shared hidden fields and variables", () => {
  test("a shared field the file brings is linked to the workspace's library, as a create links it", async () => {
    const surveyId = await seedSurvey({ status: "draft" });
    const library = await prisma.embeddedData.create({
      data: {
        key: "plan_tier",
        name: "Plan tier",
        source: "ingested",
        dataType: "string",
        workspaceId: fixture.workspaceId,
      },
      select: { id: true },
    });
    const file = await exportFile(surveyId);
    file.survey.hiddenFields = { enabled: true, fieldIds: ["plan_tier", "channel"] };
    file.references = {
      ...(file.references as Record<string, unknown>),
      embeddedFields: [
        {
          storageKey: "plan_tier",
          key: "plan_tier",
          name: "Plan tier",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
      ],
    };

    const done = await preview(file);
    const response = await update(surveyId, done, { updatedAt: done.match!.exportedUpdatedAt });

    expect(response.status).toBe(200);
    const links = await prisma.surveyEmbeddedData.findMany({
      where: { surveyId },
      select: { storageKey: true, embeddedData: { select: { id: true, surveyId: true } } },
    });
    const byStorageKey = Object.fromEntries(
      links.map(({ storageKey, embeddedData }) => [storageKey, embeddedData])
    );
    // The library's own row, not a copy local to the survey; a field the library lacks stays local.
    expect(byStorageKey.plan_tier).toEqual({ id: library.id, surveyId: null });
    expect(byStorageKey.channel).toEqual({ id: expect.any(String), surveyId });
    expect(
      await prisma.embeddedData.count({ where: { workspaceId: fixture.workspaceId, key: "plan_tier" } })
    ).toBe(1);
  });
});

describe("what an Update removes", () => {
  test("warns about each question and option it takes from a survey with responses", async () => {
    const surveyId = await seedSurvey({ status: "completed" });
    const file = await exportFile(surveyId);
    const fewer = editFile(file, (survey) => {
      const [block] = survey.blocks as { elements: { id: string; choices?: { id: string }[] }[] }[];
      block.elements = block.elements.filter((element) => element.id !== "feedback");
      block.elements[0].choices = block.elements[0].choices?.filter((option) => option.id !== "green");
    });

    expect((await preview(fewer)).match?.issues).toEqual([]);

    await prisma.response.create({ data: { surveyId, finished: true, data: { color: "Green" } } });
    const done = await preview(fewer);

    expect(done.match?.issues).toEqual([
      { code: "option_removed", severity: "warning", questionTag: "color", params: { option: "Green" } },
      {
        code: "question_removed",
        severity: "warning",
        questionTag: "feedback",
        params: { headline: "Anything else?" },
      },
    ]);
    // The Update still goes ahead.
    expect((await update(surveyId, done, { updatedAt: done.match!.updatedAt })).status).toBe(200);
    expect(await prisma.response.count({ where: { surveyId } })).toBe(1);
  });

  test("removes the parts the workspace cannot hold with a warning, as a create does", async () => {
    entitlements.externalUrls = false;
    const surveyId = await seedSurvey({ status: "draft" });
    const file = await exportFile(surveyId);
    const endingId = (file.survey.endings as { id: string }[])[0].id;
    const withRedirect = editFile(file, (survey) => {
      survey.endings = [{ id: endingId, type: "redirectToUrl", url: "https://example.com", label: "Site" }];
    });

    const done = await preview(withRedirect);
    expect(done.report.issues).toContainEqual(
      expect.objectContaining({ code: "external_url_removed", severity: "warning" })
    );

    expect((await update(surveyId, done, { updatedAt: done.match!.updatedAt })).status).toBe(200);
    expect((await storedSurvey(surveyId)).endings).toEqual([
      expect.objectContaining({ id: endingId, type: "endScreen" }),
    ]);
  });
});
