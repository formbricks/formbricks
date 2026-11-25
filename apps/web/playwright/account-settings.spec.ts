import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { clickUntilURL } from "./utils/click-until";

/**
 * The personal account settings end to end: the way back to the workspace, email alerts, the profile, and an
 * email change. One journey with `test.step` phases — the email change signs the user out, so it goes last.
 *
 * Asserted at feature level — what the page shows and what the database holds — never how the page talks to
 * the server, so the same spec holds before and after these pages moved from server actions onto
 * `/api/internal/users/me` (ENG-3984). Password reset and SSO account deletion are off in the E2E stack
 * (`PASSWORD_RESET_DISABLED`, no identity provider), so their routes are covered by route tests instead.
 */

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const storedUser = (id: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id },
    select: { name: true, email: true, notificationSettings: true },
  });

test.describe("Account settings", () => {
  test("returns to the workspace, changes email alerts, the profile name and the email address", async ({
    page,
    users,
  }) => {
    const run = stamp();
    // The fixture's password is the name, and the password field wants an uppercase letter and a digit.
    const name = `Account-${run}`;
    const user = await users.create({
      email: `account-${run}@example.com`,
      name,
      workspaceName: `Account Workspace ${run}`,
    });
    const { workspaceId, organizationId } = user;
    if (!workspaceId || !organizationId) throw new Error("Workspace not seeded for the test user");

    const survey = await prisma.survey.create({
      data: {
        workspaceId,
        createdBy: user.id,
        name: `Alert survey ${run}`,
        status: "inProgress",
        type: "link",
      },
      select: { id: true },
    });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    // ENG-1700: the settings sidebar's back arrow router.push-es the workspace the settings shell resolved.
    // Visiting a second workspace first points the proxy's formbricks-workspace-id cookie at it, while the
    // no-cookie fallback is the first-created workspace, so landing back on the second one proves the cookie
    // wins.
    await test.step("the back arrow returns to the workspace you came from", async () => {
      const secondWorkspace = await prisma.workspace.create({
        data: { name: `Account Second Workspace ${run}`, organizationId },
        select: { id: true },
      });
      const secondSurveys = new RegExp(`/workspaces/${secondWorkspace.id}/surveys`);

      await page.goto(`/workspaces/${secondWorkspace.id}/surveys`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(secondSurveys);
      await page.goto("/account/settings/profile", { waitUntil: "domcontentloaded" });

      // Retried: a click that lands before the page hydrates is dropped and the page stays put.
      await clickUntilURL(
        page.getByRole("complementary").getByRole("button", { name: "Back", exact: true }),
        secondSurveys
      );
    });

    const alertSwitch = () =>
      page
        .getByRole("row")
        .filter({ hasText: `Alert survey ${run}` })
        .getByRole("switch");
    const autoSubscribeSwitch = () =>
      page.getByRole("switch", { name: "toggle notification settings for unsubscribedOrganizationIds" });

    await test.step("turn on the response alert for a survey", async () => {
      // `load`, not `domcontentloaded`: a click on the server-rendered switch before hydration does nothing.
      await page.goto("/account/settings/notifications", { waitUntil: "load" });
      await expect(alertSwitch()).not.toBeChecked();

      await alertSwitch().click();
      await expect(page.getByText("Notification settings updated")).toBeVisible();
      await expect(alertSwitch()).toBeChecked();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(alertSwitch()).toBeChecked();
      const { notificationSettings } = await storedUser(user.id);
      expect(notificationSettings).toMatchObject({ alert: { [survey.id]: true } });
    });

    await test.step("stop auto-subscribing to the organization's new surveys", async () => {
      await expect(autoSubscribeSwitch()).toBeChecked();

      await autoSubscribeSwitch().click();
      await expect(autoSubscribeSwitch()).not.toBeChecked();

      // Flipping a second switch keeps the first: each change is applied to what is stored.
      await expect
        .poll(async () => (await storedUser(user.id)).notificationSettings)
        .toMatchObject({ alert: { [survey.id]: true }, unsubscribedOrganizationIds: [organizationId] });
    });

    await test.step("turn the alert off from the link in an alert email", async () => {
      await page.goto(`/account/settings/notifications?type=alert&elementId=${survey.id}`, {
        waitUntil: "domcontentloaded",
      });

      await expect(alertSwitch()).not.toBeChecked();
      await expect
        .poll(async () => (await storedUser(user.id)).notificationSettings)
        .toMatchObject({ alert: { [survey.id]: false }, unsubscribedOrganizationIds: [organizationId] });
    });

    await test.step("rename yourself", async () => {
      // `load`: a value filled before hydration is reset by it, leaving the form clean and Update disabled.
      await page.goto("/account/settings/profile", { waitUntil: "load" });
      const nameInput = page.getByRole("textbox", { name: "Full name" });
      await expect(nameInput).toHaveValue(name);

      await nameInput.fill(`Renamed ${run}`);
      // The form reloads the page once the name is saved; wait for that before the next step fills it in.
      const reloaded = page.waitForEvent("load");
      await page.getByRole("button", { name: "Update" }).click();
      await reloaded;

      await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(`Renamed ${run}`);
      await expect.poll(async () => (await storedUser(user.id)).name).toBe(`Renamed ${run}`);
    });

    await test.step("change the email address, confirmed with the password", async () => {
      const newEmail = `account-changed-${run}@example.com`;
      await page.getByRole("textbox", { name: "Email" }).fill(newEmail);
      await page.getByRole("button", { name: "Update" }).click();

      // The fixture's password is the user's original name.
      await page.getByPlaceholder("*******").fill(name);
      await page.getByRole("button", { name: "Confirm" }).click();

      // Email verification is off in the E2E stack: the address changes at once and the user is signed out.
      await page.waitForURL("**/email-change-without-verification-success");
      await expect(page.getByText("Email changed successfully")).toBeVisible();
      await expect.poll(async () => (await storedUser(user.id)).email).toBe(newEmail);
    });
  });
});
