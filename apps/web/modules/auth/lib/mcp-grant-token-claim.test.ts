import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import {
  type TStoredMcpGrant,
  createMcpGrantIfMissing,
  lockUserForMcpGrantWrite,
  queueMcpGrantAudit,
} from "@/modules/mcp/grant-store";
import { MCP_GRANT_TOKEN_CLAIM, mcpGrantAccessTokenClaims } from "./mcp-grant-token-claim";
import {
  REVOCATION_CLOCK_SKEW_MS,
  readExchangedAuthorizationCode,
  readOAuthRevocationTime,
} from "./oauth-revocation-marker";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/membership/dashboard-viewer", () => ({ isOnlyDashboardViewer: vi.fn() }));
vi.mock("@/modules/mcp/grant-store", () => ({
  createMcpGrantIfMissing: vi.fn(),
  lockUserForMcpGrantWrite: vi.fn(),
  queueMcpGrantAudit: vi.fn(),
}));
vi.mock("./oauth-revocation-marker", async (importOriginal) => {
  // The skew rule is the real one: the claim and the token endpoint decide by the same function.
  const { REVOCATION_CLOCK_SKEW_MS, isIssuedBeforeRevocation } =
    await importOriginal<typeof import("./oauth-revocation-marker")>();
  return {
    REVOCATION_CLOCK_SKEW_MS,
    isIssuedBeforeRevocation,
    readExchangedAuthorizationCode: vi.fn(),
    readOAuthRevocationTime: vi.fn(),
  };
});

const USER = { id: "user-1" };
const CONSENT_CLIENT = { clientId: "client-1", skipConsent: false };
const FIRST_PARTY = { clientId: "client-1", skipConsent: true };
const SCOPES = ["surveys:write", "responses:write", "dashboards:read"];

const created = { id: "grant-1", userId: "user-1", clientId: "client-1" } as TStoredMcpGrant;

const claims = (overrides: Partial<Parameters<typeof mcpGrantAccessTokenClaims>[0]> = {}) =>
  mcpGrantAccessTokenClaims({
    user: USER,
    client: FIRST_PARTY,
    scopes: SCOPES,
    grantType: "authorization_code",
    ...overrides,
  });

/** When the token endpoint's before-hook read the code this exchange spends. */
const ISSUED_AT = 1_000;

beforeEach(() => {
  vi.mocked(isOnlyDashboardViewer).mockReset().mockResolvedValue(false);
  vi.mocked(createMcpGrantIfMissing).mockReset().mockResolvedValue(created);
  vi.mocked(lockUserForMcpGrantWrite).mockReset().mockResolvedValue(undefined);
  vi.mocked(queueMcpGrantAudit).mockReset().mockResolvedValue(undefined);
  vi.mocked(readExchangedAuthorizationCode)
    .mockReset()
    .mockResolvedValue({ userId: "user-1", clientId: "client-1", issuedAt: ISSUED_AT });
  vi.mocked(readOAuthRevocationTime).mockReset().mockResolvedValue(null);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.warn).mockClear();
  prisma.$transaction.mockImplementation((async (run: (tx: unknown) => unknown) => run(prisma)) as never);
  prisma.mcpGrant.findUnique.mockResolvedValue({ id: "grant-1" } as never);
});

