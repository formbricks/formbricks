import { createId } from "@paralleldrive/cuid2";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { exportSurveyOperation } from "@/app/api/internal/surveys/[surveyId]/export/lib/operations";
import { streamSurveyImport } from "@/app/api/internal/surveys/import/lib/operations";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { claimSurveyImportIdempotencyKey, fingerprintSurveyImportRequest } from "./idempotency";
import { createSurveyImport } from "./operations";

/**
 * Importing a Formbricks file as a new survey (ENG-6850), seam 1, against real PostgreSQL, SpiceDB and
 * Redis: a survey exported from one organization is previewed from its bytes and created in another,
 * its references matched or created there in the survey's transaction, and nothing left behind when
 * the create fails.
 *
 * The plan's entitlements are the one boundary faked: contact targeting and external URLs are licence
 * questions this harness has no licence for.
 */

const entitlements = vi.hoisted(() => ({ contacts: true, externalUrls: true }));
const surveyLimit = vi.hoisted(() => ({ fail: false }));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => entitlements.contacts,
}));
vi.mock("@/modules/survey/lib/permission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/lib/permission")>()),
  getExternalUrlsPermission: async () => entitlements.externalUrls,
}));
// Fails the create at its last check before the write, after the references are in the transaction.
vi.mock("@/lib/survey/visibility/limit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/survey/visibility/limit")>();
  return {
    ...original,
    assertWorkspaceSurveyLimit: async (workspaceId: string) => {
      if (surveyLimit.fail) throw new original.WorkspaceSurveyLimitError(1, 1);
      return original.assertWorkspaceSurveyLimit(workspaceId);
    },
  };
});

// i18next-icu's ESM build cannot construct IntlMessageFormat under Node's own module loader, so outside
// Next's bundler `t` returns messages uninterpolated. The import's names are checked in English with
// the en-US strings, interpolated as ICU would.
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
let sourceSurveyId: string;
let exportedFile: Record<string, unknown>;

const ENDING_ID = createId();
const BLOCK_ID = createId();
const VARIABLE_ID = createId();
const PRICING_CONFIG = { type: "pageView", urlFilters: [{ rule: "contains", value: "/pricing" }] };

const BLOCKS = [
  {
    id: BLOCK_ID,
    name: "Block 1",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?", "de-DE": "Was sollen wir verbessern?" },
        required: true,
        inputType: "text",
        insightsEnabled: false,
        charLimit: { enabled: false },
      },
      {
        id: "nps",
        type: "nps",
        headline: { default: "How likely are you to recommend us?", "de-DE": "Wie wahrscheinlich?" },
        required: true,
        lowerLabel: { default: "Not likely", "de-DE": "Unwahrscheinlich" },
        upperLabel: { default: "Very likely", "de-DE": "Sehr wahrscheinlich" },
        isColorCodingEnabled: false,
      },
    ],
    logic: [
      {
        id: createId(),
        conditions: {
          id: createId(),
          connector: "and",
          conditions: [
            {
              id: createId(),
              leftOperand: { type: "element", value: "nps" },
              operator: "isLessThan",
              rightOperand: { type: "static", value: 5 },
            },
          ],
        },
        actions: [{ id: createId(), objective: "jumpToBlock", target: ENDING_ID }],
      },
    ],
  },
];

const filterLeaf = (
  root: Record<string, unknown>,
  qualifier: string,
  value: unknown,
  connector: string | null
) => ({
  id: createId(),
  connector,
  resource: { id: createId(), root, qualifier: { operator: qualifier }, value },
});

/** The users' session, with the owner made an owner of the foreign organization too. */
const owner = () => sessionOf(fixture.users.owner);

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

/** Preview a file's bytes as the dialog uploads them, into `workspaceId`. */
const preview = (workspaceId: string, content: unknown, name = "In-app survey.formbricks.json") =>
  streamSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
    authentication: owner(),
    workspaceId,
    file: new File([JSON.stringify(content)], name),
    requestId: "req_preview",
    instance: "/api/internal/surveys/import/stream",
  });

