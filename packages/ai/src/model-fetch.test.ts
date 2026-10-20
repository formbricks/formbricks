import { afterEach, describe, expect, test, vi } from "vitest";
import { AI_MODEL_HTTP_TIMEOUT_MS } from "@formbricks/types/ai-timeout";
import { modelFetch } from "./model-fetch";

const mocks = vi.hoisted(() => ({ createAgent: vi.fn() }));

vi.mock("undici", () => ({
  Agent: class {
    constructor(options: unknown) {
      mocks.createAgent(options);
    }
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe("modelFetch", () => {
  test("uses one model dispatcher whose limits cover the maximum AI budget", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const init = { method: "POST", body: "{}", headers: { Authorization: "test" }, signal };

    await modelFetch("http://llm.test/v1", init);
    await modelFetch("http://another-llm.test/v1", init);

    expect(mocks.createAgent).toHaveBeenCalledExactlyOnceWith({
      headersTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
      bodyTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
    });
    expect(AI_MODEL_HTTP_TIMEOUT_MS).toBe(450_000);
    const first = fetch.mock.calls[0][1] as RequestInit & { dispatcher: unknown };
    expect(first).toMatchObject(init);
    expect(first.dispatcher).toBeDefined();
    expect(fetch.mock.calls[1][1]).toMatchObject({ dispatcher: first.dispatcher });
    expect(init).not.toHaveProperty("dispatcher");
  });

  test("resolves fetch at call time and leaves unrelated requests alone", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    await modelFetch("http://llm.test/v1");
    await globalThis.fetch("http://other.test", { method: "GET" });
    expect(fetch.mock.calls[0][1]).toHaveProperty("dispatcher");
    expect(fetch.mock.calls[1][1]).toEqual({ method: "GET" });
  });
});
