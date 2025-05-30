import { expect } from "playwright/test";
import { test } from "./lib/fixtures";
import { invites } from "./utils/mock";

test.describe("Invite, accept and remove organization member", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Invite organization member", async ({ page }) => {
    await test.step("Invite User", async () => {
      const dropdownTrigger = page.locator("#userDropdownTrigger");
      await expect(dropdownTrigger).toBeVisible();
      await dropdownTrigger.click();

      const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
      await expect(dropdownInnerContentWrapper).toBeVisible();

      await page.getByRole("link", { name: "Organization" }).click();
      await page.waitForURL(/\/environments\/[^/]+\/settings\/general/);

      await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

      await page.getByRole("link", { name: "Access Control" }).click();

      // Add member button
      await expect(page.getByRole("button", { name: "Invite member" })).toBeVisible();
      await page.getByRole("button", { name: "Invite member" }).click();

      // Fill the member name and email form
      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Full Name").fill(invites.addMember.name);

      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Email").fill(invites.addMember.email);

      await page.getByRole("button", { name: "Invite", exact: true }).click();

      await page.waitForLoadState("networkidle");

      // const successToast = await page.waitForSelector(".formbricks__toast__success");
      // expect(successToast).toBeTruthy();
    });

    await test.step("Copy invite Link", async () => {
      await expect(page.locator("#membersInfoWrapper")).toBeVisible();

      const lastMemberInfo = page.locator("#membersInfoWrapper > #singleMemberInfo:last-child");
      await expect(lastMemberInfo).toBeVisible();

      const pendingSpan = lastMemberInfo.locator("span").locator("span").filter({ hasText: "Pending" });
      await expect(pendingSpan).toBeVisible();

      const shareInviteButton = page.locator("#shareInviteButton").last();
      await expect(shareInviteButton).toBeVisible();

      await shareInviteButton.click();

      const inviteLinkText = await page.waitForSelector("#inviteLinkText");
      expect(inviteLinkText).toBeTruthy();

      // invite link text is an input element, so we need to get its value instead of textContent
      const inviteLinkTextContent = await inviteLinkText.inputValue();
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

  //   const lastMemberInfo = page.locator("#membersInfoWrapper > #singleMemberInfo:last-child");
  //   await expect(lastMemberInfo).toBeVisible();

  //   const deleteMemberButton = lastMemberInfo.locator("#deleteMemberButton");
  //   await expect(deleteMemberButton).toBeVisible();

  //   await deleteMemberButton.click();

  //   await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  //   await page.getByRole("button", { name: "Delete", exact: true }).click();
  // });
});

test.describe("Create, update and delete team", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and update team", async ({ page }) => {
    const dropdownTrigger = page.locator("#userDropdownTrigger");
    await expect(dropdownTrigger).toBeVisible();
    await dropdownTrigger.click();

    const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
    await expect(dropdownInnerContentWrapper).toBeVisible();

    await page.getByRole("link", { name: "Organization" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/settings\/general/);

    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Access Control")).toBeVisible();
    await page.getByText("Access Control").click();
    await page.waitForURL(/\/environments\/[^/]+\/settings\/teams/);
    await expect(page.getByRole("button", { name: "Create new team" })).toBeVisible();
    await page.getByRole("button", { name: "Create new team" }).click();
    await page.locator("#team-name").fill("E2E");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#E2E")).toBeVisible();

    await page.getByRole("button", { name: "Manage team" }).click();

    await expect(page.getByRole("heading", { name: "E2E" })).toBeVisible();

    await page.getByPlaceholder("Team name").fill("E2E Updated");

    await page.locator("button").filter({ hasText: "Select member" }).first().click();
    await page.locator("#member-0-option").click();

    await page.locator("button").filter({ hasText: "Select project" }).first().click();
    await page.locator("#project-0-option").click();

    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("cell", { name: "E2E Updated" })).toBeVisible();

    await page.getByRole("button", { name: "Manage team" }).click();

    await expect(page.getByRole("heading", { name: "E2E Updated" })).toBeVisible();

    await page.locator("#deleteTeamButton").click();

    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Organization Settings" })).toBeVisible();

    await expect(page.getByRole("cell", { name: "E2E Updated" })).not.toBeVisible();
  });
});
