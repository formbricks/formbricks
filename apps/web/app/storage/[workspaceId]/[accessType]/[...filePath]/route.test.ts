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

  // Regression (ENG-7108): the stored Content-Type came from the uploader, and browsers read
  // `image/png;,text/html` as HTML, so an uploaded ".png" ran script on the app origin.
  describe("served Content-Type", () => {
    test.each(["private", "public"])(
      "GET serves a %s file by its extension, never by the type stored with it",
      async (accessType) => {
        mocks.getFileStreamForDownload.mockResolvedValue({
          ok: true,
          data: { body: new ReadableStream(), contentType: "image/png;,text/html", contentLength: 1 },
        });

        const response = await GET(request, params(["evil--fid--1.png"], accessType));

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/png");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      }
    );

    test.each([
      ["report--fid--1.PDF", "application/pdf"],
      ["notes--fid--1.txt", "text/plain"],
      ["legacy--fid--1.svg", "application/octet-stream"],
    ])("GET serves %s as %s", async (fileName, expected) => {
      const response = await GET(request, params([fileName]));

      expect(response.headers.get("Content-Type")).toBe(expected);
    });
  });

  describe("attachment export archives", () => {
    test.each([
      ["by path segments", ["surveys", "srv1", "exports", "exp1.zip"]],
      ["percent-encoded into one segment", ["surveys%2Fsrv1%2Fexports%2Fexp1.zip"]],
    ])("GET refuses an archive %s", async (_label, filePath) => {
      const response = await GET(request, params(filePath));

      expect(response.status).toBe(404);
      // Refused before any lookup: the only way to an archive is the audited, requester-scoped route.
      expect(mocks.authorizePrivateDownload).not.toHaveBeenCalled();
      expect(mocks.getFileStreamForDownload).not.toHaveBeenCalled();
    });

    test("GET still serves a survey's uploaded files", async () => {
      const response = await GET(
        request,
        params(["surveys", "srv1", "elements", "el1", "photo--fid--1.jpg"])
      );

      expect(response.status).toBe(200);
      expect(mocks.getFileStreamForDownload).toHaveBeenCalled();
    });
  });
});
