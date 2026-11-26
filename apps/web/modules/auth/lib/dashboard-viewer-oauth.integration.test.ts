import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  ORIGIN,
  authorize,
  createUser,
  forgetRevocations,
  grant,
  handle,
  refresh,
  registerClient,
  signIn,
  waitPastRevocation,
} from "@/integration/oauth-flow";
import { lockUserRow } from "@/integration/postgres-locks";
import { resetDb } from "@/integration/reset-db";
import { lockUserActiveState } from "@/lib/user/reactivation";
import { updateMembership, updateMembershipInTransaction } from "@/modules/ee/role-management/lib/membership";
import { deleteMembership } from "@/modules/organization/settings/teams/lib/membership";
import { runOwnerGuardedTransaction } from "@/modules/organization/settings/teams/lib/owner-guard";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

// The consent hook reads this before its transaction begins, after the provider has committed the consent.
// A test can hold the approval there (`approvalGate`); every other test passes straight through.
const approvalGate = vi.hoisted(() => ({ wait: null as null | (() => Promise<void>) }));
vi.mock("@/modules/mcp/access-options", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/mcp/access-options")>();
  return {
    ...actual,
    readMcpGrantReadableWorkspaceIds: async (
      ...args: Parameters<typeof actual.readMcpGrantReadableWorkspaceIds>
    ) => {
      await approvalGate.wait?.();
      return actual.readMcpGrantReadableWorkspaceIds(...args);
    },
  };
});

// A member removal retries an attempt Postgres aborted over a deadlock; record every failed attempt, so a
// deadlock that a retry hides still fails the race test below.
const failedRemovalAttempts = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/utils/prisma-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/prisma-error")>();
  return {
    ...actual,
    retryOnTransactionConflict: <T>(
      operation: () => Promise<T>,
      ...options: Parameters<typeof actual.retryOnTransactionConflict>[1][]
    ): Promise<T> =>
      actual.retryOnTransactionConflict(
        async () => {
          try {
            return await operation();
          } catch (error) {
            failedRemovalAttempts.push(error);
            throw error;
          }
        },
        ...options
      ),
  };
});

/**
 * ENG-6903 / ENG-6889 against the real Better Auth instance and Postgres: a user who is only a Dashboard
 * viewer grants an MCP client `dashboards:read` and nothing else, whatever the client asks for, and the
 * token endpoint never mints them anything wider, including from a grant they gave as a Member.
 */
const PASSWORD = "Correct-Horse1";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");
const VIEWER_GRANT = ["openid", "profile", "email", "offline_access", "dashboards:read"];

const scopesOf = (scope: string) => scope.split(" ").filter(Boolean).sort();

const EMAIL = "oauth-viewer@example.com";

/** The one account of a test: sign-up is only open on an instance with no users yet. */
const userWithRole = async (role: "dashboard_viewer" | "member") => {
  await createUser(EMAIL, PASSWORD, "Viewer");
  const organization = await prisma.organization.create({ data: { name: "Viewer org" } });
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role, accepted: true },
  });
  return { cookie, userId, organizationId: organization.id };
};

/** Resolves once `count` sessions of this database wait on a lock; fails if they never do. */
const waitForLockWaiters = async (count: number): Promise<void> => {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting" FROM pg_stat_activity
      WHERE "datname" = current_database() AND "wait_event_type" = 'Lock'`;
    if (waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${count} sessions never waited on a lock`);
};

const consentWith = (cookie: string, oauthQuery: string, scope?: string) =>
  handle("/oauth2/consent", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", cookie, origin: ORIGIN },
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery, ...(scope ? { scope } : {}) }),
  });

let clientId = "";

