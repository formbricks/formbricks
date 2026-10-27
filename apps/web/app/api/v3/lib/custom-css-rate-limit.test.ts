import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { applyV3CustomCssRateLimit, isCustomCssValidationRequest } from "./custom-css-rate-limit";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn() })) },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));

const requestId = "req_1";
const instance = "/api/v3/surveys/validate";

beforeEach(() => {
  vi.mocked(applyRateLimit).mockReset();
});

describe("applyV3CustomCssRateLimit", () => {
  test("charges a session or OAuth user by user id and an API key by key id, on the CSS budget", async () => {
    await applyV3CustomCssRateLimit({
      authentication: { user: { id: "user_1" }, expires: "2099-01-01" } as never,
      requestId,
      instance,
    });
    await applyV3CustomCssRateLimit({
      authentication: { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as never,
      requestId,
      instance,
    });

    expect(vi.mocked(applyRateLimit).mock.calls).toEqual([
      [rateLimitConfigs.api.v3CustomCss, "user_1"],
      [rateLimitConfigs.api.v3CustomCss, "key_1"],
    ]);
    expect(rateLimitConfigs.api.v3CustomCss).toMatchObject({ interval: 60, allowedPerInterval: 60 });
  });

  test("answers a spent budget with the standard 429 problem and Retry-After", async () => {
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Slow down", 17));

    const response = await applyV3CustomCssRateLimit({
      authentication: { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as never,
      requestId,
      instance,
    });

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("17");
    expect(await response?.json()).toMatchObject({
      code: "too_many_requests",
      detail: "Slow down",
      instance,
    });
  });

  test("lets the request through when the budget has room or there is no principal", async () => {
    expect(
      await applyV3CustomCssRateLimit({
        authentication: { user: { id: "user_1" }, expires: "2099-01-01" } as never,
        requestId,
        instance,
      })
    ).toBeNull();
    expect(await applyV3CustomCssRateLimit({ authentication: null, requestId, instance })).toBeNull();
    expect(applyRateLimit).toHaveBeenCalledTimes(1);
  });
});

describe("isCustomCssValidationRequest", () => {
  test.each([
    [{ operation: "customCss", data: { customCss: { light: "a{}", dark: null } } }, true],
    [{ operation: "create", data: { name: "x", customCss: { light: "a{}", dark: null } } }, true],
    [{ operation: "patch", data: { customCss: null } }, true],
    [{ operation: "patch", data: { name: "x" } }, false],
    [{ operation: "create", data: null }, false],
    [{ operation: "create", data: ["customCss"] }, false],
  ])("%j → %s", (body, expected) => {
    expect(isCustomCssValidationRequest(body)).toBe(expected);
  });
});
