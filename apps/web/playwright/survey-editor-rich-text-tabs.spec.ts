import { type Page, expect } from "@playwright/test";
import { type Fixtures, test } from "./lib/fixtures";
import { createSurveyFromScratch } from "./utils/helper";

/**
 * Tab behavior of the survey editor's rich text editor (ENG-1747).
 *
 * Regression: Tab always moved focus out of the Lexical editor, so nested lists
 * could not be created. The fix (ListTabIndentationPlugin) makes Tab indent and
 * Shift+Tab outdent only while the caret is inside a list item. Outside list
 * items Tab must keep its default behavior and move focus out of the editor —
 * a deliberate a11y requirement (no keyboard trap).
 *
 * Both scenarios use the welcome card panel, which renders two rich text
 * editors: "Note*" (headline) and "Welcome message" (description).
 */

const openWelcomeCardPanel = async (page: Page): Promise<void> => {
  await expect(page.locator("#welcome-toggle")).toBeVisible();
  await page.getByText("Welcome Card").click();
  await page.locator("#welcome-toggle").check();
  await expect(page.locator('label:has-text("Welcome message")')).toBeVisible();

  // Enabling the card remounts the live preview's card, which focuses its first
  // control (the welcome card's "Next" button) once it re-renders. Wait for that
  // one-time focus steal to complete, otherwise it lands mid-typing and both
  // drops characters and breaks focus assertions. Stacked off-screen preview
  // cards render dummy buttons with tabindex="-1"; the real one is tabbable.
  const previewNext = page
    .locator("#formbricks-survey-container")
    .getByRole("button", { name: "Next", exact: true })
    .and(page.locator('[tabindex="0"]'));
  await expect(previewNext).toBeFocused({ timeout: 15000 });
};

/**
 * Same label -> container walk as fillRichTextEditor (utils/helper.ts); the
 * container also holds the editor's toolbar, whose icon buttons expose their
 * translated tooltip text as the accessible name ("Bulleted list" is
 * workspace.surveys.edit.bulleted_list in en-US.json).
 */
const editorField = (page: Page, labelText: string) => {
  const container = page.locator(`label:has-text("${labelText}")`).locator("..").locator("..");
  return {
    input: container.locator(".editor-input").first(),
    bulletListButton: container.getByRole("button", { name: "Bulleted list", exact: true }),
  };
};

const gotoFreshSurveyEditorWelcomeCard = async (page: Page, users: Fixtures["users"]): Promise<void> => {
  const user = await users.create();
  await user.login();
  await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  await createSurveyFromScratch(page);
  await openWelcomeCardPanel(page);
};

const clearEditor = async (input: ReturnType<typeof editorField>["input"]): Promise<void> => {
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.press("Backspace");
};

test.describe("Survey editor rich text editor Tab behavior", () => {
  test("Tab nests a bullet list item and Shift+Tab flattens it back", async ({ page, users }) => {
    await gotoFreshSurveyEditorWelcomeCard(page, users);
    const { input, bulletListButton } = editorField(page, "Welcome message");

    // Turn the cleared editor's block into a bullet list via the toolbar
    // (the markdown "- " shortcut is not registered in this editor).
    await clearEditor(input);
    await bulletListButton.click();
    await expect(input.locator("ul > li")).toHaveCount(1);

    // Two sibling items; the caret ends up at the end of the second item.
    await input.pressSequentially("First item", { delay: 50 });
    await input.press("Enter");
    await input.pressSequentially("Second item", { delay: 50 });
    await expect(input.locator("ul > li")).toHaveCount(2);
    await expect(input.locator("li ul li")).toHaveCount(0);

    // Tab keeps focus in the editor and nests the second item (li > ul > li).
    await input.press("Tab");
    await expect(input).toBeFocused();
    await expect(input.locator("li ul li")).toHaveText("Second item");
    await expect(input.locator("li.fb-editor-nested-listitem")).toBeVisible();

    // Shift+Tab returns it to a single-level list.
    await input.press("Shift+Tab");
    await expect(input).toBeFocused();
    await expect(input.locator("li ul li")).toHaveCount(0);
    await expect(input.locator("ul > li")).toHaveText(["First item", "Second item"]);
  });

  test("Tab in plain text moves focus out of the editor (no keyboard trap)", async ({ page, users }) => {
    await gotoFreshSurveyEditorWelcomeCard(page, users);
    const { input } = editorField(page, "Note*");

    // Caret sits in a plain paragraph, not a list item.
    await clearEditor(input);
    await input.pressSequentially("Plain text", { delay: 50 });
    await expect(input.locator("li")).toHaveCount(0);
    await expect(input).toBeFocused();

    // Tab must not be swallowed by the editor: focus leaves this contenteditable.
    // (It may legitimately land on the page's next tab stop, e.g. another field.)
    await input.press("Tab");
    await expect(input).not.toBeFocused();
    await expect.poll(() => input.evaluate((el) => el.contains(document.activeElement))).toBe(false);
  });
});
