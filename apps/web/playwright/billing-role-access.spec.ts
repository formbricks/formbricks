import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-1763 regression: a billing-role member must not reach the organization's people, agent connections
// or workspaces by direct navigation. The billing role is a finance seat, so every shell page except
// billing and the user's own account sends it to the organization's billing page instead. The owner test
// guards against a naive "redirect everyone" fix regressing access for legitimate roles.

// Creates an organization (owned by `owner`), plus a second user who is a billing-role member of it.
const setupOrgWithBillingMember = async (users: UsersFixture) => {
  const owner = await users.create({ skipSurveySeed: true });
  if (!owner.organizationId) {
    throw new Error("Owner org not seeded for test");
  }

  const billingUser = await users.create({ withoutWorkspace: true });
  await prisma.membership.create({
    data: {
      userId: billingUser.id,
      organizationId: owner.organizationId,
      role: "billing",
      accepted: true,
    },
  });

  const base = `/organizations/${owner.organizationId}`;
  return {
    owner,
    billingUser,
    organizationId: owner.organizationId,
    membersUrl: `${base}/members`,
    // Every organization page but billing flows through the shell's billing check, so all must redirect.
    restrictedUrls: [
      base,
      `${base}/connections`,
      `${base}/members`,
      `${base}/teams`,
      `${base}/workspaces`,
      `${base}/security`,
    ],
  };
};

test.describe("Billing-role organization access (ENG-1763)", () => {
  test("redirects a billing member off the organization pages to billing", async ({ page, users }) => {
    const { billingUser, organizationId, restrictedUrls } = await setupOrgWithBillingMember(users);
    const billingHomeUrl = new RegExp(`/organizations/${organizationId}/billing$`);

    await billingUser.login();

    for (const url of restrictedUrls) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page, `billing member should be redirected off ${url}`).toHaveURL(billingHomeUrl);
    }
  });

  test("keeps access to the organization pages for a non-billing owner", async ({ page, users }) => {
    const { owner, organizationId, membersUrl } = await setupOrgWithBillingMember(users);

    await owner.login();
    await page.goto(membersUrl, { waitUntil: "domcontentloaded" });

    // The owner stays on the members page, which lists both people in the organization.
    await expect(page).toHaveURL(new RegExp(`/organizations/${organizationId}/members$`));
    await expect(page.getByRole("table", { name: "Members" })).toBeVisible();
  });
});
