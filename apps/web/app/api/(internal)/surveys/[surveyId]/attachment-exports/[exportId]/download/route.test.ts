import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authorize: vi.fn(),
  getExport: vi.fn(),
  sign: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
  },
}));
vi.mock("../../lib/authorize", () => ({ authorizeAttachmentExportAccess: mocks.authorize }));
vi.mock("@formbricks/storage", () => ({ getSignedDownloadUrl: mocks.sign }));
vi.mock("@/modules/storage/attachment-export/export-attachments", () => ({
  buildAttachmentArchiveFileName: (survey: { id: string }, date: Date) =>
    `${survey.id}-attachments-${date.toISOString().slice(0, 10)}.zip`,
}));
vi.mock("@/modules/storage/attachment-export/service", () => ({
  getAttachmentExport: mocks.getExport,
  toAttachmentExportDto: (row: { id: string; status: string }) => ({ id: row.id, status: row.status }),
}));

const SURVEY_ID = "cm8cmpnjj000108jfdr9srv01";
const WORKSPACE_ID = "cm8cmpnjj000108jfdr9wks01";
const USER_ID = "cm8cmpnjj000108jfdr9usr01";
const EXPORT_ID = "cm8cmpnjj000108jfdr9exp01";
const STORAGE_KEY = `${WORKSPACE_ID}/private/surveys/${SURVEY_ID}/exports/${EXPORT_ID}.zip`;
const NOW = new Date("2026-11-03T12:00:00.000Z");

const props = { params: Promise.resolve({ surveyId: SURVEY_ID, exportId: EXPORT_ID }) } as never;
const request = (path = "") =>
  new NextRequest(`http://localhost/api/surveys/${SURVEY_ID}/attachment-exports/${EXPORT_ID}${path}`);

const completedRow = (overrides: Record<string, unknown> = {}) => ({
  id: EXPORT_ID,
  status: "completed",
  storageKey: STORAGE_KEY,
  createdAt: NOW,
  expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
  ...overrides,
});

const requesterScope = {
  id: EXPORT_ID,
  surveyId: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  requestedById: USER_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.authorize.mockResolvedValue({
    response: null,
    survey: { id: SURVEY_ID, workspaceId: WORKSPACE_ID },
    organizationId: "org-1",
    workspaceId: WORKSPACE_ID,
    workspaceIdForAudit: WORKSPACE_ID,
    userId: USER_ID,
  });
  mocks.queueAuditEvent.mockResolvedValue(undefined);
  mocks.sign.mockResolvedValue({
    ok: true,
    data: "https://files.example.com/export.zip?X-Amz-Signature=abc",
  });
});

describe("GET /api/surveys/{surveyId}/attachment-exports/{exportId}/download", () => {
  test("signs a download URL that saves under the archive's name", async () => {
    mocks.getExport.mockResolvedValue(completedRow());

    const response = await GET(request("/download"), props);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { url: "https://files.example.com/export.zip?X-Amz-Signature=abc" },
    });
    expect(mocks.getExport).toHaveBeenCalledWith(requesterScope);
    expect(mocks.sign).toHaveBeenCalledWith(STORAGE_KEY, {
      expiresIn: 6 * 60 * 60,
      responseContentDisposition: `attachment; filename="${SURVEY_ID}-attachments-2026-11-03.zip"`,
    });
    // This is the request that lets respondent files leave the product, so it is the one audited.
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "exported",
        targetType: "file",
        targetId: EXPORT_ID,
        status: "success",
      })
    );
  });

  test.each([
    ["queued", completedRow({ status: "queued", storageKey: null })],
    ["running", completedRow({ status: "running" })],
    ["failed", completedRow({ status: "failed" })],
  ])("answers 409 while the export is %s", async (_label, row) => {
    mocks.getExport.mockResolvedValue(row);

    const response = await GET(request("/download"), props);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("attachment_export_not_ready");
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  test.each([
    ["marked expired", completedRow({ status: "expired", storageKey: null })],
    ["past its expiry but not yet swept", completedRow({ expiresAt: new Date(NOW.getTime() - 1) })],
  ])("answers 410 for an export %s", async (_label, row) => {
    mocks.getExport.mockResolvedValue(row);

    const response = await GET(request("/download"), props);

    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("attachment_export_expired");
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  test("answers 404 for another user's export, without signing anything", async () => {
    mocks.getExport.mockResolvedValue(null);

    const response = await GET(request("/download"), props);

    expect(response.status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
