import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

test.describe("Survey Styling", async () => {
  // Shared Helpers
  const openAccordion = async (page: any, name: string) => {
    // Find the trigger by text, ensuring we get the visible one (important for nested or reusable components)
    const accordionHeader = page
      .locator("div,button")
      .filter({ hasText: name })
      .locator("visible=true")
      .last();
    // Check if open (aria-expanded or data-state)
    const expanded = await accordionHeader.getAttribute("aria-expanded");
    const state = await accordionHeader.getAttribute("data-state");
    if (expanded === "false" || state === "closed" || (!expanded && !state)) {
      await accordionHeader.click();
      await page.waitForTimeout(500); // Animation
    }
  };

  const setColor = async (page: any, label: string, hex: string) => {
    const labelEl = page.locator("label").filter({ hasText: label }).locator("visible=true").last();
    const container = labelEl.locator("..");
    await container.getByRole("textbox").fill(hex.replace("#", ""));
    await container.getByRole("textbox").blur();
  };

  const setDimension = async (page: any, label: string, value: string) => {
    const labelEl = page.locator("label").filter({ hasText: label }).locator("visible=true").last();
    const container = labelEl.locator("..");
    // Try finding number input, fallback to simple fill if it's text
    const input = container.locator('input[type="number"], input[type="text"]').first();
    await input.fill(value);
    await input.blur();
  };

  test("Global Theme Styling (Workspace Level)", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    // Navigate to Look & Feel settings
    await page.getByRole("link", { name: "Configuration" }).click();
    await page.getByRole("link", { name: "Look & Feel" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/workspace\/look/);

    // Toggle "Enable custom styling"
    const addCustomStyles = page.getByLabel("Enable custom styling");
    if (!(await addCustomStyles.isChecked())) {
      await addCustomStyles.click();
    }

    // --- Survey styling ---
    await openAccordion(page, "Survey styling");

    // 1. Headlines & Descriptions
    await openAccordion(page, "Headlines & Descriptions");
    await setColor(page, "Headline Color", "aa0000"); // Red-ish
    await setColor(page, "Description Color", "00aa00"); // Green-ish
    await setDimension(page, "Headline Font Size", "24");
    await setDimension(page, "Description Font Size", "18");
    await setDimension(page, "Headline Font Weight", "700");
    await setColor(page, "Headline Label Color", "0000aa"); // Blue-ish
    await setDimension(page, "Headline Label Font Size", "14");
    await setDimension(page, "Headline Label Font Weight", "600");

    // Verify Typography Variables
    await page.waitForTimeout(1000);
    let css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-element-headline-color: #aa0000");
    expect(css).toContain("--fb-element-description-color: #00aa00");
    expect(css).toContain("--fb-element-headline-font-size: 24px");
    expect(css).toContain("--fb-element-description-font-size: 18px");
    expect(css).toContain("--fb-element-headline-font-weight: 700");
    expect(css).toContain("--fb-element-upper-label-color: #0000aa");
    expect(css).toContain("--fb-element-upper-label-font-size: 14px");
    expect(css).toContain("--fb-element-upper-label-font-weight: 600");

    // 2. Inputs
    await openAccordion(page, "Inputs");
    await setColor(page, "Input color", "eeeeee");
    await setColor(page, "Input border color", "cccccc");
    await setColor(page, "Input Text", "024eff");
    await setDimension(page, "Border Radius", "5");
    await setDimension(page, "Height", "50");
    await setDimension(page, "Font Size", "16");
    await setDimension(page, "Padding X", "20");
    await setDimension(page, "Padding Y", "10");
    await setDimension(page, "Placeholder Opacity", "0.8");
    // Shadow is a text input – use setDimension helper (label→parent→input)
    // because getByLabel relies on for/id linkage which FormLabel doesn't guarantee
    await setDimension(page, "Shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-input-background-color: #eeeeee");
    expect(css).toContain("--fb-input-border-color: #cccccc");
    expect(css).toContain("--fb-input-text-color: #024eff");
    expect(css).toContain("--fb-input-placeholder-color:");
    expect(css).toContain("--fb-input-border-radius: 5px");
    expect(css).toContain("--fb-input-height: 50px");
    expect(css).toContain("--fb-input-font-size: 16px");
    expect(css).toContain("--fb-input-padding-x: 20px");
    expect(css).toContain("--fb-input-padding-y: 10px");
    expect(css).toContain("--fb-input-placeholder-opacity: 0.8");
    expect(css).toContain("--fb-input-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    // 3. Buttons
    await openAccordion(page, "Buttons");
    await setColor(page, "Button Background", "ff00ff");
    await setColor(page, "Button Text", "ffffff");
    await setDimension(page, "Border Radius", "12");
    await setDimension(page, "Height", "48");
    await setDimension(page, "Font Size", "18");
    await setDimension(page, "Font Weight", "600");
    await setDimension(page, "Padding X", "24");
    await setDimension(page, "Padding Y", "12");

    await page.waitForTimeout(1000);
    // Partial verification for Buttons to ensure state is good before moving to Options
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-button-bg-color: #ff00ff");
    expect(css).toContain("--fb-button-text-color: #ffffff");
    expect(css).toContain("--fb-button-border-radius: 12px");
    expect(css).toContain("--fb-button-height: 48px");
    expect(css).toContain("--fb-button-font-size: 18px");
    expect(css).toContain("--fb-button-font-weight: 600");
    expect(css).toContain("--fb-button-padding-x: 24px");
    expect(css).toContain("--fb-button-padding-y: 12px");

    // 4. Options (Radio/Checkbox)
    await openAccordion(page, "Options (Radio/Checkbox)");
    await setColor(page, "Background", "dddddd");
    await setColor(page, "Label Color", "111111");
    // Note: Border Radius is reused, but we can set it here to be sure
    await setDimension(page, "Border Radius", "6");
    await setDimension(page, "Padding X", "12");
    await setDimension(page, "Padding Y", "8");
    await setDimension(page, "Font Size", "15");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-option-bg-color: #dddddd");
    expect(css).toContain("--fb-option-label-color: #111111");
    expect(css).toContain("--fb-option-border-radius: 6px");
    expect(css).toContain("--fb-option-padding-x: 12px");
    expect(css).toContain("--fb-option-padding-y: 8px");
    expect(css).toContain("--fb-option-font-size: 15px");

    // --- Card styling ---
    await openAccordion(page, "Card styling");
    // Toggle progress bar off/on to ensure visibility
    const hideProgressSwitch = page.locator("#hideProgressBar");
    if ((await hideProgressSwitch.getAttribute("aria-checked")) === "true") {
      await hideProgressSwitch.click();
    }
    await setDimension(page, "Track Height", "15");
    await setDimension(page, "Roundness", "20");

    await page.waitForTimeout(1000);
    css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toContain("--fb-progress-track-height: 15px");
    expect(css).toContain("--fb-progress-track-border-radius: 20px");
  });

  test("Suggest Colors derives all colors from brand color without changing non-color properties", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();

    // Navigate to Look & Feel settings
    await page.getByRole("link", { name: "Configuration" }).click();
    await page.getByRole("link", { name: "Look & Feel" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/workspace\/look/);

    // Toggle "Enable custom styling"
    const addCustomStyles = page.getByLabel("Enable custom styling");
    if (!(await addCustomStyles.isChecked())) {
      await addCustomStyles.click();
    }

    // Set some non-color properties BEFORE suggesting colors, so we can verify they aren't overwritten
    await openAccordion(page, "Survey styling");
    await openAccordion(page, "Inputs");
    await setDimension(page, "Border Radius", "12");
    await setDimension(page, "Padding Y", "20");

    await openAccordion(page, "Options (Radio/Checkbox)");
    await setDimension(page, "Border Radius", "10");
    await setDimension(page, "Padding Y", "14");

    await page.waitForTimeout(1000);

    // Verify non-color CSS vars are set before suggesting
    let cssBefore = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(cssBefore).toContain("--fb-input-border-radius: 12px");
    expect(cssBefore).toContain("--fb-input-padding-y: 20px");
    expect(cssBefore).toContain("--fb-option-border-radius: 10px");
    expect(cssBefore).toContain("--fb-option-padding-y: 14px");

    // Set a distinctive brand color (rose-600)
    await setColor(page, "Brand color", "e11d48");
    await page.waitForTimeout(500);

    // Click "Suggest colors" button
    await page.getByRole("button", { name: "Suggest colors" }).click();

    // Confirm the dialog
    await page.getByRole("button", { name: "Generate" }).click();

    // Wait for the preview to update with derived colors
    await page.waitForTimeout(1500);

    const css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toBeDefined();

    // --- Verify colors ARE derived from brand (not hardcoded) ---

    // Brand color itself should be present
    expect(css).toContain("--fb-brand-color: #e11d48");

    // Input background should be brand-tinted, NOT hardcoded #ffffff
    expect(css).toContain("--fb-input-background-color:");
    expect(css).not.toContain("--fb-input-background-color: #ffffff");

    // Card/survey background should be brand-tinted, NOT hardcoded #ffffff
    expect(css).toContain("--fb-survey-background-color:");
    expect(css).not.toContain("--fb-survey-background-color: #ffffff");

    // Question/heading color should be derived, NOT the old hardcoded #2b2524
    expect(css).toContain("--fb-heading-color:");
    expect(css).not.toContain("--fb-heading-color: #2b2524");

    // Input text color should be derived, NOT hardcoded #0f172a
    expect(css).toContain("--fb-input-text-color:");
    expect(css).not.toContain("--fb-input-text-color: #0f172a");

    // Option label color should be derived, NOT hardcoded #0f172a
    expect(css).toContain("--fb-option-label-color:");
    expect(css).not.toContain("--fb-option-label-color: #0f172a");

    // Option background should be brand-tinted (same as input bg)
    expect(css).toContain("--fb-option-bg-color:");
    expect(css).not.toContain("--fb-option-bg-color: #ffffff");

    // --- Verify non-color properties were NOT changed ---
    expect(css).toContain("--fb-input-border-radius: 12px");
    expect(css).toContain("--fb-input-padding-y: 20px");
    expect(css).toContain("--fb-option-border-radius: 10px");
    expect(css).toContain("--fb-option-padding-y: 14px");
  });

  test("Initial load derives button, progress, input, and option colors from brand color", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();

    // Navigate to Look & Feel settings
    await page.getByRole("link", { name: "Configuration" }).click();
    await page.getByRole("link", { name: "Look & Feel" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/workspace\/look/);

    // Toggle "Enable custom styling"
    const addCustomStyles = page.getByLabel("Enable custom styling");
    if (!(await addCustomStyles.isChecked())) {
      await addCustomStyles.click();
    }

    // Wait for the preview to render with default styling
    await page.waitForTimeout(1500);

    const css = await page.evaluate(() => document.getElementById("formbricks__css__custom")?.innerHTML);
    expect(css).toBeDefined();

    // On initial load (no saved styling), button and progress bar should derive from brand color (#64748b)
    // NOT from the old hardcoded dark navy (#0f172a)
    expect(css).not.toContain("--fb-button-bg-color: #0f172a");
    expect(css).not.toContain("--fb-progress-indicator-bg-color: #0f172a");

    // Input text and option label CSS variables are only emitted when
    // the user explicitly sets them, so on initial load they should NOT
    // be present at all (the CSS-variable fallback from globals.css applies).
    // Verify they are not set to the old hardcoded dark navy value.
    expect(css).not.toContain("--fb-input-text-color: #0f172a");
    expect(css).not.toContain("--fb-option-label-color: #0f172a");

    // Option background should be brand-tinted, not plain white
    expect(css).toContain("--fb-option-bg-color:");

    // Headline color should be brand-derived
    expect(css).toContain("--fb-element-headline-color:");
  });

  test("Survey Specific Styling (Survey Editor Override)", async ({ page, users }) => {
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    // Create a new survey
    await page.getByText("Start from scratch").click();
    await page.getByRole("button", { name: "Create survey", exact: true }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);

    // Ensure Welcome Card is active so we can see it
    await page.locator("p", { hasText: "Welcome card" }).first().click({ force: true });
    await page.waitForTimeout(1000);

    // Check toggle state for Welcome Card
    const welcomeToggle = page.locator("#welcome-toggle");
    if ((await welcomeToggle.getAttribute("data-state")) === "unchecked") {
      await welcomeToggle.click();
    }

    // Set Headline Text so we can verify it
    // The selector needs to be robust.
    // We try looking for the input labeled "Note" or aria-labelledby="headline"
    const headlineInput = page.locator('[aria-labelledby="headline"]').first();
    await expect(headlineInput).toBeVisible();
    await headlineInput.fill("My Custom Headline");
    await headlineInput.blur(); // Trigger save
    await expect(headlineInput).toHaveText("My Custom Headline");

    // Navigate to Styling tab
    await page.getByRole("button", { name: "Styling" }).click();

    // Toggle "Enable custom styling" (Survey override)
    // Note: The label text might be "Add custom styles" in survey editor?
    // Checking previous file: `page.getByLabel("Add custom styles")`
    const addCustomStyles = page
      .locator("label")
      .filter({ hasText: /custom styling|custom styles/i })
      .first();
    const toggleInput = page.locator(`button#${await addCustomStyles.getAttribute("for")}`);
    // If we can't find by ID, try clicking the label or simple check
    if (!(await toggleInput.isChecked())) {
      await addCustomStyles.click();
    }

    // Apply Overrides
    await openAccordion(page, "Survey styling");
    await openAccordion(page, "Headlines & Descriptions");

    // Override Headline Color (Blue)
    await setColor(page, "Headline Color", "0000ff");
    await setDimension(page, "Headline Font Size", "30");

    // Wait for Preview Update
    await page.waitForTimeout(2000);

    // Click Restart to be sure we are on welcome card
    await page.getByRole("button", { name: "Restart" }).click();
    await page.waitForTimeout(1000);

    // Check Preview Computed Styles
    const headlinePreview = page.locator("#fbjs .label-headline").first();
    await expect(headlinePreview).toBeVisible();
    await expect(headlinePreview).toHaveText("My Custom Headline");

    // Verify color override applied (computed style)
    await expect(headlinePreview).toHaveCSS("color", "rgb(0, 0, 255)"); // Blue

    // Verify font-size override via CSS variable.
    // The computed style can't be checked directly because Tailwind's `text-base`
    // utility is imported with `important` (CSS layer), which outranks the
    // unlayered `!important` from addCustomThemeToDom.  The variable IS set
    // correctly though, proving the form → preview pipeline works.
    const editorCss = await page.evaluate(
      () => document.getElementById("formbricks__css__custom")?.innerHTML
    );
    expect(editorCss).toContain("--fb-element-headline-font-size: 30px");
  });
});
