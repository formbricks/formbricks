import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  deleteMcpGrantRelationshipsBeforeCommit,
  reconcileMcpGrantRelationships,
  removeDeletedMcpGrantRelationships,
} from "@/lib/authzed/mcp-grant";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { resolveMcpGrantSelection } from "./access-options";
import {
  type TStoredMcpGrant,
  createMcpGrantIfMissing,
  deleteMcpGrants,
  getMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  prepareMcpGrantAudits,
  projectMcpGrants,
  queueMcpGrantAudit,
  queueMcpGrantAudits,
  removeDeletedMcpGrants,
  writeMcpGrant,
} from "./grant-store";

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/authzed/mcp-grant", () => ({
  deleteMcpGrantRelationshipsBeforeCommit: vi.fn(),
  reconcileMcpGrantRelationships: vi.fn(),
  removeDeletedMcpGrantRelationships: vi.fn(),
}));

vi.mock("./access-options", () => ({ resolveMcpGrantSelection: vi.fn() }));

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

describe("lockMcpGrant", () => {
  test("locks the grant row FOR UPDATE before reading it", async () => {
    const tx = newTx();
    tx.$queryRaw.mockResolvedValue([{ id: GRANT_ID }] as never);
    tx.mcpGrant.findUniqueOrThrow.mockResolvedValue(
      row({ access: "organizations", organizations: ["org-1"] }) as never
    );

    await expect(lockMcpGrant(tx, { userId: USER_ID, clientId: CLIENT_ID })).resolves.toEqual(
      stored({ access: "organizations", organizationIds: ["org-1"] })
    );
    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(sql.join("?")).toMatch(/FOR UPDATE/);
    expect(values).toEqual([USER_ID, CLIENT_ID]);
    expect(tx.mcpGrant.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: GRANT_ID } })
    );
  });

  test("returns null without a grant, and reads nothing else", async () => {
    const tx = newTx();
    tx.$queryRaw.mockResolvedValue([] as never);

    await expect(lockMcpGrant(tx, { userId: USER_ID, clientId: CLIENT_ID })).resolves.toBeNull();
    expect(tx.mcpGrant.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("narrowMcpGrantAccess", () => {
  beforeEach(() => {
    vi.mocked(deleteMcpGrantRelationshipsBeforeCommit).mockReset().mockResolvedValue(undefined);
    vi.mocked(resolveMcpGrantSelection).mockReset();
  });

  test("deletes what the resolved access takes away before the save commits", async () => {
    const tx = newTx();
    const before = stored({ access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] });
    vi.mocked(resolveMcpGrantSelection).mockResolvedValue({
      status: "ok",
      access: { access: "workspaces", workspaceIds: ["ws-1"] },
    });

    await expect(
      narrowMcpGrantAccess(tx, {
        userId: USER_ID,
        before,
        access: { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
      })
    ).resolves.toEqual({ status: "ok", access: { access: "workspaces", workspaceIds: ["ws-1"] } });
    expect(resolveMcpGrantSelection).toHaveBeenCalledWith(
      tx,
      USER_ID,
      { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
      before
    );
    expect(deleteMcpGrantRelationshipsBeforeCommit).toHaveBeenCalledWith(before, {
      access: "workspaces",
      workspaceIds: ["ws-1"],
    });
  });

  test("touches SpiceDB for neither a refused selection nor a new grant", async () => {
    const tx = newTx();
    vi.mocked(resolveMcpGrantSelection).mockResolvedValueOnce({
      status: "unavailable",
      field: "workspaceIds",
    });

    await expect(
      narrowMcpGrantAccess(tx, {
        userId: USER_ID,
        before: stored({ access: "workspaces", workspaceIds: ["ws-1"] }),
        access: { access: "workspaces", workspaceIds: ["ws-foreign"] },
      })
    ).resolves.toEqual({ status: "unavailable", field: "workspaceIds" });

    vi.mocked(resolveMcpGrantSelection).mockResolvedValueOnce({ status: "ok", access: { access: "all" } });
    await narrowMcpGrantAccess(tx, { userId: USER_ID, before: null, access: { access: "all" } });

    expect(deleteMcpGrantRelationshipsBeforeCommit).not.toHaveBeenCalled();
  });

  test("fails the save when SpiceDB can't drop what the narrowing takes away", async () => {
    const tx = newTx();
    vi.mocked(resolveMcpGrantSelection).mockResolvedValue({ status: "ok", access: { access: "all" } });
    const outage = new Error("spicedb down");
    vi.mocked(deleteMcpGrantRelationshipsBeforeCommit).mockRejectedValue(outage);

    await expect(
      narrowMcpGrantAccess(tx, {
        userId: USER_ID,
        before: stored({ access: "workspaces", workspaceIds: ["ws-1"] }),
        access: { access: "all" },
      })
    ).rejects.toBe(outage);
  });
});

describe("writeMcpGrant", () => {
  test("creates a new grant with All access when the request names no access", async () => {
    const tx = newTx();
    tx.mcpGrant.upsert.mockResolvedValue(row() as never);

    const result = await writeMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before: null,
      permissions: { surveys: "read" },
    });

    expect(result).toEqual({ before: null, after: stored() });
    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: USER_ID, clientId: CLIENT_ID, access: "all", permissions: { surveys: "read" } },
      })
    );
    expect(tx.mcpGrantWorkspace.createMany).not.toHaveBeenCalled();
  });

  test("keeps an existing grant's access when the request names none, and doesn't rewrite the column", async () => {
    const tx = newTx();
    const before = stored({ access: "workspaces", workspaceIds: ["ws-1"] });
    tx.mcpGrant.upsert.mockResolvedValue(
      row({ access: "workspaces", workspaces: ["ws-1"], permissions: { surveys: "write" } }) as never
    );

    const result = await writeMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before,
      permissions: { surveys: "write" },
    });

    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { permissions: { surveys: "write" } } })
    );
    expect(result.before).toBe(before);
    expect(result.after).toMatchObject({
      access: "workspaces",
      workspaceIds: ["ws-1"],
      permissions: { surveys: "write" },
    });
    expect(tx.mcpGrantWorkspace.deleteMany).not.toHaveBeenCalled();
  });

  test("replaces the selection rows with the access given, and writes the mode only when it changes", async () => {
    const tx = newTx();
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "workspaces" }) as never);

    const { after } = await writeMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before: stored({ access: "organizations", organizationIds: ["org-1"] }),
      permissions: { surveys: "read" },
      access: { access: "workspaces", workspaceIds: ["ws-mine"] },
    });

    expect(tx.mcpGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { permissions: { surveys: "read" }, access: "workspaces" } })
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
  });

  test("inserts the organizations of Only selected organizations", async () => {
    const tx = newTx();
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "organizations" }) as never);

    await writeMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before: null,
      permissions: {},
      access: { access: "organizations", organizationIds: ["org-mine"] },
    });

    expect(tx.mcpGrantOrganization.createMany).toHaveBeenCalledWith({
      data: [{ grantId: GRANT_ID, organizationId: "org-mine" }],
      skipDuplicates: true,
    });
  });

  test("a switch to All access clears both selections and inserts none", async () => {
    const tx = newTx();
    tx.mcpGrant.upsert.mockResolvedValue(row({ access: "all" }) as never);

    await writeMcpGrant(tx, {
      userId: USER_ID,
      clientId: CLIENT_ID,
      before: stored({ access: "workspaces", workspaceIds: ["ws-1"] }),
      permissions: {},
      access: { access: "all" },
    });

    expect(tx.mcpGrantWorkspace.deleteMany).toHaveBeenCalledWith({
      where: { grantId: GRANT_ID, workspaceId: { notIn: [] } },
    });
    expect(tx.mcpGrantWorkspace.createMany).not.toHaveBeenCalled();
    expect(tx.mcpGrantOrganization.createMany).not.toHaveBeenCalled();
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
  test("deletes nothing when the user has no grant", async () => {
    const tx = newTx();
    tx.$queryRaw.mockResolvedValue([] as never);

    await expect(deleteMcpGrants(tx, { userId: USER_ID })).resolves.toEqual([]);
    expect(tx.mcpGrant.deleteMany).not.toHaveBeenCalled();
  });

  test("locks the rows in id order, deletes them, and makes no SpiceDB call", async () => {
    const tx = newTx();
    tx.$queryRaw.mockResolvedValue([{ id: GRANT_ID }] as never);
    tx.mcpGrant.findMany.mockResolvedValue([row({ access: "workspaces", workspaces: ["ws-1"] })] as never);

    const deleted = await deleteMcpGrants(tx, { userId: USER_ID, clientId: CLIENT_ID });

    const [sql, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    expect(sql.join("?")).toMatch(/ORDER BY "id"\s+FOR UPDATE/);
    expect(values).toEqual([USER_ID, CLIENT_ID, CLIENT_ID]);
    expect(tx.mcpGrant.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [GRANT_ID] } } });
    expect(deleted).toEqual([stored({ access: "workspaces", workspaceIds: ["ws-1"] })]);
    expect(deleteMcpGrantRelationshipsBeforeCommit).not.toHaveBeenCalled();
  });

  test("takes every grant of the user without a client", async () => {
    const tx = newTx();
    tx.$queryRaw.mockResolvedValue([] as never);

    await deleteMcpGrants(tx, { userId: USER_ID });

    expect((tx.$queryRaw.mock.calls[0] as unknown[]).slice(1)).toEqual([USER_ID, null, null]);
  });
});

