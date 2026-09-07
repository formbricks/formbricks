import { afterEach, describe, expect, test, vi } from "vitest";
import { deleteTag, getTags, mergeTags, renameTag } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, detail: string, invalid_params?: unknown): Response =>
  new Response(
    JSON.stringify({ title: "Error", status, detail, code: "error", requestId: "req_1", invalid_params }),
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    }
  );

const tag = { id: "cltt1234567890123456789012", name: "Bug report", count: 3 };

describe("getTags", () => {
  test("returns body.data and passes the workspace as a query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [tag] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTags({ workspaceId: "ws_1" })).resolves.toEqual([tag]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/tags?workspaceId=ws_1",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("forwards the abort signal, so a superseded list request is cancelled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    await getTags({ workspaceId: "ws_1", signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/tags?workspaceId=ws_1",
      expect.objectContaining({ signal })
    );
  });

  test("encodes a workspace id rather than splicing it into the URL raw", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getTags({ workspaceId: "a b&c=d" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v3/tags?workspaceId=a+b%26c%3Dd");
  });
});

describe("renameTag", () => {
  test("PATCHes the tag route with the new name as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ...tag, name: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameTag({ tagId: tag.id, name: "Renamed" })).resolves.toMatchObject({ name: "Renamed" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v3/tags/${tag.id}`,
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      })
    );
  });

  test("throws a parsed V3ApiError carrying invalid_params, which is how a duplicate is recognised", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          problemResponse(422, "Unable to update tag", [{ name: "name", reason: "tag_name_already_exists" }])
        )
    );

    await expect(renameTag({ tagId: tag.id, name: "Taken" })).rejects.toMatchObject({
      status: 422,
      invalid_params: [{ name: "name", reason: "tag_name_already_exists" }],
    });
  });
});

describe("deleteTag", () => {
  test("issues a DELETE and returns the removed id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: tag.id } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteTag({ tagId: tag.id })).resolves.toEqual({ id: tag.id });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v3/tags/${tag.id}`,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("throws on a forbidden response instead of resolving as if it worked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problemResponse(403, "not yours")));

    await expect(deleteTag({ tagId: tag.id })).rejects.toMatchObject({ status: 403 });
  });
});

describe("mergeTags", () => {
  test("POSTs to the merge sub-route with the target id in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "clyy1234567890123456789012" } }));
    vi.stubGlobal("fetch", fetchMock);

    await mergeTags({ tagId: tag.id, newTagId: "clyy1234567890123456789012" });

    // The source is in the path and the target in the body: the route authorizes on the path id.
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v3/tags/${tag.id}/merge`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newTagId: "clyy1234567890123456789012" }),
      })
    );
  });
});
