import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { getFileStreamForDownload } from "@/modules/storage/service";
import { authorizePrivateDownload } from "./lib/auth";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/utils/resolve-client-id", () => ({ resolveClientApiIds: vi.fn() }));
vi.mock("./lib/auth", () => ({ authorizePrivateDownload: vi.fn() }));
vi.mock("./lib/audit-logs", () => ({ logFileDeletion: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/storage/service", () => ({ getFileStreamForDownload: vi.fn(), deleteFile: vi.fn() }));

const WORKSPACE_ID = "cm8cmpnjj000108jfdr9wks01";

const get = (filePath: string[]) =>
  GET({} as NextRequest, {
    params: Promise.resolve({ workspaceId: WORKSPACE_ID, accessType: "private", filePath }),
  });

describe("GET /storage/[workspaceId]/[accessType]/[...filePath]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveClientApiIds).mockResolvedValue({ workspaceId: WORKSPACE_ID } as never);
    vi.mocked(authorizePrivateDownload).mockResolvedValue({ ok: true, data: undefined } as never);
    vi.mocked(getFileStreamForDownload).mockResolvedValue({
      ok: true,
      data: { body: new ReadableStream(), contentType: "image/jpeg", contentLength: 1 },
    } as never);
  });

  test.each([
    ["by path segments", ["surveys", "srv1", "exports", "exp1.zip"]],
    ["percent-encoded into one segment", ["surveys%2Fsrv1%2Fexports%2Fexp1.zip"]],
  ])("refuses an attachment export archive %s", async (_label, filePath) => {
    const response = await get(filePath);

    expect(response.status).toBe(404);
    // Refused before any lookup: the only way to an archive is the audited, requester-scoped route.
    expect(authorizePrivateDownload).not.toHaveBeenCalled();
    expect(getFileStreamForDownload).not.toHaveBeenCalled();
  });

  test("still serves a survey's uploaded files", async () => {
    const response = await get(["surveys", "srv1", "elements", "el1", "photo--fid--1.jpg"]);

    expect(response.status).toBe(200);
    expect(getFileStreamForDownload).toHaveBeenCalled();
  });
});
