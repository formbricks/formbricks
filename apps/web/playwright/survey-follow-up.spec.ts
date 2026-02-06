import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

test.use({
  launchOptions: {
    slowMo: 150,
  },
});

test.describe("Survey Follow-Up Create & Edit", async () => {
  // 3 minutes
  test.setTimeout(1000 * 60 * 3);

  test("Create a follow-up without optional toggles and verify it saves", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    await test.step("Create a new survey", async () => {
      await page.getByText("Start from scratch").click();
      await page.getByRole("button", { name: "Create survey", exact: true }).click();
      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);
    });

    await test.step("Navigate to Follow-ups tab", async () => {
      await page.getByText("Follow-ups").click();
      // Verify the empty state is shown
      await expect(page.getByText("Send automatic follow-ups")).toBeVisible();
    });

    await test.step("Create a new follow-up without enabling optional toggles", async () => {
      // Click the "New follow-up" button in the empty state
      await page.getByRole("button", { name: "New follow-up" }).click();

      // Verify the modal is open
      await expect(page.getByText("Create a new follow-up")).toBeVisible();

      // Fill in the follow-up name
      await page.getByPlaceholder("Name your follow-up").fill("Test Follow-Up");

      // Leave trigger as default ("Respondent completes survey")
      // Leave "Attach response data" toggle OFF (the key scenario for the bug)
      // Leave "Include variables" and "Include hidden fields" unchecked

      // Click Save
      await page.getByRole("button", { name: "Save" }).click();

      // The success toast should appear — this was the bug: previously save failed silently
      const successToast = await page.waitForSelector(".formbricks__toast__success", { timeout: 5000 });
      expect(successToast).toBeTruthy();
    });

    await test.step("Verify follow-up appears in the list", async () => {
      // After creation, the modal closes and the follow-up should appear in the list
      await expect(page.getByText("Test Follow-Up")).toBeVisible();
      await expect(page.getByText("Any response")).toBeVisible();
      await expect(page.getByText("Send email")).toBeVisible();
    });

    await test.step("Edit the follow-up and verify it saves", async () => {
      // Click on the follow-up to edit it
      await page.getByText("Test Follow-Up").click();

      // Verify the edit modal opens
      await expect(page.getByText("Edit this follow-up")).toBeVisible();

      // Change the name
      const nameInput = page.getByPlaceholder("Name your follow-up");
      await nameInput.clear();
      await nameInput.fill("Updated Follow-Up");

      // Save the edit
      await page.getByRole("button", { name: "Save" }).click();

      // The success toast should appear
      const successToast = await page.waitForSelector(".formbricks__toast__success", { timeout: 5000 });
      expect(successToast).toBeTruthy();

      // Verify the updated name appears in the list
      await expect(page.getByText("Updated Follow-Up")).toBeVisible();
    });

    await test.step("Create a second follow-up with optional toggles enabled", async () => {
      // Click "+ New follow-up" button (now in the non-empty state header)
      await page.getByRole("button", { name: /New follow-up/ }).click();

      // Verify the modal is open
      await expect(page.getByText("Create a new follow-up")).toBeVisible();

      // Fill in the follow-up name
      await page.getByPlaceholder("Name your follow-up").fill("Follow-Up With Data");

      // Enable "Attach response data" toggle
      await page.locator("#attachResponseData").click();

      // Check both optional checkboxes
      await page.locator("#includeVariables").click();
      await page.locator("#includeHiddenFields").click();

      // Click Save
      await page.getByRole("button", { name: "Save" }).click();

      // The success toast should appear
      const successToast = await page.waitForSelector(".formbricks__toast__success", { timeout: 5000 });
      expect(successToast).toBeTruthy();

      // Verify both follow-ups appear in the list
      await expect(page.getByText("Updated Follow-Up")).toBeVisible();
      await expect(page.getByText("Follow-Up With Data")).toBeVisible();
    });
  });
});
