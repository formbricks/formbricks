import { test } from "./lib/fixtures";

test.describe("Invite, accept and remove organization member", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });
  test.describe.configure({ mode: "serial" });

  test("should navigate and update language settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Formbricks Logo" }).click();
    await page.locator("#userDropdownTrigger").click();
    await page.getByRole("link", { name: "Account" }).click();
    await page.getByRole("heading", { name: "Personal information" }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("menuitem", { name: "German" }).click();
    await page.getByRole("button", { name: "Update" }).click();
    await page.getByRole("button", { name: "German" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await page.getByRole("button", { name: "Aktualisieren" }).click();
  });
});
