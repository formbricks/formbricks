import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
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

const QUESTION_HEADLINE = "What would you like to know?";

/** Deliberately un-URL-like, so "the fallback rendered" and "a URL leaked" can never be confused. */
const FALLBACK_MARKER = "FALLBACK-HIT";

const editorPanel = (page: Page): Locator => page.getByRole("main");

/** The recall dropdown the `@` trigger opens inside a rich-text editor. */
const recallDropdown = (page: Page): Locator => page.locator("[data-recall-dropdown]");

/**
 * Expands the first question's card if it is collapsed.
 *
 * The editor activates the first element of the first block on mount, so the card is already open
 * on arrival — clicking its headline would COLLAPSE it and take the rich-text editor with it. Open
 * it only when the editor is not already there, the same idempotent shape `createSurveyFromScratch`
 * and the embedded-fields spec use. The heading is matched by role because the headline text also
 * appears inside the editor's own content, which is what made a plain text match ambiguous.
 */
const openQuestionCard = async (page: Page): Promise<void> => {
  const questionLabel = editorPanel(page).locator('label:has-text("Question*")');

  await expect(async () => {
    if (!(await questionLabel.isVisible().catch(() => false))) {
      await editorPanel(page).getByRole("heading", { name: QUESTION_HEADLINE }).click();
    }
    await expect(questionLabel).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });
};

/**
 * Types `@` into a rich-text editor to open the recall picker. The editor commits the trigger
 * character before the dropdown mounts, so the dropdown is awaited rather than assumed.
 *
 * The caret is moved to the end first: a click lands it wherever the pointer happened to fall, which
 * on non-empty content splices the recall token into the middle of a word.
 */
const openRecallPicker = async (page: Page, labelText: string): Promise<void> => {
  const label = editorPanel(page).locator(`label:has-text("${labelText}")`);
  const container = label.locator("..").locator("..");
  const editable = container.locator('[contenteditable="true"]').first();

  await editable.click();
  await editable.press("End");
  await editable.pressSequentially("@");
  await expect(recallDropdown(page)).toBeVisible({ timeout: 15000 });
};

/**
 * Picks a reserved field out of the recall dropdown and gives it a fallback.
 *
 * The fallback is not optional housekeeping: the editor refuses to publish a survey whose recall
 * token has an empty fallback ("Fallback missing"), and the fallback is the *expected output* of the
 * declared-field test below, so it has to be something unmistakable.
 */
const recallReservedFieldWithFallback = async (
  page: Page,
  reservedLabel: string,
  fallback: string
): Promise<void> => {
  await openRecallPicker(page, "Question*");
  await recallDropdown(page).getByText(reservedLabel, { exact: true }).click();
  await expect(recallDropdown(page)).toBeHidden();

  const fallbackInput = page.getByPlaceholder("Enter fallback value");
  await expect(fallbackInput).toBeVisible();
  await fallbackInput.fill(fallback);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(fallbackInput).toBeHidden();
};

