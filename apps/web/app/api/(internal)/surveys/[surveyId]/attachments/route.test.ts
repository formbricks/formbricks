import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

// The guards the attachment export runs inside its handler: the survey authorization, the `filters`
// parameter, the over-cap and empty archives, and the per-user export budget. `withV3ApiWrapper` is
// reduced to its handler; its own validation and auth are covered with the wrapper.
const mocks = vi.hoisted(() => ({
  getAuthorizedV3Survey: vi.fn(),
  getSessionUserId: vi.fn(),
  getOrganization: vi.fn(),
  collectResponseAttachments: vi.fn(),
  checkRateLimit: vi.fn(),
  streamAttachmentsAsZip: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/app/api/v3/surveys/authorization", () => ({
  getAuthorizedV3Survey: mocks.getAuthorizedV3Survey,
}));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { storage: { attachmentsExport: {} } },
}));
vi.mock("@/modules/storage/attachment-export/constants", () => ({ MAX_ATTACHMENT_FILES: 500 }));
vi.mock("@/modules/storage/attachment-export/export-attachments", () => ({
  streamAttachmentsAsZip: mocks.streamAttachmentsAsZip,
}));
vi.mock("@/modules/storage/lib/collect-response-attachments", () => ({
  collectResponseAttachments: mocks.collectResponseAttachments,
}));

const SURVEY_ID = "clsv00000000000000000001";
const survey = { id: SURVEY_ID };
const authResult = { organizationId: "org-1", workspaceId: "ws-1" };

type THandler = (input: unknown) => Promise<Response>;

const exportAttachments = (
  query: { filters?: string; dryRun?: boolean },
  auditLog: Record<string, unknown> = {}
) =>
  (GET as unknown as THandler)({
    parsedInput: { params: { surveyId: SURVEY_ID }, query: { dryRun: false, ...query } },
    authentication: { user: { id: "user-1" } },
    requestId: "req-1",
    instance: `/api/surveys/${SURVEY_ID}/attachments`,
    auditLog,
  });

const collected = (overrides: Record<string, unknown> = {}) => ({
  entries: [{ path: "a.png" }],
  fileCount: 1,
  responseCount: 1,
  exceedsMaxFiles: false,
  ...overrides,
});

describe("GET /api/surveys/[surveyId]/attachments guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthorizedV3Survey.mockResolvedValue({ survey, authResult, response: undefined });
    mocks.getSessionUserId.mockReturnValue("user-1");
    mocks.getOrganization.mockResolvedValue({ displayTimeZone: "Europe/Berlin" });
    mocks.collectResponseAttachments.mockResolvedValue(collected());
    mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: true } });
    mocks.streamAttachmentsAsZip.mockReturnValue(new Response("zip"));
  });

  test("returns the authorization refusal without reading responses", async () => {
    const refusal = new Response(null, { status: 403 });
    mocks.getAuthorizedV3Survey.mockResolvedValue({ response: refusal });

    await expect(exportAttachments({})).resolves.toBe(refusal);
    expect(mocks.collectResponseAttachments).not.toHaveBeenCalled();
  });

  test("refuses filters that are not JSON, or not a response filter", async () => {
    expect((await exportAttachments({ filters: "{not json" })).status).toBe(400);
    expect((await exportAttachments({ filters: JSON.stringify({ finished: "yes" }) })).status).toBe(400);
    expect(mocks.collectResponseAttachments).not.toHaveBeenCalled();
  });

  test("passes a valid filter, and the org's time zone, to the collector", async () => {
    await exportAttachments({ filters: JSON.stringify({ finished: true }) });

    expect(mocks.collectResponseAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ filterCriteria: { finished: true }, timeZone: "Europe/Berlin" })
    );
  });

  test("accepts a Created at range, which arrives over JSON as ISO text, and hands on Dates", async () => {
    const min = new Date("2026-11-06T00:00:00.000Z");
    const max = new Date("2026-11-10T23:59:59.999Z");

    const response = await exportAttachments({ filters: JSON.stringify({ createdAt: { min, max } }) });

    expect(await response.text()).toBe("zip");
    expect(mocks.collectResponseAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ filterCriteria: { createdAt: { min, max } } })
    );
  });

  test("refuses a Created at bound that is not a date", async () => {
    const response = await exportAttachments({
      filters: JSON.stringify({ createdAt: { max: "not a date" } }),
    });

    expect(response.status).toBe(400);
    expect(mocks.collectResponseAttachments).not.toHaveBeenCalled();
  });

  test("answers a dry run with the counts, recorded as a query, and streams nothing", async () => {
    const auditLog: Record<string, unknown> = { action: "exported" };

    const response = await exportAttachments({ dryRun: true }, auditLog);

    expect(response.status).toBe(200);
    expect(auditLog).toMatchObject({ action: "queried", organizationId: "org-1", targetId: SURVEY_ID });
    expect(mocks.streamAttachmentsAsZip).not.toHaveBeenCalled();
  });

  test("refuses an archive over the file cap, and an empty one", async () => {
    mocks.collectResponseAttachments.mockResolvedValueOnce(collected({ exceedsMaxFiles: true }));
    expect((await exportAttachments({})).status).toBe(422);

    mocks.collectResponseAttachments.mockResolvedValueOnce(collected({ fileCount: 0, entries: [] }));
    expect((await exportAttachments({})).status).toBe(422);

    expect(mocks.streamAttachmentsAsZip).not.toHaveBeenCalled();
  });

  test("refuses a user over the export budget with a 429", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: true, data: { allowed: false, retryAfter: 30 } });

    const response = await exportAttachments({});

    expect(response.status).toBe(429);
    expect(mocks.streamAttachmentsAsZip).not.toHaveBeenCalled();
  });

  test("streams the archive when every guard passes", async () => {
    const response = await exportAttachments({});

    expect(await response.text()).toBe("zip");
    expect(mocks.checkRateLimit).toHaveBeenCalledWith({}, "user-1");
  });
});