describe("mcpGrantAccessTokenClaims", () => {
  test.each([
    ["an authorization code", "authorization_code", CONSENT_CLIENT],
    ["a refresh", "refresh_token", FIRST_PARTY],
  ])("names the grant the token is issued under, for %s", async (_case, grantType, client) => {
    await expect(claims({ grantType, client })).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: "grant-1" });
    expect(prisma.mcpGrant.findUnique).toHaveBeenCalledWith({
      where: { userId_clientId: { userId: "user-1", clientId: "client-1" } },
      select: { id: true },
    });
  });

  // `null`, not absent: an absent claim marks a token from the previous release, checked by issue time.
  test("names no grant (null) while the connection has none, and nothing without a user", async () => {
    prisma.mcpGrant.findUnique.mockResolvedValue(null);
    await expect(claims({ client: CONSENT_CLIENT })).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: null });
    await expect(claims({ user: null })).resolves.toEqual({});
    await expect(claims({ user: undefined })).resolves.toEqual({});
  });

  test("gives a skipConsent client's code exchange a grant, without Tags or Audience, and audits it", async () => {
    await expect(claims()).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: "grant-1" });

    const [, { userId, clientId, permissions }] = vi.mocked(createMcpGrantIfMissing).mock.calls[0];
    expect({ userId, clientId }).toEqual({ userId: "user-1", clientId: "client-1" });
    // `responses:write` gives Responses, never Tags: only a user picks that on a consent screen.
    expect(permissions).toMatchObject({ surveys: "write", responses: "write", dashboards: "read" });
    expect(permissions).not.toHaveProperty("tags");
    expect(queueMcpGrantAudit).toHaveBeenCalledWith({
      action: "created",
      actorUserId: "user-1",
      before: null,
      after: created,
    });
    // Created before the token reads it, so the token names it.
    expect(vi.mocked(createMcpGrantIfMissing).mock.invocationCallOrder[0]).toBeLessThan(
      prisma.mcpGrant.findUnique.mock.invocationCallOrder[0]
    );
  });

  test("trims a Dashboard viewer's scopes before granting", async () => {
    vi.mocked(isOnlyDashboardViewer).mockResolvedValue(true);

    await claims();

    expect(createMcpGrantIfMissing).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ permissions: { charts: "read", dashboards: "read" } })
    );
  });

  test("leaves an existing grant alone and audits nothing", async () => {
    vi.mocked(createMcpGrantIfMissing).mockResolvedValue(null);

    await claims();

    expect(queueMcpGrantAudit).not.toHaveBeenCalled();
  });

  // A refresh never brings a grant back: it may have raced a Revoke (the refresh check ends the connection).
  test.each([
    ["a refresh", { grantType: "refresh_token" }],
    ["a client that shows the consent screen", { client: CONSENT_CLIENT }],
    ["an introspection, which names no grant type", { grantType: undefined }],
  ])("creates no grant for %s", async (_case, overrides) => {
    await claims(overrides);

    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
  });

  // Fail closed: without the hook's record of the code there is no issue time to check the mark against.
  test("creates no grant when the exchange recorded no authorization code", async () => {
    vi.mocked(readExchangedAuthorizationCode).mockResolvedValue(null);
    prisma.mcpGrant.findUnique.mockResolvedValue(null);

    await expect(claims()).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: null });
    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { userId: "user-1", clientId: "client-1" },
      "No authorization code recorded for this exchange, so no grant was created for the skipConsent client"
    );
  });

  // The provider spends the code after the before-hook read the mark: a Revoke that commits in between
  // must leave the connection without a grant, or the revoked client would be back.
  test.each([
    ["in the code's second", ISSUED_AT],
    ["after it", ISSUED_AT + 1],
    // The revoking pod's clock may run behind the issuing pod's.
    ["just before it, within the clock skew", ISSUED_AT - REVOCATION_CLOCK_SKEW_MS],
  ])("creates no grant when a Revoke marked %s", async (_case, revokedAt) => {
    vi.mocked(readOAuthRevocationTime).mockResolvedValue(revokedAt);
    prisma.mcpGrant.findUnique.mockResolvedValue(null);

    await expect(claims()).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: null });
    expect(lockUserForMcpGrantWrite).toHaveBeenCalledWith(prisma, "user-1");
    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
  });

  test("gives the grant when the last Revoke was before the code was issued, beyond the clock skew", async () => {
    vi.mocked(readOAuthRevocationTime).mockResolvedValue(ISSUED_AT - REVOCATION_CLOCK_SKEW_MS - 1);
    prisma.$transaction.mockClear();

    await expect(claims()).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: "grant-1" });
    expect(createMcpGrantIfMissing).toHaveBeenCalled();
    // Under the user's row, which a Revoke waiting behind a reconciling pass can hold for 30 s.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 35_000 });
  });

  // A client that asked for no MCP scope could do nothing with a grant: none is created for it.
  test("creates no grant for a skipConsent client that asked for no MCP scope", async () => {
    prisma.mcpGrant.findUnique.mockResolvedValue(null);

    await expect(claims({ scopes: ["openid", "offline_access"] })).resolves.toEqual({
      [MCP_GRANT_TOKEN_CLAIM]: null,
    });
    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
  });

  test("logs an unexpected failure as an error and still issues the token, naming no grant", async () => {
    vi.mocked(createMcpGrantIfMissing).mockRejectedValue(new Error("db down for user a@b.c"));
    prisma.mcpGrant.findUnique.mockResolvedValue(null);

    await expect(claims()).resolves.toEqual({ [MCP_GRANT_TOKEN_CLAIM]: null });
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.objectContaining({ errName: "Error" }), userId: "user-1", clientId: "client-1" },
      "Saving the grant of a skipConsent MCP client failed"
    );
    // Name and frames only: an error's message is never logged.
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("a@b.c");
  });

  test("logs a known Prisma error, such as the user deleted meanwhile, as a warning", async () => {
    vi.mocked(createMcpGrantIfMissing).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
        clientVersion: "test",
      })
    );

    await claims();

    expect(logger.warn).toHaveBeenCalledWith(
      {
        err: expect.objectContaining({ errName: "PrismaClientKnownRequestError" }),
        userId: "user-1",
        clientId: "client-1",
      },
      "Saving the grant of a skipConsent MCP client failed"
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