/** The `done` event of a preview that succeeded. */
const previewDone = async (workspaceId: string, content: unknown) => {
  const response = await preview(workspaceId, content);
  expect(response.status).toBe(200);
  const done = (await readEvents(response)).find((event) => event.type === "done");
  if (!done) throw new Error("The preview did not finish");
  return done as {
    payload: Record<string, unknown>;
    references: Record<string, unknown>;
    report: { source: { kind: string }; issues: { code: string; params?: Record<string, unknown> }[] };
  };
};

const auditLogStub = (): TV3AuditLog =>
  ({
    action: "created",
    targetType: "survey",
    userId: fixture.users.owner,
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    userType: "user",
  }) as TV3AuditLog;

/** Create what a preview returned, as the dialog does: the draft without its workspace, and the references. */
const commit = ({
  workspaceId,
  payload,
  references,
  idempotencyKey = createId(),
  auditLog,
}: {
  workspaceId: string;
  payload: Record<string, unknown>;
  references?: Record<string, unknown>;
  idempotencyKey?: string;
  auditLog?: TV3AuditLog;
}) => {
  const { workspaceId: _workspaceId, ...survey } = payload;
  return createSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/imports", {
      method: "POST",
      headers: { "Idempotency-Key": `"${idempotencyKey}"` },
    }),
    authentication: owner(),
    body: { workspaceId, survey, ...(references ? { references } : {}) },
    requestId: "req_commit",
    instance: "/api/internal/surveys/imports",
    auditLog,
  });
};

const surveyIdOf = (response: Response): string => {
  const location = response.headers.get("Location") ?? "";
  return location.slice(location.lastIndexOf("/") + 1);
};

/** Every row an import can leave in a workspace, counted. */
const countReferences = async (workspaceId: string) => ({
  surveys: await prisma.survey.count({ where: { workspaceId } }),
  actionClasses: await prisma.actionClass.count({ where: { workspaceId } }),
  attributeKeys: await prisma.contactAttributeKey.count({ where: { workspaceId } }),
  languages: await prisma.language.count({ where: { workspaceId } }),
  embeddedData: await prisma.embeddedData.count({ where: { workspaceId } }),
});

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  const foreignOrganization = await prisma.workspace.findUniqueOrThrow({
    where: { id: fixture.foreignWorkspaceId },
    select: { organizationId: true },
  });
  await prisma.membership.create({
    data: {
      accepted: true,
      organizationId: foreignOrganization.organizationId,
      role: "owner",
      userId: fixture.users.owner,
    },
  });

  // The source: an app survey in two languages, with logic, a local and a shared hidden field, a
  // variable, a code and a no-code trigger, and targeting that names an attribute, a segment and surveys.
  const workspaceId = fixture.workspaceId;
  const [english, german] = await Promise.all([
    prisma.language.create({ data: { code: "en-US", workspaceId } }),
    prisma.language.create({ data: { code: "de-DE", alias: "German", workspaceId } }),
  ]);
  const [checkout, pricing] = await Promise.all([
    prisma.actionClass.create({ data: { name: "Checkout", type: "code", key: "checkout", workspaceId } }),
    prisma.actionClass.create({
      data: { name: "Pricing page", type: "noCode", noCodeConfig: PRICING_CONFIG, workspaceId },
    }),
  ]);
  await prisma.contactAttributeKey.create({
    data: { key: "plan", name: "Plan", description: "Billing plan", workspaceId },
  });
  const otherSegment = await prisma.segment.create({
    data: { title: "Power users", isPrivate: false, workspaceId, filters: [] },
  });
  const segment = await prisma.segment.create({
    data: {
      title: createId(),
      isPrivate: true,
      workspaceId,
      filters: [
        filterLeaf({ type: "attribute", contactAttributeKey: "plan" }, "equals", "pro", null),
        filterLeaf({ type: "segment", segmentId: otherSegment.id }, "userIsIn", otherSegment.id, "and"),
        filterLeaf(
          { type: "surveyInteraction" },
          "haveCompleted",
          { surveyScope: "specific", surveyIds: [createId()], within: { amount: 30, unit: "days" } },
          "and"
        ),
      ],
    },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "In-app survey",
      type: "app",
      status: "inProgress",
      workspaceId,
      ownerId: fixture.users.owner,
      blocks: BLOCKS,
      endings: [{ id: ENDING_ID, type: "endScreen", headline: { default: "Thanks!", "de-DE": "Danke!" } }],
      segmentId: segment.id,
      languages: {
        create: [
          { languageId: english.id, default: true, enabled: true },
          { languageId: german.id, default: false, enabled: true },
        ],
      },
      triggers: { create: [{ actionClassId: checkout.id }, { actionClassId: pricing.id }] },
    },
    select: { id: true },
  });
  sourceSurveyId = survey.id;

  const [localField, sharedField, variable] = await Promise.all([
    prisma.embeddedData.create({
      data: { name: "channel", source: "ingested", dataType: "string", workspaceId, surveyId: survey.id },
    }),
    prisma.embeddedData.create({
      data: { key: "plan_tier", name: "Plan tier", source: "ingested", dataType: "string", workspaceId },
    }),
    prisma.embeddedData.create({
      data: {
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 0,
        workspaceId,
        surveyId: survey.id,
      },
    }),
  ]);
  await prisma.surveyEmbeddedData.createMany({
    data: [
      { workspaceId, surveyId: survey.id, embeddedDataId: localField.id, storageKey: "channel", order: 0 },
      { workspaceId, surveyId: survey.id, embeddedDataId: sharedField.id, storageKey: "plan_tier", order: 1 },
      { workspaceId, surveyId: survey.id, embeddedDataId: variable.id, storageKey: VARIABLE_ID, order: 2 },
    ],
  });

  await synchronizeAuthzedIntegrationFixture();

  const exported = await exportSurveyOperation({
    surveyId: sourceSurveyId,
    format: "json",
    authentication: owner(),
    requestId: "req_export",
    instance: `/api/internal/surveys/${sourceSurveyId}/export`,
  });
  expect(exported.status).toBe(200);
  exportedFile = (await exported.json()) as Record<string, unknown>;
}, 120_000);

