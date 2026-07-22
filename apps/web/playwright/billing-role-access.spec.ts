import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-1763 regression: a billing-role member must not reach workspace product data (contacts PII,
// survey summaries/responses, dashboards) by direct navigation. getWorkspaceAuth is the single choke
// point every product page flows through, so it bounces billing users to their org billing/enterprise
// home instead. The owner test guards against a naive "redirect everyone" fix regressing product
// access for legitimate roles.

// Creates an organization (owned by `owner`) with a workspace holding product data, plus a second
// user who is a billing-role member of that same organization.
const setupOrgWithBillingMember = async (users: UsersFixture) => {
  const owner = await users.create();
  if (!owner.organizationId || !owner.workspaceId) {
    throw new Error("Owner org/workspace not seeded for test");
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

  // users.create seeds a survey in the workspace; it backs the survey summary/responses URLs below.
  const survey = await prisma.survey.findFirstOrThrow({
    where: { workspaceId: owner.workspaceId },
    select: { id: true },
  });

  const workspaceBase = `/workspaces/${owner.workspaceId}`;
  return {
    owner,
    billingUser,
    workspaceId: owner.workspaceId,
    contactsUrl: `${workspaceBase}/contacts`,
    // Every workspace product surface flows through getWorkspaceAuth, so all of them must redirect.
    productUrls: [
      `${workspaceBase}/contacts`,
      `${workspaceBase}/dashboards`,
      `${workspaceBase}/surveys/${survey.id}/summary`,
      `${workspaceBase}/surveys/${survey.id}/responses`,
    ],
  };
};

test.describe("Billing-role workspace access (ENG-1763)", () => {
  const billingHomeUrl = /\/organizations\/[^/]+\/settings\/(billing|enterprise)/;

  test("redirects a billing member off product pages to the billing home", async ({ page, users }) => {
    const { billingUser, productUrls } = await setupOrgWithBillingMember(users);

    await billingUser.login();

    for (const url of productUrls) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page, `billing member should be redirected off ${url}`).toHaveURL(billingHomeUrl);
    }
  });

  test("keeps product-page access for a non-billing owner", async ({ page, users }) => {
    const { owner, workspaceId, contactsUrl } = await setupOrgWithBillingMember(users);

    await owner.login();
    await page.goto(contactsUrl, { waitUntil: "domcontentloaded" });

    // Owner stays on the product route (the page may render an upgrade prompt when the enterprise
    // feature is unlicensed, but crucially it is not bounced to the billing home).
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/contacts`));
  });
});
