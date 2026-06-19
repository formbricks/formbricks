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
 */
export const resetDb = (): Promise<unknown> =>
  prisma.$executeRawUnsafe('TRUNCATE "User", "Organization", "Team" RESTART IDENTITY CASCADE;');
