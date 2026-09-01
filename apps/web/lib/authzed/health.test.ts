import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { checkAuthzedHealth } from "./health";

const healthMocks = vi.hoisted(() => ({
  getAuthzedClient: vi.fn(),
  isAuthzedEnabled: vi.fn(),
  now: vi.fn(),
  readSchema: vi.fn(),
}));

vi.mock("node:perf_hooks", () => ({
  performance: { now: healthMocks.now },
}));
vi.mock("./client", () => ({
  getAuthzedClient: healthMocks.getAuthzedClient,
}));
vi.mock("./config", () => ({
  isAuthzedEnabled: healthMocks.isAuthzedEnabled,
}));

describe("checkAuthzedHealth", () => {
  beforeEach(() => {
    healthMocks.getAuthzedClient.mockReset();
    healthMocks.isAuthzedEnabled.mockReset();
    healthMocks.now.mockReset();
    healthMocks.readSchema.mockReset();
    healthMocks.getAuthzedClient.mockReturnValue({ readSchema: healthMocks.readSchema });
    healthMocks.now.mockReturnValueOnce(10).mockReturnValueOnce(22.6);
  });

  test("returns disabled without constructing a client", async () => {
    healthMocks.isAuthzedEnabled.mockReturnValue(false);

    await expect(checkAuthzedHealth()).resolves.toEqual({ status: "disabled" });
    expect(healthMocks.getAuthzedClient).not.toHaveBeenCalled();
    expect(healthMocks.now).not.toHaveBeenCalled();
  });

  test.each(["", "definition user {}"])(
    "treats schema text %j as a healthy connection",
    async (schemaText) => {
      healthMocks.isAuthzedEnabled.mockReturnValue(true);
      healthMocks.readSchema.mockResolvedValue({ schemaText });

      const result = await checkAuthzedHealth();

      expect(result).toEqual({ latencyMs: 13, status: "healthy" });
      expect(JSON.stringify(result)).not.toContain(schemaText || "schemaText");
    }
  );

  test.each([
    [AUTHZED_ERROR_CODES.UNAUTHENTICATED, false],
    [AUTHZED_ERROR_CODES.TIMEOUT, true],
    [AUTHZED_ERROR_CODES.OVERLOADED, true],
    [AUTHZED_ERROR_CODES.UNAVAILABLE, true],
  ] as const)("returns sanitized unhealthy result for %s", async (code, retryable) => {
    healthMocks.isAuthzedEnabled.mockReturnValue(true);
    healthMocks.readSchema.mockRejectedValue(
      new AuthzedError({ attempts: 3, code, operation: "read_schema", retryable })
    );

    await expect(checkAuthzedHealth()).resolves.toEqual({
      code,
      latencyMs: 13,
      retryable,
      status: "unhealthy",
    });
  });

  test("maps unexpected failures to a non-retryable internal result", async () => {
    healthMocks.isAuthzedEnabled.mockReturnValue(true);
    healthMocks.readSchema.mockRejectedValue(new Error("raw sdk details"));

    await expect(checkAuthzedHealth()).resolves.toEqual({
      code: AUTHZED_ERROR_CODES.INTERNAL,
      latencyMs: 13,
      retryable: false,
      status: "unhealthy",
    });
  });
});
