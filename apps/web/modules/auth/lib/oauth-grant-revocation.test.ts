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
 * The decisions each hook makes, against a mocked Prisma: refuse or let through, which consent rows it
 * writes, what it logs, and when it does nothing. What the raw SQL selects is not asserted here; whether
 * the queries end the right tokens, against a real database, the real provider and a concurrent refresh,
 * is `oauth-grant-revocation.integration.test.ts`.
 */
type TMockConsent = { id: string; clientId: string; scopes: string[]; updatedAt: Date; skipConsent: boolean };

const mocks = vi.hoisted(() => ({
  getSessionFromCtx: vi.fn(),
  getOAuthProviderState: vi.fn(),
  calls: [] as string[],
  /** The consent rows the locking read returns. */
  consents: [] as TMockConsent[],
  /** Whether the presented token's grant holds a token beyond the consent. */
  grantBeyond: false,
  tx: {
    oauthConsent: { findFirst: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    oauthRefreshToken: { updateMany: vi.fn() },
    oauthAccessToken: { updateMany: vi.fn() },
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
  mocks.grantBeyond = false;
  // Two raw reads steer a decision, the consent rows and the grant check; the token queries find nothing.
  mocks.tx.$queryRaw.mockImplementation(async (sql: TemplateStringsArray, ...values: unknown[]) => {
    const text = sql.join("?");
    // The consent read only finds the rows of the client or consent it was asked for.
    if (text.includes(`FROM "oauthConsent" c`)) {
      // By client id, or, for update-consent, through the client of the consent it names.
      const asked = flattenSqlValues(values);
      const named = mocks.consents.find((row) => asked.includes(row.id));
      const clientId =
        named?.clientId ?? mocks.consents.find((row) => asked.includes(row.clientId))?.clientId;
      return mocks.consents.filter((row) => row.clientId === clientId);
    }
    if (text.includes("EXISTS")) return [{ beyond: mocks.grantBeyond }];
    return [];
  });
  mocks.tx.$executeRaw.mockResolvedValue(0);
});

/** A raw query's bound values, with nested `Prisma.sql` fragments' values flattened in. */
const flattenSqlValues = (values: unknown[]): unknown[] =>
  values.flatMap((value) =>
    value && typeof value === "object" && "values" in value
      ? flattenSqlValues((value as { values: unknown[] }).values)
      : [value]
  );

/** The start of the current second, as the provider stamps a consent row it has just written. */
const thisSecond = (): Date => new Date(Math.floor(Date.now() / 1000) * 1000);

/** A consent row as the locking read returns it. */
const consentRow = (id: string, scopes: string[], updatedAt: Date, skipConsent = false): TMockConsent => ({
  id,
  clientId: "client-1",
  scopes,
  updatedAt,
  skipConsent,
});

/** Whether the hook went on to end tokens beyond the consent (the raw writes; which rows is SQL's job). */
const endedTokensBeyondConsent = (): boolean => mocks.tx.$executeRaw.mock.calls.length > 0;

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
    mocks.consents = scopes.map((consentScopes, i) =>
      consentRow(`consent-${i}`, consentScopes, new Date(Date.UTC(2026, 9, 8, 10, 0, 59 - i)))
    );
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
    expect(endedTokensBeyondConsent()).toBe(false);
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
    expect(endedTokensBeyondConsent()).toBe(true);
    // Only a full revoke touches every token the client holds; a narrowing leaves the rest alone.
    expect(mocks.tx.oauthRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  test("bounds the token by the newest row even when an older duplicate is narrower", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    // The newest row, the user's latest decision, re-approved the wide scopes.
    consentWith(WIDE, ["surveys:read", "offline_access"]);

    await expect(requireOAuthConsentOnRefreshAfterHandler(refreshCtx())).resolves.toBeUndefined();
    expect(mocks.calls).toEqual([]);
    expect(endedTokensBeyondConsent()).toBe(false);
  });

  test("picks the newest row by its timestamp, not by the order the rows come back in", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    consentWith(["surveys:read", "offline_access"], WIDE);
    mocks.consents.reverse();

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
  });

  test("bounds the token by what every row allows when the newest rows were written in the same second", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue(storedRow() as never);
    const sameSecond = new Date("2026-10-08T10:00:59Z");
    mocks.consents = [
      consentRow("consent-0", WIDE, sameSecond),
      consentRow("consent-1", ["surveys:read", "offline_access"], sameSecond),
    ];

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
  });

  test("refuses a covered token whose grant holds another token beyond the consent", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue({
      ...storedRow(),
      scopes: ["surveys:read", "offline_access"],
    } as never);
    consentWith(["surveys:read", "offline_access"]);
    mocks.grantBeyond = true;

    await expectApiError(
      requireOAuthConsentOnRefreshAfterHandler(refreshCtx()),
      "BAD_REQUEST",
      "invalid_grant"
    );
    expect(endedTokensBeyondConsent()).toBe(true);
  });

  test("lets a covered token through when its whole grant fits the consent", async () => {
    vi.mocked(prisma.oauthRefreshToken.findUnique).mockResolvedValue({
      ...storedRow(),
      scopes: ["surveys:read", "offline_access"],
    } as never);
    consentWith(["surveys:read", "offline_access"]);

    await expect(requireOAuthConsentOnRefreshAfterHandler(refreshCtx())).resolves.toBeUndefined();
    expect(endedTokensBeyondConsent()).toBe(false);
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
    mocks.consents = [consentRow("consent-1", NARROW, new Date("2026-10-08T10:00:00Z"))];
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

    expect(endedTokensBeyondConsent()).toBe(true);
  });

  test("reconciles only the client the provider's state names", async () => {
    mocks.getOAuthProviderState.mockResolvedValue({
      query: new URLSearchParams({ client_id: "another-client", scope: NARROW.join(" ") }).toString(),
    });

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(endedTokensBeyondConsent()).toBe(false);
  });

  test("does nothing without a session", async () => {
    mocks.getSessionFromCtx.mockResolvedValue(null);

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("ends the approved client's tokens beyond the stored consent", async () => {
    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(endedTokensBeyondConsent()).toBe(true);
    // A single consent row: nothing to fold.
    expect(mocks.tx.oauthConsent.deleteMany).not.toHaveBeenCalled();
  });

  test("folds duplicate consent rows into the newest, so /authorize can't read a stale wider one", async () => {
    mocks.consents = [
      consentRow("consent-old", ["surveys:read", "responses:read", "offline_access"], new Date(1_000)),
      consentRow("consent-new", NARROW, new Date(2_000)),
    ];

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-new" } },
    });
    expect(mocks.tx.oauthConsent.update).not.toHaveBeenCalled();
  });

  test("on a same-second tie, keeps the row the approval just wrote", async () => {
    const sameSecond = thisSecond();
    // The approval asked for NARROW (the signed query's scope), so the NARROW row is the one it wrote.
    mocks.consents = [
      consentRow("consent-a", ["surveys:read", "responses:read", "offline_access"], sameSecond),
      consentRow("consent-b", NARROW, sameSecond),
    ];

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-b" } },
    });
    expect(mocks.tx.oauthConsent.update).not.toHaveBeenCalled();
  });

  test("on a same-second tie, a widening re-approval keeps what the user approved", async () => {
    const WIDE = ["surveys:read", "responses:read", "offline_access"];
    mocks.getOAuthProviderState.mockResolvedValue({
      query: new URLSearchParams({ client_id: "client-1", scope: WIDE.join(" ") }).toString(),
    });
    const sameSecond = thisSecond();
    mocks.consents = [consentRow("consent-a", NARROW, sameSecond), consentRow("consent-b", WIDE, sameSecond)];

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-b" } },
    });
    expect(mocks.tx.oauthConsent.update).not.toHaveBeenCalled();
  });

  test("on a same-second tie, the scopes accepted in the body name the row the approval wrote", async () => {
    const sameSecond = thisSecond();
    // The query asked for every scope; the user accepted NARROW only, so NARROW is what was stored.
    mocks.getOAuthProviderState.mockResolvedValue({
      query: new URLSearchParams({
        client_id: "client-1",
        scope: "surveys:read responses:read offline_access",
      }).toString(),
    });
    mocks.consents = [
      consentRow("consent-a", ["surveys:read", "responses:read", "offline_access"], sameSecond),
      consentRow("consent-b", NARROW, sameSecond),
    ];

    await revokeTokensBeyondConsentAfterHandler(
      ctx("/oauth2/consent", { accept: true, scope: NARROW.join(" ") }, { redirect: true })
    );

    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-b" } },
    });
  });

  test("on a same-second tie after a refused request, names no write and keeps what every row allows", async () => {
    const sameSecond = thisSecond();
    mocks.consents = [
      consentRow("consent-a", NARROW, sameSecond),
      consentRow("consent-b", ["surveys:read", "responses:read", "offline_access"], sameSecond),
    ];

    await revokeTokensBeyondConsentAfterHandler(
      ctx(
        "/oauth2/update-consent",
        { id: "consent-b", update: { scopes: ["nope"] } },
        new APIError("BAD_REQUEST")
      )
    );

    // The refused request wrote nothing, so the wide row it named isn't trusted as the latest write.
    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-a" } },
    });
  });

  test("ignores a malformed scope in the body rather than failing", async () => {
    await revokeTokensBeyondConsentAfterHandler(ctx("/oauth2/consent", { accept: true, scope: 1 }));

    expect(logger.error).not.toHaveBeenCalled();
    expect(endedTokensBeyondConsent()).toBe(true);
  });

  test("on a same-second tie from an earlier write, trusts no row and keeps what every tied row allows", async () => {
    // The approval's scopes match consent-a, but both rows were stamped long before this request, as
    // when an accepted path (a prompt=login bounce) writes nothing.
    const earlier = new Date(Date.now() - 60_000);
    mocks.consents = [
      consentRow("consent-a", ["surveys:read", "responses:read", "offline_access"], earlier),
      consentRow("consent-b", NARROW, earlier),
    ];
    mocks.getOAuthProviderState.mockResolvedValue({
      query: new URLSearchParams({
        client_id: "client-1",
        scope: "surveys:read responses:read offline_access",
      }).toString(),
    });

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.tx.oauthConsent.update).toHaveBeenCalledWith({
      where: { id: "consent-a" },
      data: { scopes: NARROW },
    });
  });

  test("on a same-second tie no write can be named, so keeps what every tied row allows", async () => {
    mocks.getOAuthProviderState.mockResolvedValue({
      query: new URLSearchParams({ client_id: "client-1", scope: "openid" }).toString(),
    });
    const sameSecond = thisSecond();
    mocks.consents = [
      consentRow("consent-a", ["surveys:read", "responses:read", "offline_access"], sameSecond),
      consentRow("consent-b", NARROW, sameSecond),
    ];

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(mocks.tx.oauthConsent.update).toHaveBeenCalledWith({
      where: { id: "consent-a" },
      data: { scopes: NARROW },
    });
  });

  test("on a same-second tie, update-consent keeps the row it updated", async () => {
    const sameSecond = thisSecond();
    mocks.consents = [
      consentRow("consent-a", NARROW, sameSecond),
      consentRow("consent-b", ["surveys:read", "responses:read", "offline_access"], sameSecond),
    ];

    await revokeTokensBeyondConsentAfterHandler(
      ctx("/oauth2/update-consent", { id: "consent-b", update: { scopes: [] } }, { id: "consent-b" })
    );

    expect(mocks.tx.oauthConsent.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientId: "client-1", id: { not: "consent-b" } },
    });
  });

  test("warns when an accepted approval can't be mapped to its client", async () => {
    mocks.getOAuthProviderState.mockResolvedValue(null);

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(logger.warn).toHaveBeenCalledWith({ userId: "user-1" }, expect.any(String));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("reconciles an update-consent through the consent it names", async () => {
    await revokeTokensBeyondConsentAfterHandler(
      ctx("/oauth2/update-consent", { id: "consent-1", update: { scopes: NARROW } }, { id: "consent-1" })
    );

    expect(endedTokensBeyondConsent()).toBe(true);
  });

  test("still reconciles when the provider's answer is an error, since the consent may be written", async () => {
    await revokeTokensBeyondConsentAfterHandler(approve(new APIError("BAD_REQUEST")));

    expect(endedTokensBeyondConsent()).toBe(true);
  });

  test("leaves a skipConsent client alone: the provider issues its tokens without consulting consent", async () => {
    mocks.consents = [consentRow("consent-1", NARROW, new Date(2_000), true)];

    await revokeTokensBeyondConsentAfterHandler(approve());
    expect(endedTokensBeyondConsent()).toBe(false);
  });

  test("retries a failure once, logging the first one, so a transient error doesn't leave tokens behind", async () => {
    mocks.tx.$executeRaw.mockResolvedValue(1).mockRejectedValueOnce(new Error("deadlock detected"));

    await revokeTokensBeyondConsentAfterHandler(approve());

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), userId: "user-1" }),
      expect.any(String)
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", clientId: "client-1" }),
      expect.any(String)
    );
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
    expect(endedTokensBeyondConsent()).toBe(false);
  });
});
