import { type Locator, type Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch, fillRichTextEditor } from "./utils/helper";

/**
 * Reserved fields in recall and logic (ENG-1840).
 *
 * Reserved fields are auto-captured metadata (`url`, `source`, `action`, `language`, …) that every
 * survey can reference without declaring anything. This spec covers the two things that can only be
 * proven in a browser:
 *
 * 1. **The mid-survey availability gate.** Recall and logic evaluate client-side while the respondent
 *    is answering, so the picker must offer only fields the renderer can actually resolve then.
 *    `country` and `durationSeconds` are derived server-side at ingest; offering them would let an
 *    author build copy or a condition that can never resolve. A unit test can assert the filter
 *    function, but only this can assert what an author actually sees.
 * 2. **End-to-end resolution in the rendered survey.** The renderer reads a prebuilt bundle
 *    (`apps/web/public/js/surveys.umd.cjs`), so a recall token resolving correctly in the editor
 *    proves nothing about the running survey. This drives the real link survey.
 */

const editorPanel = (page: Page): Locator => page.getByRole("main");

/** The recall dropdown the `@` trigger opens inside a rich-text editor. */
const recallDropdown = (page: Page): Locator => page.locator("[data-recall-dropdown]");

/**
 * Types `@` into a rich-text editor to open the recall picker. The editor commits the trigger
 * character before the dropdown mounts, so the dropdown is awaited rather than assumed.
 */
const openRecallPicker = async (page: Page, labelText: string): Promise<void> => {
  const label = editorPanel(page).locator(`label:has-text("${labelText}")`);
  const container = label.locator("..").locator("..");
  const editable = container.locator('[contenteditable="true"]').first();

  await editable.click();
  await editable.pressSequentially("@");
  await expect(recallDropdown(page)).toBeVisible({ timeout: 15000 });
};

test.describe("Reserved fields in recall and logic", () => {
  test.setTimeout(1000 * 60 * 5);

  test("the recall picker offers client-available reserved fields and hides server-derived ones", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await createSurveyFromScratch(page);

    await editorPanel(page).getByText("What would you like to know?").first().click();
    await openRecallPicker(page, "Question*");

    const dropdown = recallDropdown(page);

    await test.step("client-available reserved fields are offered", async () => {
      // Labels are title-cased from the catalog entry names by `formatSnakeCaseToTitleCase`.
      await expect(dropdown.getByText("Url", { exact: true })).toBeVisible();
      await expect(dropdown.getByText("Source", { exact: true })).toBeVisible();
      await expect(dropdown.getByText("Language", { exact: true })).toBeVisible();
    });

    await test.step("server-derived reserved fields are absent", async () => {
      // The acceptance criterion this ticket exists to enforce. NOTE: the ticket description lists
      // browser/os/deviceType as available mid-survey — they are not. All three are parsed from the
      // `user-agent` request header by UAParser in the ingest routes, so the renderer cannot know
      // them; the catalog marks them `server` and the picker filters on that.
      for (const serverOnly of ["Country", "Duration Seconds", "Ip Address", "Browser", "Os", "Finished"]) {
        await expect(dropdown.getByText(serverOnly, { exact: true })).toHaveCount(0);
      }
    });
  });

  test("a link survey headline recalling the url renders the real URL mid-survey", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await createSurveyFromScratch(page);

    await test.step("recall the url into the headline", async () => {
      await editorPanel(page).getByText("What would you like to know?").first().click();
      await fillRichTextEditor(page, "Question*", "You came from ");
      await openRecallPicker(page, "Question*");
      await recallDropdown(page).getByText("Url", { exact: true }).click();
      await expect(recallDropdown(page)).toBeHidden();
    });

    const surveyUrl = await test.step("publish as a link survey", async () => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.locator("#howToSendCardTrigger").click();
      await expect(page.locator("#howToSendCardOption-link")).toBeVisible();
      await page.locator("#howToSendCardOption-link").click();

      await page.getByRole("button", { name: "Save as draft", exact: true }).click();
      await expect(page.getByText("Changes saved.")).toBeVisible();

      await Promise.all([
        page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/, { timeout: 120000 }),
        page.getByRole("button", { name: "Publish", exact: true }).click(),
      ]);

      await page.getByLabel("Copy survey link to clipboard").click();
      return (await page.evaluate("navigator.clipboard.readText()")) as string;
    });

    expect(surveyUrl).toBeTruthy();

    await test.step("the running survey resolves the token to its own URL", async () => {
      await page.goto(surveyUrl);

      // `url` is the page the survey runs on, so the headline must echo the link just opened —
      // and must not still contain the raw storage token or fall through to its fallback text.
      const headline = page.getByText(/You came from/);
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText(surveyUrl.split("?")[0]);
      await expect(headline).not.toContainText("#recall:");
    });
  });
});
