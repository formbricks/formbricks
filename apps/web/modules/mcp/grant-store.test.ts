import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  deleteMcpGrantRelationshipsBeforeCommit,
  reconcileMcpGrantRelationships,
} from "@/lib/authzed/mcp-grant";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import {
  type TStoredMcpGrant,
  createMcpGrantIfMissing,
  deleteMcpGrants,
  getMcpGrant,
  prepareMcpGrantAudits,
  projectMcpGrants,
  queueMcpGrantAudit,
  queueMcpGrantAudits,
  readMcpGrantAccess,
  saveMcpGrant,
} from "./grant-store";

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/authzed/mcp-grant", () => ({
  deleteMcpGrantRelationshipsBeforeCommit: vi.fn(),
  reconcileMcpGrantRelationships: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(),
}));

const USER_ID = "user-1";
const CLIENT_ID = "client-1";
const GRANT_ID = "grant-1";

const row = (
  overrides: Partial<{
    access: "all" | "organizations" | "workspaces";
    organizations: string[];
    permissions: unknown;
    workspaces: string[];
  }> = {}
) => ({
  id: GRANT_ID,
  userId: USER_ID,
  clientId: CLIENT_ID,
  access: overrides.access ?? "all",
  permissions: overrides.permissions ?? { surveys: "read" },
  organizations: (overrides.organizations ?? []).map((organizationId) => ({ organizationId })),
  workspaces: (overrides.workspaces ?? []).map((workspaceId) => ({ workspaceId })),
});

const stored = (overrides: Partial<TStoredMcpGrant> = {}): TStoredMcpGrant =>
  ({
    id: GRANT_ID,
    userId: USER_ID,
    clientId: CLIENT_ID,
    permissions: { surveys: "read" },
    access: "all",
    ...overrides,
  }) as TStoredMcpGrant;

const newTx = () => mockDeep<Prisma.TransactionClient>();

describe("readMcpGrantAccess", () => {
  test("reads only the selection the grant's mode reads", () => {
    const rows = { organizations: [{ organizationId: "org-1" }], workspaces: [{ workspaceId: "ws-1" }] };

    expect(readMcpGrantAccess({ ...rows, access: "all" })).toEqual({ access: "all" });
    expect(readMcpGrantAccess({ ...rows, access: "organizations" })).toEqual({
      access: "organizations",
      organizationIds: ["org-1"],
    });
    expect(readMcpGrantAccess({ ...rows, access: "workspaces" })).toEqual({
      access: "workspaces",
      workspaceIds: ["ws-1"],
    });
  });
});

describe("getMcpGrant", () => {
  test("returns null for a connection without a grant", async () => {
    prisma.mcpGrant.findUnique.mockResolvedValue(null);

    await expect(getMcpGrant(USER_ID, CLIENT_ID)).resolves.toBeNull();
    expect(prisma.mcpGrant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_clientId: { userId: USER_ID, clientId: CLIENT_ID } } })
    );
  });

  test("drops stored permissions that are unknown or at a level the permission doesn't offer", async () => {
    prisma.mcpGrant.findUnique.mockResolvedValue(
      row({
        access: "workspaces",
        permissions: { surveys: "write", unknownPermission: "read", workflowRuns: "write" },
        workspaces: ["ws-1"],
      }) as never
    );

    await expect(getMcpGrant(USER_ID, CLIENT_ID)).resolves.toEqual({
      id: GRANT_ID,
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "write" },
      access: "workspaces",
      workspaceIds: ["ws-1"],
    });
  });
});

