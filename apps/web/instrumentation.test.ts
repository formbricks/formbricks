import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
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
