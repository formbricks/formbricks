import { prisma } from "@formbricks/database";

/**
 * Reset the test database between integration tests (ENG-1054 harness).
 *
 * Truncating the top-level entities with CASCADE clears all their dependents in one statement:
 *  - `User`         → Account, Session, Membership, Invite, TwoFactor (all `onDelete: Cascade`)
 *  - `Organization` → Membership, OrganizationBilling, Project/Workspace, Team, … (org-owned data)
 *  - `Team`         → TeamUser, WorkspaceTeam, …
 *
 * A `User`-only CASCADE would NOT clear `Organization`/`Team` (they aren't FK children of User), so
 * the SSO-provisioning and account-deletion flows — which create orgs/teams — would bleed rows across
 * tests. Keep this the single source of truth for test isolation.
 *
 * INVARIANT: this relies on every table a flow writes being FK-cascade-reachable from one of these
 * three roots. A future flow that writes a non-descendant table (or one with `onDelete: SetNull` /
 * `Restrict`) must be added here, or its rows will bleed across tests.
 *
 * `AuthzedProjectionOutbox` is the first table to hit that invariant. It has no foreign keys at all —
 * the durable projection queue records identifiers by value so a row survives the deletion it
 * describes — so nothing above cascades to it, and database triggers write to it on every mutation
 * the three roots cascade through.
 */
export const resetDb = (): Promise<unknown> =>
  prisma.$executeRawUnsafe(
    'TRUNCATE "User", "Organization", "Team", "AuthzedProjectionOutbox" RESTART IDENTITY CASCADE;'
  );
