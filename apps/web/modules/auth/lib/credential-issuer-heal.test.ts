import { beforeEach, describe, expect, test, vi } from "vitest";
import { healCredentialAccountIssuerBeforeHandler } from "./credential-issuer-heal";

const mocks = vi.hoisted(() => ({ accountUpdateMany: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: { account: { updateMany: mocks.accountUpdateMany } },
}));

type THookContext = Parameters<typeof healCredentialAccountIssuerBeforeHandler>[0];

const hookContext = { path: "/sign-in/email", body: { email: "a@example.com" } } as unknown as THookContext;

// The heal itself is proven against real Postgres in credential-issuer-heal.integration.test.ts. This
// covers what that suite cannot reach: the hook runs before every sign-in, so it must never block one.
describe("healCredentialAccountIssuerBeforeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lets the request through when the heal write fails", async () => {
    mocks.accountUpdateMany.mockRejectedValueOnce(new Error("connection reset"));

    await expect(healCredentialAccountIssuerBeforeHandler(hookContext)).resolves.toBeUndefined();
  });
});
