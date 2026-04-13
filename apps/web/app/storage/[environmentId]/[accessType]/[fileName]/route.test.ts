import { type NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  authorizePrivateDownload: vi.fn(),
  applyRateLimit: vi.fn(),
  deleteFile: vi.fn(),
  getFileStreamForDownload: vi.fn(),
  getErrorResponseFromStorageError: vi.fn(),
  logFileDeletion: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/app/storage/[environmentId]/[accessType]/[fileName]/lib/auth", () => ({
  authorizePrivateDownload: mocks.authorizePrivateDownload,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    storage: {
      delete: { interval: 60, allowedPerInterval: 5, namespace: "storage:delete" },
    },
  },
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: mocks.deleteFile,
  getFileStreamForDownload: mocks.getFileStreamForDownload,
}));

vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: mocks.getErrorResponseFromStorageError,
}));

vi.mock("./lib/audit-logs", () => ({
  logFileDeletion: mocks.logFileDeletion,
}));

const createMockRequest = (pathname: string): NextRequest =>
  ({
    method: "DELETE",
    url: `https://api.test${pathname}`,
    nextUrl: {
      pathname,
    },
  }) as unknown as NextRequest;

const ENVIRONMENT_ID = "cmfntxc7j0009ad01etyah1ys";

describe("storage delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: "session-user-1" } });
    mocks.deleteFile.mockResolvedValue({ ok: true });
  });

  test("skips app rate limiting for api-key deletes because Envoy covers the route", async () => {
    mocks.authorizePrivateDownload.mockResolvedValue({
      ok: true,
      data: { authType: "apiKey", apiKeyId: "api-key-1" },
    });
    mocks.applyRateLimit.mockRejectedValue(new Error("should not be called"));

    const request = createMockRequest(`/storage/${ENVIRONMENT_ID}/private/file.pdf`);
    const { DELETE } = await import("./route");
    const response = await DELETE(request, {
      params: Promise.resolve({
        environmentId: ENVIRONMENT_ID,
        accessType: "private",
        fileName: "file.pdf",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.applyRateLimit).not.toHaveBeenCalled();
  });

  test("keeps app rate limiting for session-authenticated deletes", async () => {
    mocks.authorizePrivateDownload.mockResolvedValue({
      ok: true,
      data: { authType: "session", userId: "user-1" },
    });
    mocks.applyRateLimit.mockResolvedValue({ allowed: true });

    const request = createMockRequest(`/storage/${ENVIRONMENT_ID}/private/file.pdf`);
    const { DELETE } = await import("./route");
    const response = await DELETE(request, {
      params: Promise.resolve({
        environmentId: ENVIRONMENT_ID,
        accessType: "private",
        fileName: "file.pdf",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "storage:delete" }),
      "user-1"
    );
  });
});
