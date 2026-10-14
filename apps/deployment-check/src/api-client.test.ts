import { afterEach, describe, expect, test, vi } from "vitest";
import { createApiClient, problemDetail } from "./api-client.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig({
  FORMBRICKS_URL: "https://admin.example.com",
  FORMBRICKS_PUBLIC_URL: "https://surveys.example.com",
  FORMBRICKS_API_KEY: "fbk_secret",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (response: Response | Error) => {
  const fetchMock = vi.fn((_url: string, _init?: unknown) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const headersOf = (fetchMock: ReturnType<typeof stubFetch>) =>
  (fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;

describe("createApiClient", () => {
  test("sends the key to the admin origin by default", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await createApiClient(config).get("/api/v2/me");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://admin.example.com/api/v2/me");
    expect(headersOf(fetchMock)["x-api-key"]).toBe("fbk_secret");
  });

  test("never sends the key when the call is unauthenticated, and uses the public origin on request", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await createApiClient(config).get("/health", { authenticated: false, origin: "publicUrl" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://surveys.example.com/health");
    expect(headersOf(fetchMock)).not.toHaveProperty("x-api-key");
  });

  test("sends a JSON body with a content type", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 201 }));

    await createApiClient(config).post("/api/v3/surveys", { name: "x" });

    expect(headersOf(fetchMock)["content-type"]).toBe("application/json");
    expect((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body).toBe('{"name":"x"}');
  });

  test("returns the status and parsed JSON without throwing on a non-2xx", async () => {
    stubFetch(new Response('{"detail":"nope"}', { status: 403 }));

    const response = await createApiClient(config).get("/x");

    expect(response).toMatchObject({ status: 403, ok: false, json: { detail: "nope" } });
  });

  test("leaves json undefined for a non-JSON body", async () => {
    stubFetch(new Response("<html>", { status: 502 }));

    expect((await createApiClient(config).get("/x")).json).toBeUndefined();
  });

  test("turns a network error into a failure naming the URL and a next step, without the key", async () => {
    stubFetch(new Error("ECONNREFUSED"));

    const failure = createApiClient(config).get("/api/v2/me");

    await expect(failure).rejects.toThrow(
      /Network: could not reach https:\/\/admin\.example\.com\/api\/v2\/me.*ECONNREFUSED.*Next step/
    );
    await expect(failure).rejects.not.toThrow(/fbk_secret/);
  });
});

describe("problemDetail", () => {
  const response = (json: unknown, text = "") => ({ status: 400, ok: false, text, json });

  test("prefers the problem detail", () => {
    expect(problemDetail(response({ detail: "Invalid request body", title: "Bad Request" }))).toBe(
      "Invalid request body"
    );
  });

  test("appends every invalid param", () => {
    expect(
      problemDetail(
        response({
          detail: "Invalid request body",
          invalid_params: [
            { name: "endings.0.id", reason: "Missing" },
            { name: "blocks", reason: "Empty" },
          ],
        })
      )
    ).toBe("Invalid request body (endings.0.id: Missing; blocks: Empty)");
  });

  test("falls back to the title, then to the raw text", () => {
    expect(problemDetail(response({ title: "Bad Request" }))).toBe("Bad Request");
    expect(problemDetail(response(undefined, "gateway timeout"))).toBe("gateway timeout");
  });
});
