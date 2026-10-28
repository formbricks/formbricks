import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * ENG-2091: an invitee who already has a Formbricks account used to be sent to "please confirm your
 * email address" for a verification email that is never sent, in front of a resend button that no-ops
 * for an already-verified address — and their invite was consumed on the way, so logging in afterwards
 * showed "Invite Not Found".
 *
 * The invite must now survive and the screen must offer a way out. Deliberately the same screen a new
 * address gets: routing this case elsewhere would make the response an account-existence lookup
 * (ENG-2099).
 */
test.describe("Invite sign-up with an address that already has an account @slow", async () => {
  test("routes to login with the invite intact", async ({ page, users, browser }) => {
    // The invitee already has a Formbricks account with this address — the precondition for the bug.
    const inviteeEmail = `invitee-existing-${Date.now()}@corporate-example.com`;
    const invitee = await users.create({ email: inviteeEmail, skipSurveySeed: true });

    const inviter = await users.create({ skipSurveySeed: true });
    await inviter.login();

    // Inviting is the agent's job now (`invite_member`), so seed the invite the way that tool stores it,
    // then read the link the inviter would share through the Members page, which still shows invites.
    await prisma.invite.create({
      data: {
        email: inviteeEmail,
        name: "Existing Person",
        organizationId: inviter.organizationId,
        creatorId: inviter.id,
        role: "member",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const inviteLink = await test.step("Open the pending invite and copy the link", async () => {
      await page.goto(`/organizations/${inviter.organizationId}/members`);

      const invitedRow = page.getByRole("row", { name: new RegExp(inviteeEmail) });
      await expect(invitedRow).toBeVisible();
      await expect(invitedRow.getByText("Pending", { exact: true })).toBeVisible();
      await invitedRow.getByRole("button", { name: /^Manage/ }).click();

      const manageDialog = page.getByRole("dialog", { name: "Existing Person" });
      await manageDialog.getByRole("button", { name: "Get invite link" }).click();
      return manageDialog.getByLabel("Invite link").inputValue();
    });
    expect(inviteLink).toBeTruthy();

    // A separate context so the invitee is anonymous — the inviter's session would otherwise trip the
    // "email does not match" branch on /invite.
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    try {
      // The invite page carries the sign-up form itself, with the invited address filled in and locked.
      await inviteePage.goto(inviteLink);
      await expect(inviteePage.getByTestId("signup-email")).toHaveValue(inviteeEmail);
      await inviteePage.getByTestId("signup-name").fill("Existing Person");
      await inviteePage.getByTestId("signup-password").fill("SomeOtherPassword1!");
      await inviteePage.getByTestId("signup-password").press("Enter");

      // Lands on the SAME success screen a brand-new address gets, so the response can't be used to tell
      // whether the account exists (ENG-2099) — which of the two it is depends only on
      // EMAIL_VERIFICATION_DISABLED (CI runs with it on), never on the address.
      await inviteePage.waitForURL(/\/auth\/(verification-requested|signup-without-verification-success)/);

      // There must be a way out, because for this visitor no email is coming and the resend button
      // no-ops on an already-verified address. That link is the whole point of the fix: before it, the
      // screen was a dead end and the invite had already been consumed.
      //
      // Asserted unconditionally on BOTH screens: the callback used to be carried only on the
      // verification-requested one, which left the verification-disabled path — the self-hosted default
      // and what CI runs here — dropping the visitor at the app root with no way back to the invite.
      const loginLink = inviteePage.getByRole("link", { name: "Log in", exact: true });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute("href", /callbackUrl=.*invite/);
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
