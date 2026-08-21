import { beforeEach, describe, expect, test, vi } from "vitest";

describe("server - posthog clients", () => {
  const g = globalThis as Record<string, unknown>;

  const setupMocks = (opts: {
    posthogKey?: string;
    shutdown?: ReturnType<typeof vi.fn>;
    loggerError?: ReturnType<typeof vi.fn>;
    isProduction?: boolean;
  }) => {
    const shutdown = opts.shutdown ?? vi.fn().mockResolvedValue(undefined);
    const loggerError = opts.loggerError ?? vi.fn();

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({ logger: { error: loggerError } }));
    vi.doMock("posthog-node", () => ({
      PostHog: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        this.capture = vi.fn();
        this.shutdown = shutdown;
      }),
    }));
    // server.ts branches on IS_PRODUCTION, so the branch is chosen here rather than through
    // NODE_ENV. Defaults to false, matching the real constant under test (NODE_ENV=test).
    vi.doMock("@/lib/constants", () => ({
      POSTHOG_KEY: opts.posthogKey,
      IS_PRODUCTION: opts.isProduction ?? false,
    }));

    return { shutdown, loggerError };
  };

  beforeEach(() => {
    vi.resetModules();
    delete g.posthogServerClient;
    delete g.posthogTracingClient;
    delete g.posthogHandlersRegistered;
  });

  test("returns null for both clients when POSTHOG_KEY is not set", async () => {
    setupMocks({ posthogKey: undefined });

    const { posthogServerClient, posthogTracingClient } = await import("./server");
    expect(posthogServerClient).toBeNull();
    expect(posthogTracingClient).toBeNull();
  });

  test("creates the server client with immediate flush", async () => {
    setupMocks({ posthogKey: "phc_test_key" });

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).not.toBeNull();

    const { PostHog } = await import("posthog-node");
    expect(PostHog).toHaveBeenCalledWith("phc_test_key", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  test("creates the tracing client with batched flush and a before_send hook", async () => {
    setupMocks({ posthogKey: "phc_test_key" });

    const { posthogTracingClient } = await import("./server");
    expect(posthogTracingClient).not.toBeNull();

    const { PostHog } = await import("posthog-node");
    expect(PostHog).toHaveBeenCalledWith("phc_test_key", {
      host: "https://eu.i.posthog.com",
      flushAt: 20,
      flushInterval: 10_000,
      before_send: expect.any(Function),
    });
  });

  describe("tracing client before_send", () => {
    const getBeforeSend = async () => {
      const { PostHog } = await import("posthog-node");
      const options = vi
        .mocked(PostHog)
        .mock.calls.map((args) => args[1])
        .find((opts) => opts !== undefined && "before_send" in opts);
      return options!.before_send as (event: unknown) => unknown;
    };

    test("strips $ai_error but keeps $ai_is_error and other properties", async () => {
      setupMocks({ posthogKey: "phc_test_key" });
      await import("./server");
      const beforeSend = await getBeforeSend();

      const result = beforeSend({
        event: "$ai_generation",
        properties: {
          $ai_error: '{"requestBodyValues":{"prompt":"secret"}}',
          $ai_is_error: true,
          $ai_model: "gpt",
        },
      }) as { properties: Record<string, unknown> };

      expect(result.properties).toEqual({ $ai_is_error: true, $ai_model: "gpt" });
    });

    test("no-ops when properties or $ai_error is missing", async () => {
      setupMocks({ posthogKey: "phc_test_key" });
      await import("./server");
      const beforeSend = await getBeforeSend();

      expect(beforeSend(null)).toBeNull();
      const eventWithoutProperties = { event: "$mcp_tool_call" };
      expect(beforeSend(eventWithoutProperties)).toBe(eventWithoutProperties);
      const eventWithoutAiError = { event: "$ai_generation", properties: { $ai_model: "gpt" } };
      expect(beforeSend(eventWithoutAiError)).toBe(eventWithoutAiError);
    });
  });

  test("reuses both clients from globalThis in development", async () => {
    const fakeServerClient = { capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) };
    const fakeTracingClient = { capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) };
    g.posthogServerClient = fakeServerClient;
    g.posthogTracingClient = fakeTracingClient;

    setupMocks({ posthogKey: "phc_test_key" });

    const { posthogServerClient, posthogTracingClient } = await import("./server");
    expect(posthogServerClient).toBe(fakeServerClient);
    expect(posthogTracingClient).toBe(fakeTracingClient);

    const { PostHog } = await import("posthog-node");
    expect(PostHog).not.toHaveBeenCalled();
  });

  test("caches both clients on globalThis in non-production", async () => {
    setupMocks({ posthogKey: "phc_test_key", isProduction: false });

    const { posthogServerClient, posthogTracingClient } = await import("./server");
    expect(g.posthogServerClient).toBe(posthogServerClient);
    expect(g.posthogTracingClient).toBe(posthogTracingClient);
  });

  test("does not cache either client on globalThis in production", async () => {
    setupMocks({ posthogKey: "phc_test_key", isProduction: true });

    await import("./server");
    expect(g.posthogServerClient).toBeUndefined();
    expect(g.posthogTracingClient).toBeUndefined();
  });

  test("registers signal handlers once when NEXT_RUNTIME is nodejs", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    setupMocks({ posthogKey: "phc_test_key" });
    const processOnSpy = vi.spyOn(process, "on");

    await import("./server");

    expect(processOnSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(g.posthogHandlersRegistered).toBe(true);

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("does not register signal handlers when already registered", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    g.posthogHandlersRegistered = true;

    setupMocks({ posthogKey: "phc_test_key" });
    const processOnSpy = vi.spyOn(process, "on");

    await import("./server");

    const sigCalls = processOnSpy.mock.calls.filter(([event]) => event === "SIGTERM" || event === "SIGINT");
    expect(sigCalls).toHaveLength(0);

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("does not register signal handlers when NEXT_RUNTIME is not nodejs", async () => {
    vi.stubEnv("NEXT_RUNTIME", "");

    setupMocks({ posthogKey: "phc_test_key" });
    const processOnSpy = vi.spyOn(process, "on");

    await import("./server");

    const sigCalls = processOnSpy.mock.calls.filter(([event]) => event === "SIGTERM" || event === "SIGINT");
    expect(sigCalls).toHaveLength(0);

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("does not register signal handlers when neither client is configured", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    setupMocks({ posthogKey: undefined });
    const processOnSpy = vi.spyOn(process, "on");

    await import("./server");

    const sigCalls = processOnSpy.mock.calls.filter(([event]) => event === "SIGTERM" || event === "SIGINT");
    expect(sigCalls).toHaveLength(0);
    expect(g.posthogHandlersRegistered).toBeUndefined();

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("shutdown handler shuts down both clients", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    const { shutdown } = setupMocks({ posthogKey: "phc_test_key" });

    let sigTermHandler: (() => void) | undefined;
    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event, handler) => {
      if (event === "SIGTERM") sigTermHandler = handler as () => void;
      return process;
    });

    await import("./server");

    expect(sigTermHandler).toBeDefined();
    sigTermHandler!();
    expect(shutdown).toHaveBeenCalledTimes(2);

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("shutdown handler logs an error per client if shutdown rejects", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    const shutdownError = new Error("shutdown failed");
    const { loggerError } = setupMocks({
      posthogKey: "phc_test_key",
      shutdown: vi.fn().mockRejectedValue(shutdownError),
    });

    let sigTermHandler: (() => void) | undefined;
    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event, handler) => {
      if (event === "SIGTERM") sigTermHandler = handler as () => void;
      return process;
    });

    await import("./server");

    sigTermHandler!();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loggerError).toHaveBeenCalledWith(shutdownError, "Error shutting down PostHog server client");
    expect(loggerError).toHaveBeenCalledWith(shutdownError, "Error shutting down PostHog tracing client");

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