describe("removeDeletedMcpGrants", () => {
  beforeEach(() => {
    vi.mocked(removeDeletedMcpGrantRelationships).mockReset();
  });

  test("does nothing for no grants", async () => {
    await removeDeletedMcpGrants([]);
    expect(removeDeletedMcpGrantRelationships).not.toHaveBeenCalled();
  });

  test("removes the relationships after the commit, and never throws", async () => {
    const grant = stored({ access: "workspaces", workspaceIds: ["ws-1"] });
    vi.mocked(removeDeletedMcpGrantRelationships).mockRejectedValue(new Error("boom"));

    await expect(removeDeletedMcpGrants([grant])).resolves.toBeUndefined();
    expect(removeDeletedMcpGrantRelationships).toHaveBeenCalledWith([grant]);
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
    // An unknown (deleted) workspace has no organization to file it under.
    expect(records[0].workspaceOrganizationIds).toEqual({ "ws-1": "org-c" });
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
      {
        action: "updated",
        before: stored(),
        after: stored(),
        organizationIds: ["org-a", "org-b"],
        workspaceOrganizationIds: {},
      },
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
      { action: "deleted", before: stored(), after: null, organizationIds: [], workspaceOrganizationIds: {} },
      {
        action: "deleted",
        before: null,
        after: null,
        organizationIds: ["org-a"],
        workspaceOrganizationIds: {},
      },
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

describe("queueMcpGrantAudits, per organization", () => {
  beforeEach(() => {
    vi.mocked(queueAuditEventBackground).mockReset().mockResolvedValue(undefined);
  });

  const snapshotsFiledUnder = (organizationId: string) =>
    vi
      .mocked(queueAuditEventBackground)
      .mock.calls.find(([event]) => event.organizationId === organizationId)?.[0].newObject as {
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    };

  test("an entry carries only the workspaces of the organization it is filed under", async () => {
    await queueMcpGrantAudits({ userId: USER_ID, userType: "system" }, [
      {
        action: "deleted",
        before: stored({ access: "workspaces", workspaceIds: ["ws-a1", "ws-a2", "ws-b1"] }),
        after: null,
        organizationIds: ["org-a", "org-b"],
        workspaceOrganizationIds: { "ws-a1": "org-a", "ws-a2": "org-a", "ws-b1": "org-b" },
      },
    ]);

    expect(snapshotsFiledUnder("org-a").before).toMatchObject({ workspaceIds: ["ws-a1", "ws-a2"] });
    expect(snapshotsFiledUnder("org-b").before).toMatchObject({ workspaceIds: ["ws-b1"] });
  });

  test("an entry carries only its own organization of Only selected organizations, before and after", async () => {
    await queueMcpGrantAudits({ userId: USER_ID, userType: "user" }, [
      {
        action: "updated",
        before: stored({ access: "organizations", organizationIds: ["org-a", "org-b"] }),
        after: stored({ access: "all" }),
        organizationIds: ["org-a", "org-b"],
        workspaceOrganizationIds: {},
      },
    ]);

    expect(snapshotsFiledUnder("org-a")).toMatchObject({
      before: { organizationIds: ["org-a"] },
      after: { access: "all" },
    });
    expect(snapshotsFiledUnder("org-b")).toMatchObject({ before: { organizationIds: ["org-b"] } });
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