beforeEach(() => {
  entitlements.contacts = true;
  entitlements.externalUrls = true;
  surveyLimit.fail = false;
});

describe("a Formbricks file imported into another organization", () => {
  test("previews from its bytes without AI, and creates a draft that matches the source, its references created there", async () => {
    const target = fixture.foreignWorkspaceId;
    // The target already has the shared field, and an action under the code action's name with another key.
    await prisma.embeddedData.create({
      data: { key: "plan_tier", name: "Plan", source: "ingested", dataType: "string", workspaceId: target },
    });
    await prisma.actionClass.create({
      data: { name: "Checkout", type: "code", key: "buy", workspaceId: target },
    });

    const done = await previewDone(target, exportedFile);

    expect(done.report.source.kind).toBe("formbricks");
    expect(done.payload).toMatchObject({
      name: "In-app survey (imported)",
      status: "draft",
      workspaceId: target,
    });
    const codes = done.report.issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "targeting_filter_removed",
        "action_class_created",
        "attribute_key_created",
        "content_only",
      ])
    );
    expect(done.report.issues).toContainEqual({
      code: "action_class_created",
      severity: "info",
      params: { name: "Checkout (imported)" },
    });
    // Nothing is written by a preview.
    expect(await prisma.survey.count({ where: { workspaceId: target } })).toBe(0);

    const auditLog = auditLogStub();
    const response = await commit({
      workspaceId: target,
      payload: done.payload,
      references: done.references,
      auditLog,
    });

    expect(response.status).toBe(201);
    const surveyId = surveyIdOf(response);
    expect(response.headers.get("Location")).toBe(`/api/v3/surveys/${surveyId}`);
    expect(await response.json()).toEqual({ data: { id: surveyId } });
    // The survey as v3 create records it, and every reference the import created alongside it.
    const createdKeys = done.report.issues.filter((issue) => issue.code === "attribute_key_created");
    expect(auditLog).toMatchObject({
      organizationId: expect.any(String),
      targetId: surveyId,
      newObject: {
        id: surveyId,
        name: "In-app survey (imported)",
        createdFrom: "import",
        createdReferences: {
          actionClasses: [
            { id: expect.any(String), name: "Checkout (imported)" },
            { id: expect.any(String), name: "Pricing page" },
          ],
          attributeKeys: createdKeys.map((issue) => issue.params?.key),
          languages: ["de-DE"],
        },
      },
    });

    const created = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: {
        workspaceId: true,
        name: true,
        type: true,
        status: true,
        blocks: true,
        endings: true,
        triggers: { select: { actionClass: { select: { name: true, key: true, workspaceId: true } } } },
        segment: { select: { filters: true } },
        languages: { select: { default: true, language: { select: { code: true, alias: true } } } },
        embeddedDataLinks: {
          select: { storageKey: true, embeddedData: { select: { key: true, surveyId: true } } },
        },
      },
    });
    expect(created).toMatchObject({
      workspaceId: target,
      name: "In-app survey (imported)",
      type: "app",
      status: "draft",
    });
    // The content, ids included, as the source has it.
    expect(created.blocks).toEqual(BLOCKS);
    expect(created.endings).toEqual([
      { id: ENDING_ID, type: "endScreen", headline: { default: "Thanks!", "de-DE": "Danke!" } },
    ]);
    // The code action was created under a free name; the no-code one created with its configuration.
    expect(
      created.triggers.map(({ actionClass }) => actionClass).sort((a, b) => a.name.localeCompare(b.name))
    ).toEqual([
      { name: "Checkout (imported)", key: "checkout", workspaceId: target },
      { name: "Pricing page", key: null, workspaceId: target },
    ]);
    // Targeting keeps its attribute filter; the segment and survey filters pointed at the source.
    expect(created.segment?.filters).toEqual([
      expect.objectContaining({
        connector: null,
        resource: expect.objectContaining({ root: { type: "attribute", contactAttributeKey: "plan" } }),
      }),
    ]);
    expect(
      await prisma.contactAttributeKey.findUnique({
        where: { key_workspaceId: { key: "plan", workspaceId: target } },
        select: { name: true, description: true },
      })
    ).toEqual({ name: "Plan", description: "Billing plan" });
    // The language the import added has the source workspace's alias.
    expect(created.languages.map(({ default: isDefault, language }) => ({ isDefault, ...language }))).toEqual(
      expect.arrayContaining([
        { isDefault: true, code: "en-US", alias: null },
        { isDefault: false, code: "de-DE", alias: "German" },
      ])
    );
    // The shared field is linked to the target's library; the local ones are the survey's own.
    const links = Object.fromEntries(
      created.embeddedDataLinks.map(({ storageKey, embeddedData }) => [storageKey, embeddedData])
    );
    expect(links.plan_tier).toEqual({ key: "plan_tier", surveyId: null });
    expect(links.channel).toEqual({ key: null, surveyId });
    expect(links[VARIABLE_ID]).toEqual({ key: null, surveyId });
  });

  test("matches the references a workspace already has, and numbers the next import of the same survey", async () => {
    const target = fixture.foreignWorkspaceId;
    const before = await countReferences(target);

    const done = await previewDone(target, exportedFile);
    expect(done.payload.name).toBe("In-app survey (imported 2)");
    expect(done.report.issues.map((issue) => issue.code)).not.toContain("action_class_created");

    const response = await commit({
      workspaceId: target,
      payload: done.payload,
      references: done.references,
    });

    expect(response.status).toBe(201);
    const after = await countReferences(target);
    expect(after).toEqual({ ...before, surveys: before.surveys + 1, embeddedData: before.embeddedData + 2 });
  });

  test("never trusts an action class id the client sends: a trigger is matched by its key, in the target", async () => {
    const target = fixture.otherWorkspaceId;
    const done = await previewDone(target, exportedFile);
    const sourceCheckoutId = (
      await prisma.actionClass.findFirstOrThrow({
        where: { workspaceId: fixture.workspaceId, key: "checkout" },
        select: { id: true },
      })
    ).id;
    // The client points the trigger at an action class of another workspace, which it also lists.
    const triggers = (done.payload.distribution as { triggers: { actionClassId: string }[] }).triggers;
    expect(triggers).toContainEqual({ actionClassId: sourceCheckoutId });

    const response = await commit({
      workspaceId: target,
      payload: done.payload,
      references: done.references,
    });

    expect(response.status).toBe(201);
    const created = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyIdOf(response) },
      select: { triggers: { select: { actionClass: { select: { id: true, workspaceId: true } } } } },
    });
    expect(created.triggers.every(({ actionClass }) => actionClass.workspaceId === target)).toBe(true);
    expect(created.triggers.map(({ actionClass }) => actionClass.id)).not.toContain(sourceCheckoutId);
  });

  test("leaves nothing behind when the create fails after its references were written", async () => {
    const organization = await prisma.workspace.findUniqueOrThrow({
      where: { id: fixture.foreignWorkspaceId },
      select: { organizationId: true },
    });
    const empty = await prisma.workspace.create({
      data: { name: "Empty", organizationId: organization.organizationId },
    });
    await synchronizeAuthzedIntegrationFixture();
    const done = await previewDone(empty.id, exportedFile);
    const before = await countReferences(empty.id);
    surveyLimit.fail = true;

    const response = await commit({
      workspaceId: empty.id,
      payload: done.payload,
      references: done.references,
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "workspace_survey_limit_reached" });
    expect(await countReferences(empty.id)).toEqual(before);
    expect(before).toMatchObject({ surveys: 0, actionClasses: 0, attributeKeys: 0, languages: 0 });
  });
});

