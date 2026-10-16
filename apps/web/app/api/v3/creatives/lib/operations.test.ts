import { beforeEach, describe, expect, test, vi } from "vitest";
import { zCreativeResource } from "@formbricks/api-v3-schemas";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import {
  type TCreativeRecord,
  type TCreativeWriteData,
  type TDestinationSurveyFacts,
  findCreativeRecordsPage,
  insertCreativeRecord,
  replaceCreativeRecord,
} from "@/modules/creatives/lib/repository";
import {
  archiveV3Creative,
  createV3Creative,
  deleteV3Creative,
  duplicateV3Creative,
  getV3Creative,
  listV3Creatives,
  patchV3Creative,
  restoreV3Creative,
} from "./operations";
import type { TV3CreateCreativeBody, TV3PatchCreativeBody } from "./schemas";
import { ZV3CreateCreativeBody, ZV3PatchCreativeBody } from "./schemas";

/**
 * Seam 1 · the v3 creative operations, which the API routes and the MCP tools both call. Storage is
 * replaced by an in-memory fake of the repository (the one boundary the rules talk to), so every
 * assertion is on what a caller sees: the status code and the resource or problem it gets back.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws1234567890123456789012";
const OTHER_WORKSPACE_ID = "clwo1234567890123456789012";
const ORGANIZATION_ID = "clor1234567890123456789012";
const USER_ID = "clus1234567890123456789012";
const APP_SURVEY_ID = "clsa1234567890123456789012";
const LINK_SURVEY_ID = "clsl1234567890123456789012";
const PAUSED_SURVEY_ID = "clsp1234567890123456789012";
const RESTRICTED_SURVEY_ID = "clsr1234567890123456789012";
const SINGLE_USE_SURVEY_ID = "clss1234567890123456789012";
const PIN_SURVEY_ID = "clsn1234567890123456789012";
const PENDING_SURVEY_ID = "clsv1234567890123456789012";
const FOREIGN_SURVEY_ID = "clsf1234567890123456789012";
const ACTION_CLASS_ID = "clac1234567890123456789012";
const OTHER_ACTION_CLASS_ID = "clad1234567890123456789012";
const UNKNOWN_ID = "clun1234567890123456789012";

type TWorkspaceSurvey = TDestinationSurveyFacts & { workspaceId: string };

const surveyFacts = (id: string, overrides: Partial<TWorkspaceSurvey> = {}): TWorkspaceSurvey => ({
  id,
  name: `Survey ${id.slice(0, 5)}`,
  type: "app",
  status: "inProgress",
  archivedAt: null,
  singleUse: { enabled: false, isEncrypted: true },
  pin: null,
  visibility: "workspace",
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
  workspaceId: WORKSPACE_ID,
  ...overrides,
});

const SURVEYS = new Map(
  [
    surveyFacts(APP_SURVEY_ID, { name: "Site feedback" }),
    surveyFacts(LINK_SURVEY_ID, { name: "Exit survey", type: "link" }),
    surveyFacts(PAUSED_SURVEY_ID, { status: "paused" }),
    surveyFacts(RESTRICTED_SURVEY_ID, { visibility: "restricted" }),
    surveyFacts(SINGLE_USE_SURVEY_ID, { type: "link", singleUse: { enabled: true, isEncrypted: true } }),
    surveyFacts(PIN_SURVEY_ID, { type: "link", pin: "1234" }),
    // A grant to the whole workspace not yet acknowledged by the graph still counts as Restricted.
    surveyFacts(PENDING_SURVEY_ID, { visibilityVersion: 2, visibilityProjectedVersion: 1 }),
    surveyFacts(FOREIGN_SURVEY_ID, { workspaceId: OTHER_WORKSPACE_ID }),
  ].map((survey) => [survey.id, survey])
);
const ACTION_CLASS_IDS = new Set([ACTION_CLASS_ID, OTHER_ACTION_CLASS_ID]);

type TStoredLanguage = TCreativeRecord["languages"][number];

// ---- An in-memory repository: the storage boundary the creative rules talk to. ----
const store = new Map<string, TCreativeRecord>();
let nextId = 0;

const toLanguages = (languages: NonNullable<TCreativeWriteData["languages"]>): TStoredLanguage[] =>
  languages.map(({ languageId, default: isDefault, enabled }) => ({
    default: isDefault,
    enabled,
    language: { code: languageId.replace("lang_", "") },
  }));

const withRelations = (record: TCreativeRecord): TCreativeRecord => {
  const survey = record.surveyId ? SURVEYS.get(record.surveyId) : undefined;
  if (survey) {
    const { workspaceId: _workspaceId, ...facts } = survey;
    return { ...record, survey: facts };
  }
  return { ...record, survey: null };
};

vi.mock("@/modules/creatives/lib/repository", () => ({
  findCreativeWorkspaceId: vi.fn(async (id: string) => store.get(id)?.workspaceId ?? null),
  findCreativeRecord: vi.fn(async (id: string, workspaceId: string) => {
    const record = store.get(id);
    return record && record.workspaceId === workspaceId ? withRelations(record) : null;
  }),
  findCreativeRecordsPage: vi.fn(async () => []),
  runInCreativeTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  lockDestinationSurvey: vi.fn(async (_tx: unknown, surveyId: string, workspaceId: string) => {
    const survey = SURVEYS.get(surveyId);
    if (survey?.workspaceId !== workspaceId) return null;
    const { workspaceId: _workspaceId, ...facts } = survey;
    return facts;
  }),
  findWorkspaceActionClassIds: vi.fn(async (_tx: unknown, _workspaceId: string, ids: string[]) =>
    ids.filter((id) => ACTION_CLASS_IDS.has(id))
  ),
  ensureCreativeLanguages: vi.fn(
    async (_workspaceId: string, languages: { code: string; default: boolean; enabled: boolean }[]) =>
      languages.map(({ code, default: isDefault, enabled }) => ({
        languageId: `lang_${code}`,
        default: isDefault,
        enabled,
      }))
  ),
  insertCreativeRecord: vi.fn(
    async (
      _tx: unknown,
      input: {
        workspaceId: string;
        type: TCreativeRecord["type"];
        createdBy: string | null;
      } & Required<TCreativeWriteData>
    ) => {
      nextId += 1;
      const now = new Date();
      const record: TCreativeRecord = {
        ...input.row,
        showConditions: input.row.showConditions ?? null,
        id: `clcr${String(nextId).padStart(22, "0")}`,
        createdAt: now,
        updatedAt: now,
        type: input.type,
        workspaceId: input.workspaceId,
        createdBy: input.createdBy,
        creator: input.createdBy ? { name: "Jane Doe" } : null,
        triggers: input.actionClassIds.map((actionClassId) => ({ actionClassId })),
        languages: toLanguages(input.languages),
        survey: null,
      } as TCreativeRecord;
      store.set(record.id, record);
      return withRelations(record);
    }
  ),
  replaceCreativeRecord: vi.fn(
    async (_tx: unknown, id: string, workspaceId: string, data: TCreativeWriteData) => {
      const current = store.get(id);
      if (current?.workspaceId !== workspaceId) throw new Error("not found");
      const record = {
        ...current,
        ...data.row,
        showConditions: data.row.showConditions ?? null,
        updatedAt: new Date(),
        ...(data.actionClassIds && {
          triggers: data.actionClassIds.map((actionClassId) => ({ actionClassId })),
        }),
        ...(data.languages && { languages: toLanguages(data.languages) }),
      } as TCreativeRecord;
      store.set(id, record);
      return withRelations(record);
    }
  ),
  deleteCreativeRecord: vi.fn(async (id: string) => {
    store.delete(id);
  }),
}));

const API_KEY: TV3Authentication = {
  type: "apiKey",
  apiKeyId: "clak1234567890123456789012",
  organizationId: ORGANIZATION_ID,
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TV3Authentication;
const SESSION: TV3Authentication = { user: { id: USER_ID }, expires: "2099-01-01" } as TV3Authentication;

const base = { authentication: API_KEY, requestId: "req_1", instance: "/api/v3/creatives" };

const grantAccess = () =>
  vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_auth, workspaceId) => ({
    workspaceId,
    organizationId: ORGANIZATION_ID,
  }));

const feedbackButton = (overrides: Record<string, unknown> = {}): TV3CreateCreativeBody =>
  ZV3CreateCreativeBody.parse({
    workspaceId: WORKSPACE_ID,
    name: "Site feedback tab",
    type: "feedbackButton",
    content: { label: { "en-US": "Feedback" }, icon: "messageSquare" },
    destination: { type: "survey", surveyId: APP_SURVEY_ID },
    ...overrides,
  });

const banner = (overrides: Record<string, unknown> = {}): TV3CreateCreativeBody =>
  ZV3CreateCreativeBody.parse({
    workspaceId: WORKSPACE_ID,
    name: "Maintenance notice",
    type: "banner",
    content: {
      message: { "en-US": [{ text: "Maintenance tonight." }] },
      button: null,
      dismissible: true,
      accessibleName: null,
    },
    ...overrides,
  });

const patch = (body: Record<string, unknown>): TV3PatchCreativeBody => ZV3PatchCreativeBody.parse(body);

const readBody = async (response: Response) => response.json();

const invalidParamNames = async (response: Response): Promise<string[]> =>
  ((await readBody(response)).invalid_params as { name: string }[]).map(({ name }) => name);

/** Creates a creative through the operation and returns its resource, checked against the contract. */
const created = async (body: TV3CreateCreativeBody) => {
  const response = await createV3Creative({ ...base, body });
  expect(response.status).toBe(201);
  const { data } = await readBody(response);
  expect(zCreativeResource.safeParse(data).error?.issues ?? []).toEqual([]);
  return data;
};

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  grantAccess();
});

