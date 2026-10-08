import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  requireOAuthConsentOnRefreshAfterHandler,
  revokeOAuthConsentBeforeHandler,
  revokeOAuthConsentGrant,
  revokeTokensBeyondConsentAfterHandler,
} from "./oauth-grant-revocation";

/**
 * The decisions each hook makes, against a mocked Prisma. Whether the queries hold up against a real
 * database, the real provider and a concurrent refresh is `oauth-grant-revocation.integration.test.ts`.
 */
const mocks = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  getOAuthProviderState: vi.fn(),
  calls: [] as string[],
  /** The consent rows the `FOR SHARE` read returns, newest first as its `ORDER BY` does. */
  consents: [] as { scopes: string[]; updatedAt: Date }[],
  tx: {
    oauthConsent: { findFirst: vi.fn(), deleteMany: vi.fn() },
    oauthRefreshToken: { updateMany: vi.fn() },
    oauthAccessToken: { updateMany: vi.fn() },
    oauthClient: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: mocks.getSessionFromCtx,
}));
vi.mock("@better-auth/oauth-provider", () => ({ getOAuthProviderState: mocks.getOAuthProviderState }));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn((run: (tx: typeof mocks.tx) => unknown) => run(mocks.tx)),
    oauthRefreshToken: { findUnique: vi.fn() },
    oauthConsent: { findFirst: vi.fn() },
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
  mocks.consents = [];
  mocks.tx.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
    if (sql.join("?").includes(`FROM "oauthConsent"`)) return mocks.consents;
    mocks.calls.push("select refresh tokens to end");
    return [{ id: "refresh-1" }];
  });
  mocks.tx.$executeRaw.mockImplementation(async (sql: TemplateStringsArray) => {
    mocks.calls.push(sql.join("?").includes("DELETE") ? "delete refresh tokens" : "revoke access tokens");
    return 1;
  });
});

const ENDS_TOKENS = ["select refresh tokens to end", "revoke access tokens", "delete refresh tokens"];

