import { expect } from "playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { invites } from "./utils/mock";

test.describe("Invite, accept and remove organization member", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  });

  test("Invite organization member", async ({ page }) => {
    const inviteEmail = `org-invite-${Date.now()}@formbricks.com`;

    await test.step("Invite User", async () => {
      const workspaceId = /\/workspaces\/([^/]+)\//.exec(page.url())?.[1];
      // Old workspace-scoped org settings URL is redirected to the org-scoped route.
      await page.goto(`/workspaces/${workspaceId}/settings/organization/teams`);
      await page.waitForURL(/\/organizations\/[^/]+\/settings\/teams/);

      await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

      // Add member button
      await expect(page.getByRole("button", { name: "Invite member" })).toBeVisible();
      await page.getByRole("button", { name: "Invite member" }).click();

      // Fill the member name and email form
      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Full Name").fill(invites.addMember.name);

      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Email").fill(inviteEmail);

      await page.getByRole("button", { name: "Invite", exact: true }).click();

      await expect(page.locator(".formbricks__toast__success")).toBeVisible({ timeout: 15000 });
    });

    await test.step("Copy invite Link", async () => {
      await expect(page.locator("#membersInfoWrapper")).toBeVisible();

      const invitedMemberInfo = page.locator("#singleMemberInfo").filter({ hasText: inviteEmail });
      await expect(invitedMemberInfo).toBeVisible({ timeout: 10000 });

      await expect(invitedMemberInfo.getByText("Pending", { exact: true })).toBeVisible();

      const shareInviteButton = invitedMemberInfo.locator("#shareInviteButton");
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
  //   await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  // });

  // test("Remove member", async ({ page }) => {
  //   await apiLogin(page, email, name);

  //   await page.goto("/");
  //   await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

  //   const dropdownTrigger = page.locator("#userDropdownTrigger");
  //   await expect(dropdownTrigger).toBeVisible();
  //   await dropdownTrigger.click();

  //   const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
  //   await expect(dropdownInnerContentWrapper).toBeVisible();

  //   await page.getByRole("link", { name: "Organization" }).click();

  //   await page.waitForURL(/\/workspaces\/[^/]+\/settings\/members/);

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

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  });

  test("Create and update team", async ({ page }) => {
    const workspaceId = /\/workspaces\/([^/]+)\//.exec(page.url())?.[1];
    // Old workspace-scoped org settings URL is redirected to the org-scoped route.
    await page.goto(`/workspaces/${workspaceId}/settings/organization/teams`);
    await page.waitForURL(/\/organizations\/[^/]+\/settings\/teams/);
    await expect(page.getByRole("button", { name: "Create new team" })).toBeVisible();
    await page.getByRole("button", { name: "Create new team" }).click();
    await page.locator("#team-name").fill("E2E");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("team-row").filter({ hasText: "E2E" })).toBeVisible();

    await page.getByRole("button", { name: "Manage team" }).click();

    await expect(page.getByRole("heading", { name: "E2E" })).toBeVisible();

    await page.getByPlaceholder("Team name").fill("E2E Updated");

    await page.locator("#member-select-0").click();
    await page.locator('[data-slot="command-item"]').first().click();

    await page.locator("#workspace-select-0").click();
    await page.locator('[data-slot="command-item"]').first().click();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("cell", { name: "E2E Updated" })).toBeVisible();

    await page.getByRole("button", { name: "Manage team" }).click();

    await expect(page.getByRole("heading", { name: "E2E Updated" })).toBeVisible();

    await page.locator("#deleteTeamButton").click();

    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Teams", level: 1 })).toBeVisible();

    await expect(page.getByRole("cell", { name: "E2E Updated" })).not.toBeVisible();
  });
});

/**
 * Organization general settings: rename, display time zone, delete. Asserted on what the page shows and what
 * the database holds, so it holds before and after the page moved off server actions (ENG-3984).
 */
test.describe("Organization general settings", () => {
  test("renames the organization, sets its time zone and deletes it", async ({ page, users }) => {
    const run = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const user = await users.create({ organizationName: `Org ${run}`, workspaceName: `Workspace ${run}` });
    const { organizationId } = user;
    if (!organizationId) throw new Error("Organization not seeded for the test user");

    // A second organization to land in once this one is gone: the last one can't be deleted.
    const otherOrganization = await prisma.organization.create({
      data: {
        name: `Other Org ${run}`,
        billing: {
          create: {
            limits: { workspaces: 3, monthly: { responses: 1500 } },
            stripeCustomerId: null,
            usageCycleAnchor: new Date(),
          },
        },
        workspaces: { create: { name: `Other Workspace ${run}` } },
        memberships: { create: { userId: user.id, role: "owner", accepted: true } },
      },
      select: { id: true, workspaces: { select: { id: true } } },
    });
    await prisma.survey.create({
      data: {
        workspaceId: otherOrganization.workspaces[0].id,
        createdBy: user.id,
        name: "Other Organization Seed Survey",
        status: "draft",
        type: "link",
      },
    });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/organizations/${organizationId}/settings/general`, { waitUntil: "domcontentloaded" });

    const storedOrganization = () =>
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, displayTimeZone: true },
      });

    await test.step("rename the organization", async () => {
      await page.getByPlaceholder("e.g. Acme Inc.").fill(`Renamed Org ${run}`);
      await page.getByRole("button", { name: "Update" }).click();

      await expect(page.getByText("Organization name updated successfully")).toBeVisible();
      await expect.poll(async () => (await storedOrganization())?.name).toBe(`Renamed Org ${run}`);
    });

    await test.step("set the display time zone", async () => {
      await page.getByRole("combobox", { name: "Display Time Zone" }).click();
      await page.getByPlaceholder("Search", { exact: true }).fill("Lisbon");
      await page.getByRole("option", { name: "Europe/Lisbon" }).click();
      await page.getByRole("button", { name: "Update" }).click();

      await expect(page.getByText("Display time zone updated successfully")).toBeVisible();
      await expect.poll(async () => (await storedOrganization())?.displayTimeZone).toBe("Europe/Lisbon");

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByPlaceholder("e.g. Acme Inc.")).toHaveValue(`Renamed Org ${run}`);
      await expect(page.getByRole("combobox", { name: "Display Time Zone" })).toContainText("Europe/Lisbon");
    });

    await test.step("delete the organization", async () => {
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.locator("#deleteOrganizationConfirmation").fill(`Renamed Org ${run}`);
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

      await expect(page.getByText("Organization deleted successfully")).toBeVisible();
      await page.waitForURL(new RegExp(`/workspaces/${otherOrganization.workspaces[0].id}/`));
      await expect.poll(storedOrganization).toBeNull();
    });
  });
});