describe("the action classes a Formbricks file brings", () => {
  /** A fresh workspace in the foreign organization, holding these action classes. */
  const workspaceWith = async (
    actionClasses: { name: string; type: "code" | "noCode"; key?: string; noCodeConfig?: object }[]
  ) => {
    const { organizationId } = await prisma.workspace.findUniqueOrThrow({
      where: { id: fixture.foreignWorkspaceId },
      select: { organizationId: true },
    });
    const workspace = await prisma.workspace.create({
      data: { name: createId(), organizationId },
      select: { id: true },
    });
    await prisma.actionClass.createMany({
      data: actionClasses.map((actionClass) => ({ ...actionClass, workspaceId: workspace.id })),
    });
    await synchronizeAuthzedIntegrationFixture();
    return workspace.id;
  };

  /** The exported file with its triggers replaced by one on each of these actions. */
  const withActions = (actionClasses: Record<string, unknown>[]) => {
    const file = structuredClone(exportedFile) as {
      survey: { distribution: Record<string, unknown> };
      references: Record<string, unknown>;
    };
    file.references.actionClasses = actionClasses;
    file.survey.distribution.triggers = actionClasses.map(({ id }) => ({ actionClassId: id }));
    return file;
  };

  const codeAction = (name: string, key: string) => ({
    id: createId(),
    name,
    description: null,
    type: "code",
    key,
    noCodeConfig: null,
  });

  /** Preview and create, returning the names of the action classes the created survey's triggers use. */
  const importTriggers = async (workspaceId: string, file: unknown) => {
    const done = await previewDone(workspaceId, file);
    const response = await commit({ workspaceId, payload: done.payload, references: done.references });
    expect(response.status).toBe(201);
    const created = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyIdOf(response) },
      select: { triggers: { select: { actionClass: { select: { name: true } } } } },
    });
    return { done, names: created.triggers.map(({ actionClass }) => actionClass.name) };
  };

  test("an action named like an import gets the next free number, not a name the workspace has", async () => {
    const workspaceId = await workspaceWith([
      { name: "Signup (imported)", type: "code", key: "signup-a" },
      { name: "Signup (imported 2)", type: "code", key: "signup-b" },
    ]);

    const { done, names } = await importTriggers(
      workspaceId,
      withActions([codeAction("Signup (imported)", "signup-c")])
    );

    expect(done.report.issues).toContainEqual({
      code: "action_class_created",
      severity: "info",
      params: { name: "Signup (imported 3)" },
    });
    expect(names).toEqual(["Signup (imported 3)"]);
  });

  test("a name with LIKE wildcards in it is looked up as written", async () => {
    const workspaceId = await workspaceWith([
      { name: "50%_off", type: "code", key: "sale-a" },
      { name: "50%_off (imported)", type: "code", key: "sale-b" },
      // Would match the name read as a pattern, and is a different name.
      { name: "50X off (imported 2)", type: "code", key: "sale-c" },
    ]);

    const { names } = await importTriggers(workspaceId, withActions([codeAction("50%_off", "sale-d")]));

    expect(names).toEqual(["50%_off (imported 2)"]);
  });

  test("a no-code action is matched by its configuration whatever the order of its keys", async () => {
    const workspaceId = await workspaceWith([
      {
        name: "Pricing visit",
        type: "noCode",
        noCodeConfig: { urlFilters: [{ value: "/pricing", rule: "contains" }], type: "pageView" },
      },
      { name: "Other visit", type: "noCode", noCodeConfig: { type: "pageView", urlFilters: [] } },
    ]);

    const { done, names } = await importTriggers(
      workspaceId,
      withActions([
        {
          id: createId(),
          name: "Pricing page",
          description: null,
          type: "noCode",
          key: null,
          noCodeConfig: PRICING_CONFIG,
        },
      ])
    );

    expect(done.report.issues.map((issue) => issue.code)).not.toContain("action_class_created");
    expect(names).toEqual(["Pricing visit"]);
  });
});

