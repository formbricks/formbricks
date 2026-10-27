import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { listContactAttributeValues, listContacts } from "./v3-contacts-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, detail: string): Response =>
  new Response(JSON.stringify({ status, detail, code: "error" }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const requestedParams = (fetchMock: ReturnType<typeof vi.fn>) => {
  const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
  return { path: url.pathname, params: url.searchParams };
};

const page = { data: [], meta: { limit: 25, nextCursor: null, totalCount: 0 } };

describe("listContacts", () => {
  test("sends every filter param as given, repeated keys included, and asks for a count on page one", async () => {
    const fetchMock = stubFetch(jsonResponse(page));
    const signal = new AbortController().signal;

    await expect(
      listContacts({
        workspaceId: "ws_1",
        limit: 25,
        params: [
          ["filter[attributes.plan][in]", "pro"],
          ["filter[attributes.plan][in]", "team"],
        ],
        signal,
      })
    ).resolves.toEqual(page);

    const { path, params } = requestedParams(fetchMock);
    expect(path).toBe("/api/v3/contacts");
    expect(params.get("workspaceId")).toBe("ws_1");
    expect(params.get("limit")).toBe("25");
    expect(params.getAll("filter[attributes.plan][in]")).toEqual(["pro", "team"]);
    expect(params.has("cursor")).toBe(false);
    expect(params.get("includeTotalCount")).toBe("true");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET", signal }));
  });

  test("a later page sends the cursor and skips the count", async () => {
    const fetchMock = stubFetch(jsonResponse(page));

    await listContacts({ workspaceId: "ws_1", limit: 25, cursor: "cur_2", params: [] });

    const { params } = requestedParams(fetchMock);
    expect(params.get("cursor")).toBe("cur_2");
    expect(params.has("includeTotalCount")).toBe(false);
  });

  test("throws the API's problem as a V3ApiError", async () => {
    stubFetch(problemResponse(400, "Unknown filter"));

    await expect(listContacts({ workspaceId: "ws_1", limit: 25, params: [] })).rejects.toMatchObject({
      name: "V3ApiError",
      status: 400,
      message: "Unknown filter",
    });
  });
});

describe("listContactAttributeValues", () => {
  test("returns the distinct values, bounded by the default limit", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [{ value: "pro" }, { value: "team" }] }));

    await expect(
      listContactAttributeValues({ workspaceId: "ws_1", key: "plan", search: "" })
    ).resolves.toEqual(["pro", "team"]);

    const { path, params } = requestedParams(fetchMock);
    expect(path).toBe("/api/v3/contacts/attribute-values");
    expect(params.get("key")).toBe("plan");
    expect(params.get("limit")).toBe("50");
    expect(params.has("search")).toBe(false);
  });

  test("passes a search term and a custom limit", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: [] }));

    await listContactAttributeValues({ workspaceId: "ws_1", key: "plan", search: "pr", limit: 10 });

    const { params } = requestedParams(fetchMock);
    expect(params.get("search")).toBe("pr");
    expect(params.get("limit")).toBe("10");
  });

  test("throws on an error response", async () => {
    stubFetch(problemResponse(403, "Forbidden"));

    await expect(
      listContactAttributeValues({ workspaceId: "ws_1", key: "plan", search: "" })
    ).rejects.toBeInstanceOf(V3ApiError);
  });
});
