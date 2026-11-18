import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { getAuthzedClient } from "./client";
import { deleteMcpGrantRelationshipsBeforeCommit, reconcileMcpGrantRelationships } from "./mcp-grant";
import { MCP_GRANT_RELATION, MCP_GRANT_SUBJECT_TYPE } from "./relationship-map";
import { readAllRelationships } from "./relationship-reads";

/**
 * A reconciling pass holds its grants' rows `FOR SHARE` only until its transaction times out; its SpiceDB
 * writes are not part of that transaction. Against a real PostgreSQL and SpiceDB, with the pass's budget
 * shortened to seconds: a write the pass reaches the SpiceDB client with only after its lock is gone (held
 * in the client wrapper, before the gRPC call) must not land after a narrowing that took the lock next, or
 * it restores the access the narrowing removed. The write's own deadline refuses it.
 *
 * What this does not drive is a write SpiceDB already received when the deadline passes: SpiceDB abandons
 * it at its gRPC deadline, the pass then keeps its locks through the margin (unit-tested in
 * `mcp-grant.test.ts`), and a commit later still is repaired by the narrowing's own reconcile after it
 * commits (ADR 0042).
 */

vi.mock("@/lib/authzed/mcp-grant-timeouts", () => ({
  MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS: 3_000,
  MCP_GRANT_PROJECTION_WRITE_MARGIN_MS: 1_000,
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS: 15_000,
  MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS: 15_000,
}));

/** Holds the next relationship write in the client wrapper, before its gRPC call is made. */
const writes = vi.hoisted(() => ({
  holdNext: null as { sent: () => void; release: Promise<void> } | null,
}));
vi.mock("@/lib/authzed/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authzed/client")>();
  return {
    ...actual,
    getAuthzedClient: () => {
      const client = actual.getAuthzedClient();
      return {
        ...client,
        writeRelationships: async (...args: Parameters<typeof client.writeRelationships>) => {
          const hold = writes.holdNext;
          writes.holdNext = null;
          if (hold) {
            hold.sent();
            await hold.release;
          }
          return client.writeRelationships(...args);
        },
      };
    },
  };
});

const workspacesReached = async (grantId: string): Promise<string[]> => {
  const { relationships } = await readAllRelationships(getAuthzedClient(), {
    relation: MCP_GRANT_RELATION,
    resourceType: "workspace",
    subject: { objectId: grantId, objectType: MCP_GRANT_SUBJECT_TYPE },
  });
  return relationships.map(({ resource }) => resource.objectId).sort((a, b) => a.localeCompare(b));
};

const seedGrant = async () => {
  const user = await prisma.user.create({ data: { email: "fence@mcp-grant.test", name: "Fence" } });
  const organization = await prisma.organization.create({ data: { name: "Fence Org" } });
  const [kept, removed] = await Promise.all(
    ["Kept", "Removed"].map((name) =>
      prisma.workspace.create({ data: { name, organizationId: organization.id } })
    )
  );
  const clientId = "fence-client";
  await prisma.oauthClient.create({ data: { clientId, redirectUris: ["http://127.0.0.1/callback"] } });
  const grant = await prisma.mcpGrant.create({
    data: {
      userId: user.id,
      clientId,
      access: "workspaces",
      permissions: { surveys: "read" },
      workspaces: { create: [{ workspaceId: kept.id }, { workspaceId: removed.id }] },
    },
  });
  return { grantId: grant.id, kept: kept.id, removed: removed.id };
};

beforeEach(async () => {
  await resetDb();
  await synchronizeAuthzedIntegrationFixture();
  writes.holdNext = null;
});

describe("reconciling an MCP grant against its row lock (real PostgreSQL and SpiceDB)", () => {
  test("a write reaching the client after the pass's lock is gone never restores what a narrowing removed", async () => {
    const { grantId, kept, removed } = await seedGrant();
    await expect(reconcileMcpGrantRelationships({ grantIds: [grantId] })).resolves.toMatchObject({
      status: "projected",
    });
    expect(await workspacesReached(grantId)).toEqual([kept, removed].sort((a, b) => a.localeCompare(b)));

    let release!: () => void;
    let sent!: () => void;
    const writeSent = new Promise<void>((resolve) => (sent = resolve));
    writes.holdNext = { sent, release: new Promise<void>((resolve) => (release = resolve)) };
    const reconcile = reconcileMcpGrantRelationships({ grantIds: [grantId] });
    // Reconciliation settling before its write is held fails the wait at once, instead of timing out.
    await Promise.race([
      writeSent,
      reconcile.then(() => {
        throw new Error("the reconciliation settled before its write was held");
      }),
    ]);

    let released = false;
    try {
      // A narrowing, as Edit runs it: the grant row `FOR UPDATE`, which waits for the pass's transaction
      // to time out, then the removed workspace's relationship deleted before the commit.
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "McpGrant" WHERE "id" = ${grantId} FOR UPDATE`;
          await deleteMcpGrantRelationshipsBeforeCommit(
            { id: grantId, access: "workspaces", workspaceIds: [kept, removed] },
            { access: "workspaces", workspaceIds: [kept] }
          );
          await tx.mcpGrantWorkspace.deleteMany({ where: { grantId, workspaceId: removed } });
        },
        { timeout: 15_000 }
      );
      expect(await workspacesReached(grantId)).toEqual([kept]);

      // The pass's write reaches SpiceDB only now, after its lock and the narrowing.
      release();
      released = true;
      await expect(reconcile).resolves.toMatchObject({ status: "failed" });
    } finally {
      // A failure above still lets the held write go and the pass settle, so nothing outlives the test.
      if (!released) {
        release();
        await reconcile.catch(() => undefined);
      }
    }

    expect(await workspacesReached(grantId)).toEqual([kept]);
  });
});