describe("saveMcpGrant", () => {
  beforeEach(() => {
    vi.mocked(deleteMcpGrantRelationshipsBeforeCommit).mockReset().mockResolvedValue(undefined);
  });

  test("creates a new grant with All access when the request names no access", async () => {
    const tx = newTx();
    tx.mcpGrant.findUnique.mockResolvedValue(null);
    tx.mcpGrant.upsert.mockResolvedValue(row() as never);

    const result = await saveMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "read" },
    });

    expect(result).toEqual({ before: null, after: stored() });
    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: USER_ID, clientId: CLIENT_ID, access: "all", permissions: { surveys: "read" } },
      })
    );
    expect(tx.mcpGrantWorkspace.createMany).not.toHaveBeenCalled();
    expect(deleteMcpGrantRelationshipsBeforeCommit).not.toHaveBeenCalled();
  });

  test("keeps an existing grant's access when the request names none, and doesn't rewrite the column", async () => {
    const tx = newTx();
    const existing = row({ access: "workspaces", workspaces: ["ws-1"] });
    tx.mcpGrant.findUnique.mockResolvedValue(existing as never);
    tx.mcpGrant.upsert.mockResolvedValue({ ...existing, permissions: { surveys: "write" } } as never);

    const { before, after } = await saveMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "write" },
    });

    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { permissions: { surveys: "write" } } })
    );
    expect(before).toMatchObject({ access: "workspaces", workspaceIds: ["ws-1"] });
    expect(after).toMatchObject({
      access: "workspaces",
      workspaceIds: ["ws-1"],
      permissions: { surveys: "write" },
    });
    expect(tx.mcpGrantWorkspace.deleteMany).not.toHaveBeenCalled();
  });

  test("stores only the workspaces the user may pick and deletes the dropped reach before commit", async () => {
    const tx = newTx();
    tx.mcpGrant.findUnique.mockResolvedValue(
      row({ access: "organizations", organizations: ["org-1"] }) as never
    );
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "workspaces" }) as never);
    // "ws-foreign" belongs to an organization the user isn't a member of.
    tx.workspace.findMany.mockResolvedValue([{ id: "ws-mine" }] as never);

    const { before, after } = await saveMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: { surveys: "read" },
      access: { access: "workspaces", workspaceIds: ["ws-mine", "ws-foreign"] },
    });

    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { permissions: { surveys: "read" }, access: "workspaces" } })
    );
    expect(tx.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["ws-mine", "ws-foreign"] },
          organization: { memberships: { some: { userId: USER_ID } } },
        },
      })
    );
    // Every organization row goes (the other kind), every workspace row not picked goes.
    expect(tx.mcpGrantOrganization.deleteMany).toHaveBeenCalledWith({
      where: { grantId: GRANT_ID, organizationId: { notIn: [] } },
    });
    expect(tx.mcpGrantWorkspace.deleteMany).toHaveBeenCalledWith({
      where: { grantId: GRANT_ID, workspaceId: { notIn: ["ws-mine"] } },
    });
    expect(tx.mcpGrantWorkspace.createMany).toHaveBeenCalledWith({
      data: [{ grantId: GRANT_ID, workspaceId: "ws-mine" }],
      skipDuplicates: true,
    });
    expect(tx.mcpGrantOrganization.createMany).not.toHaveBeenCalled();
    expect(after).toMatchObject({ access: "workspaces", workspaceIds: ["ws-mine"] });
    expect(deleteMcpGrantRelationshipsBeforeCommit).toHaveBeenCalledWith([
      {
        before: { id: GRANT_ID, access: "organizations", organizationIds: ["org-1"], workspaceIds: [] },
        after: { id: GRANT_ID, access: "workspaces", organizationIds: [], workspaceIds: ["ws-mine"] },
      },
    ]);
    expect(before).toMatchObject({ access: "organizations" });
  });

  test("stores only organizations the user is a member of", async () => {
    const tx = newTx();
    tx.mcpGrant.findUnique.mockResolvedValue(null);
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "organizations" }) as never);
    tx.membership.findMany.mockResolvedValue([{ organizationId: "org-mine" }] as never);

    const { before, after } = await saveMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: {},
      access: { access: "organizations", organizationIds: ["org-mine", "org-foreign"] },
    });

    expect(tx.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, organizationId: { in: ["org-mine", "org-foreign"] } },
      })
    );
    expect(tx.mcpGrantOrganization.createMany).toHaveBeenCalledWith({
      data: [{ grantId: GRANT_ID, organizationId: "org-mine" }],
      skipDuplicates: true,
    });
    expect(after).toMatchObject({ access: "organizations", organizationIds: ["org-mine"] });
    expect(before).toBeNull();
    // A new grant had no reach to take away.
    expect(deleteMcpGrantRelationshipsBeforeCommit).not.toHaveBeenCalled();
  });

  test("a switch to All access clears both selections and inserts none", async () => {
    const tx = newTx();
    tx.mcpGrant.findUnique.mockResolvedValue(row({ access: "workspaces", workspaces: ["ws-1"] }) as never);
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "all" }) as never);

    await saveMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      permissions: {},
      access: { access: "all" },
    });

    expect(tx.mcpGrantWorkspace.deleteMany).toHaveBeenCalledWith({
      where: { grantId: GRANT_ID, workspaceId: { notIn: [] } },
    });
    expect(tx.mcpGrantWorkspace.createMany).not.toHaveBeenCalled();
    expect(tx.mcpGrantOrganization.createMany).not.toHaveBeenCalled();
    expect(deleteMcpGrantRelationshipsBeforeCommit).toHaveBeenCalledWith([
      {
        before: expect.objectContaining({ access: "workspaces", workspaceIds: ["ws-1"] }),
        after: expect.objectContaining({ access: "all", workspaceIds: [] }),
      },
    ]);
  });

  test("fails the save when SpiceDB can't drop the narrowed reach", async () => {
    const tx = newTx();
    tx.mcpGrant.findUnique.mockResolvedValue(row({ access: "workspaces", workspaces: ["ws-1"] }) as never);
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "workspaces" }) as never);
    tx.workspace.findMany.mockResolvedValue([] as never);
    const outage = new Error("spicedb down");
    vi.mocked(deleteMcpGrantRelationshipsBeforeCommit).mockRejectedValue(outage);

    await expect(
      saveMcpGrant(tx, {
        userId: USER_ID,
        clientId: CLIENT_ID,
        permissions: {},
        access: { access: "workspaces", workspaceIds: ["ws-gone"] },
      })
    ).rejects.toBe(outage);
  });
});

