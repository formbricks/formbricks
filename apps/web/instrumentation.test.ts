import type { Instrumentation } from "next";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const mockRegisterJobsWorker = vi.fn();
const mockRegisterRecurringJobs = vi.fn();
const mockAssertAuthzedRuntimeConfiguration = vi.fn();
const mockAssertAuthRuntimeConfiguration = vi.fn();
const mockWarnOnAuthSecretRisks = vi.fn();

vi.mock("@/lib/env", () => ({
  assertAuthzedRuntimeConfiguration: mockAssertAuthzedRuntimeConfiguration,
  assertAuthRuntimeConfiguration: mockAssertAuthRuntimeConfiguration,
  warnOnAuthSecretRisks: mockWarnOnAuthSecretRisks,
}));

const mockCaptureRequestError = vi.fn();
const mockGetClient = vi.fn();
const mockAddEventProcessor = vi.fn();
const mockGetProxySessionFromCookieHeader = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: mockCaptureRequestError,
  getClient: mockGetClient,
  getGlobalScope: () => ({ addEventProcessor: mockAddEventProcessor }),
}));

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySessionFromCookieHeader: mockGetProxySessionFromCookieHeader,
}));

vi.mock("@/lib/constants", () => ({
  IS_PRODUCTION: false,
  PROMETHEUS_ENABLED: false,
  SENTRY_DSN: undefined,
}));

vi.mock("./instrumentation-jobs", () => ({
  registerRecurringJobs: mockRegisterRecurringJobs,
  registerJobsWorker: mockRegisterJobsWorker,
}));

describe("instrumentation register", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAssertAuthzedRuntimeConfiguration.mockReset();
    mockAssertAuthRuntimeConfiguration.mockReset();
    mockWarnOnAuthSecretRisks.mockReset();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", undefined);
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  test("rejects missing authorization configuration before starting background work", async () => {
    mockAssertAuthzedRuntimeConfiguration.mockImplementation(() => {
      throw new Error("Formbricks v6 requires AUTHZED_ENABLED=true");
    });
    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("AUTHZED_ENABLED=true");
    expect(mockRegisterRecurringJobs).not.toHaveBeenCalled();
    expect(mockRegisterJobsWorker).not.toHaveBeenCalled();
  });

  test("does not require runtime credentials during a production build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    expect(mockAssertAuthzedRuntimeConfiguration).not.toHaveBeenCalled();
    expect(mockRegisterJobsWorker).not.toHaveBeenCalled();
  });

  test("does not run the node startup validator in the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    expect(mockAssertAuthzedRuntimeConfiguration).not.toHaveBeenCalled();
  });

  test("does not block Next.js boot on BullMQ worker startup", async () => {
    mockRegisterRecurringJobs.mockReturnValue(new Promise(() => undefined));
    mockRegisterJobsWorker.mockReturnValue(new Promise(() => undefined));

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    expect(mockAssertAuthzedRuntimeConfiguration).toHaveBeenCalledTimes(1);
    expect(mockRegisterRecurringJobs).toHaveBeenCalledTimes(1);
    expect(mockRegisterJobsWorker).toHaveBeenCalledTimes(1);
  });

  test("swallows BullMQ worker startup rejections after triggering background registration", async () => {
    mockRegisterRecurringJobs.mockRejectedValue(new Error("schedule failed"));
    mockRegisterJobsWorker.mockRejectedValue(new Error("startup failed"));

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    await Promise.resolve();

    expect(mockRegisterRecurringJobs).toHaveBeenCalledTimes(1);
    expect(mockRegisterJobsWorker).toHaveBeenCalledTimes(1);
  });

  test("refuses to start background work without an auth secret", async () => {
    // Same contract as the AuthZed gate above: a missing auth secret has to stop startup, not surface
    // later as an invite or verification link that cannot be minted.
    mockAssertAuthRuntimeConfiguration.mockImplementation(() => {
      throw new Error("BETTER_AUTH_SECRET is required");
    });

    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("BETTER_AUTH_SECRET is required");
    expect(mockRegisterJobsWorker).not.toHaveBeenCalled();
    expect(mockRegisterRecurringJobs).not.toHaveBeenCalled();
  });

  test("warns about risky auth secret configurations at startup", async () => {
    const { register } = await import("./instrumentation");

    await register();

    expect(mockAssertAuthRuntimeConfiguration).toHaveBeenCalledTimes(1);
    expect(mockWarnOnAuthSecretRisks).toHaveBeenCalledTimes(1);
  });

  test("skips the auth checks during a production build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    const { register } = await import("./instrumentation");

    await register();

    expect(mockAssertAuthRuntimeConfiguration).not.toHaveBeenCalled();
    expect(mockWarnOnAuthSecretRisks).not.toHaveBeenCalled();
    // Same guard, so assert the whole block rather than the two calls this change happened to add.
    expect(mockAssertAuthzedRuntimeConfiguration).not.toHaveBeenCalled();
  });
});

