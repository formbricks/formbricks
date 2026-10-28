import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "../authorization";
import { V3SurveyStaleError, dryRunV3SurveyPatch, patchV3Survey } from "../patch";
import { surveyDocumentAdapter } from "./adapter";
import { V3SurveyDestructiveChangeError } from "./destructive";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: { survey: { findUnique: vi.fn() }, response: { count: vi.fn() } },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: () => ({ type: "apiKey", id: "api_key_1" }),
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({ queueV3AuditLog: vi.fn(), skipV3AuditLog: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({ filterReadableSurveyIds: vi.fn() }));
vi.mock("@/lib/authorization/metrics", () => ({ recordSurveyListPredicateMismatch: vi.fn() }));
vi.mock("@/modules/custom-css/lib/service", () => ({
  previewCustomCss: vi.fn(),
  resolveCustomCssWrite: vi.fn(),
  invalidateCustomCssCaches: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
  archiveSurvey: vi.fn(),
  restoreSurvey: vi.fn(),
}));
vi.mock("@/modules/survey/list/lib/survey", () => ({
  getSurveyCount: vi.fn(),
  getWorkspaceSurveyCount: vi.fn(),
}));
vi.mock("@/modules/survey/list/lib/survey-page", () => ({ getSurveyListPage: vi.fn() }));
vi.mock("../authorization", () => ({ getAuthorizedV3Survey: vi.fn() }));
vi.mock("../create", async () => ({
  ...(await vi.importActual<typeof import("../create")>("../create")),
  createV3Survey: vi.fn(),
}));
// The write path has its own suite (patch.test.ts): here the pipeline is real up to the write.
vi.mock("../patch", async () => ({
  ...(await vi.importActual<typeof import("../patch")>("../patch")),
  patchV3Survey: vi.fn(),
  dryRunV3SurveyPatch: vi.fn(),
}));
vi.mock("../visibility-context", () => {
  const context = {
    actorContext: { enforced: false, kind: "apiKey" },
    gates: { entitled: false, ready: false },
  };
  return {
    resolveV3SurveyResourceVisibility: async () => ({ ...context, ownerName: null }),
    resolveV3SurveyVisibilityContext: async () => context,
  };
});

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const surveyId = "tz4a98xxat96iws9zmbrgj4c";
const requestId = "req_1";
const instance = "/api/v3/surveys/x/document";
const authentication = { apiKeyId: "api_key_1", organizationId: "org_1" } as never;
const updatedAt = new Date("2026-04-21T10:00:00.000Z");
const movedOnAt = new Date("2026-04-21T11:30:00.000Z");

const blocks = [
  {
    id: "tz4a98xxat96iws9zmbrgj4b",
    name: "Main",
    elements: [
      {
        id: "feedback",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const baseSurvey = {
  id: surveyId,
  workspaceId,
  createdAt: new Date("2026-04-20T10:00:00.000Z"),
  updatedAt,
  name: "Feedback",
  type: "link",
  status: "inProgress",
  archivedAt: null,
  ownerId: null,
  questions: [],
  welcomeCard: { enabled: false },
  blocks,
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
  showLanguageSwitch: null,
  autoSelectLanguage: null,
  segment: null,
  triggers: [],
  metadata: {},
  customCss: null,
  languages: [
    {
      language: {
        id: "cllangenus000000000000000",
        code: "en-US",
        alias: null,
        workspaceId,
        createdAt: updatedAt,
        updatedAt,
      },
      default: true,
      enabled: true,
    },
  ],
};

const authorize = (survey: unknown = baseSurvey) =>
  vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
    survey,
    authResult: { workspaceId, organizationId: "org_1" },
    response: null,
    visibility: {
      actorContext: { enforced: false, kind: "apiKey" },
      gates: { entitled: false, ready: false },
      ownerName: null,
    },
  } as never);

const pull = async () => {
  const response = await surveyDocumentAdapter.pull({ id: surveyId, authentication, requestId, instance });
  return { response, body: await response.json() };
};

const push = (overrides: Record<string, unknown> = {}) =>
  surveyDocumentAdapter.push({
    id: surveyId,
    authentication,
    requestId,
    instance,
    document: {},
    expectedUpdatedAt: updatedAt.toISOString(),
    dryRun: false,
    confirmDestructive: false,
    ...overrides,
  } as Parameters<typeof surveyDocumentAdapter.push>[0]);

describe("survey document adapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authorize();
    vi.mocked(patchV3Survey).mockResolvedValue({
      ...baseSurvey,
      name: "Renamed",
      updatedAt: movedOnAt,
    } as never);
    vi.mocked(dryRunV3SurveyPatch).mockResolvedValue({ document: {} } as never);
  });

  describe("pull", () => {
    test("answers the envelope with the editable state only", async () => {
      const { response, body } = await pull();

      expect(response.status).toBe(200);
      expect(getAuthorizedV3Survey).toHaveBeenCalledWith(expect.objectContaining({ access: "read" }));
      expect(body.data).toMatchObject({
        kind: "survey",
        schemaVersion: 1,
        id: surveyId,
        workspaceId,
        updatedAt: updatedAt.toISOString(),
      });
      expect(Object.keys(body.data.document)).toEqual([
        "name",
        "metadata",
        "languages",
        "showLanguageSwitch",
        "autoSelectLanguage",
        "welcomeCard",
        "blocks",
        "endings",
        "hiddenFields",
        "variables",
        "customCss",
      ]);
    });

    test("an unknown id and another workspace's id answer the authorization refusal, nothing more", async () => {
      vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
        survey: null,
        authResult: null,
        response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
      } as never);

      const { response } = await pull();

      expect(response.status).toBe(403);
    });

    test("a legacy question-based survey is a stored-survey problem, as a push would say", async () => {
      authorize({ ...baseSurvey, questions: [{ id: "q1" }] });

      const { response, body } = await pull();

      expect(response.status).toBe(422);
      expect(body.code).toBe("stored_survey_invalid");
    });
  });

  describe("push", () => {
    test("pushing a pulled document back changes nothing and writes nothing", async () => {
      const { body: pulled } = await pull();
      const auditLog = {} as TV3AuditLog;

      const response = await push({ document: pulled.data.document, auditLog });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.changes).toEqual([]);
      expect(body.data.dryRun).toBe(false);
      expect(body.data.envelope.updatedAt).toBe(updatedAt.toISOString());
      expect(patchV3Survey).not.toHaveBeenCalled();
      // Nothing was updated, so nothing is recorded as an update.
      expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    });

    test("a document with its keys in another order is still the same document", async () => {
      const { body: pulled } = await pull();
      const reversed = Object.fromEntries(Object.entries(pulled.data.document).reverse());

      const response = await push({ document: reversed });

      expect((await response.json()).data.changes).toEqual([]);
      expect(patchV3Survey).not.toHaveBeenCalled();
    });

    test("replaces: a key the document leaves out is sent as its reset value, and status is never sent", async () => {
      authorize({
        ...baseSurvey,
        endings: [{ id: "end1" }],
        variables: [{ id: "v1" }],
        showLanguageSwitch: true,
      });
      const auditLog = {} as TV3AuditLog;

      const response = await push({ document: { name: "Renamed", blocks }, auditLog });

      expect(response.status).toBe(200);
      const patchInput = vi.mocked(patchV3Survey).mock.calls[0][1] as Record<string, unknown>;
      expect(patchInput).toEqual({
        name: "Renamed",
        metadata: {},
        languages: [],
        showLanguageSwitch: null,
        autoSelectLanguage: null,
        welcomeCard: { enabled: false },
        blocks,
        endings: [],
        hiddenFields: { enabled: false },
        variables: [],
        customCss: null,
      });
      const body = await response.json();
      expect(body.data.dryRun).toBe(false);
      expect(body.data.envelope.document.name).toBe("Renamed");
      expect(body.data.changes).toEqual(expect.arrayContaining([{ path: "name", change: "changed" }]));
      expect(auditLog).toMatchObject({
        targetId: surveyId,
        organizationId: "org_1",
        oldObject: expect.objectContaining({ name: "Feedback" }),
        newObject: expect.objectContaining({ name: "Renamed" }),
      });
    });

    test("an app survey's omitted distribution and targeting reset too", async () => {
      authorize({ ...baseSurvey, type: "app", displayOption: "displayMultiple", segment: { filters: [] } });

      await push({ document: { name: "Renamed", blocks } });

      expect(vi.mocked(patchV3Survey).mock.calls[0][1]).toMatchObject({
        distribution: {},
        targeting: { filters: [] },
      });
    });

    test("compare-and-set: the precondition goes to the write, and a lost race answers 409 with both timestamps", async () => {
      vi.mocked(patchV3Survey).mockRejectedValue(new V3SurveyStaleError(updatedAt, movedOnAt, "write"));

      const response = await push({ document: { name: "Renamed", blocks } });

      expect(vi.mocked(patchV3Survey).mock.calls[0][4]).toEqual({ expectedUpdatedAt: updatedAt });
      expect(response.status).toBe(409);
      expect((await response.json()).details).toEqual({
        expectedUpdatedAt: updatedAt.toISOString(),
        currentUpdatedAt: movedOnAt.toISOString(),
      });
    });

    test("a stale expectedUpdatedAt is refused before the document is even read", async () => {
      const response = await push({
        document: { nonsense: true },
        expectedUpdatedAt: "2026-04-20T09:00:00.000Z",
      });

      expect(response.status).toBe(409);
      expect((await response.json()).details).toEqual({
        expectedUpdatedAt: "2026-04-20T09:00:00.000Z",
        currentUpdatedAt: updatedAt.toISOString(),
      });
      expect(patchV3Survey).not.toHaveBeenCalled();
    });

    test("a malformed expectedUpdatedAt is a 400", async () => {
      const response = await push({ expectedUpdatedAt: "yesterday" });

      expect(response.status).toBe(400);
    });

    test("unknown keys are a 422 naming them", async () => {
      const response = await push({ document: { name: "S", blocks, status: "completed", bogus: 1 } });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body.invalid_params.map((param: { name: string }) => param.name)).toEqual(["status", "bogus"]);
      expect(patchV3Survey).not.toHaveBeenCalled();
    });

    test("an archived survey is refused as the existing update refuses it", async () => {
      authorize({ ...baseSurvey, archivedAt: new Date() });

      const response = await push({ document: { name: "Renamed", blocks } });

      expect(response.status).toBe(422);
      expect(patchV3Survey).not.toHaveBeenCalled();
    });

    test("a caller without write access gets the authorization refusal", async () => {
      vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
        survey: null,
        authResult: null,
        response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
      } as never);

      const response = await push({ document: { name: "Renamed", blocks } });

      expect(response.status).toBe(403);
      expect(getAuthorizedV3Survey).toHaveBeenCalledWith(expect.objectContaining({ access: "readWrite" }));
    });

    test("an unknown survey from the write path is the same 403 as an unauthorized one", async () => {
      vi.mocked(patchV3Survey).mockRejectedValue(new ResourceNotFoundError("Survey", surveyId));

      const response = await push({ document: { name: "Renamed", blocks } });

      expect(response.status).toBe(403);
    });

    describe("destructive changes", () => {
      test("the guard is handed to the write unless the caller confirmed", async () => {
        await push({ document: { name: "Renamed", blocks } });
        expect(vi.mocked(patchV3Survey).mock.calls[0][9]).toEqual({ guard: expect.any(Function) });

        vi.mocked(patchV3Survey).mockClear();
        await push({ document: { name: "Renamed", blocks }, confirmDestructive: true });
        expect(vi.mocked(patchV3Survey).mock.calls[0]).toHaveLength(9);
      });

      test("a refusal is a 409 naming what would go, and applies once confirmed", async () => {
        const changes = [{ type: "elements_removed", ids: ["feedback"], responseCount: 3 }];
        vi.mocked(patchV3Survey).mockRejectedValueOnce(new V3SurveyDestructiveChangeError(changes));

        const refused = await push({ document: { name: "Renamed", blocks } });

        expect(refused.status).toBe(409);
        expect((await refused.json()).details).toEqual({ reason: "destructive_change", changes });

        const applied = await push({ document: { name: "Renamed", blocks }, confirmDestructive: true });
        expect(applied.status).toBe(200);
      });
    });

    describe("dry run", () => {
      test("runs the checks, answers the changes with dryRun true, and writes and records nothing", async () => {
        const auditLog = {} as TV3AuditLog;

        const response = await push({ document: { name: "Renamed", blocks }, dryRun: true, auditLog });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(patchV3Survey).not.toHaveBeenCalled();
        expect(dryRunV3SurveyPatch).toHaveBeenCalledTimes(1);
        expect(body.data.dryRun).toBe(true);
        expect(body.data.envelope.updatedAt).toBe(updatedAt.toISOString());
        expect(body.data.envelope.document.name).toBe("Renamed");
        expect(body.data.changes).toEqual(expect.arrayContaining([{ path: "name", change: "changed" }]));
        expect(auditLog).toEqual({});
      });

      test("answers the problem a real push would", async () => {
        vi.mocked(dryRunV3SurveyPatch).mockRejectedValue(
          new V3SurveyDestructiveChangeError([{ type: "blocks_removed", ids: ["b"], responseCount: 1 }])
        );

        const response = await push({ document: { name: "Renamed", blocks }, dryRun: true });

        expect(response.status).toBe(409);
        expect((await response.json()).details.reason).toBe("destructive_change");
      });

      test("is refused as a real push is when the survey is stale or the document is invalid", async () => {
        const stale = await push({
          document: { name: "Renamed", blocks },
          dryRun: true,
          expectedUpdatedAt: "2026-04-20T09:00:00.000Z",
        });
        const invalid = await push({ document: { bogus: 1 }, dryRun: true });

        expect(stale.status).toBe(409);
        expect(invalid.status).toBe(422);
        expect(dryRunV3SurveyPatch).not.toHaveBeenCalled();
      });
    });
  });
});
