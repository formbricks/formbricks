import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getTaxonomyFields,
  getTaxonomyNodeRecords,
  getTaxonomyRun,
  getTaxonomyState,
  removeTaxonomyNode,
  renameTaxonomyNode,
  triggerTaxonomyRun,
} from "./api-client";

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

describe("getTaxonomyState", () => {
  test("forwards the full scope (incl. the empty sourceId) and returns body.data", async () => {
    const state = { activeTree: null, runs: [], unavailable: false };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: state }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTaxonomyState({
      workspaceId: "w",
      directoryId: "d",
      sourceType: "survey",
      sourceId: "",
      fieldId: "q1",
    });

    expect(result).toEqual(state);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/state?workspaceId=w&directoryId=d&sourceType=survey&sourceId=&fieldId=q1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });
});

describe("getTaxonomyRun", () => {
  test("hits the run route with the encoded runId and returns body.data", async () => {
    const run = { id: "run-1", status: "running" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: run }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" });

    expect(result).toEqual(run);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/runs/run-1?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });
});

describe("getTaxonomyNodeRecords (error path)", () => {
  test("throws a parsed V3ApiError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problemResponse(500, "boom")));

    await expect(
      getTaxonomyNodeRecords({ workspaceId: "w", directoryId: "d", nodeId: "n", limit: 100 })
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("triggerTaxonomyRun", () => {
  test("POSTs the scope as JSON and returns body.data", async () => {
    const params = {
      workspaceId: "w",
      directoryId: "d",
      sourceType: "survey",
      sourceId: "",
      fieldId: "q1",
      fieldLabel: "Q1",
    };
    const payload = { run: { id: "run-1" }, inProgress: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: payload }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerTaxonomyRun(params);

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/runs",
      expect.objectContaining({ method: "POST", body: JSON.stringify(params) })
    );
  });

  test("throws a parsed V3ApiError on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problemResponse(409, "already running")));

    await expect(
      triggerTaxonomyRun({
        workspaceId: "w",
        directoryId: "d",
        sourceType: "survey",
        sourceId: "",
        fieldId: "q1",
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("renameTaxonomyNode", () => {
  test("PATCHes the node with the new label and returns body.data", async () => {
    const node = { id: "n", label: "Renamed" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: node }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await renameTaxonomyNode({
      workspaceId: "w",
      directoryId: "d",
      nodeId: "n",
      label: "Renamed",
    });

    expect(result).toEqual(node);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/nodes/n",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ workspaceId: "w", directoryId: "d", label: "Renamed" }),
      })
    );
  });
});
