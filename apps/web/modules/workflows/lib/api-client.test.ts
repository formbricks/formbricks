/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TCreateWorkflowInput } from "@formbricks/workflows";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  archiveWorkflow,
  buildWorkflowListSearchParams,
  createWorkflow,
  deleteWorkflow,
  disableWorkflow,
  duplicateWorkflow,
  enableWorkflow,
  getWorkflow,
  listWorkflows,
  testWorkflow,
  unarchiveWorkflow,
  updateWorkflow,
} from "./api-client";
import { createDefaultWorkflowDefinition } from "./default-workflow";

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

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json" } });

describe("testWorkflow", () => {
  test("POSTs /:id/test and returns the validation result", async () => {
    const result = {
      workflowId: "wf1",
      ok: false,
      problems: [{ code: "survey_not_found", field: "f", message: "m" }],
    };
    fetchMock.mockResolvedValueOnce(okResponse(result));

    await expect(testWorkflow("wf1")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/v3/workflows/wf1/test", {
      method: "POST",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  test("throws V3ApiError on a non-ok response (e.g. 422 draft/archived)", async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse(422, {
        code: "invalid_workflow_state",
        detail: "Only enabled or disabled workflows can be tested.",
      })
    );

    await expect(testWorkflow("wf1")).rejects.toMatchObject({
      name: "V3ApiError",
      status: 422,
      code: "invalid_workflow_state",
      detail: "Only enabled or disabled workflows can be tested.",
    });
  });
});

describe("buildWorkflowListSearchParams", () => {
  test("encodes workspace, limit, cursor, sort and the filter[...] family", () => {
    const params = buildWorkflowListSearchParams({
      workspaceId: "ws_1",
      limit: 12,
      cursor: "cursor_1",
      filters: { nameContains: "  onboarding  ", statusIn: ["draft", "enabled"], sortBy: "name" },
    });

    expect(params.get("workspaceId")).toBe("ws_1");
    expect(params.get("limit")).toBe("12");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("filter[name][contains]")).toBe("onboarding");
    expect(params.getAll("filter[status][in]")).toEqual(["draft", "enabled"]);
  });

  test("omits cursor, sort and filters when not provided", () => {
    const params = buildWorkflowListSearchParams({ workspaceId: "ws_1", limit: 12 });

    expect(params.has("cursor")).toBe(false);
    expect(params.has("sortBy")).toBe(false);
    expect(params.has("filter[name][contains]")).toBe(false);
    expect(params.has("filter[status][in]")).toBe(false);
  });

  test("omits a blank or whitespace-only name filter", () => {
    const params = buildWorkflowListSearchParams({
      workspaceId: "ws_1",
      limit: 12,
      filters: { nameContains: "   " },
    });

    expect(params.has("filter[name][contains]")).toBe(false);
  });
});

describe("workflows api-client requests", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("listWorkflows requests the list endpoint and returns the cursor page unchanged", async () => {
    const page = {
      data: [{ id: "wf_1", name: "Workflow 1" }],
      meta: { limit: 12, nextCursor: "cursor_1" },
    };
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(page));

    const result = await listWorkflows({ workspaceId: "ws_1", limit: 12, filters: { nameContains: "abc" } });

    expect(result).toEqual(page);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows?workspaceId=ws_1&limit=12&filter%5Bname%5D%5Bcontains%5D=abc",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("createWorkflow posts the input and unwraps the resource", async () => {
    const resource = { id: "wf_new", name: "New", status: "draft" };
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ data: resource }, 201));

    const input: TCreateWorkflowInput = {
      workspaceId: "ws_1",
      name: "New",
      description: null,
      status: "draft" as const,
      definition: createDefaultWorkflowDefinition(),
    };
    const result = await createWorkflow(input);

    expect(result).toEqual(resource);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(url).toBe("/api/v3/workflows");
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      workspaceId: "ws_1",
      name: "New",
    });
  });

  test("duplicateWorkflow posts an empty body when no name is given", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ data: { id: "wf_copy" } }, 201));

    const result = await duplicateWorkflow("wf_1");

    expect(result).toEqual({ id: "wf_copy" });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(url).toBe("/api/v3/workflows/wf_1/duplicate");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({});
  });

  test("archiveWorkflow posts to the archive endpoint and unwraps the resource", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ data: { id: "wf_1", status: "archived" } }));

    const result = await archiveWorkflow("wf_1");

    expect(result).toEqual({ id: "wf_1", status: "archived" });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1/archive",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  test("unarchiveWorkflow posts to the unarchive endpoint and unwraps the resource", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ data: { id: "wf_1", status: "disabled" } }));

    const result = await unarchiveWorkflow("wf_1");

    expect(result).toEqual({ id: "wf_1", status: "disabled" });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1/unarchive",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
  });

  test("deleteWorkflow resolves on a 204 with no body", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteWorkflow("wf_1")).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1",
      expect.objectContaining({ method: "DELETE", cache: "no-store" })
    );
  });

  test("maps a problem+json error response to a V3ApiError carrying the detail", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      problemResponse(403, {
        title: "Forbidden",
        status: 403,
        detail: "You are not authorized to access this resource",
        code: "forbidden",
        requestId: "req_1",
      })
    );

    await expect(listWorkflows({ workspaceId: "ws_1", limit: 12 })).rejects.toBeInstanceOf(V3ApiError);
  });

  test("propagates the parsed problem detail and code on a failed mutation", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      problemResponse(400, {
        title: "Bad Request",
        status: 400,
        detail: "The request payload is invalid.",
        code: "bad_request",
        requestId: "req_2",
      })
    );

    await expect(archiveWorkflow("wf_1")).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
      message: "The request payload is invalid.",
    });
  });
});