describe("a reviewed draft that carries no references (Qualtrics, Word, Excel, CSV)", () => {
  /** A draft as a document lane's preview returns it, named "(imported)" when it was previewed. */
  const documentDraft = (workspaceId: string) => ({
    workspaceId,
    name: "Visit survey (imported)",
    status: "inProgress",
    defaultLanguage: "en-US",
    blocks: [
      {
        id: createId(),
        name: "Block 1",
        elements: [
          {
            id: "visit_day",
            type: "openText",
            headline: { "en-US": "Which day did you visit?" },
            required: true,
            inputType: "text",
            charLimit: { enabled: false },
          },
        ],
      },
    ],
  });

  test("is created through the import, named against the workspace as it is now, as a draft", async () => {
    const target = fixture.otherWorkspaceId;
    // Another import took the previewed name in the meantime.
    await prisma.survey.create({
      data: { name: "Visit survey (imported)", type: "link", workspaceId: target, blocks: [] },
    });
    const auditLog = auditLogStub();

    const response = await commit({ workspaceId: target, payload: documentDraft(target), auditLog });

    expect(response.status).toBe(201);
    const created = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyIdOf(response) },
      select: { name: true, status: true, workspaceId: true, blocks: true },
    });
    expect(created).toMatchObject({
      name: "Visit survey (imported 2)",
      status: "draft",
      workspaceId: target,
    });
    expect(auditLog).toMatchObject({ targetId: surveyIdOf(response) });
  });

  test("is idempotent per Idempotency-Key, like a Formbricks file's", async () => {
    const target = fixture.otherWorkspaceId;
    const idempotencyKey = createId();
    const payload = documentDraft(target);
    const before = await prisma.survey.count({ where: { workspaceId: target } });

    const first = await commit({ workspaceId: target, payload, idempotencyKey });
    const repeat = await commit({ workspaceId: target, payload, idempotencyKey });

    expect(first.status).toBe(201);
    expect(repeat.headers.get("Location")).toBe(first.headers.get("Location"));
    expect(await prisma.survey.count({ where: { workspaceId: target } })).toBe(before + 1);
  });

  test("refuses a draft the create would refuse, naming the field, and creates nothing", async () => {
    const target = fixture.otherWorkspaceId;
    const before = await prisma.survey.count({ where: { workspaceId: target } });
    const payload = documentDraft(target);
    payload.blocks[0].elements[0].headline = {} as never;

    const response = await commit({ workspaceId: target, payload });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as { invalid_params: { name: string }[] };
    expect(problem.invalid_params.map((param) => param.name)).toContain(
      "survey.blocks.0.elements.0.headline"
    );
    expect(await prisma.survey.count({ where: { workspaceId: target } })).toBe(before);
  });
});

