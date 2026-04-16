import { beforeEach, describe, expect, test, vi } from "vitest";

describe("server - posthogServerClient", () => {
  const g = globalThis as Record<string, unknown>;

  const setupMocks = (opts: {
    posthogKey?: string;
    shutdown?: ReturnType<typeof vi.fn>;
    loggerError?: ReturnType<typeof vi.fn>;
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
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: opts.posthogKey }));

    return { shutdown, loggerError };
  };

  beforeEach(() => {
    vi.resetModules();
    delete g.posthogServerClient;
    delete g.posthogHandlersRegistered;
  });

  test("returns null when POSTHOG_KEY is not set", async () => {
    setupMocks({ posthogKey: undefined });

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).toBeNull();
  });

  test("creates PostHog client when POSTHOG_KEY is set", async () => {
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

  test("reuses client from globalThis in development", async () => {
    const fakeClient = { capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) };
    g.posthogServerClient = fakeClient;

    setupMocks({ posthogKey: "phc_test_key" });

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).toBe(fakeClient);

    const { PostHog } = await import("posthog-node");
    expect(PostHog).not.toHaveBeenCalled();
  });

  test("caches client on globalThis in non-production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    setupMocks({ posthogKey: "phc_test_key" });

    const { posthogServerClient } = await import("./server");
    expect(g.posthogServerClient).toBe(posthogServerClient);

    vi.unstubAllEnvs();
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

  test("shutdown handler calls shutdown()", async () => {
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
    expect(shutdown).toHaveBeenCalled();

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("shutdown handler logs error if shutdown rejects", async () => {
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

    processOnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
