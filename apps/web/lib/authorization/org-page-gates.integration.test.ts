import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { can } from "@/lib/authorization";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";

/**
 * ENG-2409 — the equivalence claims behind the organization page gates, decided against real rows.
 *
 * Every gate this ticket moved is an assertion that some `organization.*` permission selects exactly
 * the roles a flag test used to select. Those claims are proven three ways, and this is the one that
 * exercises the real evaluator end to end rather than a mock or the schema in isolation:
 *
 *   - `authzed/schema-validation.yaml` proves the SpiceDB side (and now proves the billing exclusion
 *     of `read_access`, which had no assertFalse at all before this ticket).
 *   - the unit tests prove each call site asks the right question.
 *   - this file proves the sole SpiceDB evaluator answers the same way for real membership rows
 *     projected from PostgreSQL.
 *
 * The mapping under test, all for a session user:
 *   organization.read           = owner + manager + member + billing   (the getOrganizationAuth gate)
 *   organization.read_access    = owner + manager + member             (the billing-role redirect)
 *   organization.manage_billing = owner + manager + billing            (the enterprise page)
 *   organization.manage         = owner + manager                      (feedback directories)
 *   organization.manage_api_keys= owner + manager                      (API keys)
 */
const scenario: { organizationId: string; userIdByRole: Map<TOrganizationRole, string>; outsiderId: string } =
  { organizationId: "", userIdByRole: new Map(), outsiderId: "" };

const ORGANIZATION_ROLES: ReadonlyArray<TOrganizationRole> = ["owner", "manager", "member", "billing"];

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Org Page Gates" } });

  for (const role of ORGANIZATION_ROLES) {
    const user = await prisma.user.create({ data: { name: role, email: `${role}@org-gates.test` } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: organization.id, role, accepted: true },
    });
    scenario.userIdByRole.set(role, user.id);
  }

  const outsider = await prisma.user.create({
    data: { name: "outsider", email: "outsider@org-gates.test" },
  });

  scenario.organizationId = organization.id;
  scenario.outsiderId = outsider.id;
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

const check = async (userId: string, action: Parameters<typeof can>[1]) =>
  withAuthorizationSurface("page", () =>
    can({ type: "user", id: userId }, action, { type: "organization", id: scenario.organizationId })
  );

describe("organization page gates, against a real database", () => {
  // Each row is "this permission admits exactly these roles". Stated as the full four-role partition
  // rather than only the allowed set, so a widening fails here and not only in the schema suite.
  const GATES = [
    { action: "organization.read", allowed: ["owner", "manager", "member", "billing"] },
    { action: "organization.read_access", allowed: ["owner", "manager", "member"] },
    { action: "organization.manage_billing", allowed: ["owner", "manager", "billing"] },
    { action: "organization.manage", allowed: ["owner", "manager"] },
    { action: "organization.manage_api_keys", allowed: ["owner", "manager"] },
  ] as const;

  test.each(GATES)("$action admits exactly $allowed", async ({ action, allowed }) => {
    const decisions = await Promise.all(
      ORGANIZATION_ROLES.map(async (role) => [role, await check(scenario.userIdByRole.get(role)!, action)])
    );

    expect(Object.fromEntries(decisions)).toEqual(
      Object.fromEntries(ORGANIZATION_ROLES.map((role) => [role, allowed.includes(role as never)]))
    );
  });

  test.each(GATES)("$action refuses a user with no membership in the organization", async ({ action }) => {
    expect(await check(scenario.outsiderId, action)).toBe(false);
  });

  test("a page's gates cost one check each, and do not scale with anything", async () => {
    // The api-keys page is the worst case in this ticket: the shared billing redirect runs one check
    // and the page's own gate runs another. Pinned so a later change that moves a check inside a loop
    // over workspaces or API keys shows up here rather than in production latency.
    const issued = await withAuthorizationSurface("page", async () => {
      const actor = { type: "user", id: scenario.userIdByRole.get("owner")! } as const;
      const organization = { type: "organization", id: scenario.organizationId } as const;

      await can(actor, "organization.read_access", organization);
      await can(actor, "organization.manage_api_keys", organization);

      return getIssuedAuthorizationCheckCount();
    });

    expect(issued).toBe(2);
  });
});
