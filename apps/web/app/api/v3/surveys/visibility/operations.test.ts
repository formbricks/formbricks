import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { can } from "@/lib/authorization";
import { lockSurveyVisibility, reconcileSurveyRelationships } from "@/lib/authzed/survey";
import { getAuthorizedV3Survey } from "../authorization";
import { findSurveyOutboundBlockers } from "./blockers";
import { getSurveyVisibilityImpact } from "./impact";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "./operations";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    survey: { findUniqueOrThrow: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: (authentication: { apiKeyId?: string; user?: { id: string } } | null) =>
    authentication?.user ? { id: authentication.user.id, type: "user" } : { id: "key_1", type: "apiKey" },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/survey", () => ({
  lockSurveyVisibility: vi.fn(),
  reconcileSurveyRelationships: vi.fn(),
}));
vi.mock("../authorization", () => ({ getAuthorizedV3Survey: vi.fn() }));
vi.mock("./blockers", () => ({ findSurveyOutboundBlockers: vi.fn() }));
vi.mock("./impact", () => ({ getSurveyVisibilityImpact: vi.fn() }));

const SURVEY_ID = "clsv1234567890123456789012";
const requestId = "req_1";
const instance = `/api/v3/surveys/${SURVEY_ID}/visibility`;
const session = { expires: "2026-12-01", user: { id: "user_1" } } as never;
const apiKey = { apiKeyId: "key_1" } as never;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: SURVEY_ID,
  ownerId: "user_1",
  visibility: "workspace",
  visibilityChangedAt: null,
  visibilityChangedById: null,
  visibilityProjectedVersion: 2,
  visibilityVersion: 2,
  workspaceId: "ws_1",
  ...overrides,
});

const enabled = {
  actorContext: { enforced: true, isOrganizationAdmin: false, kind: "user", userId: "user_1" },
  gates: { entitled: true, ready: true },
  ownerName: "Ada",
};

const authorize = (survey = row(), visibility: unknown = enabled) =>
  vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
    authResult: { organizationId: "org_1", workspaceId: "ws_1" },
    response: null,
    survey,
    visibility,
  } as never);

/** Run the transaction against a stored row that becomes `after` once the UPDATE has run. */
const store = (before: ReturnType<typeof row>, after = before) => {
  const tx = {
    $executeRaw: vi.fn(),
    survey: { findUniqueOrThrow: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after) },
  };
  vi.mocked(prisma.$transaction).mockImplementation((async (run: (value: typeof tx) => unknown) =>
    run(tx)) as never);
  return tx;
};

const post = (body: unknown, authentication = session, auditLog: Record<string, unknown> = {}) =>
  changeV3SurveyVisibility({
    auditLog: auditLog as never,
    authentication,
    body,
    instance,
    requestId,
    surveyId: SURVEY_ID,
  });

const json = async (response: Response) => response.json();

beforeEach(() => {
  vi.resetAllMocks();
  authorize();
  vi.mocked(can).mockResolvedValue(true);
  vi.mocked(findSurveyOutboundBlockers).mockResolvedValue([]);
  vi.mocked(getSurveyVisibilityImpact).mockResolvedValue({ memberCount: 3, responseCount: 7 });
  vi.mocked(reconcileSurveyRelationships).mockResolvedValue({ passes: 1, status: "projected" });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user_1", name: "Ada" } as never);
});