/** The values the raw select of the refresh tokens to end was given, so a test can check its scoping. */
const endingSelectValues = (): unknown[] =>
  mocks.tx.$queryRaw.mock.calls
    .find(([sql]) => !(sql as TemplateStringsArray).join("?").includes(`FROM "oauthConsent"`))!
    .slice(1);

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
  const WIDE = ["surveys:read", "responses:read", "offline_access"];
  const refreshCtx = (refreshToken: unknown = "fbor_raw-token", returned: unknown = { access_token: "a" }) =>
    ctx("/oauth2/token", { grant_type: "refresh_token", refresh_token: refreshToken }, returned);
  const storedRow = (skipConsent = false) => ({
    userId: "user-1",
    clientId: "client-1",
    scopes: WIDE,
    authorizationCodeId: "code-1" as string | null,
    rotatedAt: new Date("2026-10-08T10:00:00Z"),
    sessionId: "session-1",
    client: { skipConsent },
  });
  /** Consent rows newest first, each a second older than the one before. */
  const consentWith = (...scopes: string[][]) => {
    mocks.consents = scopes.map((consentScopes, i) => ({
      scopes: consentScopes,
      updatedAt: new Date(Date.UTC(2026, 9, 8, 10, 0, 59 - i)),
    }));
  };

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
    consentWith(WIDE);

    await requireOAuthConsentOnRefreshAfterHandler(refreshCtx());

    const hash = createHash("sha256").update("raw-token").digest("base64url");
    expect(prisma.oauthRefreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: hash } })
    );
  });

  test("lets the refresh through while the consent covers the token's scopes", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    consentWith([...WIDE, "workflows:read"]);

    await expect(requireOAuthConsentOnRefreshAfterHandler(refreshCtx())).resolves.toBeUndefined();
    expect(mocks.calls).toEqual([]);
  });

  test("bounds the token by the newest consent row when a race left two", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    // The older row still has the wide scopes; the newer one, the user's latest decision, doesn't.
    consentWith(["surveys:read", "offline_access"], WIDE);

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
  });

  test("revokes the grant and refuses the refresh once the consent is gone", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    consentWith();

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
    expect(mocks.calls).toEqual(["revoke refresh tokens", "revoke access tokens"]);
  });

  test("ends the tokens beyond a narrowed consent, and the presented grant, and refuses the refresh", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    consentWith(["surveys:read", "offline_access"]);

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
    // Access tokens first: deleting a refresh token cascades to the access tokens minted from it.
    expect(mocks.calls).toEqual(ENDS_TOKENS);
    // Scoped to the user and client, bounded by the consent, and reaching the presented token's grant.
    expect(endingSelectValues()).toEqual([
      "user-1",
      "client-1",
      ["surveys:read", "offline_access"],
      "code-1",
      "code-1",
      new Date("2026-10-08T10:00:00Z"),
      "session-1",
    ]);
    // Only a full revoke touches every token the client holds; a narrowing leaves the rest alone.
    expect(mocks.tx.oauthRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  test("finds the token minted for a refused pre-1.7 grant by its rotation stamp, having no grant id", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue({
      ...storedRow(),
      authorizationCodeId: null,
    } as never);
    consentWith(["surveys:read", "offline_access"]);

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
    expect(endingSelectValues()).toEqual([
      "user-1",
      "client-1",
      ["surveys:read", "offline_access"],
      null,
      null,
      new Date("2026-10-08T10:00:00Z"),
      "session-1",
    ]);
  });

  test("bounds the token by what every row allows when the newest rows were written in the same second", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    const sameSecond = new Date("2026-10-08T10:00:59Z");
    mocks.consents = [
      { scopes: WIDE, updatedAt: sameSecond },
      { scopes: ["surveys:read", "offline_access"], updatedAt: sameSecond },
    ];

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
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

describe("revokeTokensBeyondConsentAfterHandler", () => {
  const NARROW = ["surveys:read", "offline_access"];
  const oauthQuery = new URLSearchParams({
    client_id: "client-1",
    scope: NARROW.join(" "),
    sig: "s",
  }).toString();
  const approve = (returned: unknown = { redirect: true, url: "https://client/cb" }) =>
    ctx("/oauth2/consent", { accept: true, oauth_query: oauthQuery }, returned);

  beforeEach(() => {
    mocks.getSessionFromCtx.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getOAuthProviderState.mockResolvedValue({ query: oauthQuery });
    mocks.tx.oauthClient.findUnique.mockResolvedValue({ skipConsent: false });
    mocks.consents = [{ scopes: NARROW, updatedAt: new Date("2026-10-08T10:00:00Z") }];
  });

  test.each([
    ["another path", ctx("/oauth2/token", { accept: true, oauth_query: oauthQuery })],
    ["a denied approval", ctx("/oauth2/consent", { accept: false, oauth_query: oauthQuery })],
    ["an update-consent without an id", ctx("/oauth2/update-consent", { update: { scopes: NARROW } })],
  ])("does nothing for %s", async (_label, hookCtx) => {
    await revokeTokensBeyondConsentAfterHandler(hookCtx);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("does nothing when the provider holds no authorization request", async () => {
    mocks.getOAuthProviderState.mockResolvedValue(null);

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("reads the client from the provider's request state, not the request body", async () => {
    await revokeTokensBeyondConsentAfterHandler(ctx("/oauth2/consent", { accept: true }));

    expect(mocks.tx.oauthClient.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client-1" } })
    );
  });

  test("does nothing without a session", async () => {
    mocks.getSessionFromCtx.mockResolvedValue(null);

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("ends the approved client's tokens beyond the stored consent, for the caller only", async () => {
    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.calls).toEqual(ENDS_TOKENS);
    // No grant: a narrowing reaches tokens by their scopes alone, never a whole grant.
    expect(endingSelectValues()).toEqual(["user-1", "client-1", NARROW, null, null, null, null]);
  });

  test("finds an updated consent's client through a lookup scoped to the caller", async () => {
    vi.mocked(prisma.oauthConsent.findFirst).mockResolvedValue({ clientId: "client-1" } as never);

    await revokeTokensBeyondConsentAfterHandler(
      ctx("/oauth2/update-consent", { id: "consent-1", update: { scopes: NARROW } }, { id: "consent-1" })
    );

    expect(prisma.oauthConsent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "consent-1", userId: "user-1" } })
    );
    expect(endingSelectValues()).toEqual(["user-1", "client-1", NARROW, null, null, null, null]);
  });

  test("does nothing for an updated consent the caller doesn't own", async () => {
    vi.mocked(prisma.oauthConsent.findFirst).mockResolvedValue(null);

    await revokeTokensBeyondConsentAfterHandler(
      ctx("/oauth2/update-consent", { id: "someone-elses", update: { scopes: NARROW } })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("still reconciles when the provider's answer is an error, since the consent may be written", async () => {
    await revokeTokensBeyondConsentAfterHandler(approve(new APIError("BAD_REQUEST")));

    expect(mocks.calls).toEqual(ENDS_TOKENS);
  });

  test("leaves a skipConsent client alone: the provider issues its tokens without consulting consent", async () => {
    mocks.tx.oauthClient.findUnique.mockResolvedValue({ skipConsent: true });

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(mocks.calls).toEqual([]);
  });

  test("logs a failure instead of failing an approval that is already committed", async () => {
    mocks.tx.$executeRaw.mockRejectedValue(new Error("connection reset"));

    await expect(revokeTokensBeyondConsentAfterHandler(approve())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), userId: "user-1" }),
      expect.any(String)
    );
  });

  test("leaves a client without a consent row alone: skipConsent clients and revokes aren't its job", async () => {
    mocks.consents = [];

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(mocks.calls).toEqual([]);
  });
});