describe("POST /api/internal/surveys/imports is idempotent per Idempotency-Key", () => {
  test("a repeat gets the same 201 and creates one survey; the same key with another body is a 422", async () => {
    const target = fixture.otherWorkspaceId;
    const done = await previewDone(target, exportedFile);
    const idempotencyKey = createId();
    const before = await prisma.survey.count({ where: { workspaceId: target } });

    const first = await commit({ workspaceId: target, ...done, idempotencyKey });
    const auditLog = auditLogStub();
    const repeat = await commit({ workspaceId: target, ...done, idempotencyKey, auditLog });

    expect(first.status).toBe(201);
    expect(repeat.status).toBe(201);
    expect(repeat.headers.get("Location")).toBe(first.headers.get("Location"));
    expect(await prisma.survey.count({ where: { workspaceId: target } })).toBe(before + 1);

    const changed = await commit({
      workspaceId: target,
      payload: { ...done.payload, name: "Something else" },
      references: done.references,
      idempotencyKey,
    });
    expect(changed.status).toBe(422);
    expect(await changed.json()).toMatchObject({ code: "idempotency_key_reused" });
  });

  test("a repeat while the first request runs is a 409, and a failed request gives its key back", async () => {
    const target = fixture.otherWorkspaceId;
    const done = await previewDone(target, exportedFile);
    const idempotencyKey = createId();
    const { workspaceId: _workspaceId, ...survey } = done.payload;
    const running = await claimSurveyImportIdempotencyKey({
      userId: fixture.users.owner,
      idempotencyKey,
      fingerprint: fingerprintSurveyImportRequest({
        workspaceId: target,
        survey,
        references: done.references,
      }),
    });
    expect(running.kind).toBe("claimed");

    const inFlight = await commit({ workspaceId: target, ...done, idempotencyKey });
    expect(inFlight.status).toBe(409);
    expect(await inFlight.json()).toMatchObject({ code: "idempotency_key_in_use" });
    expect(inFlight.headers.get("Retry-After")).toEqual(expect.any(String));

    if (running.kind === "claimed") await running.release();
    surveyLimit.fail = true;
    const failed = await commit({ workspaceId: target, ...done, idempotencyKey });
    expect(failed.status).toBe(422);
    surveyLimit.fail = false;

    const retried = await commit({ workspaceId: target, ...done, idempotencyKey });
    expect(retried.status).toBe(201);
  });

  test("refuses a create without a key", async () => {
    const response = await createSurveyImport({
      req: new Request("http://localhost/api/internal/surveys/imports", { method: "POST" }),
      authentication: owner(),
      body: { workspaceId: fixture.otherWorkspaceId, survey: {}, references: {} },
      requestId: "req_commit",
      instance: "/api/internal/surveys/imports",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ invalid_params: [{ name: "Idempotency-Key" }] });
  });
});