describe("POST …/visibility", () => {
  test("400 for a body with an unknown key, marked unsupported_field", async () => {
    const response = await post({ visibility: "restricted", owner: "someone" });

    expect(response.status).toBe(400);
    expect((await json(response)).invalid_params).toEqual([
      expect.objectContaining({ code: "unsupported_field" }),
    ]);
  });

  test("400 for an unknown value", async () => {
    expect((await post({ visibility: "secret" })).status).toBe(400);
  });

  test("403 forbidden for an API key, before the survey is even looked up (K-4)", async () => {
    const response = await post({ visibility: "restricted" }, apiKey);

    expect(response.status).toBe(403);
    expect((await json(response)).code).toBe("forbidden");
    expect(getAuthorizedV3Survey).not.toHaveBeenCalled();
  });

  test("403 forbidden, the shared body, for a survey the caller cannot see", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      response: new Response(null, { status: 403 }),
    } as never);

    expect((await post({ visibility: "restricted" })).status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each([
    ["the marker is unset", { ...enabled, gates: { entitled: false, ready: false } }],
    ["the organization lacks the entitlement", { ...enabled, gates: { entitled: false, ready: true } }],
  ])("403 visibility_not_enabled when %s", async (_label, visibility) => {
    authorize(row(), visibility);

    const response = await post({ visibility: "restricted" });

    expect(response.status).toBe(403);
    expect((await json(response)).code).toBe("visibility_not_enabled");
  });

  test("403 forbidden for someone who sees the survey but may not change it (R-10)", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const response = await post({ visibility: "restricted" });

    expect(can).toHaveBeenCalledWith({ id: "user_1", type: "user" }, "survey.change_visibility", {
      id: SURVEY_ID,
      type: "survey",
    });
    expect((await json(response)).code).toBe("forbidden");
  });

  test("409 with details.blockers while connections depend on the survey", async () => {
    const blockers = [{ id: "wh_1", name: "Zapier", type: "webhook" }];
    vi.mocked(findSurveyOutboundBlockers).mockResolvedValue(blockers as never);
    const tx = store(row());

    const response = await post({ visibility: "restricted" });

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      code: "visibility_blocked_by_connections",
      details: { blockers },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("422 for an ownerless survey, even with blockers", async () => {
    vi.mocked(findSurveyOutboundBlockers).mockResolvedValue([{ id: "wh_1", name: "x", type: "webhook" }]);
    store(row({ ownerId: null }));

    const response = await post({ visibility: "restricted" });

    expect(response.status).toBe(422);
    expect((await json(response)).code).toBe("visibility_change_not_allowed");
  });

  test("200 no-op writes nothing, projects nothing, and is not audited", async () => {
    const tx = store(row());
    const auditLog = {};

    const response = await post({ visibility: "workspace" }, session, auditLog);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      data: { changedAt: null, changedBy: null, pending: null, version: 2, visibility: "workspace" },
    });
    expect(lockSurveyVisibility).toHaveBeenCalledWith(tx, SURVEY_ID);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(reconcileSurveyRelationships).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("a restriction answers 200 even when the graph has not caught up, with pending restricted", async () => {
    const after = row({ visibility: "restricted", visibilityChangedById: "user_1", visibilityVersion: 3 });
    const tx = store(row(), after);
    vi.mocked(reconcileSurveyRelationships).mockResolvedValue({
      attempts: 3,
      code: "authzed_unavailable",
      retryable: true,
      status: "failed",
    });
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue(after as never);
    const auditLog: Record<string, unknown> = {};

    const response = await post({ visibility: "restricted" }, session, auditLog);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      data: {
        changedBy: { id: "user_1", name: "Ada", type: "user" },
        pending: "restricted",
        version: 3,
        visibility: "restricted",
      },
    });
    // Stored without touching `updatedAt`, and fenced by the per-survey lock taken first.
    const [strings] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join("?")).toContain('"visibilityVersion" = "visibilityVersion" + 1');
    expect(strings.join("?")).not.toContain("updated_at");
    expect(auditLog).toMatchObject({
      newObject: { version: 3, visibility: "restricted" },
      oldObject: { version: 2, visibility: "workspace" },
      status: "success",
    });
  });

  test("audits the previous state read under the lock, not the one the authorization read saw", async () => {
    // Authorized against workspace v2; another request restricted it (v3, projected) before the lock.
    const underLock = row({ visibility: "restricted", visibilityProjectedVersion: 3, visibilityVersion: 3 });
    const stored = row({ visibility: "workspace", visibilityProjectedVersion: 3, visibilityVersion: 4 });
    store(underLock, stored);
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue({
      ...stored,
      visibilityProjectedVersion: 4,
    } as never);
    const auditLog: Record<string, unknown> = {};

    const response = await post({ visibility: "workspace" }, session, auditLog);

    expect(response.status).toBe(200);
    expect(auditLog).toMatchObject({
      newObject: { version: 4, visibility: "workspace" },
      oldObject: { version: 3, visibility: "restricted" },
    });
  });

  test("a grant answers 200 only once the graph acknowledged this exact version", async () => {
    const stored = row({ visibility: "workspace", visibilityVersion: 4, visibilityProjectedVersion: 3 });
    store(row({ visibility: "restricted", visibilityProjectedVersion: 3, visibilityVersion: 3 }), stored);
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue({
      ...stored,
      visibilityProjectedVersion: 4,
    } as never);

    const response = await post({ visibility: "workspace" });

    expect(response.status).toBe(200);
    expect((await json(response)).data).toMatchObject({ pending: null, visibility: "workspace" });
  });

  test("503 projection_pending for a grant the graph did not acknowledge in-request; retry is safe", async () => {
    const stored = row({ visibility: "workspace", visibilityVersion: 4, visibilityProjectedVersion: 3 });
    store(row({ visibility: "restricted", visibilityProjectedVersion: 3, visibilityVersion: 3 }), stored);
    vi.mocked(reconcileSurveyRelationships).mockResolvedValue({
      attempts: 3,
      code: "authzed_unavailable",
      retryable: true,
      status: "failed",
    });
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue(stored as never);

    const response = await post({ visibility: "workspace" });

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect((await json(response)).code).toBe("projection_pending");
  });

  test("requesting the pending value again re-attempts the projection without a new version or audit", async () => {
    const pendingGrant = row({
      visibility: "workspace",
      visibilityVersion: 4,
      visibilityProjectedVersion: 3,
    });
    const tx = store(pendingGrant);
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue({
      ...pendingGrant,
      visibilityProjectedVersion: 4,
    } as never);
    const auditLog = {};

    const response = await post({ visibility: "workspace" }, session, auditLog);

    expect(response.status).toBe(200);
    expect(lockSurveyVisibility).toHaveBeenCalledWith(tx, SURVEY_ID);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(reconcileSurveyRelationships).toHaveBeenCalledWith([SURVEY_ID]);
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });
});

