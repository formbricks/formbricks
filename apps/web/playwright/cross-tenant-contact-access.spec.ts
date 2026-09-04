import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-2290 regression: the contact detail page authorized the workspaceId in the URL but loaded the
// contact by contactId alone, so pairing your own workspace with someone else's contact id read that
// contact's attributes (email, userId, arbitrary custom PII), its responses and its displays. Every
// read on this page now goes through getContactAuth, which ties the two ids together and fails
// closed with a 404. The second test guards against a fix that over-blocks and takes the owner's own
// contacts down with it.

const seedTenant = async (users: UsersFixture, label: string) => {
  const user = await users.create({ organizationName: `${label} Org` });

  if (!user.workspaceId) {
    throw new Error("Workspace not seeded for test");
  }

  const workspaceId = user.workspaceId;
  const contact = await prisma.contact.create({ data: { workspaceId } });

  // The users fixture seeds the default attribute keys (email, firstName, lastName, userId) per
  // workspace; add a custom one so the test also covers operator-uploaded PII.
  const keys = await prisma.contactAttributeKey.findMany({
    where: { workspaceId },
    select: { id: true, key: true },
  });
  const customKey = await prisma.contactAttributeKey.create({
    data: { workspaceId, name: "Plan", key: "plan", type: "custom" },
  });

  // Unique per tenant and per run, so an assertion on the page HTML cannot pass by accident.
  const pii = {
    email: `${label}-pii-${Date.now()}@example.com`,
    userId: `${label}-user-${Date.now()}`,
    plan: `${label}-secret-plan-${Date.now()}`,
    answer: `${label}-answer-${Date.now()}`,
  };

  const keyId = (key: string) => keys.find((k) => k.key === key)?.id;

  await prisma.contactAttribute.createMany({
    data: [
      { contactId: contact.id, attributeKeyId: keyId("email")!, value: pii.email },
      { contactId: contact.id, attributeKeyId: keyId("userId")!, value: pii.userId },
      { contactId: contact.id, attributeKeyId: customKey.id, value: pii.plan },
    ],
  });

  // Give the contact activity too, so the response/display loaders are exercised, not just the
  // attribute one.
  const survey = await prisma.survey.findFirstOrThrow({ where: { workspaceId }, select: { id: true } });
  await prisma.display.create({ data: { surveyId: survey.id, contactId: contact.id } });
  await prisma.response.create({
    data: { surveyId: survey.id, contactId: contact.id, finished: true, data: { q1: pii.answer } },
  });

  return { user, workspaceId, contactId: contact.id, pii };
};

test.describe("Cross-tenant contact access (ENG-2290)", () => {
  test("404s when a foreign contact id is paired with an authorized workspace", async ({ page, users }) => {
    const victim = await seedTenant(users, "victim");
    const attacker = await seedTenant(users, "attacker");

    await attacker.user.login();

    await page.goto(`/workspaces/${attacker.workspaceId}/contacts/${victim.contactId}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("error-code")).toHaveText("404");

    // Assert against the full document rather than visible text: this also catches PII serialized
    // into the RSC flight payload but never painted. The contact id itself is deliberately not
    // asserted on — it is the attacker's own input and Next echoes the request path back in the
    // router state.
    const html = await page.content();
    for (const [field, value] of Object.entries(victim.pii)) {
      expect(html, `the page must not expose the victim's ${field}`).not.toContain(value);
    }
  });

  test("keeps access to the workspace's own contacts", async ({ page, users }) => {
    const owner = await seedTenant(users, "owner");

    await owner.user.login();

    await page.goto(`/workspaces/${owner.workspaceId}/contacts/${owner.contactId}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: owner.pii.email })).toBeVisible();
    await expect(page.getByText(owner.pii.userId)).toBeVisible();
    await expect(page.getByText(owner.pii.plan)).toBeVisible();
  });
});
