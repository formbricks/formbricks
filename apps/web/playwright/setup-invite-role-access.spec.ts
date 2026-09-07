import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-2169 regression: the onboarding invite screen creates owner invites (the role is hardcoded, the
// action takes no role input) but authorized managers as well, so a manager could navigate straight to
// this route — nothing ties it to the moments after organization creation — and mint an owner, going
// around the "managers can only invite users as members" rule enforced on the org settings invite
// path. Both the page and the action are owner-only now. The owner test guards against a fix that
// over-blocks and breaks the real onboarding step.

const setupOrgWithManager = async (users: UsersFixture) => {
  const owner = await users.create();
  if (!owner.organizationId) {
    throw new Error("Owner org not seeded for test");
  }

  const manager = await users.create({ withoutWorkspace: true });
  await prisma.membership.create({
    data: {
      userId: manager.id,
      organizationId: owner.organizationId,
      role: "manager",
      accepted: true,
    },
  });

  return {
    owner,
    manager,
    inviteUrl: `/setup/organization/${owner.organizationId}/invite`,
  };
};

test.describe("Setup invite role access (ENG-2169)", () => {
  test("404s for an organization manager", async ({ page, users }) => {
    const { manager, inviteUrl } = await setupOrgWithManager(users);

    await manager.login();
    await page.goto(inviteUrl, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("error-code")).toHaveText("404");
    await expect(page.getByText("Invite your Organization members")).not.toBeVisible();
  });

  test("keeps the onboarding invite screen for the organization owner", async ({ page, users }) => {
    const { owner, inviteUrl } = await setupOrgWithManager(users);

    await owner.login();
    await page.goto(inviteUrl, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Invite your Organization members")).toBeVisible();
  });
});