describe("a Dashboard viewer's OAuth grant", () => {
  beforeEach(async () => {
    await resetDb();
    // Instance-level, so resetDb clears it; inserted atomically for the reason the revocation suite gives.
    await prisma.oauthResource.createMany({
      data: [
        { identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] },
      ],
      skipDuplicates: true,
    });
    clientId = await registerClient("dashboard viewer client");
  });

  test("asking for every scope grants only dashboards:read, identity and refresh", async () => {
    const { cookie, userId } = await userWithRole("dashboard_viewer");

    const tokens = await grant(cookie, clientId, EVERYTHING);

    expect(scopesOf(tokens.scope)).toEqual([...VIEWER_GRANT].sort());
    const consent = await prisma.oauthConsent.findFirstOrThrow({ where: { userId, clientId } });
    expect([...consent.scopes].sort()).toEqual([...VIEWER_GRANT].sort());
  });

  test("a consent page that sends wider scopes is narrowed by the server", async () => {
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    const { target } = await authorize(cookie, clientId, EVERYTHING);

    const response = await consentWith(
      cookie,
      target.search.slice(1),
      "surveys:read responses:read dashboards:read"
    );

    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).searchParams.get("code")).toBeTruthy();
    // What is stored is the narrowed grant, not what the page sent.
    const consent = await prisma.oauthConsent.findFirstOrThrow({ where: { userId, clientId } });
    expect(consent.scopes).toContain("dashboards:read");
    expect(consent.scopes).not.toContain("surveys:read");
    expect(consent.scopes).not.toContain("responses:read");
  });

  test("a client that asks for no dashboard access is denied", async () => {
    const { cookie } = await userWithRole("dashboard_viewer");
    const { target } = await authorize(cookie, clientId, "surveys:read responses:read offline_access");

    const response = await consentWith(cookie, target.search.slice(1));

    expect(response.status).toBe(403);
  });

  test("a refresh never widens a viewer's grant", async () => {
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    const tokens = await grant(cookie, clientId, EVERYTHING);

    const refreshed = await refresh(clientId, tokens.refresh_token, EVERYTHING);

    expect(refreshed.status).not.toBe(200);
    const plain = await refresh(clientId, tokens.refresh_token);
    if (plain.status === 200) {
      expect(scopesOf(String(plain.body.scope))).toEqual([...VIEWER_GRANT].sort());
    }
    expect(await prisma.oauthRefreshToken.count({ where: { userId, scopes: { has: "surveys:read" } } })).toBe(
      0
    );
  });

  test("a Member's wide grant ends when they are made a Dashboard viewer", async () => {
    const { cookie, userId, organizationId } = await userWithRole("member");
    const tokens = await grant(cookie, clientId, EVERYTHING);
    expect(scopesOf(tokens.scope)).toContain("surveys:read");

    await updateMembership(userId, organizationId, { role: "dashboard_viewer" }, userId);

    expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);

    // Authorizing again goes through consent, which now offers only dashboards:read.
    await waitPastRevocation();
    const again = await grant(cookie, clientId, EVERYTHING);
    expect(scopesOf(again.scope)).toEqual([...VIEWER_GRANT].sort());
  });

  test("a Member's wide grant ends when their last other membership is removed and they stay a viewer (S13)", async () => {
    const { cookie, userId, organizationId } = await userWithRole("member");
    const viewerOrganization = await prisma.organization.create({ data: { name: "Viewer elsewhere" } });
    await prisma.membership.create({
      data: { userId, organizationId: viewerOrganization.id, role: "dashboard_viewer", accepted: true },
    });
    const tokens = await grant(cookie, clientId, EVERYTHING);
    expect(scopesOf(tokens.scope)).toContain("surveys:read");

    await deleteMembership(userId, organizationId, userId);

    expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);
  });

  test("removing them from their last two wider organizations at once still ends the wide grant", async () => {
    // Each removal decides "only viewer memberships left?" on its own; without the user-row lock both can
    // still see the other's membership, and neither revokes. A race, so several rounds.
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    for (let round = 0; round < 5; round++) {
      const [first, second] = await Promise.all(
        [1, 2].map((n) => prisma.organization.create({ data: { name: `Member org ${round}-${n}` } }))
      );
      await prisma.membership.createMany({
        data: [first, second].map(({ id }) => ({
          userId,
          organizationId: id,
          role: "member",
          accepted: true,
        })),
      });
      // The previous round ended the grant; this round is a new sign-in after it, not a race with it.
      await forgetRevocations(userId, clientId);
      const tokens = await grant(cookie, clientId, EVERYTHING);
      expect(scopesOf(tokens.scope)).toContain("surveys:read");

      await Promise.all([
        deleteMembership(userId, first.id, userId),
        deleteMembership(userId, second.id, userId),
      ]);

      expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);
      expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    }
  });

  test("a demotion to viewer racing a removal elsewhere still ends the wide grant", async () => {
    // The member list's owner demotion (`applyRoleChange` in app/api/internal/members/[userId]/lib/operations.ts): the owners' lock,
    // then the user's row, then the role change. Without the user-row lock, the demotion's "only viewer
    // memberships left?" check can miss the removal committing at the same moment.
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    for (let round = 0; round < 5; round++) {
      const [removedFrom, demotedIn] = await Promise.all(
        [1, 2].map((n) => prisma.organization.create({ data: { name: `Org ${round}-${n}` } }))
      );
      const otherOwner = await prisma.user.create({
        data: { name: "Other owner", email: `other-owner-${round}@example.com` },
      });
      await prisma.membership.createMany({
        data: [
          { userId, organizationId: removedFrom.id, role: "member", accepted: true },
          { userId, organizationId: demotedIn.id, role: "owner", accepted: true },
          { userId: otherOwner.id, organizationId: demotedIn.id, role: "owner", accepted: true },
        ],
      });
      // The previous round ended the grant; this round is a new sign-in after it, not a race with it.
      await forgetRevocations(userId, clientId);
      const tokens = await grant(cookie, clientId, EVERYTHING);
      expect(scopesOf(tokens.scope)).toContain("surveys:read");

      await Promise.all([
        deleteMembership(userId, removedFrom.id, userId),
        runOwnerGuardedTransaction(demotedIn.id, userId, async (tx) => {
          await lockUserActiveState(tx, userId);
          return updateMembershipInTransaction(tx, userId, demotedIn.id, { role: "dashboard_viewer" });
        }),
      ]);

      expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);
      expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    }
  });

  test("two demotions to viewer of the same owner at once still end the wide grant", async () => {
    // Different organizations, so different owner locks: only the user-row lock makes the second demotion's
    // "only viewer memberships left?" check see the first.
    const { cookie, userId } = await userWithRole("dashboard_viewer");
    const demote = (organizationId: string) =>
      runOwnerGuardedTransaction(organizationId, userId, async (tx) => {
        await lockUserActiveState(tx, userId);
        return updateMembershipInTransaction(tx, userId, organizationId, { role: "dashboard_viewer" });
      });
    for (let round = 0; round < 5; round++) {
      const organizations = await Promise.all(
        [1, 2].map((n) => prisma.organization.create({ data: { name: `Owned ${round}-${n}` } }))
      );
      const otherOwner = await prisma.user.create({
        data: { name: "Other owner", email: `co-owner-${round}@example.com` },
      });
      await prisma.membership.createMany({
        data: organizations.flatMap(({ id }) => [
          { userId, organizationId: id, role: "owner" as const, accepted: true },
          { userId: otherOwner.id, organizationId: id, role: "owner" as const, accepted: true },
        ]),
      });
      // The previous round ended the grant; this round is a new sign-in after it, not a race with it.
      await forgetRevocations(userId, clientId);
      const tokens = await grant(cookie, clientId, EVERYTHING);
      expect(scopesOf(tokens.scope)).toContain("surveys:read");

      await Promise.all(organizations.map(({ id }) => demote(id)));

      expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);
      expect((await refresh(clientId, tokens.refresh_token)).status).not.toBe(200);
    }
  });

  test("a first approval racing a removal that ends the grant finishes without a deadlock", async () => {
    // The removal takes the owners, then the user's row `FOR UPDATE`, then the grant and consent rows. The
    // approval's grant insert takes the user's row `FOR KEY SHARE` through its foreign key; unless the
    // approval takes that lock before the consent rows, it holds the consent rows while the removal holds
    // the user's row, and each waits on the other. The interleaving is forced: a blocker holds the user's
    // row, the removal queues on it, then the approval runs as far as it can, then the blocker lets go.
    const { cookie, userId, organizationId } = await userWithRole("member");
    const viewerOrganization = await prisma.organization.create({ data: { name: "Viewer elsewhere" } });
    await prisma.membership.create({
      data: { userId, organizationId: viewerOrganization.id, role: "dashboard_viewer", accepted: true },
    });
    const { target } = await authorize(cookie, clientId, EVERYTHING);
    const warn = vi.spyOn(logger, "warn");
    failedRemovalAttempts.length = 0;

    let reachedGate!: () => void;
    const atGate = new Promise<void>((resolve) => (reachedGate = resolve));
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => (openGate = resolve));
    approvalGate.wait = () => {
      reachedGate();
      return gate;
    };
    let releaseUser!: () => void;
    const userReleased = new Promise<void>((resolve) => (releaseUser = resolve));
    let userLocked!: () => void;
    const userIsLocked = new Promise<void>((resolve) => (userLocked = resolve));

    try {
      // The provider has committed the consent; the hook's transaction hasn't begun.
      const approval = consentWith(cookie, target.search.slice(1));
      await atGate;

      const blocker = prisma.$transaction(
        async (tx) => {
          await lockUserRow(tx, userId);
          userLocked();
          await userReleased;
        },
        { timeout: 30_000 }
      );
      await userIsLocked;

      const removal = deleteMembership(userId, organizationId, userId);
      await waitForLockWaiters(1);
      openGate();
      await waitForLockWaiters(2);
      releaseUser();

      const [approved, removed] = await Promise.allSettled([approval, removal, blocker]);
      expect(removed.status, String((removed as PromiseRejectedResult).reason)).toBe("fulfilled");
      expect(approved.status, String((approved as PromiseRejectedResult).reason)).toBe("fulfilled");
      // Both sides retry an attempt Postgres aborted over a deadlock, so neither may have failed one.
      expect(failedRemovalAttempts.map(String)).toEqual([]);
      expect(warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "OAuth consent changed but settling it failed; retrying"
      );
    } finally {
      approvalGate.wait = null;
      openGate();
      releaseUser();
      warn.mockRestore();
    }

    // The removal won: no consent, no grant, no membership; the approval found its consent gone.
    expect(await prisma.oauthConsent.count({ where: { userId } })).toBe(0);
    expect(await prisma.mcpGrant.count({ where: { userId } })).toBe(0);
    expect(await prisma.membership.count({ where: { userId, organizationId } })).toBe(0);
  });

  test("a Member is unaffected", async () => {
    const { cookie } = await userWithRole("member");

    const tokens = await grant(cookie, clientId, EVERYTHING);

    expect(scopesOf(tokens.scope)).toEqual([...MCP_OAUTH_SCOPES].sort());
  });
});
