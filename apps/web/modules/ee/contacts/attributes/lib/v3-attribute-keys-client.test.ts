import { afterEach, describe, expect, test, vi } from "vitest";
import { listAttributeKeys } from "./v3-attribute-keys-client";

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

const meta = { limit: 25, nextCursor: null, totalCount: 1 };

describe("listAttributeKeys", () => {
  test("stamps each key with the workspace and turns timestamps into Dates", async () => {
    stubFetch(
      jsonResponse({
        data: [
          {
            id: "key_1",
            key: "plan",
            name: "Plan",
            description: null,
            type: "custom",
            dataType: "string",
            isUnique: false,
            createdAt: "2026-10-01T10:00:00.000Z",
            updatedAt: "2026-10-02T11:00:00.000Z",
          },
        ],
        meta,
      })
    );

    const result = await listAttributeKeys({ workspaceId: "ws_1", limit: 25, params: [] });

    expect(result.meta).toEqual(meta);
    expect(result.data[0]).toMatchObject({ id: "key_1", key: "plan", workspaceId: "ws_1" });
    expect(result.data[0].createdAt).toEqual(new Date("2026-10-01T10:00:00.000Z"));
    expect(result.data[0].updatedAt).toEqual(new Date("2026-10-02T11:00:00.000Z"));
  });

  test("on page one sends the filter params and asks for the match count", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [], meta }));
    const signal = new AbortController().signal;

    await listAttributeKeys({
      workspaceId: "ws_1",
      limit: 25,
      params: [
        ["filter[type][in]", "custom"],
        ["filter[type][in]", "default"],
      ],
      signal,
    });

    expect((fetchMock.mock.calls[0][0] as string).startsWith("/api/v3/contact-attribute-keys?")).toBe(true);
    const params = requestedParams(fetchMock);
    expect(params.get("workspaceId")).toBe("ws_1");
    expect(params.get("limit")).toBe("25");
    expect(params.getAll("filter[type][in]")).toEqual(["custom", "default"]);
    expect(params.get("includeTotalCount")).toBe("true");
    expect(params.has("cursor")).toBe(false);
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ signal }));
  });

  test("on a later page sends the cursor and no count request", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [], meta }));

    await listAttributeKeys({ workspaceId: "ws_1", limit: 25, cursor: "cur_2", params: [] });

    const params = requestedParams(fetchMock);
    expect(params.get("cursor")).toBe("cur_2");
    expect(params.has("includeTotalCount")).toBe(false);
  });

  test("throws the API's problem on an error response", async () => {
    stubFetch(
      new Response(JSON.stringify({ status: 400, detail: "Unknown filter" }), {
        status: 400,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    await expect(listAttributeKeys({ workspaceId: "ws_1", limit: 25, params: [] })).rejects.toMatchObject({
      name: "V3ApiError",
      status: 400,
      message: "Unknown filter",
    });
  });
});
