import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { type TStoredMcpGrant, createMcpGrantIfMissing, queueMcpGrantAudit } from "@/modules/mcp/grant-store";
import { MCP_GRANT_TOKEN_CLAIM, mcpGrantAccessTokenClaims } from "./mcp-grant-token-claim";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/membership/dashboard-viewer", () => ({ isOnlyDashboardViewer: vi.fn() }));
vi.mock("@/modules/mcp/grant-store", () => ({
  createMcpGrantIfMissing: vi.fn(),
  queueMcpGrantAudit: vi.fn(),
}));

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

beforeEach(() => {
  vi.mocked(isOnlyDashboardViewer).mockReset().mockResolvedValue(false);
  vi.mocked(createMcpGrantIfMissing).mockReset().mockResolvedValue(created);
  vi.mocked(queueMcpGrantAudit).mockReset().mockResolvedValue(undefined);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.warn).mockClear();
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

    const [{ userId, clientId, permissions }] = vi.mocked(createMcpGrantIfMissing).mock.calls[0];
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