describe("createV3Creative", () => {
  test("creates a draft feedback button with the default styling, opening its app survey as a popup", async () => {
    const response = await createV3Creative({ ...base, body: feedbackButton() });
    const { data } = await readBody(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/creatives/${data.id}`);
    expect(data).toMatchObject({
      type: "feedbackButton",
      status: "draft",
      displayStatus: "draft",
      displayStatusReason: null,
      publishedAt: null,
      archivedAt: null,
      creator: null,
      defaultLanguage: "en-US",
      languages: [{ code: "en-US", default: true, enabled: true }],
      destination: { type: "survey", surveyId: APP_SURVEY_ID, surveyName: "Site feedback", opensAs: "popup" },
      distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
      styling: { position: { desktop: { edge: "right", offset: 50 }, phone: null } },
      warnings: [],
    });
  });

  test("records the signed-in user as the creator", async () => {
    const response = await createV3Creative({ ...base, authentication: SESSION, body: feedbackButton() });

    expect((await readBody(response)).data.creator).toEqual({ name: "Jane Doe" });
  });

  test("publishes straight away when a status is given, stamping publishedAt", async () => {
    const data = await created(feedbackButton({ status: "inProgress" }));

    expect(data.status).toBe("inProgress");
    expect(data.displayStatus).toBe("active");
    expect(data.publishedAt).not.toBeNull();
  });

  test("a link survey opens in a new tab, as does a link", async () => {
    const survey = await created(
      feedbackButton({ destination: { type: "survey", surveyId: LINK_SURVEY_ID } })
    );
    const link = await created(
      feedbackButton({ destination: { type: "link", url: "https://example.com/help" } })
    );

    expect(survey.destination.opensAs).toBe("newTab");
    expect(link.destination).toEqual({ type: "link", url: "https://example.com/help", opensAs: "newTab" });
  });

  test("a published creative before its start is scheduled, and one whose survey is paused is paused with the reason", async () => {
    const scheduled = await created(
      feedbackButton({ status: "inProgress", schedule: { startAt: hoursFromNow(2), endAt: null } })
    );
    const pausedWithSurvey = await created(
      feedbackButton({ status: "inProgress", destination: { type: "survey", surveyId: PAUSED_SURVEY_ID } })
    );

    expect(scheduled.displayStatus).toBe("scheduled");
    expect(pausedWithSurvey).toMatchObject({
      displayStatus: "paused",
      displayStatusReason: "surveyNotActive",
    });
  });

  test.each([
    ["Restricted", RESTRICTED_SURVEY_ID],
    ["with a pending visibility change", PENDING_SURVEY_ID],
    ["single-use", SINGLE_USE_SURVEY_ID],
    ["PIN-protected", PIN_SURVEY_ID],
    ["in another workspace", FOREIGN_SURVEY_ID],
    ["unknown", UNKNOWN_ID],
  ])("refuses a %s survey as the Destination", async (_kind, surveyId) => {
    const response = await createV3Creative({
      ...base,
      body: feedbackButton({ destination: { type: "survey", surveyId } }),
    });
    const body = await readBody(response);

    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "destination.surveyId", code: "invalid_reference" }),
    ]);
    expect(insertCreativeRecord).not.toHaveBeenCalled();
  });

  test("publishing needs a Destination, a label and, when showing on an action, an action", async () => {
    const response = await createV3Creative({
      ...base,
      body: feedbackButton({
        status: "inProgress",
        destination: null,
        content: { label: { "en-US": "  " }, icon: null },
        distribution: { showOn: "action", triggers: [], conditions: null, displayPercentage: null },
      }),
    });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual([
      "destination",
      "content.label.en-US",
      "distribution.triggers",
    ]);
  });

  test("a draft may still lack them, and says so in its warnings", async () => {
    const data = await created(
      feedbackButton({
        destination: null,
        distribution: { showOn: "action", triggers: [], conditions: null, displayPercentage: null },
      })
    );

    expect(data.warnings.map(({ code }: { code: string }) => code)).toEqual([
      "destinationMissing",
      "actionMissing",
    ]);
  });

  test("texts must hold the default language and only declared ones", async () => {
    const response = await createV3Creative({
      ...base,
      body: feedbackButton({
        defaultLanguage: "de-DE",
        languages: [{ code: "fr-FR", enabled: true }],
        content: { label: { "en-US": "Feedback", "fr-FR": "Avis" }, icon: null },
      }),
    });
    const { invalid_params: invalidParams } = await readBody(response);

    expect(response.status).toBe(422);
    expect(invalidParams).toEqual([
      expect.objectContaining({ name: "content.label", code: "missing_translation" }),
      expect.objectContaining({ name: "content.label.en-US", code: "unsupported_locale" }),
    ]);
  });

  test("declared languages come back with the default first, and a missing translation is fine", async () => {
    const data = await created(
      feedbackButton({
        languages: [
          { code: "de-DE", enabled: false },
          { code: "es-US", enabled: true },
        ],
      })
    );

    expect(data.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: false },
      { code: "es-US", default: false, enabled: true },
    ]);
  });

  test("a banner without a button is a notice only and can't open anything", async () => {
    const notice = await created(banner({ status: "inProgress" }));
    const response = await createV3Creative({
      ...base,
      body: banner({ destination: { type: "link", url: "https://example.com" } }),
    });

    expect(notice).toMatchObject({ displayStatus: "active", destination: null, warnings: [] });
    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["destination"]);
  });

  test("a banner with a button needs a Destination to publish", async () => {
    const response = await createV3Creative({
      ...base,
      body: banner({
        status: "inProgress",
        content: {
          message: { "en-US": [{ text: "Tell us how we did" }] },
          button: { label: { "en-US": "Continue" } },
          dismissible: true,
          accessibleName: null,
        },
      }),
    });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["destination"]);
  });

  test("triggers must be the workspace's own actions, listed once, and only with showOn action", async () => {
    const unknown = await createV3Creative({
      ...base,
      body: feedbackButton({
        distribution: {
          showOn: "action",
          triggers: [{ actionClassId: ACTION_CLASS_ID }, { actionClassId: UNKNOWN_ID }],
          conditions: null,
          displayPercentage: null,
        },
      }),
    });
    const misplaced = await createV3Creative({
      ...base,
      body: feedbackButton({
        distribution: {
          showOn: "pageView",
          triggers: [{ actionClassId: ACTION_CLASS_ID }, { actionClassId: ACTION_CLASS_ID }],
          conditions: null,
          displayPercentage: null,
        },
      }),
    });

    expect(unknown.status).toBe(422);
    expect(await invalidParamNames(unknown)).toEqual(["distribution.triggers[1].actionClassId"]);
    expect(misplaced.status).toBe(422);
    expect(await invalidParamNames(misplaced)).toEqual([
      "distribution.triggers",
      "distribution.triggers[1].actionClassId",
    ]);
  });

  test("the schedule must end after it starts", async () => {
    const start = hoursFromNow(5);
    const response = await createV3Creative({
      ...base,
      body: feedbackButton({ schedule: { startAt: start, endAt: start } }),
    });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["schedule.endAt"]);
  });

  test("an empty Show when group is stored as no conditions", async () => {
    const data = await created(
      feedbackButton({
        distribution: {
          showOn: "pageView",
          triggers: [],
          conditions: { id: "k3m9q2w7e5r1t8y4u6i0o2p5", connector: "and", conditions: [] },
          displayPercentage: 50,
        },
      })
    );

    expect(data.distribution).toEqual({
      showOn: "pageView",
      triggers: [],
      conditions: null,
      displayPercentage: 50,
    });
  });

  test("needs read/write access to the workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await createV3Creative({ ...base, body: feedbackButton() });

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      API_KEY,
      WORKSPACE_ID,
      "readWrite",
      "req_1",
      "/api/v3/creatives"
    );
    expect(insertCreativeRecord).not.toHaveBeenCalled();
  });
});

describe("the route schemas", () => {
  test("refuse Show when conditions the shared rules reject, naming the condition", () => {
    const result = ZV3CreateCreativeBody.safeParse({
      workspaceId: WORKSPACE_ID,
      name: "Tab",
      type: "feedbackButton",
      content: { label: { "en-US": "Feedback" }, icon: null },
      distribution: {
        showOn: "pageView",
        triggers: [],
        conditions: {
          id: "k3m9q2w7e5r1t8y4u6i0o2p5",
          connector: "and",
          conditions: [
            {
              id: "x8c2v6b4n1m7q9w3e5r0t2y6",
              leftOperand: { type: "device", value: "deviceType" },
              operator: "contains",
              rightOperand: { type: "static", value: "phone" },
            },
          ],
        },
        displayPercentage: null,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map(({ path }) => path.slice(0, 2))).toEqual([
      ["distribution", "conditions"],
    ]);
  });

  test("refuse NULL bytes anywhere in a body, which PostgreSQL can't store", () => {
    expect(ZV3PatchCreativeBody.safeParse({ name: "Tab\u0000" }).success).toBe(false);
  });
});

describe("getV3Creative", () => {
  test("reads a creative through its own workspace, with read access", async () => {
    const { id } = await created(feedbackButton());
    vi.mocked(requireV3WorkspaceAccess).mockClear();

    const response = await getV3Creative({ ...base, creativeId: id });

    expect(response.status).toBe(200);
    expect((await readBody(response)).data.id).toBe(id);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      API_KEY,
      WORKSPACE_ID,
      "read",
      "req_1",
      base.instance
    );
  });

  test("an unknown creative answers the same 403 as one the caller can't see", async () => {
    const { id } = await created(feedbackButton());
    const unknown = await getV3Creative({ ...base, creativeId: UNKNOWN_ID });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(
      Response.json({ code: "forbidden" }, { status: 403 })
    );
    const hidden = await getV3Creative({ ...base, creativeId: id });

    expect(unknown.status).toBe(403);
    expect(hidden.status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledTimes(2);
  });
});

describe("patchV3Creative", () => {
  test("replaces each group it sends whole and leaves the others alone", async () => {
    const original = await created(
      feedbackButton({
        distribution: {
          showOn: "action",
          triggers: [{ actionClassId: ACTION_CLASS_ID }, { actionClassId: OTHER_ACTION_CLASS_ID }],
          conditions: null,
          displayPercentage: 25,
        },
        schedule: { startAt: hoursFromNow(1), endAt: null },
      })
    );

    const response = await patchV3Creative({
      ...base,
      creativeId: original.id,
      body: patch({
        name: "Renamed",
        distribution: {
          showOn: "action",
          triggers: [{ actionClassId: OTHER_ACTION_CLASS_ID }],
          conditions: null,
          displayPercentage: null,
        },
      }),
    });
    const { data } = await readBody(response);

    expect(response.status).toBe(200);
    expect(data.name).toBe("Renamed");
    expect(data.distribution).toEqual({
      showOn: "action",
      triggers: [{ actionClassId: OTHER_ACTION_CLASS_ID }],
      conditions: null,
      displayPercentage: null,
    });
    expect(data.schedule).toEqual(original.schedule);
    expect(data.content).toEqual(original.content);
    expect(data.destination).toEqual(original.destination);
  });

  test("refuses content or styling of the other type: a creative's type never changes", async () => {
    const { id } = await created(feedbackButton());

    const response = await patchV3Creative({
      ...base,
      creativeId: id,
      body: patch({
        content: {
          message: { "en-US": [{ text: "Hi" }] },
          button: null,
          dismissible: false,
          accessibleName: null,
        },
        styling: {
          position: { desktop: { placement: "bottom", layout: "overlay" }, phone: null },
          theme: {
            customStyles: false,
            backgroundColor: null,
            textColor: null,
            borderColor: null,
            fontWeight: null,
            fontSize: { desktop: null, phone: null },
            paddingX: { desktop: null, phone: null },
            paddingY: { desktop: null, phone: null },
          },
        },
      }),
    });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["content", "styling"]);
    expect(replaceCreativeRecord).not.toHaveBeenCalled();
  });

  test("publishes, pauses, closes and reopens through status, keeping the first publish time", async () => {
    const { id } = await created(feedbackButton());
    const statusAfter = async (status: string) => {
      const response = await patchV3Creative({ ...base, creativeId: id, body: patch({ status }) });
      expect(response.status).toBe(200);
      return (await readBody(response)).data;
    };

    const published = await statusAfter("inProgress");
    const paused = await statusAfter("paused");
    const closed = await statusAfter("completed");
    const reopened = await statusAfter("inProgress");

    expect([published, paused, closed, reopened].map(({ displayStatus }) => displayStatus)).toEqual([
      "active",
      "paused",
      "closed",
      "active",
    ]);
    expect(reopened.publishedAt).toBe(published.publishedAt);
  });

  test("a published creative can't go back to Draft", async () => {
    const { id } = await created(feedbackButton({ status: "inProgress" }));

    const response = await patchV3Creative({ ...base, creativeId: id, body: patch({ status: "draft" }) });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["status"]);
  });

  test("checks the publish rules against the creative as it would be after the change", async () => {
    const { id } = await created(feedbackButton({ status: "inProgress" }));

    const response = await patchV3Creative({ ...base, creativeId: id, body: patch({ destination: null }) });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["destination"]);
  });

  test("checks a survey being linked, but not one already linked when something else changes", async () => {
    const { id } = await created(feedbackButton({ status: "inProgress" }));
    const relink = await patchV3Creative({
      ...base,
      creativeId: id,
      body: patch({ destination: { type: "survey", surveyId: RESTRICTED_SURVEY_ID } }),
    });
    // The stored survey turns Restricted afterwards (it can't through the app, but a stored link must
    // never block an unrelated edit); the resource warns instead.
    store.set(id, { ...store.get(id)!, surveyId: RESTRICTED_SURVEY_ID });
    const rename = await patchV3Creative({ ...base, creativeId: id, body: patch({ name: "Renamed" }) });

    expect(relink.status).toBe(422);
    expect(await invalidParamNames(relink)).toEqual(["destination.surveyId"]);
    expect(rename.status).toBe(200);
    expect((await readBody(rename)).data.warnings).toEqual([
      expect.objectContaining({ code: "destinationNotAllowed" }),
    ]);
  });

  test("an archived creative is read-only until restored", async () => {
    const { id } = await created(feedbackButton());
    await archiveV3Creative({ ...base, creativeId: id });

    const response = await patchV3Creative({ ...base, creativeId: id, body: patch({ name: "Renamed" }) });

    expect(response.status).toBe(422);
    expect(await invalidParamNames(response)).toEqual(["archivedAt"]);
  });

  test("an empty patch changes nothing", async () => {
    const original = await created(feedbackButton());

    const response = await patchV3Creative({ ...base, creativeId: original.id, body: patch({}) });

    expect(response.status).toBe(200);
    expect((await readBody(response)).data.updatedAt).toBe(original.updatedAt);
    expect(replaceCreativeRecord).not.toHaveBeenCalled();
  });

  test("needs read/write access", async () => {
    const { id } = await created(feedbackButton());
    vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_auth, _workspaceId, permission) =>
      permission === "read"
        ? { workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID }
        : Response.json({ code: "forbidden" }, { status: 403 })
    );

    const response = await patchV3Creative({ ...base, creativeId: id, body: patch({ name: "Renamed" }) });

    expect(response.status).toBe(403);
    expect(replaceCreativeRecord).not.toHaveBeenCalled();
  });
});

describe("archiveV3Creative and restoreV3Creative", () => {
  test("archiving keeps the status; restoring brings it back as it was", async () => {
    const { id } = await created(feedbackButton({ status: "inProgress" }));

    const archived = (await readBody(await archiveV3Creative({ ...base, creativeId: id }))).data;
    const restored = (await readBody(await restoreV3Creative({ ...base, creativeId: id }))).data;

    expect(archived).toMatchObject({ status: "inProgress", displayStatus: "archived" });
    expect(archived.archivedAt).not.toBeNull();
    expect(restored).toMatchObject({ status: "inProgress", displayStatus: "active", archivedAt: null });
  });

  test("a creative whose survey was unlinked while archived comes back as a Draft", async () => {
    const { id } = await created(feedbackButton({ status: "inProgress" }));
    await archiveV3Creative({ ...base, creativeId: id });
    store.set(id, { ...store.get(id)!, surveyId: null });

    const restored = (await readBody(await restoreV3Creative({ ...base, creativeId: id }))).data;

    expect(restored).toMatchObject({
      status: "draft",
      displayStatus: "draft",
      destination: null,
      warnings: [expect.objectContaining({ code: "destinationMissing" })],
    });
  });

  test("a survey that can no longer be a Destination is unlinked on restore, and it comes back as a Draft", async () => {
    const { id } = await created(feedbackButton({ status: "paused" }));
    await archiveV3Creative({ ...base, creativeId: id });
    store.set(id, { ...store.get(id)!, surveyId: PIN_SURVEY_ID });

    const restored = (await readBody(await restoreV3Creative({ ...base, creativeId: id }))).data;

    expect(restored).toMatchObject({ status: "draft", destination: null });
  });

  test("a notice-only banner needs no Destination and keeps its status", async () => {
    const { id } = await created(banner({ status: "inProgress" }));
    await archiveV3Creative({ ...base, creativeId: id });

    const restored = (await readBody(await restoreV3Creative({ ...base, creativeId: id }))).data;

    expect(restored).toMatchObject({ status: "inProgress", displayStatus: "active" });
  });
});

describe("duplicateV3Creative", () => {
  test("copies a creative into a new, unarchived Draft created by the caller", async () => {
    const source = await created(feedbackButton({ status: "inProgress" }));
    await archiveV3Creative({ ...base, creativeId: source.id });

    const response = await duplicateV3Creative({ ...base, authentication: SESSION, creativeId: source.id });
    const { data } = await readBody(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/creatives/${data.id}`);
    expect(data.id).not.toBe(source.id);
    expect(data).toMatchObject({
      name: "Site feedback tab (copy)",
      status: "draft",
      displayStatus: "draft",
      publishedAt: null,
      archivedAt: null,
      creator: { name: "Jane Doe" },
      content: source.content,
      styling: source.styling,
      destination: source.destination,
    });
  });

  test("leaves out a survey that can no longer be a Destination", async () => {
    const source = await created(feedbackButton());
    store.set(source.id, { ...store.get(source.id)!, surveyId: SINGLE_USE_SURVEY_ID });

    const { data } = await readBody(await duplicateV3Creative({ ...base, creativeId: source.id }));

    expect(data.destination).toBeNull();
    expect(data.warnings).toEqual([expect.objectContaining({ code: "destinationMissing" })]);
  });
});

