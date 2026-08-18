import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasStaleAuthzedRevocation } from "./outbox-repository";

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("./outbox-repository", () => ({ hasStaleAuthzedRevocation: vi.fn() }));

describe("AuthZed projection freshness guard", () => {
  beforeEach(() => vi.clearAllMocks());

  test("allows a fresh graph", async () => {
    vi.mocked(hasStaleAuthzedRevocation).mockResolvedValue(false);
    const { assertAuthzedProjectionFreshness } = await import("./outbox-freshness");
    await expect(assertAuthzedProjectionFreshness()).resolves.toBeUndefined();
  });

  test("fails closed for an overdue or dead-letter revocation", async () => {
    vi.mocked(hasStaleAuthzedRevocation).mockResolvedValue(true);
    const { assertAuthzedProjectionFreshness } = await import("./outbox-freshness");
    await expect(assertAuthzedProjectionFreshness()).rejects.toMatchObject({
      code: "authzed_projection_stale",
      retryable: false,
    });
  });
});
