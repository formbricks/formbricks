import { beforeEach, describe, expect, test, vi } from "vitest";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import { getCreativesAccess } from "@/modules/ee/creatives/lib/access";
import { DEFAULT_CREATIVE_STYLING } from "@/modules/ee/creatives/lib/creative";
import {
  type TCreativeRecord,
  type TCreativeWriteData,
  type TDestinationSurveyFacts,
  findCreativeRecord,
  replaceCreativeRecord,
} from "@/modules/ee/creatives/lib/repository";
import { creativeDocumentAdapter } from "./document-adapter";
import { archiveV3Creative, createV3Creative, patchV3Creative } from "./operations";
import type { TV3CreateCreativeBody } from "./schemas";
import { ZV3CreateCreativeBody, ZV3PatchCreativeBody } from "./schemas";

/**
 * The creative document adapter behind `pull_document` / `push_document` and
 * `/api/v3/creatives/{id}/document`. Storage is the same in-memory fake of the repository the operation
 * tests use, so every assertion is on what a caller sees: the status code and the document or problem.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  getV3SessionUserId: (await importOriginal<typeof import("@/app/api/v3/lib/auth")>()).getV3SessionUserId,
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/modules/custom-css/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/custom-css/lib/access")>()),
  getCustomCssPlanAllowed: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/app/api/v3/lib/audit", () => ({ queueV3AuditLog: vi.fn(), skipV3AuditLog: vi.fn() }));
// The instance's licence (ENG-6602): `full` unless a test says otherwise.
vi.mock("@/modules/ee/creatives/lib/access", () => ({ getCreativesAccess: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws1234567890123456789012";
const OTHER_WORKSPACE_ID = "clwo1234567890123456789012";
const ORGANIZATION_ID = "clor1234567890123456789012";
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

vi.mock("@/modules/ee/creatives/lib/repository", () => ({
  findCreativeWorkspaceId: vi.fn(async (id: string) => store.get(id)?.workspaceId ?? null),
  findCreativeRecord: vi.fn(async (id: string, workspaceId: string) => {
    const record = store.get(id);
    return record && record.workspaceId === workspaceId ? withRelations(record) : null;
  }),
  // The fake has no locks: the row read "under the lock" is simply what is stored when the write runs.
  lockCreativeRecord: vi.fn(async (_tx: unknown, id: string, workspaceId: string) => {
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
    async (
      _tx: unknown,
      _workspaceId: string,
      languages: { code: string; default: boolean; enabled: boolean }[]
    ) =>
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
  updateCreativeLifecycleColumns: vi.fn(
    async (_tx: unknown, id: string, workspaceId: string, columns: Partial<TCreativeRecord>) => {
      const current = store.get(id);
      if (current?.workspaceId !== workspaceId) throw new Error("not found");
      const record = { ...current, ...columns, updatedAt: new Date() } as TCreativeRecord;
      store.set(id, record);
      return withRelations(record);
    }
  ),
  // The selection itself is the database's; `repository.integration.test.ts` proves it against Postgres.
  pauseSurveyCreativeRecords: vi.fn(async (_tx: unknown, surveyId: string, workspaceId: string) => {
    const paused = [...store.values()].filter(
      (record) =>
        record.surveyId === surveyId &&
        record.workspaceId === workspaceId &&
        record.archivedAt === null &&
        record.status === "inProgress"
    );
    for (const record of paused) {
      store.set(record.id, { ...record, status: "paused", updatedAt: new Date() });
    }
    return paused.map(({ id }) => id);
  }),
  deleteCreativeRecord: vi.fn(async (id: string) => {
    store.delete(id);
  }),
  findOpenedSurveyFacts: vi.fn(
    async (_tx: unknown, surveyId: string, workspaceId: string, creativeId: string) => {
      const survey = SURVEYS.get(surveyId);
      if (survey?.workspaceId !== workspaceId) return null;
      return {
        type: survey.type,
        status: survey.status,
        triggerCount: 0,
        otherOpenerCount: [...store.values()].filter(
          (record) => record.surveyId === surveyId && record.archivedAt === null && record.id !== creativeId
        ).length,
      };
    }
  ),
}));

vi.mock("@/modules/ee/creatives/lib/stats-repository", () => ({
  findCreativeDayDeviceCounts: vi.fn(),
  findCreativePageCounts: vi.fn(),
}));

const API_KEY: TV3Authentication = {
  type: "apiKey",
  apiKeyId: "clak1234567890123456789012",
  organizationId: ORGANIZATION_ID,
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TV3Authentication;

const base = {
  authentication: API_KEY,
  requestId: "req_1",
  instance: "/api/v3/creatives/document",
};

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
      message: { "en-US": [{ text: "Tell us how we did" }] },
      button: { label: { "en-US": "Continue" } },
      dismissible: true,
      accessibleName: null,
    },
    destination: { type: "link", url: "https://example.com/help" },
    ...overrides,
  });

const readBody = async (response: Response) => response.json();

type TDocument = Record<string, unknown>;
type TEnvelope = {
  kind: string;
  schemaVersion: number;
  id: string;
  workspaceId: string;
  updatedAt: string;
  document: TDocument;
};
type TPushResult = { envelope: TEnvelope; dryRun: boolean; changes: { path: string; change: string }[] };

const created = async (body: TV3CreateCreativeBody): Promise<{ id: string }> => {
  const response = await createV3Creative({ ...base, body });
  expect(response.status).toBe(201);
  return (await readBody(response)).data;
};

const pull = async (id: string): Promise<TEnvelope> => {
  const response = await creativeDocumentAdapter.pull({ ...base, id });
  expect(response.status).toBe(200);
  return (await readBody(response)).data;
};

const push = (
  id: string,
  document: TDocument,
  options: {
    expectedUpdatedAt: string;
    dryRun?: boolean;
    confirmDestructive?: boolean;
    auditLog?: TV3AuditLog;
  }
) =>
  creativeDocumentAdapter.push({
    ...base,
    id,
    document,
    dryRun: false,
    confirmDestructive: false,
    ...options,
  });

/** Pulls the creative and pushes `edit` of its document back with the pulled `updatedAt`. */
const pushEdit = async (
  id: string,
  edit: (document: TDocument) => TDocument,
  options: { dryRun?: boolean; confirmDestructive?: boolean; auditLog?: TV3AuditLog } = {}
) => {
  const envelope = await pull(id);
  return push(id, edit(envelope.document), { expectedUpdatedAt: envelope.updatedAt, ...options });
};

