import { prisma } from "@/lib/__mocks__/database";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { type TStoredMcpGrant, createMcpGrantIfMissing, queueMcpGrantAudit } from "@/modules/mcp/grant-store";
import { grantSkipConsentClientAfterHandler } from "./skip-consent-mcp-grant";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/membership/dashboard-viewer", () => ({ isOnlyDashboardViewer: vi.fn() }));
vi.mock("@/modules/mcp/grant-store", () => ({
  createMcpGrantIfMissing: vi.fn(),
  queueMcpGrantAudit: vi.fn(),
}));

type TCtx = Parameters<typeof grantSkipConsentClientAfterHandler>[0];
const ctx = (path: string, body: unknown, returned?: unknown): TCtx =>
  ({ path, body, context: { returned } }) as unknown as TCtx;

const base64url = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
/** An access token as the provider signs it; the handler only decodes it. */
const jwt = (payload: Record<string, unknown>): string =>
  `${base64url({ alg: "EdDSA", typ: "JWT" })}.${base64url(payload)}.signature`;

const issued = (
  payload: Record<string, unknown> = { sub: "user-1", azp: "client-1" },
  scope = "surveys:write responses:write dashboards:read"
) => ({
  access_token: jwt(payload),
  scope,
});

const tokenCtx = (returned: unknown = issued(), grantType: unknown = "authorization_code") =>
  ctx("/oauth2/token", { grant_type: grantType }, returned);

const created = { id: "grant-1", userId: "user-1", clientId: "client-1" } as TStoredMcpGrant;

describe("grantSkipConsentClientAfterHandler", () => {
  beforeEach(() => {
    vi.mocked(isOnlyDashboardViewer).mockReset().mockResolvedValue(false);
    vi.mocked(createMcpGrantIfMissing).mockReset().mockResolvedValue(created);
    vi.mocked(queueMcpGrantAudit).mockReset().mockResolvedValue(undefined);
    vi.mocked(logger.error).mockClear();
    prisma.oauthClient.findUnique.mockResolvedValue({ skipConsent: true } as never);
  });

  test.each(["authorization_code", "refresh_token"])(
    "gives a skipConsent client a grant on a %s issuance, without Tags or Audience, and audits it",
    async (grantType) => {
      await grantSkipConsentClientAfterHandler(tokenCtx(issued(), grantType));

      expect(prisma.oauthClient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: "client-1" } })
      );
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
    }
  );

  test("reads the client from `client_id` when the token carries no `azp`", async () => {
    await grantSkipConsentClientAfterHandler(tokenCtx(issued({ sub: "user-1", client_id: "client-2" })));

    expect(createMcpGrantIfMissing).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", clientId: "client-2" })
    );
  });

  test("trims a Dashboard viewer's scopes before granting", async () => {
    vi.mocked(isOnlyDashboardViewer).mockResolvedValue(true);

    await grantSkipConsentClientAfterHandler(tokenCtx());

    expect(createMcpGrantIfMissing).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: { charts: "read", dashboards: "read" } })
    );
  });

  test("leaves an existing grant alone and audits nothing", async () => {
    vi.mocked(createMcpGrantIfMissing).mockResolvedValue(null);

    await grantSkipConsentClientAfterHandler(tokenCtx());

    expect(createMcpGrantIfMissing).toHaveBeenCalled();
    expect(queueMcpGrantAudit).not.toHaveBeenCalled();
  });

  test.each([
    ["a client that shows the consent screen", { skipConsent: false }],
    ["an unknown client", null],
  ])("grants nothing to %s", async (_label, client) => {
    prisma.oauthClient.findUnique.mockResolvedValue(client as never);

    await grantSkipConsentClientAfterHandler(tokenCtx());

    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
  });

  test.each([
    ["another path", ctx("/oauth2/consent", { grant_type: "authorization_code" }, issued())],
    ["a client_credentials grant", tokenCtx(issued(), "client_credentials")],
    ["no grant type", ctx("/oauth2/token", undefined, issued())],
    ["a refused issuance", tokenCtx(new APIError("BAD_REQUEST"))],
    ["no response", tokenCtx(null)],
    ["a response without a scope", tokenCtx({ access_token: jwt({ sub: "user-1", azp: "client-1" }) })],
    ["an opaque access token", tokenCtx({ access_token: "opaque", scope: "surveys:read" })],
    ["a token without a subject", tokenCtx(issued({ azp: "client-1" }))],
    ["a token without a client", tokenCtx(issued({ sub: "user-1" }))],
  ])("does nothing for %s", async (_label, hookCtx) => {
    await grantSkipConsentClientAfterHandler(hookCtx);

    expect(prisma.oauthClient.findUnique).not.toHaveBeenCalled();
    expect(createMcpGrantIfMissing).not.toHaveBeenCalled();
  });

  test("logs an unexpected failure as an error instead of failing an issuance that already happened", async () => {
    vi.mocked(createMcpGrantIfMissing).mockRejectedValue(new Error("db down for user a@b.c"));

    await expect(grantSkipConsentClientAfterHandler(tokenCtx())).resolves.toBeUndefined();
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

    await expect(grantSkipConsentClientAfterHandler(tokenCtx())).resolves.toBeUndefined();
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
