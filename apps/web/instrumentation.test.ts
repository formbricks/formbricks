import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRegisterJobsWorker = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  IS_PRODUCTION: false,
  PROMETHEUS_ENABLED: false,
  SENTRY_DSN: undefined,
}));

vi.mock("./instrumentation-jobs", () => ({
  registerJobsWorker: mockRegisterJobsWorker,
}));

describe("instrumentation register", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  test("does not block Next.js boot on BullMQ worker startup", async () => {
    mockRegisterJobsWorker.mockReturnValue(new Promise(() => undefined));

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    expect(mockRegisterJobsWorker).toHaveBeenCalledTimes(1);
  });

  test("swallows BullMQ worker startup rejections after triggering background registration", async () => {
    mockRegisterJobsWorker.mockRejectedValue(new Error("startup failed"));

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    await Promise.resolve();

    expect(mockRegisterJobsWorker).toHaveBeenCalledTimes(1);
  });
});