const invalidParamNames = async (response: Response): Promise<string[]> =>
  ((await readBody(response)).invalid_params as { name: string }[]).map(({ name }) => name);

const READ_AT = new Date("2026-10-16T09:30:00.000Z");
/** Stamps the stored creative with a fixed `updatedAt`, so a write made now is told apart from it. */
const stampUpdatedAt = (id: string, updatedAt = READ_AT) => store.set(id, { ...store.get(id)!, updatedAt });

const customStyling = {
  ...DEFAULT_CREATIVE_STYLING.feedbackButton,
  position: { desktop: { edge: "left", offset: 60 }, phone: null },
};

/** A published feedback button with every group set to something other than its default. */
const liveCreative = () =>
  created(
    feedbackButton({
      status: "inProgress",
      languages: [{ code: "es-US", enabled: true }],
      content: { label: { "en-US": "Feedback", "es-US": "Comentarios" }, icon: "messageSquare" },
      styling: customStyling,
      distribution: {
        showOn: "action",
        triggers: [{ actionClassId: ACTION_CLASS_ID }],
        conditions: null,
        displayPercentage: 40,
      },
      schedule: { startAt: "2026-11-01T02:00:00.000Z", endAt: null },
    })
  );

const draftCreative = () =>
  created(
    feedbackButton({
      languages: [{ code: "es-US", enabled: true }],
      content: { label: { "en-US": "Feedback", "es-US": "Comentarios" }, icon: "messageSquare" },
      styling: customStyling,
      distribution: {
        showOn: "action",
        triggers: [{ actionClassId: ACTION_CLASS_ID }],
        conditions: null,
        displayPercentage: 40,
      },
      schedule: { startAt: "2026-11-01T02:00:00.000Z", endAt: null },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  grantAccess();
  vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);
  vi.mocked(getCreativesAccess).mockResolvedValue("full");
});

