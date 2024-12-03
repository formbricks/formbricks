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

      // Add member button
      await expect(page.getByRole("button", { name: "Add member" })).toBeVisible();
      await page.getByRole("button", { name: "Add member" }).click();

      // Fill the member name and email form
      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Full Name").fill(invites.addMember.name);

      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Email").fill(invites.addMember.email);

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

    await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

    await expect(page.getByText("Teams")).toBeVisible();
    await page.getByText("Teams").click();
    await expect(page.getByRole("button", { name: "Create new team" })).toBeVisible();
    await page.getByRole("button", { name: "Create new team" }).click();
    await page.locator("#team-name").fill("E2E");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#E2E")).toBeVisible();
    await page.getByRole("link", { name: "E2E" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/settings\/teams\/[^/]+/);
    await expect(page.getByRole("heading", { name: "E2E" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Add Member" })).toBeVisible();
    await page.getByRole("button", { name: "Add Member" }).click();

    await page.locator("#multi-select-dropdown").click();
    await page.locator(".option-1").click();

    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByRole("cell", { name: "No members found" })).toBeHidden();

    await expect(page.getByRole("button", { name: "Projects" })).toBeVisible();
    await page.getByRole("button", { name: "Projects" }).click();

    await expect(
      page.getByRole("cell", {
        name: "You haven't added any projects yet. Assign a project to the team to grant access to its members.",
      })
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Add Project" })).toBeVisible();
    await page.getByRole("button", { name: "Add Project" }).click();

    await page.locator("#multi-select-dropdown").click();
    await page.locator(".option-1").click();

    await page.getByRole("button", { name: "Add" }).click();

    await expect(
      page.getByRole("cell", {
        name: "You haven't added any projects yet. Assign a project to the team to grant access to its members.",
      })
    ).toBeHidden();

    await page.getByRole("combobox").click();

    await page.getByText("Manage").click();

    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();

    await page.locator("#team-name").fill("E2E Updated");
    await page.getByRole("button", { name: "Update" }).click();

    await expect(page.getByRole("heading", { name: "E2E Updated" })).toBeVisible();

    await page.getByRole("link", { name: "Configuration" }).click();

    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Team Access" })).toBeVisible();

    await page.getByRole("link", { name: "Team Access" }).click();
    await page.getByRole("combobox").click();

    await page.getByText("Read & write").click();

    await page.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(page.getByRole("cell", { name: "No teams found" })).toBeVisible();

    await page.getByRole("button", { name: "Add existing team" }).click();

    await page.locator("#multi-select-dropdown").click();
    await page.locator(".option-1").click();

    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByRole("link", { name: "E2E Updated" })).toBeVisible();

    await page.getByRole("link", { name: "E2E Updated" }).click();

    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(page.getByRole("cell", { name: "No members found" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();

    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(
      page.getByRole("cell", {
        name: "You don’t have any teams yet. Create your first team to manage project access for members of your organization.",
      })
    ).toBeVisible();
  });
});
