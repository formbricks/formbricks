import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE, GET } from "./route";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  authorizePrivateDownload: vi.fn(),
  deleteFile: vi.fn(),
  getErrorResponseFromStorageError: vi.fn(),
  getFileStreamForDownload: vi.fn(),
  getSession: vi.fn(),
  logFileDeletion: vi.fn(),
  resolveClientApiIds: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/storage/[workspaceId]/[accessType]/[...filePath]/lib/auth", () => ({
  authorizePrivateDownload: mocks.authorizePrivateDownload,
}));
vi.mock("./lib/audit-logs", () => ({ logFileDeletion: mocks.logFileDeletion }));
vi.mock("@/lib/utils/resolve-client-id", () => ({ resolveClientApiIds: mocks.resolveClientApiIds }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { storage: { delete: {} } },
}));
vi.mock("@/modules/storage/service", () => ({
  deleteFile: mocks.deleteFile,
  getFileStreamForDownload: mocks.getFileStreamForDownload,
}));
vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: mocks.getErrorResponseFromStorageError,
}));

const WORKSPACE_ID = "ws-1";

const request = new NextRequest(`http://localhost/storage/${WORKSPACE_ID}/private/file`);

// The router has decoded each segment once by the time the handler sees `filePath`.
const params = (filePath: string[], accessType = "private") => ({
  params: Promise.resolve({ workspaceId: WORKSPACE_ID, accessType, filePath }),
});

// Stored names that a second decode would break: a literal `%20`, and a bare `%` that does not decode at all.
const NAMES_WITH_PERCENT: [string, string][] = [
  ["a literal %20", "Test%20tiara--fid--abc.png"],
  ["a bare %", "100%--fid--abc.png"],
];

describe("storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.authorizePrivateDownload.mockResolvedValue({
      ok: true,
      data: { authType: "session", userId: "user-1" },
    });
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.deleteFile.mockResolvedValue({ ok: true, data: undefined });
    mocks.getFileStreamForDownload.mockResolvedValue({
      ok: true,
      data: { body: new ReadableStream(), contentType: "image/png", contentLength: 1 },
    });
  });

  // Regression (ENG-3077, ENG-6887): the router decodes the param once and objects are stored under that
  // name, so the handler must pass it on untouched. A second decode here turned `Test%20tiara` into
  // `Test tiara` and made `100%` throw, so these files could be neither downloaded nor deleted.
  describe.each(NAMES_WITH_PERCENT)("a file name with %s", (_label, fileName) => {
    test("DELETE removes the object under the name as given", async () => {
      const response = await DELETE(request, params([fileName]));

      expect(response.status).toBe(200);
      expect(mocks.deleteFile).toHaveBeenCalledWith(WORKSPACE_ID, "private", fileName, WORKSPACE_ID);
    });

    test("GET reads the object under the name as given", async () => {
      const response = await GET(request, params([fileName]));

      expect(response.status).toBe(200);
      expect(mocks.getFileStreamForDownload).toHaveBeenCalledWith(
        fileName,
        WORKSPACE_ID,
        "private",
        WORKSPACE_ID
      );
    });
  });

  test("DELETE joins nested segments without decoding them", async () => {
    await DELETE(request, params(["surveys", "survey-1", "elements", "el-1", "100%--fid--abc.png"]));

    expect(mocks.deleteFile).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "private",
      "surveys/survey-1/elements/el-1/100%--fid--abc.png",
      WORKSPACE_ID
    );
  });

  test("DELETE hands the access check the same segments it deletes", async () => {
    const filePath = ["surveys", "survey-1", "elements", "el-1", "100%--fid--abc.png"];

    await DELETE(request, params(filePath));

    expect(mocks.authorizePrivateDownload).toHaveBeenCalledWith(request, WORKSPACE_ID, "DELETE", filePath);
  });

  test("DELETE reports a storage failure through the shared error response", async () => {
    mocks.deleteFile.mockResolvedValue({ ok: false, error: { code: "file_not_found_error" } });
    mocks.getErrorResponseFromStorageError.mockReturnValue(new Response(null, { status: 404 }));

    const response = await DELETE(request, params(["missing--fid--abc.png"]));

    expect(response.status).toBe(404);
    expect(mocks.logFileDeletion).toHaveBeenCalledWith(
      expect.objectContaining({ failureReason: "file_not_found_error" })
    );
  });
});
