import { expect, test } from "@playwright/test";

test.describe("Advanced Styling - Input and Layout", () => {
  test("should apply input sizing and padding correctly", async ({ page }) => {
    // Login
    await page.goto("/auth/login");

    // Handle potential intermediate login screen
    try {
      await page.getByText("Login with Email").click({ timeout: 3000 });
    } catch (e) {
      // Button not found or not clickable, proceed to input check
    }

    await page.fill('input[type="email"]', "admin@formbricks.com");
    await page.fill('input[type="password"]', "Password#123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/environments\/.+/);

    await page.goto("/environments/clseedenvprod000000000/workspace/look");

    // Open Advanced Styling
    await page.getByText("Advanced Styling").click();
    await page.getByText("Inputs").click(); // Open Inputs accordion

    // Locator for the preview input
    const previewInput = page.locator("input[placeholder='Type something here...']");
    await expect(previewInput).toBeVisible();

    // 1. Test Input Height (Min Height) mechanism
    // Default is usually 40px (2.5rem). Let's set it to 60px.
    const heightInput = page.locator('input[name="inputHeight"]');
    await heightInput.fill("60");
    await heightInput.blur(); // Trigger save/update

    // Verify it expands to at least 60px
    await expect(previewInput).toHaveCSS("min-height", "60px");
    // Also check computed height
    const box = await previewInput.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(60);

    // 2. Test Font Size causing expansion
    // Set Font Size to something huge, like 40px
    const fontSizeInput = page.locator('input[name="inputFontSize"]');
    await fontSizeInput.fill("40");
    await fontSizeInput.blur();

    // Verify font size applied
    await expect(previewInput).toHaveCSS("font-size", "40px");

    // With 40px font + default padding (16px top + 16px bottom = 32px), total required height is > 72px.
    // Since inputHeight is 60px, the box should expand beyond 60px.
    // Wait a bit for render
    await page.waitForTimeout(500);
    const boxLargeFont = await previewInput.boundingBox();
    expect(boxLargeFont?.height).toBeGreaterThan(60);

    // 3. Test Padding Y causing expansion
    // Reset Font Size to small to isolate padding test
    await fontSizeInput.fill("14");
    await fontSizeInput.blur();

    // Wait, the UI might have inputPaddingX and inputPaddingY?
    // Let's check the HTML for the name or label.
    // Assuming "Vertical Padding" input exists.
    const paddingYInput = page.locator('input[name="inputPaddingY"]');
    await paddingYInput.fill("30");
    await paddingYInput.blur();

    // 30px top + 30px bottom + line-height (~20px for 14px font) = ~80px
    await page.waitForTimeout(500);
    const boxLargePadding = await previewInput.boundingBox();
    expect(boxLargePadding?.height).toBeGreaterThan(70);

    // 4. Verify Toggles at bottom are visible (Layout fix check)
    // The previous fix reduced preview height to 85% to verify toggles are visible.
    const linkSurveyToggle = page.getByText("Link Survey");
    const appSurveyToggle = page.getByText("App Survey");

    await expect(linkSurveyToggle).toBeVisible();
    await expect(appSurveyToggle).toBeVisible();

    // Ensure they are not covered by the preview window
    // We can check if they are clickable
    await linkSurveyToggle.click();
    await appSurveyToggle.click();
  });
});