describe("pull", () => {
  test("answers the envelope with the editable state only", async () => {
    const { id } = await liveCreative();

    const envelope = await pull(id);

    expect(envelope).toMatchObject({
      kind: "creative",
      schemaVersion: 1,
      id,
      workspaceId: WORKSPACE_ID,
      updatedAt: store.get(id)?.updatedAt.toISOString(),
    });
    expect(envelope.document).toEqual({
      type: "feedbackButton",
      name: "Site feedback tab",
      defaultLanguage: "en-US",
      languages: [{ code: "es-US", enabled: true }],
      content: { label: { "en-US": "Feedback", "es-US": "Comentarios" }, icon: "messageSquare" },
      styling: customStyling,
      destination: { type: "survey", surveyId: APP_SURVEY_ID },
      distribution: {
        showOn: "action",
        triggers: [{ actionClassId: ACTION_CLASS_ID }],
        conditions: null,
        displayPercentage: 40,
      },
      schedule: { startAt: "2026-11-01T02:00:00.000Z", endAt: null },
    });
  });

  test.each([
    "id",
    "workspaceId",
    "status",
    "displayStatus",
    "displayStatusReason",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "archivedAt",
    "creator",
    "warnings",
  ])("leaves the server-owned %s out of the document", async (field) => {
    const { id } = await liveCreative();

    expect((await pull(id)).document).not.toHaveProperty(field);
  });

  test("reads in wind-down, as the creative itself can be read", async () => {
    const { id } = await liveCreative();
    vi.mocked(getCreativesAccess).mockResolvedValue("windDown");

    expect((await creativeDocumentAdapter.pull({ ...base, id })).status).toBe(200);
  });

  test("an unknown id answers 403, like an id from a workspace the caller cannot see", async () => {
    const other = await created({ ...feedbackButton(), workspaceId: OTHER_WORKSPACE_ID, destination: null });
    vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_auth, workspaceId) =>
      workspaceId === OTHER_WORKSPACE_ID
        ? new Response(null, { status: 403 })
        : { workspaceId, organizationId: ORGANIZATION_ID }
    );

    expect((await creativeDocumentAdapter.pull({ ...base, id: UNKNOWN_ID })).status).toBe(403);
    expect((await creativeDocumentAdapter.pull({ ...base, id: other.id })).status).toBe(403);
  });
});

