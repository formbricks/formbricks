import { afterEach, describe, expect, test, vi } from "vitest";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { RECORDS_PER_PAGE, countDirectoryRecords, listDirectoryRecords, sortRecords } from "./records-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, detail: string): Response =>
  new Response(JSON.stringify({ status, detail }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const requested = (fetchMock: ReturnType<typeof vi.fn>) => {
  const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
  return { path: url.pathname, params: url.searchParams };
};

const record = (id: string, fields: Record<string, string | undefined> = {}) =>
  ({ id, ...fields }) as unknown as FeedbackRecordData;

describe("listDirectoryRecords", () => {
  test("asks one directory for a page with the Hub query, repeated values as repeated keys", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [record("r1")], limit: 50, next_cursor: "cur_2" }));
    const signal = new AbortController().signal;

    const result = await listDirectoryRecords({
      tenantId: "tenant_1",
      query: { source_type: ["formbricks", "formbricks_survey"], sort: "created_at", order: "asc" },
      signal,
    });

    expect(result).toEqual({ records: [record("r1")], nextCursor: "cur_2" });
    const { path, params } = requested(fetchMock);
    expect(path).toBe("/api/v3/feedbackRecords");
    expect(params.get("tenant_id")).toBe("tenant_1");
    expect(params.get("limit")).toBe(String(RECORDS_PER_PAGE));
    expect(params.getAll("source_type")).toEqual(["formbricks", "formbricks_survey"]);
    expect(params.get("sort")).toBe("created_at");
    expect(params.has("cursor")).toBe(false);
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET", signal }));
  });

  test("sends the cursor for a later page and reads a missing body as an empty last page", async () => {
    const fetchMock = stubFetch(jsonResponse({ limit: 50 }));

    const result = await listDirectoryRecords({ tenantId: "tenant_1", query: {}, cursor: "cur_2" });

    expect(result).toEqual({ records: [], nextCursor: null });
    expect(requested(fetchMock).params.get("cursor")).toBe("cur_2");
  });

  test("throws the API's problem on an error response", async () => {
    stubFetch(problemResponse(502, "Hub unavailable"));

    await expect(listDirectoryRecords({ tenantId: "tenant_1", query: {} })).rejects.toMatchObject({
      name: "V3ApiError",
      status: 502,
      message: "Hub unavailable",
    });
  });
});

describe("countDirectoryRecords", () => {
  test("sends the filters but not the sort", async () => {
    const fetchMock = stubFetch(jsonResponse({ count: 12 }));

    await expect(
      countDirectoryRecords({
        tenantId: "tenant_1",
        query: { language: "en", sort: "created_at", order: "asc" },
      })
    ).resolves.toBe(12);

    const { path, params } = requested(fetchMock);
    expect(path).toBe("/api/v3/feedbackRecords/count");
    expect(params.get("tenant_id")).toBe("tenant_1");
    expect(params.get("language")).toBe("en");
    expect(params.has("sort")).toBe(false);
    expect(params.has("order")).toBe(false);
    expect(params.has("limit")).toBe(false);
  });

  test("reads the count from a data envelope, and treats a missing one as zero", async () => {
    stubFetch(jsonResponse({ data: { count: 7 } }));
    await expect(countDirectoryRecords({ tenantId: "tenant_1", query: {} })).resolves.toBe(7);

    stubFetch(jsonResponse({}));
    await expect(countDirectoryRecords({ tenantId: "tenant_1", query: {} })).resolves.toBe(0);
  });

  test("throws the API's problem on an error response", async () => {
    stubFetch(problemResponse(403, "Forbidden"));

    await expect(countDirectoryRecords({ tenantId: "tenant_1", query: {} })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("sortRecords", () => {
  const early = record("a", { collected_at: "2026-10-01", created_at: "2026-10-05" });
  const late = record("b", { collected_at: "2026-10-03", created_at: "2026-10-04" });

  test("orders by collected_at, newest first, by default", () => {
    expect(sortRecords([early, late], {}).map((r) => r.id)).toEqual(["b", "a"]);
  });

  test("orders by created_at ascending when asked", () => {
    expect(sortRecords([early, late], { sort: "created_at", order: "asc" }).map((r) => r.id)).toEqual([
      "b",
      "a",
    ]);
  });

  test("breaks a tie by id, so merged pages come out the same whatever order they arrived in", () => {
    const x = record("x", { collected_at: "2026-10-01" });
    const y = record("y", { collected_at: "2026-10-01" });
    for (const order of ["asc", "desc"]) {
      const ids = (input: FeedbackRecordData[]) => sortRecords(input, { order }).map((r) => r.id);
      expect(ids([x, y])).toEqual(ids([y, x]));
    }
  });

  test("puts a record without the field last when newest comes first", () => {
    const undated = record("u");
    expect(sortRecords([undated, early], {}).map((r) => r.id)).toEqual(["a", "u"]);
    expect(sortRecords([early, undated], {}).map((r) => r.id)).toEqual(["a", "u"]);
  });

  test("does not mutate the input", () => {
    const input = [early, late];
    sortRecords(input, {});
    expect(input).toEqual([early, late]);
  });
});
