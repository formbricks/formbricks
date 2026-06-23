import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  archiveWorkflow,
  disableWorkflow,
  enableWorkflow,
  getWorkflow,
  unarchiveWorkflow,
  updateWorkflow,
} from "./api-client";

const workflow = { id: "wf1", name: "x" };
const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWorkflow", () => {
  test("GETs the workflow endpoint and returns data", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(workflow));
    const signal = new AbortController().signal;

    const result = await getWorkflow("wf1", signal);

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/workflows/wf1", {
      method: "GET",
      cache: "no-store",
      signal,
    });
    expect(result).toEqual(workflow);
  });

  test("throws V3ApiError when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: { get: () => null },
      json: async () => ({ detail: "missing" }),
    } as unknown as Response);

    await expect(getWorkflow("wf1")).rejects.toBeInstanceOf(V3ApiError);
  });
});

describe("updateWorkflow", () => {
  test("PATCHes with JSON body", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(workflow));

    await updateWorkflow("wf1", { name: "new" });

    expect(fetchMock).toHaveBeenCalledWith("/api/v3/workflows/wf1", {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new" }),
      signal: expect.any(AbortSignal),
    });
  });
});

describe("lifecycle endpoints", () => {
  test.each([
    [enableWorkflow, "enable"],
    [disableWorkflow, "disable"],
    [archiveWorkflow, "archive"],
    [unarchiveWorkflow, "unarchive"],
  ] as const)("POSTs /:id/%s", async (fn, action) => {
    fetchMock.mockResolvedValueOnce(okResponse(workflow));

    await fn("wf1");

    expect(fetchMock).toHaveBeenCalledWith(`/api/v3/workflows/wf1/${action}`, {
      method: "POST",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });
});
