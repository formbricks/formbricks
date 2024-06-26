import { expect } from "playwright/test";
import { test } from "./lib/fixtures";
import { finishOnboarding, signUpAndLogin } from "./utils/helper";
import { invites, mockUsers } from "./utils/mock";

test.describe("Invite, accept and remove organization member", async () => {
  test.describe.configure({ mode: "serial" });

  const { email, name } = mockUsers.organization[0];
  // let inviteLink: string;

  test("Invite organization member", async ({ page }) => {
    await signUpAndLogin(page, name, email, name);
    await finishOnboarding(page, "link");

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    await test.step("Invite User", async () => {
      const dropdownTrigger = page.locator("#userDropdownTrigger");
      await expect(dropdownTrigger).toBeVisible();
      await dropdownTrigger.click();

      const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
      await expect(dropdownInnerContentWrapper).toBeVisible();

      await page.getByRole("link", { name: "Organization" }).click();
      await page.waitForURL(/\/environments\/[^/]+\/settings\/members/);

      await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

      // Add member button
      await expect(page.getByRole("button", { name: "Add Member" })).toBeVisible();
      await page.getByRole("button", { name: "Add Member" }).click();

      // Fill the member name and email form
      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Full Name").fill(invites.addMember.name);

      await expect(page.getByLabel("Email Address")).toBeVisible();
      await page.getByLabel("Email Address").fill(invites.addMember.email);

      await page.getByRole("button", { name: "Send Invitation", exact: true }).click();

      await page.waitForLoadState("networkidle");

      // const successToast = await page.waitForSelector(".formbricks__toast__success");
      // expect(successToast).toBeTruthy();
    });

    await test.step("Copy invite Link", async () => {
      await expect(page.locator("#membersInfoWrapper")).toBeVisible();

      const lastMemberInfo = page.locator("#membersInfoWrapper > .singleMemberInfo:last-child");
      await expect(lastMemberInfo).toBeVisible();

      const pendingSpan = lastMemberInfo.locator("span").filter({ hasText: "Pending" });
      await expect(pendingSpan).toBeVisible();

      const shareInviteButton = page.locator(".shareInviteButton").last();
      await expect(shareInviteButton).toBeVisible();

      await shareInviteButton.click();

      const inviteLinkText = await page.waitForSelector("#inviteLinkText");
      expect(inviteLinkText).toBeTruthy();

      // invite link text is a paragraph, and we need the text inside it
      const inviteLinkTextContent = await inviteLinkText.textContent();
      expect(inviteLinkTextContent).toBeTruthy();
      // if (inviteLinkTextContent) {
      //   inviteLink = inviteLinkTextContent;
      // }
    });
  });

  // test("Accept invite", async ({ page }) => {
  //   const { email, name } = mockUsers.organization[1];
  //   page.goto(inviteLink);

  //   await page.waitForURL(/\/invite\?token=[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);

  //   // Create account button
  //   await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  //   await page.getByRole("link", { name: "Create account" }).click();

  //   await signupUsingInviteToken(page, name, email, name);
  //   await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  // });

  // test("Remove member", async ({ page }) => {
  //   await apiLogin(page, email, name);

  //   await page.goto("/");
  //   await page.waitForURL(/\/environments\/[^/]+\/surveys/);

  //   const dropdownTrigger = page.locator("#userDropdownTrigger");
  //   await expect(dropdownTrigger).toBeVisible();
  //   await dropdownTrigger.click();

  //   const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
  //   await expect(dropdownInnerContentWrapper).toBeVisible();

  //   await page.getByRole("link", { name: "Organization" }).click();

  //   await page.waitForURL(/\/environments\/[^/]+\/settings\/members/);

  //   await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

  //   await expect(page.locator("#membersInfoWrapper")).toBeVisible();

  //   const lastMemberInfo = page.locator("#membersInfoWrapper > .singleMemberInfo:last-child");
  //   await expect(lastMemberInfo).toBeVisible();

  //   const deleteMemberButton = lastMemberInfo.locator("#deleteMemberButton");
  //   await expect(deleteMemberButton).toBeVisible();

  //   await deleteMemberButton.click();

  //   await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  //   await page.getByRole("button", { name: "Delete", exact: true }).click();
  // });
});