describe("push", () => {
  test("a pulled document pushed back unchanged changes nothing: no write, no audit, same updatedAt", async () => {
    const { id } = await liveCreative();
    const envelope = await pull(id);
    const auditLog = { action: "updated", targetType: "creative" } as unknown as TV3AuditLog;

    const response = await push(id, envelope.document, { expectedUpdatedAt: envelope.updatedAt, auditLog });
    const { data } = (await readBody(response)) as { data: TPushResult };

    expect(response.status).toBe(200);
    expect(data.changes).toEqual([]);
    expect(data.dryRun).toBe(false);
    expect(data.envelope).toEqual(envelope);
    expect(replaceCreativeRecord).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    expect(auditLog).not.toHaveProperty("newObject");
  });

  test("replaces: what the document omits resets to its default, and the status is left alone", async () => {
    const { id } = await draftCreative();
    const before = await pull(id);

    const response = await pushEdit(id, () => ({
      type: "feedbackButton",
      name: "Reset",
      content: { label: { "en-US": "Feedback" }, icon: null },
    }));
    const { data } = (await readBody(response)) as { data: TPushResult };

    expect(response.status).toBe(200);
    expect(data.changes).toEqual(
      ["content", "destination", "distribution", "languages", "name", "schedule", "styling"].map((path) => ({
        path,
        change: "changed",
      }))
    );
    expect(data.envelope.document).toEqual({
      type: "feedbackButton",
      name: "Reset",
      defaultLanguage: "en-US",
      languages: [],
      content: { label: { "en-US": "Feedback" }, icon: null },
      styling: DEFAULT_CREATIVE_STYLING.feedbackButton,
      destination: null,
      distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
      schedule: { startAt: null, endAt: null },
    });
    expect(await pull(id)).toMatchObject({
      document: data.envelope.document,
      updatedAt: data.envelope.updatedAt,
    });
    expect(store.get(id)).toMatchObject({ status: "draft", publishedAt: null, archivedAt: null });
    expect(before.document).not.toEqual(data.envelope.document);
  });

  test("a push that changes one field reports just that field", async () => {
    const { id } = await liveCreative();

    const response = await pushEdit(id, (document) => ({ ...document, name: "Renamed" }));

    expect(response.status).toBe(200);
    expect((await readBody(response)).data.changes).toEqual([{ path: "name", change: "changed" }]);
    expect(store.get(id)).toMatchObject({ name: "Renamed", status: "inProgress" });
  });

  test("never publishes: a draft stays a draft however the document is shaped", async () => {
    const { id } = await draftCreative();

    await pushEdit(id, (document) => ({ ...document, name: "Renamed" }));

    expect(store.get(id)).toMatchObject({ status: "draft", publishedAt: null });
  });

  test("records the change as an update, before and after, on the wrapper's audit entry", async () => {
    const { id } = await liveCreative();
    const auditLog = { action: "updated", targetType: "creative" } as unknown as TV3AuditLog;

    await pushEdit(id, (document) => ({ ...document, name: "Renamed" }), { auditLog });

    expect(auditLog).toMatchObject({
      organizationId: ORGANIZATION_ID,
      targetId: id,
      oldObject: { name: "Site feedback tab" },
      newObject: { name: "Renamed" },
    });
    expect(skipV3AuditLog).not.toHaveBeenCalled();
  });

  describe("validation", () => {
    test.each([
      ["status", { status: "paused" }],
      ["workspaceId", { workspaceId: WORKSPACE_ID }],
      ["id", { id: "clcr1234567890123456789012" }],
      ["bogus", { bogus: true }],
    ])("refuses the key %s with a 422 naming it, and writes nothing", async (key, extra) => {
      const { id } = await liveCreative();

      const response = await pushEdit(id, (document) => ({ ...document, ...extra }));

      expect(response.status).toBe(422);
      expect(await invalidParamNames(response)).toEqual([key]);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });

    test("a creative's type never changes", async () => {
      const { id } = await liveCreative();

      const response = await pushEdit(id, () => ({
        type: "banner",
        name: "Notice",
        content: {
          message: { "en-US": [{ text: "Hello" }] },
          button: null,
          dismissible: true,
          accessibleName: null,
        },
      }));

      expect(response.status).toBe(422);
      expect(await invalidParamNames(response)).toEqual(["type"]);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });

    test("a published creative keeps meeting the publish rules", async () => {
      const { id } = await liveCreative();

      const response = await pushEdit(id, (document) => ({
        ...document,
        content: { label: { "en-US": "  ", "es-US": "Comentarios" }, icon: null },
      }));

      expect(response.status).toBe(422);
      expect(await invalidParamNames(response)).toEqual(["content.label.en-US"]);
    });

    test.each([
      [
        "a survey in another workspace",
        { destination: { type: "survey", surveyId: FOREIGN_SURVEY_ID } },
        "destination.surveyId",
      ],
      [
        "a Restricted survey",
        { destination: { type: "survey", surveyId: RESTRICTED_SURVEY_ID } },
        "destination.surveyId",
      ],
      [
        "an action that does not exist",
        {
          distribution: {
            showOn: "action",
            triggers: [{ actionClassId: UNKNOWN_ID }],
            conditions: null,
            displayPercentage: null,
          },
        },
        "distribution.triggers[0].actionClassId",
      ],
    ])("checks references as the PATCH does: %s", async (_name, edit, param) => {
      const { id } = await draftCreative();

      const response = await pushEdit(id, (document) => ({ ...document, ...edit }));

      expect(response.status).toBe(422);
      expect(await invalidParamNames(response)).toEqual([param]);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });

    test("an archived creative is read-only: restore it first", async () => {
      const { id } = await liveCreative();
      await archiveV3Creative({ ...base, creativeId: id });

      const response = await pushEdit(id, (document) => ({ ...document, name: "Renamed" }));

      expect(response.status).toBe(422);
      expect(await invalidParamNames(response)).toEqual(["archivedAt"]);
    });
  });

  describe("access", () => {
    test("needs read/write access to the workspace, and the full licence", async () => {
      const { id } = await liveCreative();
      const envelope = await pull(id);
      vi.mocked(requireV3WorkspaceAccess).mockClear();

      await push(id, envelope.document, { expectedUpdatedAt: envelope.updatedAt });

      expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
        API_KEY,
        WORKSPACE_ID,
        "readWrite",
        expect.any(String),
        expect.any(String)
      );
    });

    test.each([
      ["windDown", /existing creatives can only be listed, read, paused, closed or deleted/],
      ["none", /^Creatives is not available on this instance$/],
    ] as const)(
      "under the %s licence a push answers 403 creatives_not_entitled and writes nothing",
      async (access, detail) => {
        const { id } = await liveCreative();
        const envelope = await pull(id);
        vi.mocked(getCreativesAccess).mockResolvedValue(access);

        const response = await push(
          id,
          { ...envelope.document, name: "Renamed" },
          { expectedUpdatedAt: envelope.updatedAt }
        );

        expect(response.status).toBe(403);
        expect(await readBody(response)).toMatchObject({
          code: "creatives_not_entitled",
          detail: expect.stringMatching(detail),
        });
        expect(replaceCreativeRecord).not.toHaveBeenCalled();
      }
    );

    test("an unknown id, or one the caller cannot reach, answers 403 and writes nothing", async () => {
      const other = await created({
        ...feedbackButton(),
        workspaceId: OTHER_WORKSPACE_ID,
        destination: null,
      });
      const otherEnvelope = await pull(other.id);
      vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_auth, workspaceId) =>
        workspaceId === OTHER_WORKSPACE_ID
          ? new Response(null, { status: 403 })
          : { workspaceId, organizationId: ORGANIZATION_ID }
      );

      const unknown = await push(UNKNOWN_ID, otherEnvelope.document, {
        expectedUpdatedAt: otherEnvelope.updatedAt,
      });
      const foreign = await push(
        other.id,
        { ...otherEnvelope.document, name: "Hijacked" },
        { expectedUpdatedAt: otherEnvelope.updatedAt }
      );

      expect([unknown.status, foreign.status]).toEqual([403, 403]);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });
  });

  describe("expectedUpdatedAt", () => {
    test("applies the push when the creative is as it was pulled", async () => {
      const { id } = await liveCreative();
      stampUpdatedAt(id);

      const response = await push(
        id,
        { ...(await pull(id)).document, name: "Renamed" },
        { expectedUpdatedAt: READ_AT.toISOString() }
      );

      expect(response.status).toBe(200);
      expect(store.get(id)?.name).toBe("Renamed");
    });

    test("answers 409 naming both times when the creative changed since, and writes nothing", async () => {
      const { id } = await liveCreative();
      stampUpdatedAt(id, new Date("2026-10-16T09:45:00.000Z"));
      const envelope = await pull(id);

      const response = await push(
        id,
        { ...envelope.document, name: "Renamed" },
        { expectedUpdatedAt: READ_AT.toISOString() }
      );

      expect(response.status).toBe(409);
      expect(await readBody(response)).toMatchObject({
        code: "conflict",
        details: { expectedUpdatedAt: READ_AT.toISOString(), currentUpdatedAt: "2026-10-16T09:45:00.000Z" },
      });
      expect(store.get(id)?.name).toBe("Site feedback tab");
    });

    test("a stale push fails even when its document would change nothing", async () => {
      const { id } = await liveCreative();
      const envelope = await pull(id);
      stampUpdatedAt(id, new Date("2026-10-16T09:45:00.000Z"));

      const response = await push(id, envelope.document, { expectedUpdatedAt: READ_AT.toISOString() });

      expect(response.status).toBe(409);
    });

    test("is compared on the row read under the write's lock, so two pushes cannot both win", async () => {
      const { id } = await liveCreative();
      stampUpdatedAt(id);
      const envelope = await pull(id);
      // A second writer commits after this push has authorized and read the creative, before it locks it.
      vi.mocked(findCreativeRecord).mockImplementationOnce(
        async (creativeId: string, workspaceId: string) => {
          const stored = store.get(creativeId);
          const read = stored?.workspaceId === workspaceId ? { ...stored, survey: null } : null;
          await patchV3Creative({
            ...base,
            creativeId,
            body: ZV3PatchCreativeBody.parse({ name: "Second writer" }),
          });
          return read as TCreativeRecord | null;
        }
      );

      const response = await push(
        id,
        { ...envelope.document, name: "First writer" },
        { expectedUpdatedAt: envelope.updatedAt }
      );

      expect(response.status).toBe(409);
      expect(await readBody(response)).toMatchObject({
        details: { expectedUpdatedAt: envelope.updatedAt, currentUpdatedAt: expect.any(String) },
      });
      expect(store.get(id)?.name).toBe("Second writer");
    });
  });

  describe("destructive changes", () => {
    const toLink = (document: TDocument): TDocument => ({
      ...document,
      destination: { type: "link", url: "https://example.com/help" },
    });

    test("a live creative cannot change its destination without confirmation", async () => {
      const { id } = await liveCreative();

      const response = await pushEdit(id, toLink);

      expect(response.status).toBe(409);
      expect(await readBody(response)).toMatchObject({
        code: "conflict",
        details: {
          reason: "destructive_change",
          changes: [
            { type: "destination_changed", ids: [APP_SURVEY_ID] },
            { type: "survey_left_unopened", ids: [APP_SURVEY_ID] },
          ],
        },
      });
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });

    test("with confirmDestructive the same push applies", async () => {
      const { id } = await liveCreative();

      const response = await pushEdit(id, toLink, { confirmDestructive: true });

      expect(response.status).toBe(200);
      expect(store.get(id)).toMatchObject({
        surveyId: null,
        linkUrl: "https://example.com/help",
      });
    });

    test("a survey another creative still opens is not left unopened", async () => {
      const { id } = await liveCreative();
      await created(feedbackButton({ name: "Another opener" }));

      const response = await pushEdit(id, toLink);

      expect(response.status).toBe(409);
      expect((await readBody(response)).details.changes).toEqual([
        { type: "destination_changed", ids: [APP_SURVEY_ID] },
      ]);
    });

    test("removing the destination of a live banner is destructive too", async () => {
      const { id } = await created(banner({ status: "inProgress" }));

      const refused = await pushEdit(id, (document) => ({
        ...document,
        destination: null,
        content: {
          message: { "en-US": [{ text: "Tell us how we did" }] },
          button: null,
          dismissible: true,
          accessibleName: null,
        },
      }));

      expect(refused.status).toBe(409);
      expect((await readBody(refused)).details.changes).toEqual([{ type: "destination_removed" }]);
    });

    test("a draft has nothing live to lose", async () => {
      const { id } = await draftCreative();

      const response = await pushEdit(id, toLink);

      expect(response.status).toBe(200);
    });

    test("changing something else on a live creative needs no confirmation", async () => {
      const { id } = await liveCreative();

      expect((await pushEdit(id, (document) => ({ ...document, name: "Renamed" }))).status).toBe(200);
    });
  });

  describe("dryRun", () => {
    test("runs the push without writing and says what it would change", async () => {
      const { id } = await liveCreative();
      stampUpdatedAt(id);
      const auditLog = { action: "updated", targetType: "creative" } as unknown as TV3AuditLog;

      const response = await pushEdit(id, (document) => ({ ...document, name: "Renamed" }), {
        dryRun: true,
        auditLog,
      });
      const { data } = (await readBody(response)) as { data: TPushResult };

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        dryRun: true,
        changes: [{ path: "name", change: "changed" }],
        envelope: { updatedAt: READ_AT.toISOString(), document: { name: "Renamed" } },
      });
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
      expect(store.get(id)?.name).toBe("Site feedback tab");
      expect(auditLog).not.toHaveProperty("newObject");
      expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    });

    test("answers the problem a real push would: stale, destructive, invalid", async () => {
      const { id } = await liveCreative();
      stampUpdatedAt(id);
      const envelope = await pull(id);

      const stale = await push(id, envelope.document, {
        expectedUpdatedAt: "2026-10-16T09:00:00.000Z",
        dryRun: true,
      });
      const destructive = await push(
        id,
        { ...envelope.document, destination: { type: "link", url: "https://example.com/help" } },
        { expectedUpdatedAt: envelope.updatedAt, dryRun: true }
      );
      const invalid = await push(
        id,
        { ...envelope.document, destination: { type: "survey", surveyId: RESTRICTED_SURVEY_ID } },
        { expectedUpdatedAt: envelope.updatedAt, dryRun: true, confirmDestructive: true }
      );

      expect(stale.status).toBe(409);
      expect((await readBody(stale)).details).toHaveProperty("currentUpdatedAt");
      expect(destructive.status).toBe(409);
      expect((await readBody(destructive)).details.reason).toBe("destructive_change");
      expect(invalid.status).toBe(422);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
    });

    test("a confirmed destructive dry run reports the change and still writes nothing", async () => {
      const { id } = await liveCreative();

      const response = await pushEdit(
        id,
        (document) => ({ ...document, destination: { type: "link", url: "https://example.com/help" } }),
        { dryRun: true, confirmDestructive: true }
      );

      expect(response.status).toBe(200);
      expect((await readBody(response)).data.changes).toEqual([{ path: "destination", change: "changed" }]);
      expect(replaceCreativeRecord).not.toHaveBeenCalled();
      expect(store.get(id)?.surveyId).toBe(APP_SURVEY_ID);
    });
  });
});