/** Switches the draft to a link survey, publishes it, and returns the public URL. */
const publishAsLinkSurvey = async (page: Page): Promise<string> => {
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

    await openQuestionCard(page);
    await openRecallPicker(page, "Question*");

    const dropdown = recallDropdown(page);

    await test.step("client-available reserved fields are offered", async () => {
      // Labels are title-cased from the catalog entry names by `formatFieldNameToTitleCase`, which
      // splits camelCase as well as snake_case. Every client-available Group A entry happens to be a
      // single word, so the split only shows here once ENG-1841's `utmSource`/`pagePath` land; it is
      // load-bearing for the absence assertions below.
      await expect(dropdown.getByText("Url", { exact: true })).toBeVisible();
      await expect(dropdown.getByText("Source", { exact: true })).toBeVisible();
      await expect(dropdown.getByText("Language", { exact: true })).toBeVisible();
    });

    await test.step("server-derived reserved fields are absent", async () => {
      // The acceptance criterion this ticket exists to enforce. NOTE: the ticket description lists
      // browser/os/deviceType as available mid-survey — they are not. All three are parsed from the
      // `user-agent` request header by UAParser in the ingest routes, so the renderer cannot know
      // them; the catalog marks them `server` and the picker filters on that.
      // These are the labels the picker would actually render for these entries — before
      // `formatFieldNameToTitleCase` they rendered as "DurationSeconds"/"IpAddress", so searching for
      // the spaced forms passed no matter what the availability filter did.
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
      await openQuestionCard(page);
      // Appends to the headline rather than replacing it: `fillRichTextEditor` clears with `Meta+A`,
      // which selects nothing on Linux/Chromium where CI runs. What matters here is that the recall
      // token that follows resolves, not what precedes it.
      await fillRichTextEditor(page, "Question*", "You came from ");
      // Picking a recall item opens the fallback popover, and its Save button stays disabled until a
      // fallback is entered. Skipping it leaves the survey unpublishable ("Fallback missing").
      await recallReservedFieldWithFallback(page, "Url", "somewhere");
    });

    const surveyUrl = await test.step("publish as a link survey", () => publishAsLinkSurvey(page));

    expect(surveyUrl).toBeTruthy();

    await test.step("the running survey resolves the token to its own URL", async () => {
      await page.goto(surveyUrl);

      // `url` is the page the survey runs on, so the headline must echo the link just opened —
      // and must not still contain the raw storage token or fall through to its fallback text.
      // The resolved value renders as a text node beside the typed copy, so the assertions sit on
      // the paragraph holding the whole headline rather than on the inner element a text matcher
      // would return, which carries only the typed half.
      const headline = editorPanel(page).locator("p").filter({ hasText: "You came from" }).first();
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText(surveyUrl.split("?")[0]);
      await expect(headline).not.toContainText("#recall:");
    });
  });

  test("a survey DECLARING `url` renders the author's fallback when the field is empty", async ({
    page,
    users,
  }) => {
    // ENG-2538, bug 1 — the one this whole spec exists to keep fixed, and the only place it is
    // provable. `mergeReservedValues` is a spread, and a spread only wins for keys that EXIST: an
    // optional hidden field the respondent never filled overwrote nothing, so the reserved page URL
    // survived into the headline. On a seeded fixture this rendered
    // `url=http://localhost:3000/workspaces/<ws>/surveys/<id>/edit` where the author had written a
    // fallback.
    //
    // Not a preview artefact: a respondent opening `/s/<id>` without the param takes the same path.
    // Supplying the param is what makes it look correct, which is why the happy-path test above
    // misses it — and why this test opens the link BOTH ways.
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    await createSurveyFromScratch(page);

    await test.step("recall the url with an unmistakable fallback", async () => {
      await openQuestionCard(page);
      await fillRichTextEditor(page, "Question*", "url=");
      await recallReservedFieldWithFallback(page, "Url", FALLBACK_MARKER);
    });

    const surveyUrl = await test.step("publish as a link survey", () => publishAsLinkSurvey(page));
    expect(surveyUrl).toBeTruthy();

    const surveyId = await test.step("declare a hidden field named `url`", async () => {
      const id = /\/surveys\/([^/]+)\//.exec(page.url())?.[1];
      expect(id, "the summary URL should carry the survey id").toBeTruthy();

      const survey = await prisma.survey.findUniqueOrThrow({
        where: { id },
        select: { workspaceId: true },
      });

      // Written directly rather than through the editor because ENG-1839's guard refuses to CREATE a
      // declared field named `url` — which is the point: the 195 surveys in production that already
      // declare it are grandfathered, and they are exactly who this bug hurt. The rows are what the
      // renderer reads (`getSurveyEmbeddedFields`), inlined onto the survey at load.
      const field = await prisma.embeddedData.create({
        data: {
          name: "url",
          source: "ingested",
          dataType: "string",
          workspaceId: survey.workspaceId,
          surveyId: id,
        },
      });
      await prisma.surveyEmbeddedData.create({
        data: {
          storageKey: "url",
          order: 0,
          surveyId: id!,
          workspaceId: survey.workspaceId,
          embeddedDataId: field.id,
        },
      });
      // The legacy column too, so the survey is in the state a real grandfathered survey is in and
      // nothing downstream can read it as undeclared.
      await prisma.survey.update({
        where: { id },
        data: { hiddenFields: { enabled: true, fieldIds: ["url"] } },
      });

      return id!;
    });

    await test.step("WITHOUT the param, the headline shows the fallback and never a URL", async () => {
      await page.goto(surveyUrl);

      const headline = editorPanel(page).locator("p").filter({ hasText: "url=" }).first();
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText(`url=${FALLBACK_MARKER}`);
      // The regression itself, asserted on the shape of the leaked value rather than on one URL:
      // the reserved read is the page's own address, so any scheme reaching this headline is the bug.
      await expect(headline).not.toContainText("http");
      await expect(headline).not.toContainText("#recall:");
    });

    await test.step("WITH the param, the respondent's value wins — the grandfather rule", async () => {
      await page.goto(`${surveyUrl}?url=SUPPLIED-BY-RESPONDENT`);

      const headline = editorPanel(page).locator("p").filter({ hasText: "url=" }).first();
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText("url=SUPPLIED-BY-RESPONDENT");
      await expect(headline).not.toContainText(FALLBACK_MARKER);
    });

    expect(surveyId).toBeTruthy();
  });
});