describe("GET …/visibility", () => {
  test("describes the state, what a change would do, and what may be requested", async () => {
    vi.mocked(findSurveyOutboundBlockers).mockResolvedValue([
      { id: "wf_1", name: "Notify", type: "workflow" },
    ]);

    const response = await getV3SurveyVisibility({
      authentication: session,
      instance,
      requestId,
      surveyId: SURVEY_ID,
    });

    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({
      access: { canManageVisibility: true, via: "workspace" },
      allowedTargets: [],
      blockers: [{ id: "wf_1", name: "Notify", type: "workflow" }],
      id: SURVEY_ID,
      impact: { memberCount: 3, responseCount: 7 },
      owner: { name: "Ada" },
      pending: null,
      version: 2,
      visibility: "workspace",
    });
  });

  test("reports no blockers for a settled restricted survey, whose only target is workspace", async () => {
    authorize(row({ visibility: "restricted" }));

    const response = await getV3SurveyVisibility({
      authentication: session,
      instance,
      requestId,
      surveyId: SURVEY_ID,
    });

    expect((await json(response)).data).toMatchObject({ allowedTargets: ["workspace"], blockers: [] });
    expect(findSurveyOutboundBlockers).not.toHaveBeenCalled();
  });

  test("403 for an API key, like the POST", async () => {
    const response = await getV3SurveyVisibility({
      authentication: apiKey,
      instance,
      requestId,
      surveyId: SURVEY_ID,
    });

    expect(response.status).toBe(403);
    expect(getAuthorizedV3Survey).not.toHaveBeenCalled();
  });
});