describe("instrumentation onRequestError", () => {
  type TArgs = Parameters<Instrumentation.onRequestError>;
  const EVENT = { event_id: "e1" };
  const context: TArgs[2] = {
    routerKind: "App Router",
    routePath: "/workspaces/[workspaceId]",
    routeType: "render",
    revalidateReason: undefined,
  };
  const buildArgs = (error: unknown, path: string, cookie?: string): TArgs => [
    error,
    { path, method: "GET", headers: cookie ? { cookie } : {} },
    context,
  ];

  const loadInstrumentation = async () => {
    const { onRequestError } = await import("./instrumentation");
    const { applyRequestErrorUser } = await import("@/lib/sentry/request-error-user");
    return {
      onRequestError,
      userFor: (error: unknown) => applyRequestErrorUser(EVENT, { originalException: error }).user,
    };
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    mockGetClient.mockReturnValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  test("captures an authenticated request's error with only the user id attached", async () => {
    mockGetProxySessionFromCookieHeader.mockResolvedValue({ userId: "user-1" });
    const { onRequestError, userFor } = await loadInstrumentation();
    const args = buildArgs(new Error("boom"), "/workspaces/abc", "formbricks.session_token=signed");

    await onRequestError(...args);

    expect(mockGetProxySessionFromCookieHeader).toHaveBeenCalledWith("formbricks.session_token=signed");
    expect(mockCaptureRequestError).toHaveBeenCalledWith(...args);
    expect(userFor(args[0])).toEqual({ id: "user-1" });
  });

  test("captures an anonymous request's error exactly as before, without a user", async () => {
    mockGetProxySessionFromCookieHeader.mockResolvedValue(null);
    const { onRequestError, userFor } = await loadInstrumentation();
    const args = buildArgs(new Error("boom"), "/workspaces/abc", "formbricks.session_token=expired");

    await onRequestError(...args);

    expect(mockCaptureRequestError).toHaveBeenCalledWith(...args);
    expect(userFor(args[0])).toBeUndefined();
  });

  test("still captures the error when the session lookup throws", async () => {
    mockGetProxySessionFromCookieHeader.mockRejectedValue(new Error("db down"));
    const { onRequestError, userFor } = await loadInstrumentation();
    const args = buildArgs(new Error("boom"), "/workspaces/abc", "formbricks.session_token=signed");

    await expect(onRequestError(...args)).resolves.toBeUndefined();

    expect(mockCaptureRequestError).toHaveBeenCalledWith(...args);
    expect(userFor(args[0])).toBeUndefined();
  });

  test.each([
    ["a public survey route", "nodejs", {}, "/s/survey-id?lang=de"],
    ["the edge runtime", "edge", {}, "/workspaces/abc"],
    ["Sentry being off", "nodejs", undefined, "/workspaces/abc"],
  ])("does no session lookup for %s", async (_, runtime, client, path) => {
    vi.stubEnv("NEXT_RUNTIME", runtime);
    mockGetClient.mockReturnValue(client);
    const { onRequestError } = await loadInstrumentation();
    const args = buildArgs(new Error("boom"), path, "formbricks.session_token=signed");

    await onRequestError(...args);

    expect(mockGetProxySessionFromCookieHeader).not.toHaveBeenCalled();
    expect(mockCaptureRequestError).toHaveBeenCalledWith(...args);
  });

  test("still skips expected business-logic errors without a lookup", async () => {
    const { onRequestError } = await loadInstrumentation();

    await onRequestError(
      ...buildArgs(new ResourceNotFoundError("survey", "1"), "/workspaces/abc", "formbricks.session_token=x")
    );

    expect(mockGetProxySessionFromCookieHeader).not.toHaveBeenCalled();
    expect(mockCaptureRequestError).not.toHaveBeenCalled();
  });
});
