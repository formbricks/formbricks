import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { writeData } from "@/lib/notion/service";

vi.mock("@/lib/crypto", () => ({
  symmetricDecrypt: vi.fn(() => "decrypted-notion-token"),
}));

const notionConfig = {
  key: {
    access_token: "encrypted-token",
    bot_id: "bot-id",
    token_type: "bearer",
    duplicated_template_id: null,
    owner: { type: "workspace", workspace: true, user: null },
    workspace_icon: null,
    workspace_id: "workspace-id",
    workspace_name: "workspace-name",
  },
  data: [],
} as any;

describe("notion service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("writeData retries on 429 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "rate limited", code: "rate_limited" }), {
          status: 429,
          headers: {
            "retry-after": "0",
            "x-request-id": "req-1",
            "content-type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    global.fetch = fetchMock as any;

    await expect(
      writeData("db1", { Name: { title: [{ text: { content: "hi" } }] } }, notionConfig)
    ).resolves.toBe(undefined);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("writeData throws immediately on non-retryable 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "bad request", code: "validation_error" }), {
        status: 400,
        headers: {
          "x-request-id": "req-2",
          "content-type": "application/json",
        },
      })
    );

    global.fetch = fetchMock as any;

    await expect(
      writeData("db1", { Name: { title: [{ text: { content: "hi" } }] } }, notionConfig)
    ).rejects.toThrow(/bad request/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("writeData retries on network error and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    global.fetch = fetchMock as any;

    const promise = writeData("db1", { Name: { title: [{ text: { content: "hi" } }] } }, notionConfig);

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(undefined);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
