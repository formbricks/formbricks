import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

test.describe("Comprehensive Survey Styling Tests", async () => {
  test("All styling fields should update CSS variables correctly", async ({ page, users }) => {
    // Fast login
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    // Navigate to Look & Feel settings
    await page.getByRole("link", { name: "Configuration" }).click();
    await page.getByRole("link", { name: "Look & Feel" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/workspace\/look/);

    // Toggle "Add custom styles"
    const addCustomStyles = page.getByLabel("Add custom styles");
    if (!(await addCustomStyles.isChecked())) {
      await addCustomStyles.check();
    }

    // Helper to open accordion if needed
    const openAccordion = async (name: string) => {
      const accordion = page.getByText(name, { exact: false });
      // We click it. If it's already open, it might close, but usually these are separate triggers or we can check attribute.
      // For simplicity in this specific UI, we'll assume they start closed or checking is idempotent enough if we are careful.
      // Actually, standard accordions usually have `aria-expanded`.
      await accordion.click();
    };

    // Helper to set color input
    const setColor = async (label: string, hex: string) => {
      // Find the specific label, get parent, find the hex input
      // Because labels are repeated (e.g. "Font Size"), we need to scope them to the section if possible,
      // but here we will rely on the order or assume we open one section at a time.
      // Better strategy: Find the label within the visible section.
      
      const labelEl = page.locator("label").filter({ hasText: label }).last(); // .last() is risky but usually works for bottom-most open section
      // The color picker input is usually an input type text with a '#' prefix or similar. 
      // Based on previous interaction, it's a textbox in the container.
      const container = labelEl.locator(".."); 
      await container.getByRole("textbox").fill(hex);
      // Trigger blur/change
      await container.getByRole("textbox").blur();
    };

    // Helper to set dimension (number)
    const setDimension = async (label: string, value: string) => {
      const labelEl = page.locator("label").filter({ hasText: label }).last();
      const container = labelEl.locator("..");
      await container.locator('input[type="number"]').fill(value);
      await container.locator('input[type="number"]').blur();
    };

     // Helper to set simple text input (e.g. Shadow)
     const setText = async (label: string, value: string) => {
        const labelEl = page.locator("label").filter({ hasText: label }).last();
        const container = labelEl.locator("..");
        await container.getByRole("textbox").fill(value);
        await container.getByRole("textbox").blur();
      };

    // --- Headlines & Descriptions ---
    await openAccordion("Headlines & Descriptions");
    
    // Set values
    await setColor("Headline Color", "aa0000"); // Red-ish
    await setColor("Description Color", "00aa00"); // Green-ish
    await setDimension("Headline Font Size", "24");
    await setDimension("Description Font Size", "18");
    await setText("Headline Font Weight", "700"); // Assuming text/number input
    await setColor("Headline Label Color", "0000aa"); // Blue-ish
    await setDimension("Headline Label Font Size", "14");

    // Wait for updates
    await page.waitForTimeout(1000);

    // Verify Variables
    let css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-element-headline-color: #aa0000");
    expect(css).toContain("--fb-element-description-color: #00aa00");
    expect(css).toContain("--fb-element-headline-font-size: 24px");
    expect(css).toContain("--fb-element-description-font-size: 18px");
    expect(css).toContain("--fb-element-headline-font-weight: 700");
    expect(css).toContain("--fb-element-upper-label-color: #0000aa");
    expect(css).toContain("--fb-element-upper-label-font-size: 14px");


    // --- Inputs ---
    await openAccordion("Inputs");
    
    // Note: "Input color" usually refers to Background. 
    await setColor("Input color", "eeeeee");
    await setColor("Input border color", "cccccc");
    await setColor("Input Text", "024eff"); // The one we fixed!
    await setDimension("Border Radius", "5");
    await setDimension("Height", "50");
    await setDimension("Font Size", "16");
    await setDimension("Padding X", "20");
    await setDimension("Padding Y", "10");
    await setText("Placeholder Opacity", "0.8");
    await setText("Shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);

    expect(css).toContain("--fb-input-background-color: #eeeeee");
    expect(css).toContain("--fb-input-border-color: #cccccc");
    expect(css).toContain("--fb-input-text-color: #024eff");
    expect(css).toContain("--fb-input-border-radius: 5px");
    expect(css).toContain("--fb-input-height: 50px");
    expect(css).toContain("--fb-input-font-size: 16px");
    expect(css).toContain("--fb-input-padding-x: 20px");
    expect(css).toContain("--fb-input-padding-y: 10px");
    expect(css).toContain("--fb-input-placeholder-opacity: 0.8");
    expect(css).toContain("--fb-input-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)");


    // --- Buttons ---
    await openAccordion("Buttons"); // Click "Buttons" accordion header

    await setColor("Button Background", "ff00ff");
    await setColor("Button Text", "ffffff");
    await setDimension("Border Radius", "12"); // Scoping issue? Button has "Border Radius" too.
    // Since we opened "Buttons" accordion and it is below Inputs (usually), the .last() filter on labels might catch the one in Buttons.
    // BUT Playwright's .last() is strict on the result set.
    // A safer way is ensuring we only scope to the Buttons region, but for now we assume functionality.
    // Let's refine the helper to use the open accordion context if we can, or just trust the labels are unique enough OR appearing later in DOM.
    // "Border Radius" appears in both Inputs and Buttons. "Border Radius" in Buttons is likely last in DOM if Buttons is below Inputs.
    
    await setDimension("Height", "48");
    await setDimension("Font Size", "18");
    await setText("Font Weight", "600");
    await setDimension("Padding X", "24");
    await setDimension("Padding Y", "12");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);

    expect(css).toContain("--fb-button-bg-color: #ff00ff");
    expect(css).toContain("--fb-button-text-color: #ffffff");
    expect(css).toContain("--fb-button-border-radius: 12px");
    expect(css).toContain("--fb-button-height: 48px");
    expect(css).toContain("--fb-button-font-size: 18px");
    expect(css).toContain("--fb-button-font-weight: 600");
    expect(css).toContain("--fb-button-padding-x: 24px");
    expect(css).toContain("--fb-button-padding-y: 12px");

    // --- Options ---
    await openAccordion("Options");

    await setColor("Option Background", "eeeeee");
    await setColor("Option Label", "111111");
    // "Border Radius" is reused. We rely on order or being in the open accordion.
    // If multiple accordions are open, we might hit ambiguity.
    // For this test, we assume previous accordions might stay open or we just rely on .last() picking the bottom-most one which is Options.
    await setDimension("Border Radius", "6"); 
    await setDimension("Padding X", "12");
    await setDimension("Padding Y", "8");
    await setDimension("Font Size", "15");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);

    expect(css).toContain("--fb-option-bg-color: #eeeeee");
    expect(css).toContain("--fb-option-label-color: #111111");
    expect(css).toContain("--fb-option-border-radius: 6px");
    expect(css).toContain("--fb-option-padding-x: 12px");
    expect(css).toContain("--fb-option-padding-y: 8px");
    expect(css).toContain("--fb-option-font-size: 15px");



    // --- Progress Bar ---
    // Located in Card Styling settings generally, but we can search for the label.
    // Ensure it's visible (toggle off "Hide progress bar" if it's on)
    // The switch label is "Hide progress bar"
    const hideProgressSwitch = page.getByLabel("Hide progress bar");
    if (await hideProgressSwitch.isChecked()) {
        await hideProgressSwitch.uncheck();
    }
    
    // Set Track Height
    // "Track Height" is the label
    await setDimension("Track Height", "15");
    
    // Test Card Roundness influence on Track Radius
    // Card styling is usually in an accordion or section "Card Styling" or similar?
    // In Settings -> Look & Feel -> Card Styling is a section.
    // But in the UI it might be under "Card Styling".
    // We already have `setDimension("Roundness", ...)` potentially available if we find the label.
    // "Roundness" label is unique enough usually. Default is 8.
    await setDimension("Roundness", "20");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);

    // Verify Progress Track Variables
    expect(css).toContain("--fb-progress-track-height: 15px");
    expect(css).toContain("--fb-progress-track-border-radius: 20px"); // Should match Roundness

    // Computed Style Check for Progress Track Height
    const progressTrack = page.locator("#fbjs .progress-track");
    await expect(progressTrack).toBeVisible();
    // Using evaluate to get precise computed value
    const computedTrackHeight = await progressTrack.evaluate((el) => window.getComputedStyle(el).height);
    expect(computedTrackHeight).toBe("15px");

    // Final Computed Style Check for the crucial fix (Input Text Color)
    const previewInput = page.locator('#preview_input_field_element');
    await previewInput.click();
    await previewInput.fill("Final Check");
    await expect(previewInput).toHaveCSS("color", "rgb(2, 78, 255)"); // #024eff
  });
});
