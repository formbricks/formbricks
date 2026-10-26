import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AI_MODEL_HTTP_TIMEOUT_MS } from "@formbricks/types/ai-timeout";
import { modelFetch } from "./model-fetch";

const originalDispatcher = getGlobalDispatcher();
const routes: MockAgent[] = [];
const origin = "http://127.0.0.1:54321";

const installRoute = (response: string): MockAgent => {
  const route = new MockAgent();
  route.disableNetConnect();
  route.get(origin).intercept({ path: "/v1", method: "POST" }).reply(200, response);
  routes.push(route);
  setGlobalDispatcher(route);
  return route;
};

afterEach(async () => {
  vi.unstubAllGlobals();
  setGlobalDispatcher(originalDispatcher);
  await Promise.all(routes.splice(0).map((route) => route.close()));
});

describe("modelFetch", () => {
  test("extends model timeouts through the configured global route", async () => {
    const route = installRoute("routed response");
    const dispatch = vi.spyOn(route, "dispatch");

    const response = await modelFetch(`${origin}/v1`, { method: "POST", body: "{}" });

    expect(await response.text()).toBe("routed response");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        headersTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
        bodyTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
      }),
      expect.anything()
    );
    expect(getGlobalDispatcher()).toBe(route);
  });

  test("honours a global route installed after an earlier model call", async () => {
    installRoute("first route");
    const first = await modelFetch(`${origin}/v1`, { method: "POST" });
    expect(await first.text()).toBe("first route");

    installRoute("second route");
    const second = await modelFetch(`${origin}/v1`, { method: "POST" });
    expect(await second.text()).toBe("second route");
  });

  test("reuses the model wrapper and preserves request controls without affecting other fetches", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const init = { method: "POST", body: "{}", headers: { Authorization: "test" }, signal };

    await modelFetch("http://llm.test/v1", init);
    await modelFetch("http://another-llm.test/v1", init);
    await globalThis.fetch("http://other.test", { method: "GET" });

    const first = fetch.mock.calls[0][1] as RequestInit & { dispatcher: unknown };
    expect(first).toMatchObject(init);
    expect(first.dispatcher).toBeDefined();
    expect(fetch.mock.calls[1][1]).toMatchObject({ dispatcher: first.dispatcher });
    expect(init).not.toHaveProperty("dispatcher");
    expect(fetch.mock.calls[2][1]).toEqual({ method: "GET" });
  });
});
