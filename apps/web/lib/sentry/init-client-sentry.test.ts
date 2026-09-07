import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SENTRY_CLIENT_RUNTIME_CONFIG_KEY } from "@/lib/sentry/client-runtime-config";

const mockInit = vi.hoisted(() => vi.fn());
const mockReplayIntegration = vi.hoisted(() => vi.fn(() => ({ name: "Replay" })));

vi.mock("@sentry/nextjs", () => ({
  init: mockInit,
  replayIntegration: mockReplayIntegration,
}));

const CONFIG = { dsn: "https://key@sentry.example.com/1", release: "1.2.3", environment: "production" };

const importInit = async () => {
  const { initClientSentryFromRuntimeConfig } = await import("@/lib/sentry/init-client-sentry");
  return initClientSentryFromRuntimeConfig;
};

describe("initClientSentryFromRuntimeConfig", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("window", {} as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("initializes immediately when the layout injected the config first", async () => {
    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;

    (await importInit())();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: CONFIG.dsn,
        release: CONFIG.release,
        environment: CONFIG.environment,
      })
    );
  });

  test("initializes as soon as the config is assigned when it lands after the bundle", async () => {
    (await importInit())();

    expect(mockInit).not.toHaveBeenCalled();

    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY]).toEqual(CONFIG);
  });

  test("stays disabled while no config is injected", async () => {
    (await importInit())();

    expect(mockInit).not.toHaveBeenCalled();
  });

  test("ignores a config without a DSN", async () => {
    (await importInit())();

    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = { dsn: "" };

    expect(mockInit).not.toHaveBeenCalled();
  });

  test("initializes only once when the config is assigned repeatedly", async () => {
    (await importInit())();

    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;
    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  test("preserves tracing, replay sampling and privacy options", async () => {
    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;

    (await importInit())();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        debug: false,
        sendDefaultPii: false,
        sendClientReports: false,
      })
    );
    expect(mockReplayIntegration).toHaveBeenCalledWith({ maskAllText: true, blockAllMedia: true });
  });

  test("drops NEXT_NOT_FOUND errors and keeps everything else", async () => {
    window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY] = CONFIG;

    (await importInit())();

    const { beforeSend } = mockInit.mock.calls[0][0];
    const event = { message: "boom" };

    const notFound = Object.assign(new Error("not found"), { digest: "NEXT_NOT_FOUND" });
    expect(beforeSend(event, { originalException: notFound })).toBeNull();
    expect(beforeSend(event, { originalException: new Error("boom") })).toBe(event);
    expect(beforeSend(event, {})).toBe(event);
  });

  test("does nothing on the server where there is no window", async () => {
    vi.stubGlobal("window", undefined);

    (await importInit())();

    expect(mockInit).not.toHaveBeenCalled();
  });
});