describe("the three validation tiers", () => {
  test("a malformed file is refused naming each field, and nothing is created", async () => {
    const target = fixture.otherWorkspaceId;
    const before = await countReferences(target);
    const survey = structuredClone(exportedFile.survey) as {
      blocks: { elements: Record<string, unknown>[] }[];
    };
    delete survey.blocks[0].elements[0].headline;
    delete survey.blocks[0].elements[1].headline;

    const response = await preview(target, { ...exportedFile, survey });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as { code: string; invalid_params: { name: string }[] };
    expect(problem.code).toBe("formbricks_file_invalid");
    expect(problem.invalid_params.map((param) => param.name)).toEqual([
      "file.survey.blocks.0.elements.0.headline",
      "file.survey.blocks.0.elements.1.headline",
    ]);
    expect(await countReferences(target)).toEqual(before);
  });

  test("a broken logic reference is refused, naming where it is", async () => {
    const survey = structuredClone(exportedFile.survey) as {
      blocks: { logic: { actions: { target: string }[] }[] }[];
    };
    survey.blocks[0].logic[0].actions[0].target = createId();

    const response = await preview(fixture.otherWorkspaceId, { ...exportedFile, survey });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as { code: string; invalid_params: { name: string }[] };
    expect(problem.code).toBe("formbricks_file_invalid");
    expect(problem.invalid_params.every((param) => param.name.startsWith("file.survey.blocks.0.logic"))).toBe(
      true
    );
  });

  test("a file from a newer Formbricks is refused as such", async () => {
    const response = await preview(fixture.otherWorkspaceId, {
      ...exportedFile,
      formbricks: { ...(exportedFile.formbricks as object), format: 2 },
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "formbricks_file_too_new" });
  });

  test("unknown keys are dropped with a warning each, and parts the workspace cannot hold removed with one", async () => {
    entitlements.contacts = false;
    const survey = { ...(exportedFile.survey as object), tone: "friendly" };

    const done = await previewDone(fixture.otherWorkspaceId, {
      ...exportedFile,
      survey,
      exportedBy: "ChatGPT",
    });

    expect(done.report.issues).toEqual(
      expect.arrayContaining([
        { code: "unknown_key_dropped", severity: "warning", params: { field: "survey.tone" } },
        { code: "unknown_key_dropped", severity: "warning", params: { field: "exportedBy" } },
        { code: "targeting_removed", severity: "warning" },
      ])
    );
    expect(done.payload).not.toHaveProperty("tone");
    expect(done.payload).not.toHaveProperty("targeting");
  });
});