describe("createMcpGrantIfMissing", () => {
  test("returns the grant it created", async () => {
    prisma.mcpGrant.createMany.mockResolvedValue({ count: 1 });
    prisma.mcpGrant.findUnique.mockResolvedValue(row() as never);

    await expect(
      createMcpGrantIfMissing({ userId: USER_ID, clientId: CLIENT_ID, permissions: { surveys: "read" } })
    ).resolves.toEqual(stored());
    expect(prisma.mcpGrant.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, clientId: CLIENT_ID, access: "all", permissions: { surveys: "read" } }],
      skipDuplicates: true,
    });
  });

  test("returns null and reads nothing when the connection already had a grant", async () => {
    prisma.mcpGrant.createMany.mockResolvedValue({ count: 0 });

    await expect(
      createMcpGrantIfMissing({ userId: USER_ID, clientId: CLIENT_ID, permissions: {} })
    ).resolves.toBeNull();
    expect(prisma.mcpGrant.findUnique).not.toHaveBeenCalled();
  });
});

describe("deleteMcpGrants", () => {
  beforeEach(() => {
    vi.mocked(deleteMcpGrantRelationshipsBeforeCommit).mockReset().mockResolvedValue(undefined);
  });

  test("deletes nothing and touches SpiceDB not at all when the user has no grant", async () => {
    const tx = newTx();
    tx.mcpGrant.findMany.mockResolvedValue([]);

    await expect(deleteMcpGrants(tx, { userId: USER_ID })).resolves.toEqual([]);
    expect(tx.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
    expect(tx.mcpGrant.deleteMany).not.toHaveBeenCalled();
    expect(deleteMcpGrantRelationshipsBeforeCommit).not.toHaveBeenCalled();
  });

  test("deletes the client's grant and its whole reach", async () => {
    const tx = newTx();
    tx.mcpGrant.findMany.mockResolvedValue([row({ access: "workspaces", workspaces: ["ws-1"] })] as never);

    const deleted = await deleteMcpGrants(tx, { userId: USER_ID, clientId: CLIENT_ID });

    expect(tx.mcpGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, clientId: CLIENT_ID } })
    );
    expect(tx.mcpGrant.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [GRANT_ID] } } });
    expect(deleted).toEqual([stored({ access: "workspaces", workspaceIds: ["ws-1"] })]);
    expect(deleteMcpGrantRelationshipsBeforeCommit).toHaveBeenCalledWith([
      {
        before: { id: GRANT_ID, access: "workspaces", organizationIds: [], workspaceIds: ["ws-1"] },
        after: null,
      },
    ]);
  });
});

