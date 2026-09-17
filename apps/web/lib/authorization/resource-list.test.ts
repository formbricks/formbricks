import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { getAuthorizationSurface, recordAuthorizationCheckIssued } from "./context";
import { recordAuthorizationDecision } from "./metrics";
import { getApiKeyAuthById } from "./resolvers";
import { lookupAuthorizedOrganizationIds, lookupAuthorizedWorkspaceIds } from "./resource-list";

vi.mock("@formbricks/database", () => ({
  prisma: { $queryRaw: vi.fn(), organization: { findMany: vi.fn() } },
}));
vi.mock("./resolvers", () => ({ getApiKeyAuthById: vi.fn() }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("./context", () => ({
  getAuthorizationSurface: vi.fn(() => "unscoped"),
  recordAuthorizationCheckIssued: vi.fn(),
}));
vi.mock("./metrics", () => ({ recordAuthorizationDecision: vi.fn() }));

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
  vi.mocked(getApiKeyAuthById).mockResolvedValue(null);
  vi.mocked(getAuthzedClient).mockImplementation(() => {
    throw new Error("SDK unavailable");
  });
  vi.mocked(assertAuthzedProjectionFreshness).mockRejectedValue(new Error("projection stale"));
});

describe("bridge resource lists", () => {
  test("organization discovery retains all membership roles, excluding inactive users", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([{ id: "organization" }] as never);
    await expect(lookupAuthorizedOrganizationIds({ type: "user", id: "user" })).resolves.toEqual([
      "organization",
    ]);
    expect(prisma.organization.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { memberships: { some: { userId: "user", user: { isActive: true } } } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    expect(recordAuthorizationCheckIssued).toHaveBeenCalledOnce();
    expect(getAuthzedClient).not.toHaveBeenCalled();
    expect(assertAuthzedProjectionFreshness).not.toHaveBeenCalled();
  });

  test.each([1, 100])(
    "%s workspaces issue one query and one central decision without SpiceDB",
    async (count) => {
      const ids = Array.from({ length: count }, (_, index) => "workspace-" + index);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(ids.map((id) => ({ id })));
      await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user" })).resolves.toEqual(ids);
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      expect(recordAuthorizationCheckIssued).toHaveBeenCalledOnce();
      expect(recordAuthorizationDecision).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ action: "workspace.read", outcome: "allow" })
      );
      expect(getAuthzedClient).not.toHaveBeenCalled();
      expect(assertAuthzedProjectionFreshness).not.toHaveBeenCalled();
    }
  );

  test.each(["read", "write"] as const)(
    "API-key %s list uses existing tenant-filtered grants and deduplicates",
    async (permission) => {
      vi.mocked(getApiKeyAuthById).mockResolvedValue({
        type: "apiKey",
        apiKeyId: "key",
        organizationId: "org",
        organizationAccess: {},
        workspacePermissions: [
          { workspaceId: "b", workspaceName: "B", permission: "manage" },
          { workspaceId: "a", workspaceName: "A", permission: "read" },
          { workspaceId: "b", workspaceName: "B", permission: "manage" },
          { workspaceId: "c", workspaceName: "C", permission: "write" },
        ],
      });
      await expect(lookupAuthorizedWorkspaceIds({ type: "apiKey", id: "key" }, permission)).resolves.toEqual(
        permission === "read" ? ["a", "b", "c"] : ["b", "c"]
      );
      expect(getApiKeyAuthById).toHaveBeenCalledOnce();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    }
  );

  test.each([undefined, { read: true }, { write: true }, { read: false, write: false }])(
    "API-key organization list honors accessControl %j",
    async (accessControl) => {
      vi.mocked(getApiKeyAuthById).mockResolvedValue({
        type: "apiKey",
        apiKeyId: "key",
        organizationId: "org",
        organizationAccess: { accessControl },
        workspacePermissions: [],
      } as never);
      await expect(lookupAuthorizedOrganizationIds({ type: "apiKey", id: "key" })).resolves.toEqual(
        accessControl?.read || accessControl?.write ? ["org"] : []
      );
    }
  );

  test("deleted API key returns an empty list", async () => {
    await expect(lookupAuthorizedWorkspaceIds({ type: "apiKey", id: "deleted" })).resolves.toEqual([]);
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(expect.objectContaining({ outcome: "deny" }));
  });

  test("database failure is sanitized and never an empty list", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("secret workspace-id token database-url"));
    await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user" })).rejects.toMatchObject({
      code: "authzed_internal",
      message: "authzed_internal",
      operation: "authorization_list",
    });
    expect(JSON.stringify(vi.mocked(recordAuthorizationDecision).mock.calls)).not.toMatch(
      /secret|workspace-id|token|database-url/
    );
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "operational_error" })
    );
  });

  test("records the current surface", async () => {
    vi.mocked(getAuthorizationSurface).mockReturnValueOnce("mcp");
    await lookupAuthorizedWorkspaceIds({ type: "apiKey", id: "key" });
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "deny", surface: "mcp" })
    );
  });
});
