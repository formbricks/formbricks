import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { AuthenticationError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { assertCanRecheckLicense } from "@/modules/ee/license-check/lib/recheck-authorization";

/**
 * ENG-1737: the license-recheck gate, decided against real memberships.
 *
 * This is the one behavior change in the branch — the old gate denied the `member` role by name, so
 * `billing` passed it. The unit test beside this file pins the composition with a mocked `can()`;
 * this pins the outcome per real organization role, which is the part that actually regressed.
 */
const scenario: { organizationId: string; userIdByRole: Map<string, string> } = {
  organizationId: "",
  userIdByRole: new Map(),
};

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "License Org" } });

  const makeUser = async (label: string, role: TOrganizationRole | null) => {
    const user = await prisma.user.create({ data: { name: label, email: `${label}@license.test` } });
    if (role) {
      await prisma.membership.create({
        data: { userId: user.id, organizationId: organization.id, role, accepted: true },
      });
    }
    scenario.userIdByRole.set(label, user.id);
  };

  await makeUser("owner", "owner");
  await makeUser("manager", "manager");
  await makeUser("billing", "billing");
  await makeUser("member", "member");
  await makeUser("outsider", null);

  scenario.organizationId = organization.id;
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("assertCanRecheckLicense against a real database", () => {
  test.each(["owner", "manager"])("allows %s", async (role) => {
    await expect(
      assertCanRecheckLicense(scenario.userIdByRole.get(role)!, scenario.organizationId)
    ).resolves.toBeUndefined();
  });

  // `billing` is the regression: it holds a membership, so it passes the membership check, and it is
  // not a `member`, so the old role-name test never caught it.
  test.each(["billing", "member"])("refuses %s as unable to manage the organization", async (role) => {
    await expect(
      assertCanRecheckLicense(scenario.userIdByRole.get(role)!, scenario.organizationId)
    ).rejects.toThrow(OperationNotAllowedError);
  });

  test("reports a user outside the organization as a non-member", async () => {
    await expect(
      assertCanRecheckLicense(scenario.userIdByRole.get("outsider")!, scenario.organizationId)
    ).rejects.toThrow(AuthenticationError);
  });
});
