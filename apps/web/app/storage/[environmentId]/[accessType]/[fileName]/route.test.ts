import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { StorageErrorCode } from "@formbricks/storage";

const {
  mockApplyRateLimit,
  mockAuthorizePrivateDownload,
  mockDeleteFile,
  mockGetErrorResponseFromStorageError,
  mockGetFileStreamForDownload,
  mockGetServerSession,
  mockLogFileDeletion,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(),
  mockAuthorizePrivateDownload: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockGetErrorResponseFromStorageError: vi.fn(),
  mockGetFileStreamForDownload: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockLogFileDeletion: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn(() => new Response(null, { status: 400 })),
    notAuthenticatedResponse: vi.fn(() => new Response(null, { status: 401 })),
    successResponse: vi.fn(() => new Response(null, { status: 200 })),
    tooManyRequestsResponse: vi.fn(() => new Response(null, { status: 429 })),
    unauthorizedResponse: vi.fn(() => new Response(null, { status: 403 })),
  },
}));

vi.mock("@/app/lib/api/validator", () => ({
  transformErrorToDetails: vi.fn(() => [{ field: "fileName", message: "Invalid input" }]),
}));

vi.mock("@/app/storage/[environmentId]/[accessType]/[fileName]/lib/auth", () => ({
  authorizePrivateDownload: mockAuthorizePrivateDownload,
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mockApplyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    storage: {
      delete: "storage-delete-limit",
    },
  },
}));

vi.mock("@/modules/storage/service", () => ({
  deleteFile: mockDeleteFile,
  getFileStreamForDownload: mockGetFileStreamForDownload,
}));

vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: mockGetErrorResponseFromStorageError,
}));

vi.mock("./lib/audit-logs", () => ({
  logFileDeletion: mockLogFileDeletion,
}));

describe("storage file route", () => {
  const environmentId = "cm8cmpnjj000108jfdr9dfqe6";

  beforeEach(() => {
    vi.resetAllMocks();
    mockApplyRateLimit.mockResolvedValue(undefined);
    mockAuthorizePrivateDownload.mockResolvedValue({
      ok: true,
      data: {
        authType: "user",
        userId: "user_123",
      },
    });
    mockDeleteFile.mockResolvedValue({ ok: true, data: undefined });
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user_123",
      },
    });
    mockLogFileDeletion.mockResolvedValue(undefined);
  });

  test("returns the mapped storage error for download failures", async () => {
    mockGetFileStreamForDownload.mockResolvedValue({
      ok: false,
      error: { code: StorageErrorCode.FileNotFoundError },
    });
    mockGetErrorResponseFromStorageError.mockReturnValue(new Response(null, { status: 404 }));

    const { GET } = await import("./route");
    const response = await GET(new NextRequest(`http://localhost/storage/${environmentId}/public/file.jpg`), {
      params: Promise.resolve({
        accessType: "public",
        environmentId,
        fileName: "file.jpg",
      }),
    });

    expect(response.status).toBe(404);
    expect(mockGetFileStreamForDownload).toHaveBeenCalledWith("file.jpg", environmentId, "public");
    expect(mockGetErrorResponseFromStorageError).toHaveBeenCalledWith(
      { code: StorageErrorCode.FileNotFoundError },
      { fileName: "file.jpg" }
    );
  });

  test("logs and returns the mapped storage error for delete failures", async () => {
    mockDeleteFile.mockResolvedValue({
      ok: false,
      error: { code: StorageErrorCode.Unknown },
    });
    mockGetErrorResponseFromStorageError.mockReturnValue(new Response(null, { status: 500 }));

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new NextRequest(`http://localhost/storage/${environmentId}/public/test%20file.jpg`),
      {
        params: Promise.resolve({
          accessType: "public",
          environmentId,
          fileName: "test%20file.jpg",
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(mockDeleteFile).toHaveBeenCalledWith(environmentId, "public", "test file.jpg");
    expect(mockApplyRateLimit).toHaveBeenCalledWith("storage-delete-limit", "user_123");
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: { code: StorageErrorCode.Unknown } },
      "Error deleting file"
    );
    expect(mockLogFileDeletion).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: "public",
        environmentId,
        failureReason: StorageErrorCode.Unknown,
        userId: "user_123",
      })
    );
    expect(mockGetErrorResponseFromStorageError).toHaveBeenCalledWith(
      { code: StorageErrorCode.Unknown },
      { fileName: "test%20file.jpg" }
    );
  });
});
