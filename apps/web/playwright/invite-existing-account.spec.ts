import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * ENG-2091: an invitee who already has a Formbricks account used to be sent to "please confirm your
 * email address" for a verification email that is never sent (Better Auth answers a duplicate address
 * with a synthetic 200 and skips the send), in front of a resend button that no-ops for an
 * already-verified address — and their invite was consumed on the way, so logging in afterwards
 * showed "Invite Not Found".
 *
 * They should land on the login page instead, with the invite still pending.
 */
test.describe("Invite sign-up with an address that already has an account", async () => {
  test("routes to login with the invite intact", async ({ page, users, browser }) => {
    // The invitee already has a Formbricks account with this address — the precondition for the bug.
    const inviteeEmail = `invitee-existing-${Date.now()}@corporate-example.com`;
    const invitee = await users.create({ email: inviteeEmail, skipSurveySeed: true });

    const inviter = await users.create({ skipSurveySeed: true });
    await inviter.login();

    // Invite the address through the real UI, then read the link the inviter would share.
    const inviteLink = await test.step("Invite the existing user and copy the link", async () => {
      // Navigate by the fixture's known workspace id rather than waiting on the post-login landing
      // page, which differs depending on whether the workspace has any surveys.
      await page.goto(`/workspaces/${inviter.workspaceId}/settings/organization/teams`);
      await page.waitForURL(/\/organizations\/[^/]+\/settings\/teams/);
      await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

      await page.getByRole("button", { name: "Invite member" }).click();
      await page.getByLabel("Full Name").fill("Existing Person");
      await page.getByLabel("Email").fill(inviteeEmail);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      await expect(page.locator(".formbricks__toast__success")).toBeVisible({ timeout: 15000 });

      const invitedMemberInfo = page.locator("#singleMemberInfo").filter({ hasText: inviteeEmail });
      await expect(invitedMemberInfo).toBeVisible({ timeout: 10000 });
      await invitedMemberInfo.locator("#shareInviteButton").click();
      return (await page.waitForSelector("#inviteLinkText")).inputValue();
    });
    expect(inviteLink).toBeTruthy();

    // A separate context so the invitee is anonymous — the inviter's session would otherwise trip the
    // "email does not match" branch on /invite.
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    try {
      await inviteePage.goto(inviteLink);
      await inviteePage.getByRole("link", { name: "Create an account" }).click();
      await inviteePage.waitForURL(/\/auth\/signup\?inviteToken=/);

      await inviteePage.getByText("Continue with Email").click();
      await inviteePage.fill('input[name="name"]', "Existing Person");
      await inviteePage.fill('input[name="email"]', inviteeEmail);
      await inviteePage.fill('input[name="password"]', "SomeOtherPassword1!");
      await inviteePage.press('input[name="password"]', "Enter");

      // Sent to log in — not to a verification screen for an email that never arrives.
      await inviteePage.waitForURL(/\/auth\/login\?.*notice=existing_account_invite/);
      await expect(inviteePage.getByText("You already have an account")).toBeVisible();
    } finally {
      await inviteeContext.close();
    }

    // The invite must survive so logging in can still accept it, and nothing may have joined the
    // existing account to the org behind the user's back.
    expect(await prisma.invite.count({ where: { email: inviteeEmail } })).toBe(1);
    expect(
      await prisma.membership.count({
        where: { userId: invitee.id, organizationId: inviter.organizationId },
      })
    ).toBe(0);
  });
});
