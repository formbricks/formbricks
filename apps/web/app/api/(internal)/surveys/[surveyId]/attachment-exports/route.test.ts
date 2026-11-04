import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authorize: vi.fn(),
  queueingConfig: vi.fn(),
  releaseWork: vi.fn(),
  getOrganization: vi.fn(),
  collect: vi.fn(),
  checkRateLimit: vi.fn(),
  create: vi.fn(),
  dispatch: vi.fn(),
  failUndispatched: vi.fn(),
  queueAuditEvent: vi.fn(),
  smtp: { configured: true },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
  },
}));
vi.mock("@/modules/storage/attachment-export/authorize", () => ({
  authorizeAttachmentExportAccess: mocks.authorize,
}));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_SMTP_CONFIGURED() {
    return mocks.smtp.configured;
  },
}));
vi.mock("@/lib/jobs/config", () => ({ getJobsQueueingConfig: mocks.queueingConfig }));
vi.mock("@/lib/upgrade/compatibility", () => ({ isNewReleaseWorkEnabled: mocks.releaseWork }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/storage/lib/collect-response-attachments", () => ({
  collectResponseAttachments: mocks.collect,
}));
vi.mock("@/modules/storage/attachment-export/service", () => ({
  createAttachmentExport: mocks.create,
  dispatchAttachmentExport: mocks.dispatch,
  failUndispatchedAttachmentExport: mocks.failUndispatched,
  toAttachmentExportDto: (row: { id: string; status: string }) => ({ id: row.id, status: row.status }),
}));

const SURVEY_ID = "cm8cmpnjj000108jfdr9srv01";
const WORKSPACE_ID = "cm8cmpnjj000108jfdr9wks01";
const USER_ID = "cm8cmpnjj000108jfdr9usr01";
const survey = { id: SURVEY_ID, workspaceId: WORKSPACE_ID };
const row = {
  id: "cm8cmpnjj000108jfdr9exp01",
  workspaceId: WORKSPACE_ID,
  dispatchCount: 0,
  status: "queued",
  filterCriteria: null,
};

const post = (body: unknown = {}) =>
  POST(
    new NextRequest(`http://localhost/api/surveys/${SURVEY_ID}/attachment-exports`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

describe("POST /api/surveys/{surveyId}/attachment-exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.authorize.mockResolvedValue({
      response: null,
      survey,
      organizationId: "org-1",
      workspaceId: WORKSPACE_ID,
      workspaceIdForAudit: WORKSPACE_ID,
      userId: USER_ID,
    });
    mocks.queueingConfig.mockReturnValue({ enabled: true, redisUrl: "redis://localhost" });
    mocks.releaseWork.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ displayTimeZone: "Asia/Riyadh" });
    mocks.collect.mockResolvedValue({ entries: [], fileCount: 12, responseCount: 4, exceedsMaxFiles: false });
    mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: true } });
    mocks.create.mockResolvedValue({ row, created: true });
    mocks.dispatch.mockResolvedValue(undefined);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.smtp.configured = true;
  });

  test("records the export, enqueues it and answers 202", async () => {
    const filterCriteria = { finished: true };

    const response = await post({ filterCriteria });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ data: { id: row.id, status: "queued" } });
    expect(mocks.collect).toHaveBeenCalledWith(
      expect.objectContaining({ survey, filterCriteria, timeZone: "Asia/Riyadh" })
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(rateLimitConfigs.storage.attachmentsExport, USER_ID);
    expect(mocks.create).toHaveBeenCalledWith({
      surveyId: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      requestedById: USER_ID,
      filterCriteria,
      timeZone: "Asia/Riyadh",
      fileCount: 12,
      responseCount: 4,
    });
    expect(mocks.dispatch).toHaveBeenCalledWith(row);
  });

  test("returns the export already in flight instead of starting another", async () => {
    mocks.create.mockResolvedValue({ row: { ...row, status: "running" }, created: false });

    const response = await post();

    expect(response.status).toBe(200);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("refuses a request whose filter differs from the export in flight", async () => {
    // The running export covers completed responses only; this request asks for every response.
    mocks.create.mockResolvedValue({
      row: { ...row, status: "running", filterCriteria: { finished: true } },
      created: false,
    });

    const response = await post();

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("attachment_export_filter_conflict");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("returns the export in flight when it was started with the same filter", async () => {
    mocks.create.mockResolvedValue({
      row: { ...row, status: "running", filterCriteria: { finished: true } },
      created: false,
    });

    const response = await post({ filterCriteria: { finished: true } });

    expect(response.status).toBe(200);
  });

  test("passes the authorization refusal through without reading responses", async () => {
    mocks.authorize.mockResolvedValue({ response: new Response(null, { status: 403 }) });

    const response = await post();

    expect(response.status).toBe(403);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test.each([
    [
      "no worker can build it",
      () => mocks.queueingConfig.mockReturnValue({ enabled: false, redisUrl: null }),
    ],
    ["the online upgrade has not activated", () => mocks.releaseWork.mockResolvedValue(false)],
    // The download link only reaches the user by email.
    [
      "email is not configured",
      () => {
        mocks.smtp.configured = false;
      },
    ],
  ])("asks the client to fall back to the stream when %s", async (_label, arrange) => {
    arrange();

    const response = await post();

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("attachment_export_unavailable");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("refuses an export over the file cap without spending the rate limit", async () => {
    mocks.collect.mockResolvedValue({
      entries: [],
      fileCount: 5001,
      responseCount: 9,
      exceedsMaxFiles: true,
    });

    const response = await post();

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("attachment_export_too_large");
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("refuses an export with nothing in it", async () => {
    mocks.collect.mockResolvedValue({ entries: [], fileCount: 0, responseCount: 0, exceedsMaxFiles: false });

    const response = await post();

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("attachment_export_empty");
  });

  test("answers 429 once the user's export budget is spent", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: false, retryAfter: 120 } });

    const response = await post();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("fails the export and answers 503 when it cannot be enqueued", async () => {
    mocks.dispatch.mockRejectedValue(new Error("Redis is down"));

    const response = await post();

    expect(response.status).toBe(503);
    expect(mocks.failUndispatched).toHaveBeenCalledWith(row);
  });

  test("rejects unknown body fields", async () => {
    const response = await post({ responseIds: ["r1"] });

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
