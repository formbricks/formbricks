import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildApiUrl, getApiData, sendApiRequest } from "./internal-api-client";
import { V3ApiError } from "./v3-client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("buildApiUrl", () => {
  test("appends defined params and skips null and undefined", () => {
    expect(buildApiUrl("/api/internal/things", { a: "x y", b: 2, c: false, d: null, e: undefined })).toBe(
      "/api/internal/things?a=x+y&b=2&c=false"
    );
  });

  test("leaves the path alone when there is nothing to add", () => {
    expect(buildApiUrl("/api/internal/things", { d: null })).toBe("/api/internal/things");
    expect(buildApiUrl("/api/internal/things")).toBe("/api/internal/things");
  });
});

describe("getApiData", () => {
  test("unwraps the data envelope and forwards the abort signal, never using the browser cache", async () => {
    fetchMock.mockResolvedValue(json({ data: [{ id: "1" }] }));
    const signal = new AbortController().signal;

    await expect(getApiData("/api/internal/things", { signal })).resolves.toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/internal/things", {
      method: "GET",
      cache: "no-store",
      signal,
    });
  });

  test("throws the problem as a V3ApiError carrying status, code and request id", async () => {
    fetchMock.mockResolvedValue(
      json({ status: 403, detail: "Nope", code: "forbidden", requestId: "req_1" }, 403)
    );

    const error = await getApiData("/api/internal/things").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status: 403, detail: "Nope", code: "forbidden", requestId: "req_1" });
  });
});

describe("sendApiRequest", () => {
  test("sends a JSON body with a timeout and returns the unwrapped data", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: "1" } }, 201));

    await expect(
      sendApiRequest("/api/internal/things", { method: "POST", body: { name: "x" } })
    ).resolves.toEqual({ id: "1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("sends no body or content type when there is nothing to send, and resolves a 204 to undefined", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(sendApiRequest("/api/internal/things/1", { method: "DELETE" })).resolves.toBeUndefined();

    const [, init] = fetchMock.mock.calls[0];
    expect(init).not.toHaveProperty("body");
    expect(init).not.toHaveProperty("headers");
  });

  test("throws a V3ApiError for a problem response", async () => {
    fetchMock.mockResolvedValue(
      json({ status: 422, detail: "Invalid", invalid_params: [{ name: "label", reason: "x" }] }, 422)
    );

    await expect(sendApiRequest("/api/internal/things", { method: "PATCH", body: {} })).rejects.toMatchObject(
      { status: 422, invalid_params: [{ name: "label", reason: "x" }] }
    );
  });
});

describe("failures with no problem response", () => {
  test.each([
    ["the network", () => fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))],
    [
      "a 2xx that isn't JSON",
      () => fetchMock.mockResolvedValue(new Response("<html>challenge</html>", { status: 200 })),
    ],
    ["a timeout", () => fetchMock.mockRejectedValue(new DOMException("signal timed out", "TimeoutError"))],
  ])(
    "turns %s into a V3ApiError with no detail, so callers show their own message",
    async (_label, arrange) => {
      arrange();

      const error = await sendApiRequest("/api/internal/things", { method: "POST" }).catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(V3ApiError);
      expect(error).toMatchObject({ status: 0, code: "network_error", detail: "" });
    }
  );

  test("lets a cancelled query's own abort error through, for TanStack to recognize", async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = new DOMException("The operation was aborted.", "AbortError");
    fetchMock.mockRejectedValue(aborted);

    await expect(getApiData("/api/internal/things", { signal: controller.signal })).rejects.toBe(aborted);
  });

  test("a problem with an empty body and no reason phrase still throws, with no detail", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502, statusText: "" }));

    await expect(getApiData("/api/internal/things")).rejects.toMatchObject({ status: 502, detail: "" });
  });
});

describe("timeouts", () => {
  test("a long write can opt out of the timeout", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await sendApiRequest("/api/internal/imports", { method: "POST", timeoutMs: null });

    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });
});
