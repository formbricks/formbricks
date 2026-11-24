import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { AuthorizationError, TooManyRequestsError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { assertFeedbackSourceDirectoryAccess } from "@/lib/feedback-source/access";
import { importCsvFile } from "@/lib/feedback-source/csv-file-import";
import { getFeedbackSourceWithMappingsById } from "@/lib/feedback-source/service";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CSV_FILE_TOO_LARGE_ERROR_CODE } from "@/modules/ee/unify-feedback/sources/types";
import { POST } from "./route";

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/feedback-source/access", () => ({
  assertFeedbackSourceDirectoryAccess: vi.fn(),
}));
vi.mock("@/lib/feedback-source/csv-file-import", () => ({
  CsvImportValidationError: class CsvImportValidationError extends Error {},
  importCsvFile: vi.fn(),
}));
vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourceWithMappingsById: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "http://localhost",
  AUTH_TRUSTED_ORIGINS: ["http://localhost"],
  BETTER_AUTH_ENV_TRUSTED_ORIGINS: [],
}));

const userId = "user_1";
const workspaceId = "workspace_1";
const feedbackSourceId = "source_1";
const feedbackDirectoryId = "directory_1";

const makeRequest = (headers: Record<string, string> = {}): Request => {
  const body = new FormData();
  body.set("workspaceId", workspaceId);
  body.set("feedbackSourceId", feedbackSourceId);
  body.set("file", new File(["value\nexample"], "feedback.csv", { type: "text/csv" }));
  // A browser sends Sec-Fetch-Site; only the cross-origin tests omit it on purpose.
  const requestHeaders =
    headers.origin === undefined && headers["sec-fetch-site"] === undefined
      ? { "sec-fetch-site": "same-origin" }
      : headers;
  return new Request("http://localhost/api/unify-feedback/sources/csv/import", {
    method: "POST",
    body,
    headers: requestHeaders,
  });
};

describe("CSV feedback source import authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(getUser).mockResolvedValue({ id: userId } as never);
    vi.mocked(assertCan).mockResolvedValue(undefined);
    vi.mocked(getFeedbackSourceWithMappingsById).mockResolvedValue({ feedbackDirectoryId } as never);
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockResolvedValue(undefined);
    vi.mocked(importCsvFile).mockResolvedValue({ imported: 1 } as never);
  });

  test("refuses a same-site session upload with a 403 problem before reading anything (ENG-3380)", async () => {
    const response = await POST(makeRequest({ "sec-fetch-site": "same-site" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 403, code: "forbidden" });
    expect(getSession).not.toHaveBeenCalled();
    expect(importCsvFile).not.toHaveBeenCalled();
  });

  test("refuses a foreign Origin when Sec-Fetch-Site is absent", async () => {
    const response = await POST(makeRequest({ origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(importCsvFile).not.toHaveBeenCalled();
  });

  test("accepts a same-origin upload", async () => {
    const response = await POST(makeRequest({ "sec-fetch-site": "same-origin" }));

    expect(response.status).toBe(200);
    expect(importCsvFile).toHaveBeenCalledTimes(1);
  });

  test("rate-limits per user and answers a 429 problem with Retry-After", async () => {
    vi.mocked(applyRateLimit).mockRejectedValueOnce(new TooManyRequestsError("Too many requests", 30));

    const response = await POST(makeRequest());

    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.internalFeedbackCsvImport, userId);
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(importCsvFile).not.toHaveBeenCalled();
  });

  test("requires exact assignment write access before importing", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: userId }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    expect(assertFeedbackSourceDirectoryAccess).toHaveBeenCalledWith(
      userId,
      feedbackDirectoryId,
      workspaceId,
      "write"
    );
    expect(importCsvFile).toHaveBeenCalledWith({ feedbackSourceId, workspaceId, file: expect.any(File) });
  });

  test("preserves the existing forbidden response for a denied assignment", async () => {
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockRejectedValue(
      new AuthorizationError("Not authorized")
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(importCsvFile).not.toHaveBeenCalled();
  });

  test("does not log identifiers or raw operational errors", async () => {
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockRejectedValue(
      new Error(`evaluator failed for ${feedbackDirectoryId} and ${feedbackSourceId}`)
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const logOutput = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logOutput).not.toContain(feedbackDirectoryId);
    expect(logOutput).not.toContain(feedbackSourceId);
    expect(logOutput).not.toContain("evaluator failed");
  });

  test("refuses a chunked upload past the limit without buffering it whole", async () => {
    let pulled = 0;
    let cancelled = false;
    const request = new Request("http://localhost/api/unify-feedback/sources/csv/import", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "sec-fetch-site": "same-origin" },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          if (pulled >= 32 * 1024 * 1024) return controller.close();
          pulled += 1024 * 1024;
          controller.enqueue(new Uint8Array(1024 * 1024));
        },
        cancel() {
          cancelled = true;
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: CSV_FILE_TOO_LARGE_ERROR_CODE });
    expect(cancelled).toBe(true);
    // The limit is 16 MiB; an unbounded formData() would read all 32 MiB and answer 400 for the garbage.
    expect(pulled).toBeLessThanOrEqual(18 * 1024 * 1024);
    expect(importCsvFile).not.toHaveBeenCalled();
  });
});
