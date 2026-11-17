import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  authorizePrivateDownload: vi.fn(),
  getFileStreamForDownload: vi.fn(),
  resolveClientApiIds: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/storage/[workspaceId]/[accessType]/[...filePath]/lib/auth", () => ({
  authorizePrivateDownload: mocks.authorizePrivateDownload,
}));
vi.mock("./lib/audit-logs", () => ({ logFileDeletion: vi.fn() }));
vi.mock("@/lib/utils/resolve-client-id", () => ({ resolveClientApiIds: mocks.resolveClientApiIds }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { storage: { delete: {} } },
}));
vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
  getFileStreamForDownload: mocks.getFileStreamForDownload,
}));
vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: vi.fn(),
}));

const WORKSPACE_ID = "ws-1";

const request = new NextRequest(`http://localhost/storage/${WORKSPACE_ID}/private/file`);

const params = (filePath: string[], accessType = "private") => ({
  params: Promise.resolve({ workspaceId: WORKSPACE_ID, accessType, filePath }),
});

describe("storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveClientApiIds.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.authorizePrivateDownload.mockResolvedValue({
      ok: true,
      data: { authType: "session", userId: "user-1" },
    });
    mocks.getFileStreamForDownload.mockResolvedValue({
      ok: true,
      data: { body: new ReadableStream(), contentType: "image/png", contentLength: 1 },
    });
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
});
