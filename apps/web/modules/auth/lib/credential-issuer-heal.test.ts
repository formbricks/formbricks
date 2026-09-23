import { beforeEach, describe, expect, test, vi } from "vitest";
import { healCredentialAccountIssuerBeforeHandler } from "./credential-issuer-heal";

const mocks = vi.hoisted(() => ({ accountUpdateMany: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: { account: { updateMany: mocks.accountUpdateMany } },
}));

type THookContext = Parameters<typeof healCredentialAccountIssuerBeforeHandler>[0];

const hookContext = (path: string, email: string) => ({ path, body: { email } }) as unknown as THookContext;

// The heal itself is proven against real Postgres in credential-issuer-heal.integration.test.ts. These
// cover what that suite does not: the address as a user types it, other routes, and a failing write.
describe("healCredentialAccountIssuerBeforeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountUpdateMany.mockResolvedValue({ count: 1 });
  });

  test.each(["/sign-in/email", "/request-password-reset"])(
    "on %s, heals the NULL-issuer credential row of the user Better Auth will look up",
    async (path) => {
      // Better Auth lowercases before its exact match, so an address typed with capitals is the same user.
      await healCredentialAccountIssuerBeforeHandler(hookContext(path, "Alice@Example.com"));

      expect(mocks.accountUpdateMany).toHaveBeenCalledWith({
        where: { provider: "credential", issuer: null, user: { email: "alice@example.com" } },
        data: { issuer: "local:credential" },
      });
    }
  );

  test("does not write on any other route", async () => {
    await healCredentialAccountIssuerBeforeHandler(hookContext("/sign-up/email", "alice@example.com"));

    expect(mocks.accountUpdateMany).not.toHaveBeenCalled();
  });

  test("lets the request through when the heal write fails", async () => {
    mocks.accountUpdateMany.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      healCredentialAccountIssuerBeforeHandler(hookContext("/sign-in/email", "alice@example.com"))
    ).resolves.toBeUndefined();
  });
});
