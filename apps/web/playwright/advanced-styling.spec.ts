import { expect, test } from "@playwright/test";

test.describe("Advanced Styling", () => {
  test("should apply advanced button styling to preview", async ({ page }) => {
    // Login
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "admin@formbricks.com");
    await page.fill('input[type="password"]', "Password#123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/environments\/.+/);

    await page.goto("/environments/clseedenvprod000000000/workspace/look");
    
    // Open Advanced Styling
    await page.getByText("Advanced Styling").click();
    await page.getByText("Buttons").click();

    // Verify initial state
    const previewButton = page.locator(".button-custom"); // Adjust selector if needed
    // Wait for preview to load
    await expect(previewButton).toBeVisible();

    // Change Button Background
    const bgInput = page.locator('input[name="buttonBgColor.light"]');
    await bgInput.fill("#ff0000"); 
    await bgInput.press('Enter'); // trigger change

    // Change Border Radius
    const radiusInput = page.locator('input[name="buttonBorderRadius"]');
    await radiusInput.fill("20");

    // Change Height
    const heightInput = page.locator('input[name="buttonHeight"]');
    await heightInput.fill("50");

    // Verify Preview Styles
    // We expect the preview button to have these computed styles
    await expect(previewButton).toHaveCSS("height", "50px");

    // Change Border Radius to %
    await page.locator('div:has(input[name="buttonBorderRadius"]) select').selectOption("%");
    
    // Verify CSS Variable directly for accuracy (computed style converts % to px)
    const styleTag = page.locator('#formbricks__css__custom');
    await expect(styleTag).toContainText('--fb-button-border-radius: 20%;');

    // Test Input Deletion (Regression Test)
    await radiusInput.click();
    await radiusInput.fill(""); // Simulate clearing
    await expect(radiusInput).toHaveValue("");
    
    // Enter new value
    await radiusInput.type("15");
    await expect(styleTag).toContainText('--fb-button-border-radius: 15%;');

    // Switch back to px
    await page.locator('div:has(input[name="buttonBorderRadius"]) select').selectOption("px");
    await expect(styleTag).toContainText('--fb-button-border-radius: 15px;');
  });
});
