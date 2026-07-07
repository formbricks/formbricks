import { afterEach, describe, expect, test, vi } from "vitest";
import { getTaxonomyFields, getTaxonomyNodeRecords, removeTaxonomyNode } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, detail: string): Response =>
  new Response(JSON.stringify({ title: "Error", status, detail, code: "error", requestId: "req_1" }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

describe("getTaxonomyFields", () => {
  test("returns body.data and calls the fields route with workspaceId + directoryId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { fields: [], unavailable: false } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTaxonomyFields({ workspaceId: "w", directoryId: "d" });

    expect(result).toEqual({ fields: [], unavailable: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/fields?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("throws a parsed V3ApiError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problemResponse(403, "nope")));

    await expect(getTaxonomyFields({ workspaceId: "w", directoryId: "d" })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("getTaxonomyNodeRecords", () => {
  test("maps { data, meta.limit } to { records, limit }", async () => {
    const record = { id: "rec-1" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [record], meta: { limit: 100 } })));

    const result = await getTaxonomyNodeRecords({
      workspaceId: "w",
      directoryId: "d",
      nodeId: "n",
      limit: 100,
    });

    expect(result).toEqual({ records: [record], limit: 100 });
  });
});

describe("removeTaxonomyNode", () => {
  test("issues a DELETE and resolves on 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      removeTaxonomyNode({ workspaceId: "w", directoryId: "d", nodeId: "n" })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/nodes/n?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "DELETE", cache: "no-store" })
    );
  });
});
