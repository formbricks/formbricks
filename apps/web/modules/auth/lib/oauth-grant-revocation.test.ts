import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  requireOAuthConsentOnRefreshAfterHandler,
  revokeOAuthConsentBeforeHandler,
  revokeOAuthConsentGrant,
} from "./oauth-grant-revocation";

/**
 * The decisions each hook makes, against a mocked Prisma. Whether the queries hold up against a real
 * database, the real provider and a concurrent refresh is `oauth-grant-revocation.integration.test.ts`.
 */
const mocks = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  calls: [] as string[],
  tx: {
    oauthConsent: { findFirst: vi.fn(), deleteMany: vi.fn() },
    oauthRefreshToken: { updateMany: vi.fn() },
    oauthAccessToken: { updateMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: mocks.getSessionFromCtx,
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn((run: (tx: typeof mocks.tx) => unknown) => run(mocks.tx)),
    oauthRefreshToken: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./mcp-oauth-provider-options", () => ({ MCP_OAUTH_REFRESH_TOKEN_PREFIX: "fbor_" }));

type TCtx = Parameters<typeof revokeOAuthConsentBeforeHandler>[0];
const ctx = (path: string, body: unknown, returned?: unknown): TCtx =>
  ({ path, body, context: { returned } }) as unknown as TCtx;

const expectApiError = async (promise: Promise<unknown>, status: string, error?: string) => {
  const thrown = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(thrown).toBeInstanceOf(APIError);
  expect((thrown as APIError).status).toBe(status);
  if (error) expect((thrown as APIError).body).toMatchObject({ error });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.tx.oauthConsent.deleteMany.mockImplementation(async () => {
    mocks.calls.push("delete consent");
    return { count: 1 };
  });
  mocks.tx.oauthRefreshToken.updateMany.mockImplementation(async () => {
    mocks.calls.push("revoke refresh tokens");
    return { count: 2 };
  });
  mocks.tx.oauthAccessToken.updateMany.mockImplementation(async () => {
    mocks.calls.push("revoke access tokens");
    return { count: 0 };
  });
});

describe("revokeOAuthConsentGrant", () => {
  test("deletes the client's consents before revoking its tokens, scoped to the user", async () => {
    mocks.tx.oauthConsent.findFirst.mockResolvedValue({ clientId: "client-1" });

    const result = await revokeOAuthConsentGrant({ userId: "user-1", consentId: "consent-1" });

    expect(result).toEqual({ consentsDeleted: 1, refreshTokensRevoked: 2, accessTokensRevoked: 0 });
    expect(mocks.tx.oauthConsent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "consent-1", userId: "user-1" } })
    );
    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1" },
    });
    for (const model of [mocks.tx.oauthRefreshToken, mocks.tx.oauthAccessToken]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", clientId: "client-1", revoked: null },
        data: { revoked: expect.any(Date) },
      });
    }
    // The delete takes the row locks a racing refresh's FOR SHARE read waits on, so it must come first.
    expect(mocks.calls).toEqual(["delete consent", "revoke refresh tokens", "revoke access tokens"]);
  });

  test("returns null and writes nothing for a consent the user doesn't own", async () => {
    mocks.tx.oauthConsent.findFirst.mockResolvedValue(null);

    expect(await revokeOAuthConsentGrant({ userId: "user-1", consentId: "someone-elses" })).toBeNull();
    expect(mocks.calls).toEqual([]);
  });
});

describe("revokeOAuthConsentBeforeHandler", () => {
  test("leaves every other path to Better Auth", async () => {
    expect(await revokeOAuthConsentBeforeHandler(ctx("/oauth2/token", {}))).toBeUndefined();
    expect(mocks.getSessionFromCtx).not.toHaveBeenCalled();
  });

  test("refuses without a session", async () => {
    mocks.getSessionFromCtx.mockResolvedValue(null);

    await expectApiError(
      revokeOAuthConsentBeforeHandler(ctx("/oauth2/delete-consent", { id: "c" })),
      "UNAUTHORIZED"
    );
  });

  test.each([{}, { id: "" }, { id: 42 }])("answers 404 for a missing or malformed id: %j", async (body) => {
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } });

    await expectApiError(revokeOAuthConsentBeforeHandler(ctx("/oauth2/delete-consent", body)), "NOT_FOUND");
    expect(mocks.tx.oauthConsent.findFirst).not.toHaveBeenCalled();
  });

  test("answers 404 when the consent isn't the caller's", async () => {
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } });
    mocks.tx.oauthConsent.findFirst.mockResolvedValue(null);

    await expectApiError(
      revokeOAuthConsentBeforeHandler(ctx("/oauth2/delete-consent", { id: "consent-1" })),
      "NOT_FOUND"
    );
  });

  test("revokes and short-circuits the upstream endpoint", async () => {
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } });
    mocks.tx.oauthConsent.findFirst.mockResolvedValue({ clientId: "client-1" });

    expect(await revokeOAuthConsentBeforeHandler(ctx("/oauth2/delete-consent", { id: "consent-1" }))).toEqual(
      {
        success: true,
      }
    );
    expect(mocks.calls).toContain("revoke refresh tokens");
  });
});

describe("requireOAuthConsentOnRefreshAfterHandler", () => {
  const refreshCtx = (refreshToken: unknown = "fbor_raw-token", returned: unknown = { access_token: "a" }) =>
    ctx("/oauth2/token", { grant_type: "refresh_token", refresh_token: refreshToken }, returned);
  const storedRow = (skipConsent = false) => ({
    userId: "user-1",
    clientId: "client-1",
    client: { skipConsent },
  });

  test.each([
    ["another path", ctx("/oauth2/consent", { grant_type: "refresh_token", refresh_token: "fbor_x" })],
    ["another grant", ctx("/oauth2/token", { grant_type: "authorization_code", code: "c" })],
    ["no refresh token", ctx("/oauth2/token", { grant_type: "refresh_token" })],
    ["a refresh upstream already refused", refreshCtx("fbor_x", new APIError("BAD_REQUEST"))],
  ])("does nothing for %s", async (_label, hookCtx) => {
    await requireOAuthConsentOnRefreshAfterHandler(hookCtx);
    expect(prisma.oauthRefreshToken.findUnique).not.toHaveBeenCalled();
  });

  test("looks the presented token up by the provider's stored hash", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "consent-1" }]);

    await requireOAuthConsentOnRefreshAfterHandler(refreshCtx());

    const hash = createHash("sha256").update("raw-token").digest("base64url");
    expect(prisma.oauthRefreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: hash } })
    );
  });

  test("lets the refresh through while the consent exists", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "consent-1" }]);

    await expect(requireOAuthConsentOnRefreshAfterHandler(refreshCtx())).resolves.toBeUndefined();
    expect(mocks.calls).toEqual([]);
  });

  test("revokes the grant and refuses the refresh once the consent is gone", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    mocks.tx.$queryRaw.mockResolvedValue([]);

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
    expect(mocks.calls).toEqual(["revoke refresh tokens", "revoke access tokens"]);
  });

  test("exempts a skipConsent client, which never has a consent row", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow(true) as never);

    await expect(requireOAuthConsentOnRefreshAfterHandler(refreshCtx())).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each([
    ["a token without the provider's prefix", "raw-token"],
    ["a token that matches no stored row", "fbor_unknown"],
  ])("fails closed on %s", async (_label, token) => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(null);

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx(token)),
      "BAD_REQUEST",
      "invalid_grant"
    );
  });
});