describe("deleteV3Creative", () => {
  test("deletes the creative for good", async () => {
    const { id } = await created(feedbackButton());

    const response = await deleteV3Creative({ ...base, creativeId: id });

    expect(response.status).toBe(204);
    expect((await getV3Creative({ ...base, creativeId: id })).status).toBe(403);
  });

  test("an unknown creative answers 403", async () => {
    expect((await deleteV3Creative({ ...base, creativeId: UNKNOWN_ID })).status).toBe(403);
  });
});

describe("listV3Creatives", () => {
  const list = (query: string) =>
    listV3Creatives({ ...base, searchParams: new URLSearchParams(`workspaceId=${WORKSPACE_ID}&${query}`) });

  test("passes the filters to the page query and hands back a cursor when more rows follow", async () => {
    const first = await created(feedbackButton({ name: "A" }));
    const second = await created(feedbackButton({ name: "B" }));
    vi.mocked(findCreativeRecordsPage).mockResolvedValue([store.get(first.id)!, store.get(second.id)!]);

    const response = await list(
      "limit=1&sortBy=name&filter[name][contains]=feed&filter[type][in]=feedbackButton&filter[displayStatus][in]=paused,archived&surveyId=" +
        APP_SURVEY_ID
    );
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body.data.map(({ id }: { id: string }) => id)).toEqual([first.id]);
    expect(body.meta).toEqual({ limit: 1, nextCursor: expect.any(String) });
    expect(findCreativeRecordsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        sortBy: "name",
        take: 2,
        after: null,
        name: "feed",
        types: ["feedbackButton"],
        displayStatuses: ["paused", "archived"],
        surveyId: APP_SURVEY_ID,
      })
    );

    vi.mocked(findCreativeRecordsPage).mockClear();
    const next = await list(
      `limit=1&sortBy=name&filter[name][contains]=feed&filter[type][in]=feedbackButton&filter[displayStatus][in]=paused,archived&surveyId=${APP_SURVEY_ID}&cursor=${body.meta.nextCursor}`
    );
    expect(next.status).toBe(200);
    expect(findCreativeRecordsPage).toHaveBeenCalledWith(
      expect.objectContaining({ after: { value: "A", id: first.id } })
    );
  });

  test("the last page has no cursor", async () => {
    const only = await created(feedbackButton());
    vi.mocked(findCreativeRecordsPage).mockResolvedValue([store.get(only.id)!]);

    expect((await readBody(await list(""))).meta).toEqual({ limit: 20, nextCursor: null });
  });

  test.each([
    ["an unknown parameter", "status=draft", "status"],
    ["an unknown display status", "filter[displayStatus][in]=live", "filter[displayStatus][in].0"],
    ["a limit above the maximum", "limit=251", "limit"],
    ["a cursor that was never issued", "cursor=bm90LWEtY3Vyc29y", "cursor"],
  ])("answers 400 for %s", async (_name, query, param) => {
    const response = await list(query);

    expect(response.status).toBe(400);
    expect(await invalidParamNames(response)).toEqual([param]);
    expect(findCreativeRecordsPage).not.toHaveBeenCalled();
  });

  test("needs read access to the workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(Response.json({}, { status: 403 }));

    const response = await list("");

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      API_KEY,
      WORKSPACE_ID,
      "read",
      "req_1",
      base.instance
    );
    expect(findCreativeRecordsPage).not.toHaveBeenCalled();
  });
});
