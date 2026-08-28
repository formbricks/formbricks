/**
 * Captures the screenshots that ship in `docs/`.
 *
 * Not a test: nothing here asserts, and it must stay out of the PR gate. It lives in `scripts/`
 * rather than under `apps/web/playwright/` for a second reason — `apps/web/tsconfig.json` includes
 * `**\/*.ts`, so anything under the app is typechecked by the Next build, and a dev script that
 * fails to compile takes the whole build down with it. Run it by hand against a local instance when
 * a release changes what the product looks like.
 *
 * Why a script rather than driving a browser by hand: 200-odd images only read as one set if every
 * one shares a viewport, a theme and a workspace, and the set is worth nothing in eighteen months
 * unless it can be regenerated. Both of those are properties of a script, not of a person clicking.
 *
 *   1. `pnpm --filter @formbricks/database db:seed`       (admin user)
 *   2. `pnpm --filter @formbricks/database db:seed:docs`  (the ACME Inc. workspace)
 *   3. `pnpm dev`
 *   4. `pnpm tsx scripts/docs-capture/capture.ts [name ...]`
 *
 * With no arguments it captures everything registered in `shots`. With arguments it captures only
 * the named shots, which is the loop you want while iterating on one page.
 */
import { type Browser, type Locator, type Page, chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DOCS_IMAGES = resolve(REPO_ROOT, "docs/images");

const BASE_URL = process.env.DOCS_CAPTURE_URL ?? "http://localhost:3000";

/** Generated wordmark for the fictional bank, used by the logo-upload shots. */
const LOGO_FILE = process.env.DOCS_CAPTURE_LOGO ?? "";

/** Must match `SEED_CREDENTIALS.ADMIN` in `packages/database/src/seed/constants.ts`. */
const LOGIN = { email: "admin@formbricks.com", password: "Password#123" };

/** Must match `DOCS_IDS` in `packages/database/src/scripts/seed-docs-fixtures.ts`. */
const ACME = {
  workspaceId: "cldocsacmeworkspace000001",
  surveyAllElements: "cldocsallelements00000001",
  // An app survey. Visibility & Recontact and the targeting controls do not exist for link surveys.
  surveyApp: "cldocsappsurvey000000001",
  // Two link surveys that exist only to be photographed from the respondent's side: the PIN screen
  // and the email gate come before the survey and cannot be shown from the editor.
  surveyPin: "cldocspinsurvey000000001",
  surveyVerifyEmail: "cldocsverifyemail00000001",
  organizationId: "cldocsacmeorg00000000001",
};

/**
 * One viewport for every shot. The three current screenshots in the docs are 1920x1200, 1027x666 and
 * 2420x1400 — three sizes for three images, which is part of why the set never looked like a set.
 *
 * deviceScaleFactor 2 because these are read on retina displays; at 1x the UI text in a downscaled
 * screenshot goes soft, which is the single most common way a docs image looks amateurish.
 */
const VIEWPORT = { width: 1920, height: 1200 };
const DEVICE_SCALE_FACTOR = 2;

interface Shot {
  /** Selects this shot on the command line, and names nothing else. */
  name: string;
  /** Path under `docs/images/`, extension included. */
  out: string;
  /**
   * Drives the app to the moment worth photographing, then says what to capture:
   * a Locator (Playwright measures the element itself — prefer this), an explicit clip box for the
   * cases where the interesting region spans more than one element, or nothing for the full page.
   */
  take: (
    page: Page
  ) => Promise<Locator | { clip: { x: number; y: number; width: number; height: number } } | void>;
}

/** The element the editor expands on load — see `openElementCard`. First in the fixture's order. */
const AUTO_EXPANDED_ELEMENT_ID = "acme-openText";

const editorUrl = (surveyId: string): string =>
  `${BASE_URL}/workspaces/${ACME.workspaceId}/surveys/${surveyId}/edit`;

const summaryUrl = (surveyId: string): string =>
  `${BASE_URL}/workspaces/${ACME.workspaceId}/surveys/${surveyId}/summary`;
const responsesUrl = (surveyId: string): string =>
  `${BASE_URL}/workspaces/${ACME.workspaceId}/surveys/${surveyId}/responses`;

/**
 * Waits for the editor to stop moving. The block list mounts, then re-renders once the survey
 * resolves; screenshotting between the two catches a half-drawn card.
 */
const settleEditor = async (page: Page): Promise<void> => {
  await page.waitForSelector("text=Questions", { timeout: 30_000 });
  // Wait on a concrete node rather than `networkidle`. The preview pane renders the survey, and a
  // CTA element pointing at an external URL keeps requests in flight indefinitely, so networkidle
  // never arrives and the whole shot times out — which is exactly how `statement-cta` failed.
  // Wait for any element card, not a specific id: the app survey has different element ids from the
  // link survey, and keying on one made every app-survey shot time out here.
  await page.locator(".scroll-mt-16").first().waitFor({ state: "visible", timeout: 60_000 });
};

/**
 * Opens one element's card in the editor and returns it, with every other card collapsed.
 *
 * The editor auto-expands the first element on load, so a card shot taken without collapsing it
 * catches two cards open — which reads as a mistake rather than a choice. Elements are addressed by
 * the fixed ids the fixture assigns (`acme-<type>`), so this never depends on question order or on
 * matching headline text that the copy might later change.
 */
const openElementCard = async (page: Page, elementId: string) => {
  // The element id is NOT unique on this page: the live preview pane renders the same survey, so
  // every element id appears twice — once on the editor card, once inside the preview. `.scroll-mt-16`
  // is the editor card wrapper and is what disambiguates them. Matching the bare id would sometimes
  // photograph the preview instead of the card, which is the wrong picture for a question-type page.
  //
  // Attribute selector rather than `#id` because `CSS.escape` is a browser API, unavailable here.
  const cardOf = (id: string) => page.locator(`[id="${id}"].scroll-mt-16`);
  // `.cursor-pointer` picks the clickable summary row out of the other Radix nodes in a card that
  // also carry `data-state`.
  const headerOf = (id: string) => cardOf(id).locator("[data-state].cursor-pointer").first();

  // The editor always mounts with the first element expanded. Collapse that one by id rather than
  // sweeping every `[data-state="open"]` node: clicking mutates the set mid-iteration, so a sweep
  // races itself and the later indices go stale.
  if (elementId !== AUTO_EXPANDED_ELEMENT_ID) {
    const first = headerOf(AUTO_EXPANDED_ELEMENT_ID);
    if ((await first.getAttribute("data-state")) === "open") {
      await first.click();
      await page.waitForTimeout(200);
    }
  }

  const card = cardOf(elementId);
  await card.waitFor({ state: "visible", timeout: 30_000 });

  const header = headerOf(elementId);
  if ((await header.getAttribute("data-state")) === "closed") {
    await header.click();
  }

  await card.scrollIntoViewIfNeeded();
  // The card grows as it expands; screenshotting mid-transition clips it short.
  await page.waitForTimeout(400);
  return card;
};

/**
 * Opens the survey editor's Settings tab and expands one of its collapsible sections.
 *
 * Five separate docs pages document a single toggle inside Response Options — response limits, spam
 * protection, the back button, email verification and the PIN — so they all reach the app the same
 * way and differ only in which row they photograph.
 */
const openSettingsSection = async (
  page: Page,
  section: string,
  probe?: string,
  surveyId: string = ACME.surveyAllElements
): Promise<void> => {
  await page.goto(editorUrl(surveyId));
  await settleEditor(page);
  await page.getByText("Settings", { exact: true }).first().click();
  await page.waitForTimeout(1500);

  const header = page.getByText(section, { exact: true }).first();
  await header.waitFor({ state: "visible", timeout: 30_000 });

  // Only click if the section is actually shut. Response Options is expanded on load, so an
  // unconditional click closes it — and every row inside then times out looking for itself.
  if (probe) {
    const alreadyOpen = await page
      .getByText(probe, { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (alreadyOpen) return;
  }
  await header.click();
  // The section animates open; clipping mid-transition cuts the panel short.
  await page.waitForTimeout(1200);
};

/**
 * Opens the survey's response table and scrolls until a named column is on screen.
 *
 * Scrolling to a column rather than a pixel offset: the table is very wide (answers, then hidden
 * fields, then metadata) and any fixed offset lands somewhere different the moment a column is added.
 */
const responseTableAtColumn = async (page: Page, column: string): Promise<void> => {
  await page.goto(responsesUrl(ACME.surveyAllElements));
  await page.waitForSelector("text=Response ID", { timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.getByText(column, { exact: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
};

/**
 * A collapsible section on the editor's Questions tab (Hidden Fields, Variables, the welcome and
 * ending cards), expanded and ready to photograph.
 *
 * These sit below the block list and are collapsed on load, unlike Response Options which is open.
 */
const openQuestionsSection = async (page: Page, label: string): Promise<Locator> => {
  await page.goto(editorUrl(ACME.surveyAllElements));
  await settleEditor(page);

  const heading = page.getByText(label, { exact: true }).first();
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const trigger = heading.locator("xpath=ancestor::div[@data-state][1]");
  if ((await trigger.getAttribute("data-state")) === "closed") {
    await heading.click();
    await page.waitForTimeout(1400);
  }
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // The parent again: the expanded body is the trigger's sibling, so returning the trigger alone
  // photographs a bare heading with nothing under it.
  return trigger.locator("xpath=..");
};

/**
 * Turns a setting on and returns its row, ready to photograph.
 *
 * Captured switched ON deliberately. A toggle in its default-off state shows nothing the reader came
 * for — the spam-protection page is about the reCAPTCHA threshold, which does not exist until the
 * toggle is on. The editor has auto-save disabled, so nothing here persists.
 */
const enabledSettingRow = async (page: Page, label: string): Promise<Locator> => {
  const row = page.getByText(label, { exact: true }).first();
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // The switch sits beside the label, not inside it; go up to the row and take its switch.
  const toggle = row
    .locator("xpath=ancestor::div[.//button[@role='switch']][1]")
    .locator("button[role='switch']")
    .first();
  if ((await toggle.getAttribute("aria-checked")) === "false") {
    await toggle.click();
    await page.waitForTimeout(1500);
  }

  // The parent, not the row: the panel a toggle reveals is the row's *sibling*, so the row's own
  // container excludes it entirely.
  return row.locator("xpath=ancestor::div[.//button[@role='switch']][1]/..");
};

/**
 * The survey editor on one of its top-level tabs.
 */
const openEditorTab = async (page: Page, tab: string): Promise<void> => {
  await page.goto(editorUrl(ACME.surveyAllElements));
  await settleEditor(page);
  await page.getByText(tab, { exact: true }).first().click();
  await page.waitForTimeout(3500);
};

/**
 * Question 1's card with its media panel open, on the Image or the Video tab.
 *
 * The button that opens it is an icon with no accessible name, sitting to the right of the headline
 * field, so it is found by position rather than by text.
 */
const openMediaPanel = async (page: Page, tab: "Image" | "Video"): Promise<Locator> => {
  await page.goto(editorUrl(ACME.surveyAllElements));
  await settleEditor(page);

  const card = page.locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const field = await card.locator("[contenteditable='true']").first().boundingBox();
  const buttons = card.locator("button");
  for (let i = 0; i < (await buttons.count()); i++) {
    const box = await buttons.nth(i).boundingBox();
    if (box && field && box.x > field.x + field.width - 20 && Math.abs(box.y - field.y) < 60) {
      await buttons.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(2000);

  if (tab === "Video") {
    await card.getByText("Video", { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  return card;
};

/**
 * A respondent-facing gate, cropped to the card rather than the page.
 *
 * These screens are a small dialog centred in an otherwise empty viewport, so a full-page shot is
 * mostly white. The clip is built around the anchor text with a fixed margin — there is no wrapper
 * element with sensible bounds to photograph instead.
 */
const gateClip = async (page: Page, anchor: string, width = 1000, height = 420, topMargin = 120) => {
  const box = await page.getByText(anchor, { exact: false }).first().boundingBox();
  if (!box) return undefined;
  const cx = box.x + box.width / 2;
  const x = Math.max(0, Math.min(cx - width / 2, VIEWPORT.width - width));
  const y = Math.max(0, box.y - topMargin);
  return { clip: { x, y, width, height: Math.min(height, VIEWPORT.height - y) } };
};

/**
 * The survey's Share dialog, on one of its panels.
 *
 * Every way of distributing a link survey now lives in this one dialog — anonymous links, personal
 * links, the embeds, and the three share settings. The pages this serves used to photograph screens
 * that were scattered across the app.
 */
const openShareDialog = async (page: Page, panel?: string): Promise<Locator> => {
  await page.goto(summaryUrl(ACME.surveyAllElements));
  await page.waitForSelector("text=Summary", { timeout: 90_000 });
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: /share/i }).first().click();
  await page.waitForTimeout(3000);

  const dialog = page.locator("[role='dialog']").last();
  if (panel) {
    await dialog.getByText(panel, { exact: true }).first().click();
    await page.waitForTimeout(2200);
  }
  return dialog;
};

/**
 * The segment editor, open on its Settings tab where the targeting filters live.
 *
 * The dialog opens on Activity (counts and ids); Settings is the tab the targeting page is about.
 */
const openSegmentSettings = async (page: Page): Promise<Locator> => {
  await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/segments`);
  await page.waitForTimeout(6000);
  await page.getByText("Premium account holders", { exact: true }).first().click();
  await page.waitForTimeout(3500);

  const dialog = page.locator("[role='dialog']").last();
  await dialog.getByText("Settings", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  return dialog;
};

/**
 * The "Track New User Action" dialog, open on one of its two tabs.
 *
 * One dialog covers what used to be five screenshots: the five no-code types are a single row of
 * buttons inside it, so photographing the dialog once shows the whole set rather than one type per
 * picture.
 */
const openAddActionDialog = async (page: Page, tab: "No code" | "Code"): Promise<Locator> => {
  await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/user-actions`);
  await page.waitForSelector("text=User Actions", { timeout: 90_000 });
  await page.waitForTimeout(3000);
  await page
    .getByRole("button", { name: /add action/i })
    .first()
    .click();
  await page.waitForTimeout(2000);

  const dialog = page.locator("[role='dialog']").last();
  if (tab === "Code") {
    await dialog.getByText("Code", { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  return dialog;
};

/**
 * Question 2's card with `@` typed at the end of its headline, which opens the recall menu.
 *
 * Question 2 and not question 1: there is nothing before the first question to recall, so the menu
 * never opens there. The headline is a rich-text editor, so the caret has to be placed in it before
 * the keystroke lands.
 */
const openRecallMenu = async (page: Page): Promise<Locator> => {
  await page.goto(editorUrl(ACME.surveyAllElements));
  await settleEditor(page);

  const collapse = page
    .locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`)
    .locator("[data-state].cursor-pointer")
    .first();
  if ((await collapse.getAttribute("data-state")) === "open") {
    await collapse.click();
    await page.waitForTimeout(300);
  }

  const card = page.locator('[id="acme-multipleChoiceSingle"].scroll-mt-16');
  await card.locator("[data-state].cursor-pointer").first().click();
  await page.waitForTimeout(1200);

  const headline = card.locator("[contenteditable='true']").first();
  await headline.click();
  await headline.press("End");
  await page.keyboard.type(" @");
  await page.waitForTimeout(1500);
  // Typing moves the caret and the editor pane scrolls with it, which leaves the card off screen.
  // Scroll back before anything tries to click inside the menu: Playwright needs a click point in
  // the viewport even with `force`, and the menu follows its anchor.
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  return card;
};

/**
 * Unions several elements' boxes with the menu that is currently open.
 *
 * Radix renders menus in a portal at the end of `<body>`, so they are never inside the element that
 * anchors them and an element screenshot would show the trigger with nothing attached to it.
 */
const withMenuClip = async (page: Page, anchors: Locator[], widthFrom?: Locator, padding = 14) => {
  const boxes = (await Promise.all(anchors.map((a) => a.boundingBox()))).filter(Boolean) as {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  const menu = await page.locator("[data-radix-popper-content-wrapper]").last().boundingBox();
  if (menu) boxes.push(menu);
  if (boxes.length === 0) return undefined;

  // `widthFrom` sets the sides without dragging the top and bottom with it, so a clip can span a
  // whole card horizontally while still starting below its header.
  const side = widthFrom ? await widthFrom.boundingBox() : null;
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x), side ? side.x : Infinity) - padding);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - padding);
  const right = Math.max(...boxes.map((b) => b.x + b.width), side ? side.x + side.width : 0) + padding;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + padding;
  return {
    clip: { x, y, width: Math.min(right, VIEWPORT.width) - x, height: Math.min(bottom, VIEWPORT.height) - y },
  };
};

/**
 * The editor with a block's Conditional Logic panel on screen, one rule added and filled in.
 *
 * Logic is a property of a *block* now, not of a question: there is exactly one `Add logic` button
 * per block and it sits at the foot of the block card, under the question list. The 2024
 * screenshots this replaces show a per-question logic editor that no longer exists.
 *
 * A second block is added first so `Jump to block` has somewhere to jump to — with one block the
 * target select is empty, which is the one thing a reader most needs to see filled in. The block is
 * added in the editor and never saved (auto-save is off), so the fixture keeps its single block.
 */
const blockLogicEditor = async (page: Page, addRule: boolean): Promise<void> => {
  await page.goto(editorUrl(ACME.surveyAllElements));
  await settleEditor(page);

  // The editor mounts with the first question expanded, which pushes the logic panel down past the
  // fold and makes every clip below taller than it needs to be.
  const firstCard = page
    .locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`)
    .locator("[data-state].cursor-pointer")
    .first();
  if ((await firstCard.getAttribute("data-state")) === "open") {
    await firstCard.click();
    await page.waitForTimeout(300);
  }

  await page.getByText("Add Block", { exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText("Free text", { exact: true }).first().click();
  await page.waitForTimeout(1800);

  if (addRule) {
    await page.getByText("Add logic", { exact: true }).first().click();
    await page.waitForTimeout(1400);
    await fillExampleRule(page);
  }
};

/**
 * The first block's only logic rule, as a container.
 *
 * Anchored on the `Then` label, which is unique on the page: the second block has no rule, so it
 * contributes no `Then`. Scoping matters — the option texts inside these selects are the question
 * headlines, which also appear in the block's question list above, and an unscoped `getByText` for
 * one of them clicks the question card instead of the select.
 *
 * The rule holds six selects in document order: the condition's question, operator and value, then
 * the action, the action's target, and the fallback ("all other answers will continue to ...").
 * They are addressed by index because only two of them carry stable visible text.
 */
const logicRule = (page: Page): Locator =>
  page.getByText("Then", { exact: true }).first().locator("xpath=ancestor::div[2]");

const ruleSelects = (page: Page): Locator => logicRule(page).locator("[role='combobox']");

const SELECT = { question: 0, operator: 1, value: 2, action: 3, actionTarget: 4 } as const;

/** Picks an option out of the menu the last click opened. */
const pickOption = async (page: Page, label: string): Promise<void> => {
  await page
    .locator("[data-radix-popper-content-wrapper]")
    .last()
    .getByText(label, { exact: true })
    .first()
    .click();
  await page.waitForTimeout(1000);
};

/**
 * Fills the freshly-added rule with a realistic example.
 *
 * An empty rule is three placeholder selects, which shows the reader nothing about what a condition
 * is made of — the thing the page is about. The example routes people who opened a savings account
 * to a different block, which is the shape a reader is most likely to want first.
 */
const fillExampleRule = async (page: Page): Promise<void> => {
  const selects = ruleSelects(page);

  // Swap the default (question 1, free text) for the single-select, so the value control offers a
  // list of choices rather than an empty text box.
  await selects.nth(SELECT.question).click();
  await page.waitForTimeout(800);
  await pickOption(page, "Which account did you open?");

  await selects.nth(SELECT.value).click();
  await page.waitForTimeout(800);
  await pickOption(page, "High-Yield Savings");

  // `Jump to block` is already the default action; it just has no target yet.
  await selects.nth(SELECT.actionTarget).click();
  await page.waitForTimeout(800);
  await pickOption(page, "Block 2");
};

/**
 * The clip covering one block's whole Conditional Logic panel, optionally unioned with a dropdown.
 *
 * Measured from two text anchors rather than from a container element: the panel's own wrapper also
 * holds the block's question list, so photographing it would put sixteen collapsed questions above
 * the subject. `Conditional Logic` is matched loosely because the heading grows a count badge as
 * soon as a rule exists.
 *
 * Radix renders a select's menu in a portal at the end of `<body>`, so an element screenshot of the
 * panel alone would show a closed select. `withMenu` unions the two boxes instead.
 */
const logicPanelClip = async (page: Page, withMenu = false) => {
  const head = page.getByText("Conditional Logic", { exact: false }).first();
  await head.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const top = await head.boundingBox();
  const foot = await page.getByText("Add logic", { exact: true }).first().boundingBox();
  if (!top || !foot) return undefined;

  let x = top.x - 20;
  let y = top.y - 16;
  let right = x + 1220;
  let bottom = foot.y + foot.height + 16;

  if (withMenu) {
    const menu = await page.locator("[data-radix-popper-content-wrapper]").last().boundingBox();
    if (menu) {
      x = Math.min(x, menu.x - 8);
      y = Math.min(y, menu.y - 8);
      right = Math.max(right, menu.x + menu.width + 8);
      bottom = Math.max(bottom, menu.y + menu.height + 8);
    }
  }

  x = Math.max(0, x);
  y = Math.max(0, y);
  return {
    clip: {
      x,
      y,
      width: Math.min(right, VIEWPORT.width) - x,
      height: Math.min(bottom, VIEWPORT.height) - y,
    },
  };
};

/**
 * The 15 question-type pages, keyed to the element ids in the fixture.
 *
 * `thank-you-card` is not here — it was re-shot on 2026-08-12 and is already current.
 * `select-picture` is not here either; it needs uploaded images before it can be captured (ENG-2650).
 */
const QUESTION_TYPE_PAGES: { page: string; elementId: string }[] = [
  { page: "csat", elementId: "acme-csat" },
  { page: "ces", elementId: "acme-ces" },
  { page: "free-text", elementId: "acme-openText" },
  { page: "select-single", elementId: "acme-multipleChoiceSingle" },
  { page: "select-multiple", elementId: "acme-multipleChoiceMulti" },
  { page: "net-promoter-score", elementId: "acme-nps" },
  { page: "rating", elementId: "acme-rating" },
  { page: "ranking", elementId: "acme-ranking" },
  { page: "matrix", elementId: "acme-matrix" },
  { page: "date", elementId: "acme-date" },
  { page: "file-upload", elementId: "acme-fileUpload" },
  { page: "schedule-a-meeting", elementId: "acme-cal" },
  { page: "consent", elementId: "acme-consent" },
  { page: "contact-info", elementId: "acme-contactInfo" },
  { page: "address", elementId: "acme-address" },
  { page: "statement-cta", elementId: "acme-cta" },
];

/**
 * Milestone 3, group 1: five pages whose subject is one row of Settings -> Response Options.
 * `nextLabel` is the row below, used to bound the clip.
 */
const RESPONSE_OPTION_PAGES: { page: string; label: string; nextLabel: string }[] = [
  {
    page: "surveys/general-features/limit-submissions",
    label: "Close survey on response limit",
    nextLabel: "Spam protection",
  },
  {
    page: "surveys/general-features/spam-protection",
    label: "Spam protection",
    nextLabel: "Adjust “Survey Closed” message",
  },
  {
    page: "surveys/link-surveys/verify-email-before-survey",
    label: "Verify email before submission",
    nextLabel: "Protect survey with a PIN",
  },
  {
    page: "surveys/link-surveys/pin-protected-surveys",
    label: "Protect survey with a PIN",
    nextLabel: "Auto-progress rating and NPS questions",
  },
  {
    page: "surveys/general-features/hide-back-button",
    label: "Hide “Back” button",
    nextLabel: "Capture IP address",
  },
];

const shots: Shot[] = [
  {
    name: "platform/features/styling-theme/logo-uploaded",
    out: "platform/features/styling-theme/logo-uploaded.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/look`);
      await page.waitForSelector("text=Click or drag to upload files.", { timeout: 90_000 });
      await page.waitForTimeout(3000);
      // The logo upload steps cannot be shown from an empty dropzone, so upload one first. The file
      // is a generated wordmark for the fictional bank, not any real company's mark.
      await page.locator('input[type="file"]').first().setInputFiles(LOGO_FILE);
      // Wait for the upload to finish, not just to start: at 9s the logo was still fading in behind
      // a spinner, which reads as a rendering glitch rather than an uploaded logo.
      await page
        .waitForFunction(() => !document.querySelector('[class*="animate-spin"]'), undefined, {
          timeout: 60_000,
        })
        .catch(() => undefined);
      await page.waitForTimeout(4000);

      // Save, then reload. Without saving, the workspace's logo stays null and the preview box
      // renders empty — which looks like a broken image rather than an uploaded logo.
      const logoCard = page
        .getByText("Logo", { exact: true })
        .first()
        .locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
      await logoCard.getByRole("button", { name: /^Save$/ }).click();
      await page.waitForTimeout(5000);
      await page.reload();
      await page.waitForSelector("text=Replace Logo", { timeout: 90_000 });
      await page.waitForTimeout(4000);

      const h = page.getByText("Logo", { exact: true }).first();
      await h.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      return h.locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    },
  },
  {
    name: "platform/features/styling-theme/overwrite",
    out: "platform/features/styling-theme/enable-custom-styling.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/look`);
      await page.waitForSelector("text=Enable custom styling", { timeout: 90_000 });
      await page.waitForTimeout(3000);
      const row = page.getByText("Enable custom styling", { exact: true }).first();
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      return row.locator("xpath=ancestor::div[.//button[@role='switch']][1]");
    },
  },
  {
    name: "platform/features/styling-theme/logo",
    out: "platform/features/styling-theme/logo.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/look`);
      await page.waitForSelector("text=Logo", { timeout: 90_000 });
      await page.waitForTimeout(3500);
      const h = page.getByText("Logo", { exact: true }).first();
      await h.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      return h.locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    },
  },
  {
    name: "surveys/website-app-surveys/show-survey-to-percent-of-users",
    out: "surveys/website-app-surveys/show-survey-to-percent-of-users/display-settings.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Survey Display Settings", undefined, ACME.surveyApp);
      // The row, switched on, rather than the whole section: the page is about this one setting, and
      // the percentage control only exists once the toggle is on.
      return enabledSettingRow(page, "Show survey to % of users");
    },
  },
  {
    name: "surveys/website-app-surveys/recontact",
    out: "surveys/website-app-surveys/recontact/visibility-and-recontact.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Visibility & Recontact", "Recontact options", ACME.surveyApp);
      const heading = page.getByText("Visibility & Recontact", { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      return heading.locator("xpath=ancestor::div[@data-state][1]/..");
    },
  },
  {
    name: "surveys/analysis/responses",
    out: "surveys/analysis/responses.webp",
    take: async (page: Page) => {
      await page.goto(responsesUrl(ACME.surveyAllElements));
      await page.waitForSelector("text=Response ID", { timeout: 90_000 });
      await page.waitForTimeout(3500);
      return undefined;
    },
  },
  {
    name: "surveys/analysis/summary",
    out: "surveys/analysis/summary.webp",
    take: async (page: Page) => {
      await page.goto(summaryUrl(ACME.surveyAllElements));
      await page.waitForSelector("text=Summary", { timeout: 90_000 });
      await page.waitForTimeout(6000);
      return undefined;
    },
  },
  {
    name: "platform/features/contacts/list",
    out: "platform/features/contacts/contacts-list.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/contacts`);
      await page.waitForTimeout(8000);
      return undefined;
    },
  },
  {
    name: "platform/features/contacts/attributes",
    out: "platform/features/contacts/attribute-keys.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/attributes`);
      await page.waitForTimeout(8000);
      return undefined;
    },
  },
  {
    name: "platform/features/contacts/segments",
    out: "platform/features/contacts/segments.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/segments`);
      await page.waitForTimeout(8000);
      return undefined;
    },
  },
  {
    name: "surveys/general-features/survey-scheduling",
    out: "surveys/general-features/survey-scheduling/publish-and-close.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Response Options", "Publish survey on date");
      // Both dates together: they are one feature and adjacent rows, so two images would just be
      // the same panel photographed twice.
      const first = await enabledSettingRow(page, "Publish survey on date");
      const second = await enabledSettingRow(page, "Close survey on date");
      const a = await first.boundingBox();
      const b = await second.boundingBox();
      if (!a || !b) return first;
      return { clip: { x: a.x - 10, y: a.y, width: a.width + 20, height: b.y + b.height - a.y + 10 } };
    },
  },
  {
    name: "surveys/website-app-surveys/cooldown-period",
    out: "surveys/website-app-surveys/cooldown-period/workspace-setting.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/general`);
      await page.waitForTimeout(6000);
      // The label is "Cooldown Period (across surveys)"; "Recontact Waiting Time" is pre-Formbricks-5.
      const heading = page.getByText("Cooldown Period", { exact: false }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      return heading.locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    },
  },
  {
    name: "platform/features/user-management/two-factor-auth",
    out: "platform/features/user-management/two-factor-auth/setup.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/account/settings/profile`);
      await page.waitForTimeout(6000);
      const heading = page.getByText("Two-Factor Authentication", { exact: false }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      return heading.locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    },
  },
  {
    name: "surveys/general-features/tags",
    out: "surveys/general-features/tags/manager.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/tags`);
      await page.waitForSelector("text=Manage Tags", { timeout: 90_000 });
      await page.waitForTimeout(2500);
      // The settings shell has no <main>; take the card that holds the table instead.
      return page
        .getByText("Manage Tags", { exact: true })
        .first()
        .locator("xpath=ancestor::div[.//table][1]");
    },
  },
  {
    name: "surveys/general-features/quota-management",
    out: "surveys/general-features/quota-management/quotas.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Quotas");
      const heading = page.getByText("Quotas", { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      return heading.locator("xpath=ancestor::div[@data-state][1]/..");
    },
  },
  {
    name: "surveys/general-features/hidden-fields-responses",
    out: "surveys/general-features/hidden-fields/responses.webp",
    take: async (page: Page) => {
      // Viewport, not the table element: 52 rows exceeds WebP's dimension cap, and the reader only
      // needs to see that the columns are there.
      await responseTableAtColumn(page, "plan_tier");
      return undefined;
    },
  },
  {
    name: "platform/features/styling-theme",
    out: "platform/features/styling-theme/appearance.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/look`);
      await page.waitForTimeout(7000);
      return undefined;
    },
  },
  {
    name: "surveys/general-features/hidden-fields",
    out: "surveys/general-features/hidden-fields/editor.webp",
    take: (page: Page) => openQuestionsSection(page, "Hidden fields"),
  },
  {
    name: "surveys/general-features/variables",
    out: "surveys/general-features/variables/editor.webp",
    take: (page: Page) => openQuestionsSection(page, "Variables"),
  },
  {
    name: "surveys/general-features/partial-submissions",
    out: "surveys/general-features/partial-submissions/drop-offs.webp",
    take: async (page: Page) => {
      await page.goto(summaryUrl(ACME.surveyAllElements));
      await page.waitForSelector("text=Drop-Offs", { timeout: 90_000 });
      await page.waitForTimeout(4000);
      // Drop-offs is a stat card that expands, not the "Analyze Drop-Offs" toggle the page still
      // describes. Expand it so the per-question breakdown is what gets photographed.
      const card = page
        .getByText("Drop-Offs", { exact: true })
        .first()
        .locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
      await card
        .locator("button, [role='button']")
        .first()
        .click()
        .catch(() => undefined);
      await page.waitForTimeout(2000);
      return undefined;
    },
  },
  {
    name: "surveys/general-features/metadata",
    out: "surveys/general-features/metadata/response-metadata.webp",
    take: async (page: Page) => {
      await responseTableAtColumn(page, "Source");
      return undefined;
    },
  },
  {
    name: "platform/features/user-management/members",
    out: "platform/features/user-management/organizations-and-roles/members.webp",
    take: async (page: Page) => {
      // Members live on the Teams page, not on General — the same screen holds both cards.
      await page.goto(`${BASE_URL}/organizations/${ACME.organizationId}/settings/teams`);
      await page.waitForSelector("text=Manage members", { timeout: 90_000 });
      await page.waitForTimeout(3000);
      return page
        .getByText("Manage members", { exact: true })
        .first()
        .locator("xpath=ancestor::div[.//table][1]");
    },
  },
  {
    name: "platform/features/user-management/org-teams",
    out: "platform/features/user-management/teams-and-roles/teams.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/organizations/${ACME.organizationId}/settings/teams`);
      await page.waitForSelector("text=Create new team", { timeout: 90_000 });
      await page.waitForTimeout(3000);
      const card = page
        .getByText("Assign members into teams and give teams access to workspaces.", { exact: true })
        .first()
        .locator("xpath=ancestor::div[.//table][1]");
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      return card;
    },
  },
  {
    name: "platform/features/user-management/workspace-access",
    out: "platform/features/user-management/teams-and-roles/workspace-access.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/teams`);
      await page.waitForSelector("text=See which teams can access this workspace.", { timeout: 90_000 });
      await page.waitForTimeout(2500);
      return page
        .getByText("See which teams can access this workspace.", { exact: true })
        .first()
        .locator("xpath=ancestor::div[.//table][1]");
    },
  },
  {
    name: "surveys/general-features/overwrite-styling/tab",
    out: "surveys/general-features/overwrite-styling/styling-tab.webp",
    take: async (page: Page) => {
      await openEditorTab(page, "Styling");
      return undefined;
    },
  },
  {
    name: "surveys/general-features/overwrite-styling/on",
    out: "surveys/general-features/overwrite-styling/custom-styles.webp",
    take: async (page: Page) => {
      await openEditorTab(page, "Styling");
      // Off, the four sections below are greyed out and nothing can be opened; the page is about
      // what you do after switching it on.
      const row = await enabledSettingRow(page, "Add custom styles");
      await page.getByText("Survey styling", { exact: true }).first().click();
      await page.waitForTimeout(1800);
      void row;
      return undefined;
    },
  },
  {
    name: "surveys/general-features/email-followups/tab",
    out: "surveys/general-features/email-followups/followups-tab.webp",
    take: async (page: Page) => {
      await openEditorTab(page, "Follow-ups");
      return undefined;
    },
  },
  {
    name: "surveys/general-features/email-followups/new",
    out: "surveys/general-features/email-followups/new-followup.webp",
    take: async (page: Page) => {
      await openEditorTab(page, "Follow-ups");
      await page.getByText("New follow-up", { exact: true }).first().click();
      await page.waitForTimeout(3000);
      return page.locator("[role='dialog']").last();
    },
  },
  {
    name: "surveys/general-features/add-image-or-video/image",
    out: "surveys/general-features/add-image-or-video-question/media-panel.webp",
    take: (page: Page) => openMediaPanel(page, "Image"),
  },
  {
    name: "surveys/general-features/add-image-or-video/video",
    out: "surveys/general-features/add-image-or-video-question/media-video.webp",
    take: (page: Page) => openMediaPanel(page, "Video"),
  },
  {
    name: "surveys/general-features/validation-rules",
    out: "surveys/general-features/validation-rules/editor.webp",
    take: async (page: Page) => {
      await page.goto(editorUrl(ACME.surveyAllElements));
      await settleEditor(page);
      const card = page.locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await card.getByText("Validation rules", { exact: true }).first().click();
      await page.waitForTimeout(1500);
      // A rule with a real number in it. The row defaults to "At least 0 characters", which is a
      // rule that rejects nothing and reads like a placeholder.
      const value = card.locator("input[type='number'], input").last();
      await value.fill("20").catch(() => undefined);
      await page.waitForTimeout(600);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      return card;
    },
  },
  {
    name: "surveys/link-surveys/data-prefilling",
    out: "surveys/link-surveys/data-prefilling/question-id.webp",
    take: async (page: Page) => {
      await page.goto(editorUrl(ACME.surveyAllElements));
      await settleEditor(page);
      const card = page.locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`);
      await card.getByText("Show Question settings", { exact: false }).first().click();
      await page.waitForTimeout(1500);
      const label = card.getByText("Question ID", { exact: true }).first();
      await label.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      const a = await label.boundingBox();
      const c = await card.boundingBox();
      if (!a || !c) return card;
      // The Question ID row alone. The card above it is the free-text editor, which this page is
      // not about, and photographing all of it buries the one field a reader came for.
      const y = Math.max(0, a.y - 56);
      return { clip: { x: c.x, y, width: c.width, height: Math.min(150, VIEWPORT.height - y) } };
    },
  },
  {
    name: "surveys/link-surveys/pin-prompt",
    out: "surveys/link-surveys/pin-protected-surveys/pin-prompt.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/s/${ACME.surveyPin}`);
      await page.waitForTimeout(6000);
      // No card behind this one — text and four boxes on white — so the crop has to be tight or the
      // image is mostly nothing.
      return gateClip(page, "This survey is protected", 760, 220, 50);
    },
  },
  {
    name: "surveys/link-surveys/email-gate",
    out: "surveys/link-surveys/verify-email-before-survey/email-gate.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/s/${ACME.surveyVerifyEmail}`);
      await page.waitForTimeout(6000);
      return gateClip(page, "Verify your email", 1000, 470, 200);
    },
  },
  {
    name: "surveys/link-surveys/link-settings",
    out: "surveys/link-surveys/link-settings/link-settings.webp",
    take: (page: Page) => openShareDialog(page, "Link settings"),
  },
  {
    name: "surveys/link-surveys/pretty-url",
    out: "surveys/link-surveys/pretty-url/custom-slug.webp",
    take: (page: Page) => openShareDialog(page, "Pretty URL"),
  },
  {
    name: "surveys/link-surveys/personal-links",
    out: "surveys/link-surveys/personal-links/generate.webp",
    take: (page: Page) => openShareDialog(page, "Personal links"),
  },
  {
    name: "surveys/link-surveys/single-use-links",
    out: "surveys/link-surveys/single-use-links/single-use-links.webp",
    take: async (page: Page) => {
      const dialog = await openShareDialog(page, "Anonymous links");
      // Switched on: off, the row is one sentence and shows none of the options the page describes.
      const toggle = dialog
        .getByText("Single-use links", { exact: true })
        .first()
        .locator("xpath=ancestor::div[.//button[@role='switch']][1]")
        .locator("button[role='switch']")
        .first();
      if ((await toggle.getAttribute("aria-checked")) === "false") {
        await toggle.click();
        await page.waitForTimeout(1500);
        // Switching single-use on turns the multi-use link off, which the app asks about first.
        // Without confirming, the panel never changes and `.last()` photographs the confirmation.
        await page
          .getByRole("button", { name: "Disable multi-use link" })
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(2500);
      }
      return page.locator("[role='dialog']").first();
    },
  },
  {
    name: "surveys/website-app-surveys/targeting/segments",
    out: "surveys/website-app-surveys/targeting/segments-list.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/segments`);
      await page.waitForTimeout(7000);
      return undefined;
    },
  },
  {
    name: "surveys/website-app-surveys/targeting/segment-editor",
    out: "surveys/website-app-surveys/targeting/segment-editor.webp",
    take: (page: Page) => openSegmentSettings(page),
  },
  {
    name: "surveys/website-app-surveys/targeting/add-filter",
    out: "surveys/website-app-surveys/targeting/add-filter.webp",
    take: async (page: Page) => {
      const dialog = await openSegmentSettings(page);
      await dialog.getByText("Add filter", { exact: false }).first().click();
      await page.waitForTimeout(2000);
      // This one dialog is what used to be three screenshots: attributes, segments and devices are
      // its tabs, and survey interaction sits in the same list.
      return page.locator("[role='dialog']").last();
    },
  },
  {
    name: "surveys/website-app-surveys/targeting/survey-type",
    out: "surveys/website-app-surveys/targeting/survey-type.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Survey Type", "Website & App survey", ACME.surveyApp);
      const heading = page.getByText("Survey Type", { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      return heading.locator("xpath=ancestor::div[@data-state][1]/..");
    },
  },
  {
    name: "surveys/website-app-surveys/targeting/target-audience",
    out: "surveys/website-app-surveys/targeting/target-audience.webp",
    take: async (page: Page) => {
      await openSettingsSection(page, "Target Audience", undefined, ACME.surveyApp);
      const heading = page.getByText("Target Audience", { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      return heading.locator("xpath=ancestor::div[@data-state][1]/..");
    },
  },
  {
    name: "surveys/website-app-surveys/actions/list",
    out: "surveys/website-app-surveys/actions/user-actions.webp",
    take: async (page: Page) => {
      await page.goto(`${BASE_URL}/workspaces/${ACME.workspaceId}/settings/workspace/user-actions`);
      await page.waitForSelector("text=User Actions", { timeout: 90_000 });
      await page.waitForTimeout(3500);
      return page
        .getByText("Actions", { exact: true })
        .first()
        .locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    },
  },
  {
    name: "surveys/website-app-surveys/actions/add-no-code",
    out: "surveys/website-app-surveys/actions/add-action.webp",
    take: (page: Page) => openAddActionDialog(page, "No code"),
  },
  {
    name: "surveys/website-app-surveys/actions/add-code",
    out: "surveys/website-app-surveys/actions/code-action.webp",
    take: (page: Page) => openAddActionDialog(page, "Code"),
  },
  {
    name: "surveys/website-app-surveys/actions/trigger",
    out: "surveys/website-app-surveys/actions/survey-trigger.webp",
    take: async (page: Page) => {
      await openSettingsSection(
        page,
        "Survey Trigger",
        "Trigger survey when one of the actions is fired…",
        ACME.surveyApp
      );
      // With no action attached the section is one empty button, which is the wrong picture for a
      // page about wiring a survey to an action. Nothing is saved — auto-save is off.
      await page
        .getByRole("button", { name: /^Add action$/ })
        .first()
        .click();
      await page.waitForTimeout(1500);
      await page
        .locator("[data-radix-popper-content-wrapper], [role='dialog']")
        .last()
        .getByText("Viewed the mortgage calculator", { exact: true })
        .first()
        .click();
      await page.waitForTimeout(1500);
      const heading = page.getByText("Survey Trigger", { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      return heading.locator("xpath=ancestor::div[@data-state][1]/..");
    },
  },
  {
    name: "surveys/general-features/recall/menu",
    out: "surveys/general-features/recall/recall-menu.webp",
    take: async (page: Page) => {
      const card = await openRecallMenu(page);
      // The headline field and its label, not the whole card: the rest of a card is the question's
      // own settings, which this page is not about, and editing a survey that already has responses
      // raises a "changes may lead to inconsistencies" banner above the field — a warning triangle
      // in a screenshot about recall reads as a warning about recall.
      return withMenuClip(
        page,
        [
          card.getByText("Question*", { exact: true }).first(),
          card.locator("[contenteditable='true']").first(),
        ],
        card
      );
    },
  },
  {
    name: "surveys/general-features/recall/fallback",
    out: "surveys/general-features/recall/fallback.webp",
    take: async (page: Page) => {
      const card = await openRecallMenu(page);
      await page
        .locator("[data-radix-popper-content-wrapper]")
        .last()
        .getByText("What made", { exact: false })
        .first()
        .click();
      await page.waitForTimeout(1800);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      return withMenuClip(
        page,
        [
          card.getByText("Question*", { exact: true }).first(),
          card.locator("[contenteditable='true']").first(),
        ],
        card
      );
    },
  },
  {
    name: "surveys/general-features/conditional-logic/add-logic",
    out: "surveys/general-features/conditional-logic/add-logic.webp",
    take: async (page: Page) => {
      await blockLogicEditor(page, false);
      // The foot of the block card, not the panel alone: an empty Conditional Logic section is a
      // heading and a button, and on its own it says nothing about where in the editor to find it.
      const top = page.getByText("Add question to block", { exact: true }).first();
      await top.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const a = await top.boundingBox();
      const b = await page.getByText("Show Block settings", { exact: true }).first().boundingBox();
      // x from the heading, not from the button: `boundingBox` on a button returns its label's box,
      // which is inset by the padding, and clipping to that shears the text off the left edge.
      const left = await page.getByText("Conditional Logic", { exact: false }).first().boundingBox();
      if (!a || !b || !left) return undefined;
      const x = Math.max(0, left.x - 20);
      const y = Math.max(0, a.y - 28);
      return {
        clip: {
          x,
          y,
          width: Math.min(x + 1220, VIEWPORT.width) - x,
          height: Math.min(b.y + b.height + 28, VIEWPORT.height) - y,
        },
      };
    },
  },
  {
    name: "surveys/general-features/conditional-logic/rule",
    out: "surveys/general-features/conditional-logic/logic-rule.webp",
    take: async (page: Page) => {
      await blockLogicEditor(page, true);
      return logicPanelClip(page);
    },
  },
  {
    name: "surveys/general-features/conditional-logic/operators",
    out: "surveys/general-features/conditional-logic/condition-operators.webp",
    take: async (page: Page) => {
      await blockLogicEditor(page, true);
      await logicPanelClip(page);
      await ruleSelects(page).nth(SELECT.operator).click();
      await page.waitForTimeout(900);
      return logicPanelClip(page, true);
    },
  },
  {
    name: "surveys/general-features/conditional-logic/actions",
    out: "surveys/general-features/conditional-logic/action-options.webp",
    take: async (page: Page) => {
      await blockLogicEditor(page, true);
      await logicPanelClip(page);
      await ruleSelects(page).nth(SELECT.action).click();
      await page.waitForTimeout(900);
      return logicPanelClip(page, true);
    },
  },
  ...RESPONSE_OPTION_PAGES.map(({ page: docsPage, label }) => ({
    name: docsPage,
    out: `${docsPage.replace("surveys/", "surveys/")}/response-option.webp`,
    take: async (page: Page) => {
      await openSettingsSection(page, "Response Options", label);
      return enabledSettingRow(page, label);
    },
  })),

  ...QUESTION_TYPE_PAGES.map(({ page: docsPage, elementId }) => ({
    name: `question-type/${docsPage}`,
    // New home for these images. The originals live under the legacy
    // `images/xm-and-surveys/core-features/question-type/` tree, which ENG-2662 retires.
    out: `surveys/question-type/${docsPage}/editor.webp`,
    take: async (page: Page) => {
      await page.goto(editorUrl(ACME.surveyAllElements));
      await settleEditor(page);
      const card = await openElementCard(page, elementId);
      const box = await card.boundingBox();
      return box ? { clip: box } : undefined;
    },
  })),
];

const login = async (browser: Browser): Promise<string> => {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/auth/login`);
  await page.getByRole("button", { name: /log in with email/i }).click();
  await page.getByPlaceholder("work@email.com").fill(LOGIN.email);
  await page.locator('input[type="password"]').fill(LOGIN.password);
  await page.getByRole("button", { name: /log in with email/i }).click();
  await page.waitForURL(/\/workspaces\//, { timeout: 60_000 });

  const statePath = resolve(HERE, ".auth.json");
  await page.context().storageState({ path: statePath });
  await page.close();
  return statePath;
};

const main = async (): Promise<void> => {
  const wanted = process.argv.slice(2);
  const selected = wanted.length > 0 ? shots.filter((s) => wanted.includes(s.name)) : shots;

  if (selected.length === 0) {
    console.error(`No shots matched. Known: ${shots.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const statePath = await login(browser);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    storageState: statePath,
    colorScheme: "light",
    // The app renders relative timestamps ("2 days ago") and locale-formatted dates. Pinning both
    // keeps a re-run from producing a diff that is nothing but a clock tick.
    locale: "en-US",
    timezoneId: "UTC",
  });

  // The Next.js dev-tools button floats over the bottom-left corner of every page, right on top of
  // the sidebar's account row. It is dev-server chrome, not product UI, and it has no business in a
  // docs screenshot — an init script rather than `addStyleTag` so the rule survives navigation.
  // Passed as source text, not as a function: `tsx` compiles with esbuild's keepNames, which wraps
  // named declarations in a `__name(...)` helper that does not exist in the page, so a function
  // handed to `addInitScript` throws `__name is not defined` before it can do anything.
  await context.addInitScript({
    content: `document.addEventListener("DOMContentLoaded", function () {
      var s = document.createElement("style");
      s.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(s);
    });`,
  });

  // A cold route in the dev server can take well over the 30s default: Next compiles it on first
  // request, and the response table pulls a lot of data.
  context.setDefaultNavigationTimeout(120_000);
  context.setDefaultTimeout(60_000);

  for (const shot of selected) {
    const page = await context.newPage();
    try {
      const result = await shot.take(page);
      const out = resolve(DOCS_IMAGES, shot.out);
      await mkdir(dirname(out), { recursive: true });

      // Capture PNG (lossless, so the encode below starts from a clean source), then re-encode to
      // WebP. The docs are served to every reader: the same 14 shots weigh 1.4 MB as 2x PNG and
      // ~200 KB as WebP, and at quality 90 UI text stays crisp. Every existing docs image is .webp,
      // so this also keeps the tree consistent.
      // A Locator screenshots itself, which is why most shots return one: element bounds beat any
      // arithmetic I can do against a moving layout.
      // Three shapes, narrowed explicitly: a Locator screenshots itself, a clip box bounds a
      // page shot, and nothing means the viewport.
      let png: Buffer;
      if (!result) {
        png = await page.screenshot();
      } else if ("screenshot" in result) {
        png = await result.screenshot();
      } else {
        png = await page.screenshot({ clip: result.clip });
      }
      await sharp(png).webp({ quality: 90 }).toFile(out);

      console.log(`  ✓ ${shot.name} -> docs/images/${shot.out}`);
    } catch (error) {
      console.error(`  ✗ ${shot.name}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();
};

void main();
