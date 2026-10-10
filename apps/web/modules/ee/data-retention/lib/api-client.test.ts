import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { RETENTION_EXPORT_FALLBACK_FILE_NAME, fetchRetentionExport } from "./api-client";

const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ status, code, detail: "English text from the server" }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

describe("fetchRetentionExport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the organization's export uncached, and returns the body under the server's name", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("runId,policy\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="retention-history-org_1-2030-01-01.csv"',
        },
      })
    );

    const file = await fetchRetentionExport({ organizationId: "org_1" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/internal/retention-runs/export?organizationId=org_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
    expect(file.fileName).toBe("retention-history-org_1-2030-01-01.csv");
    expect(await file.blob.text()).toBe("runId,policy\n");
  });

  test("names the file itself when the response doesn't", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("runId\n", { status: 200 }));

    expect((await fetchRetentionExport({ organizationId: "org_1" })).fileName).toBe(
      RETENTION_EXPORT_FALLBACK_FILE_NAME
    );
  });

  test.each([
    [422, "retention_export_too_large"],
    [429, "too_many_requests"],
  ])("throws a %i refusal as a problem rather than returning it as the CSV", async (status, code) => {
    vi.mocked(global.fetch).mockResolvedValueOnce(problem(status, code));

    const error = await fetchRetentionExport({ organizationId: "org_1" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status, code });
  });
});
