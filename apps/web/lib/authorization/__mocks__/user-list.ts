import { beforeEach, vi } from "vitest";

export const batch = vi.fn();
export const freshness = vi.fn();
export const readiness = vi.fn();
export const decisionMetric = vi.fn();
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: () => ({ checkPermissionBatch: batch }) }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: freshness }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: readiness }));
vi.mock("../context", () => ({
  getAuthorizationSurface: () => "unscoped",
  recordAuthorizationCheckIssued: vi.fn(),
}));
vi.mock("../metrics", () => ({ recordAuthorizationDecision: decisionMetric }));

beforeEach(() => {
  batch.mockReset().mockImplementation(async (checks: unknown[]) => checks.map(() => true));
  freshness.mockReset().mockResolvedValue(undefined);
  readiness.mockReset().mockResolvedValue(false);
  decisionMetric.mockReset();
});
