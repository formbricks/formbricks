import { describe, expect, test, vi } from "vitest";
import "./route";

const captured = vi.hoisted(() => ({ configs: [] as Record<string, unknown>[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: (config: Record<string, unknown>) => {
    captured.configs.push(config);
    return config;
  },
}));
vi.mock("../../visibility/operations", () => ({
  changeV3SurveyVisibility: vi.fn(),
  getV3SurveyVisibility: vi.fn(),
}));

describe("visibility route rate limiting", () => {
  test("leaves the visibility budget to the operation, so REST and MCP charge it once", () => {
    // Re-adding `customRateLimitConfig` here would charge REST twice (wrapper + operation) and halve the
    // effective budget; the operation owns it because an MCP call never passes this wrapper.
    expect(captured.configs.length).toBeGreaterThan(0);
    for (const config of captured.configs) {
      expect(config).not.toHaveProperty("customRateLimitConfig");
    }
    expect(captured.configs.some((config) => config.action === "visibilityChanged")).toBe(true);
  });

  test("spends only the operation's visibility budget on a change, not the general v3 budget too", () => {
    const post = captured.configs.find((config) => config.action === "visibilityChanged");
    const get = captured.configs.find((config) => config.action !== "visibilityChanged");

    expect(post).toMatchObject({ rateLimit: false });
    // The read has no budget of its own, so it keeps the wrapper's default.
    expect(get).not.toHaveProperty("rateLimit");
  });
});
