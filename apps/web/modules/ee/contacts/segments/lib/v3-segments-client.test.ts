import { afterEach, describe, expect, test, vi } from "vitest";
import { listSegments } from "./v3-segments-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const requestedParams = (fetchMock: ReturnType<typeof vi.fn>) =>
  new URL(fetchMock.mock.calls[0][0] as string, "http://localhost").searchParams;

const meta = { limit: 20, nextCursor: "cur_2", totalCount: 1 };

describe("listSegments", () => {
  test("turns the API's ISO timestamps into Dates and keeps the page meta", async () => {
    stubFetch(
      jsonResponse({
        data: [
          {
            id: "seg_1",
            title: "Power users",
            createdAt: "2026-10-01T10:00:00.000Z",
            updatedAt: "2026-10-02T11:00:00.000Z",
          },
        ],
        meta,
      })
    );

    const result = await listSegments({
      workspaceId: "ws_1",
      limit: 20,
      search: "",
      sortBy: "-updatedAt",
    });

    expect(result.meta).toEqual(meta);
    expect(result.data[0]).toMatchObject({ id: "seg_1", title: "Power users" });
    expect(result.data[0].createdAt).toEqual(new Date("2026-10-01T10:00:00.000Z"));
    expect(result.data[0].updatedAt).toEqual(new Date("2026-10-02T11:00:00.000Z"));
  });

  test("sends workspace, limit and sort, and leaves out a blank search and the cursor on page one, and asks for the count", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [], meta }));
    const signal = new AbortController().signal;

    await listSegments({ workspaceId: "ws_1", limit: 20, search: "   ", sortBy: "title", signal });

    expect((fetchMock.mock.calls[0][0] as string).startsWith("/api/v3/segments?")).toBe(true);
    const params = requestedParams(fetchMock);
    expect(params.get("workspaceId")).toBe("ws_1");
    expect(params.get("limit")).toBe("20");
    expect(params.get("sortBy")).toBe("title");
    expect(params.has("filter[title][contains]")).toBe(false);
    expect(params.has("cursor")).toBe(false);
    expect(params.get("includeTotalCount")).toBe("true");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ signal }));
  });

  test("trims the search and, on a later page, sends the cursor without a count", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [], meta }));

    await listSegments({
      workspaceId: "ws_1",
      limit: 20,
      cursor: "cur_2",
      search: " power ",
      sortBy: "title",
    });

    const params = requestedParams(fetchMock);
    expect(params.get("filter[title][contains]")).toBe("power");
    expect(params.get("cursor")).toBe("cur_2");
    expect(params.has("includeTotalCount")).toBe(false);
  });

  test("throws the API's problem on an error response", async () => {
    stubFetch(
      new Response(JSON.stringify({ status: 422, detail: "Invalid sortBy" }), {
        status: 422,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    await expect(
      listSegments({ workspaceId: "ws_1", limit: 20, search: "", sortBy: "bogus" })
    ).rejects.toMatchObject({ name: "V3ApiError", status: 422, message: "Invalid sortBy" });
  });
});
