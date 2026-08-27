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
import { type Browser, type Page, chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DOCS_IMAGES = resolve(REPO_ROOT, "docs/images");

const BASE_URL = process.env.DOCS_CAPTURE_URL ?? "http://localhost:3000";

/** Must match `SEED_CREDENTIALS.ADMIN` in `packages/database/src/seed/constants.ts`. */
const LOGIN = { email: "admin@formbricks.com", password: "Password#123" };

/** Must match `DOCS_IDS` in `packages/database/src/scripts/seed-docs-fixtures.ts`. */
const ACME = {
  workspaceId: "cldocsacmeworkspace000001",
  surveyAllElements: "cldocsallelements00000001",
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
  /** Drives the app to the moment worth photographing, then returns the region to capture. */
  take: (page: Page) => Promise<{ clip?: { x: number; y: number; width: number; height: number } } | void>;
}

/** The element the editor expands on load — see `openElementCard`. First in the fixture's order. */
const AUTO_EXPANDED_ELEMENT_ID = "acme-openText";

const editorUrl = (surveyId: string): string =>
  `${BASE_URL}/workspaces/${ACME.workspaceId}/surveys/${surveyId}/edit`;

/**
 * Waits for the editor to stop moving. The block list mounts, then re-renders once the survey
 * resolves; screenshotting between the two catches a half-drawn card.
 */
const settleEditor = async (page: Page): Promise<void> => {
  await page.waitForSelector("text=Questions", { timeout: 30_000 });
  // Wait on a concrete node rather than `networkidle`. The preview pane renders the survey, and a
  // CTA element pointing at an external URL keeps requests in flight indefinitely, so networkidle
  // never arrives and the whole shot times out — which is exactly how `statement-cta` failed.
  await page.locator(`[id="${AUTO_EXPANDED_ELEMENT_ID}"].scroll-mt-16`).waitFor({
    state: "visible",
    timeout: 30_000,
  });
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
 * The 15 question-type pages, keyed to the element ids in the fixture.
 *
 * `thank-you-card` is not here — it was re-shot on 2026-08-12 and is already current.
 * `select-picture` is not here either; it needs uploaded images before it can be captured (ENG-2650).
 */
const QUESTION_TYPE_PAGES: { page: string; elementId: string }[] = [
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

const shots: Shot[] = [
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
      const png = await page.screenshot({ clip: result?.clip });
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