describe("projectMcpGrants", () => {
  beforeEach(() => {
    vi.mocked(reconcileMcpGrantRelationships).mockReset();
  });

  test("does nothing for no grants", async () => {
    await projectMcpGrants([]);
    expect(reconcileMcpGrantRelationships).not.toHaveBeenCalled();
  });

  test("never throws after commit, even when the projection does", async () => {
    vi.mocked(reconcileMcpGrantRelationships).mockRejectedValue(new Error("boom"));

    await expect(projectMcpGrants([GRANT_ID])).resolves.toBeUndefined();
    expect(reconcileMcpGrantRelationships).toHaveBeenCalledWith({ grantIds: [GRANT_ID] });
  });
});

describe("prepareMcpGrantAudits", () => {
  test("files each change under every organization the grant reaches before or after", async () => {
    const db = newTx();
    db.membership.findMany.mockResolvedValue([
      { userId: USER_ID, organizationId: "org-b" },
      { userId: "someone-else", organizationId: "org-z" },
    ] as never);
    db.workspace.findMany.mockResolvedValue([{ id: "ws-1", organizationId: "org-c" }] as never);

    const records = await prepareMcpGrantAudits(db, [
      {
        action: "updated",
        before: stored({ access: "all" }),
        after: stored({ access: "workspaces", workspaceIds: ["ws-1", "ws-unknown"] }),
      },
      {
        action: "deleted",
        before: stored({ access: "organizations", organizationIds: ["org-a", "org-b"] }),
        after: null,
      },
    ]);

    expect(records.map(({ organizationIds }) => organizationIds)).toEqual([
      ["org-b", "org-c"],
      ["org-a", "org-b"],
    ]);
  });

  test("reads nothing when no grant needs a lookup", async () => {
    const db = newTx();

    const records = await prepareMcpGrantAudits(db, [
      {
        action: "created",
        before: null,
        after: stored({ access: "organizations", organizationIds: ["org-1"] }),
      },
    ]);

    expect(records[0].organizationIds).toEqual(["org-1"]);
    expect(db.membership.findMany).not.toHaveBeenCalled();
    expect(db.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("queueMcpGrantAudits", () => {
  beforeEach(() => {
    vi.mocked(queueAuditEventBackground).mockReset().mockResolvedValue(undefined);
    vi.mocked(logger.error).mockClear();
  });

  test("writes one entry per organization, and keeps going when one fails", async () => {
    vi.mocked(queueAuditEventBackground).mockRejectedValueOnce(new Error("queue down"));

    await queueMcpGrantAudits({ userId: USER_ID, userType: "user" }, [
      { action: "updated", before: stored(), after: stored(), organizationIds: ["org-a", "org-b"] },
    ]);

    expect(vi.mocked(queueAuditEventBackground).mock.calls.map(([event]) => event.organizationId)).toEqual([
      "org-a",
      "org-b",
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ grantId: GRANT_ID, action: "updated" }),
      "Failed to queue MCP grant audit event"
    );
  });

  test("files a grant that reaches no organization without one, and skips an empty change", async () => {
    await queueMcpGrantAudits({ userId: USER_ID, userType: "user" }, [
      { action: "deleted", before: stored(), after: null, organizationIds: [] },
      { action: "deleted", before: null, after: null, organizationIds: ["org-a"] },
    ]);

    expect(queueAuditEventBackground).toHaveBeenCalledTimes(1);
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "unknown",
        newObject: expect.objectContaining({
          after: null,
          before: expect.objectContaining({ access: "all" }),
        }),
      })
    );
  });
});

describe("queueMcpGrantAudit", () => {
  test("never throws when preparing the audit fails", async () => {
    vi.mocked(logger.error).mockClear();
    prisma.membership.findMany.mockRejectedValue(new Error("db down"));

    await expect(
      queueMcpGrantAudit({ action: "created", actorUserId: USER_ID, before: null, after: stored() })
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ grantId: GRANT_ID, action: "created" }),
      "Failed to queue MCP grant audit event"
    );
  });
});
