import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page, expect, test } from "@playwright/test";

// Point this at any published survey link. Example:
//   SURVEY_URL="http://localhost:3000/s/abc123" pnpm test:e2e survey-accessibility
const SURVEY_URL = process.env.SURVEY_URL;

// All axe rule sets we want to evaluate — broader than WCAG 2.1 AA so we surface
// best-practice, WCAG 2.2, and experimental issues too.
const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
  "experimental",
  "ACT",
  "section508",
  "EN-301-549",
];
const MAX_STEPS = 30;
const STEP_TIMEOUT_MS = 8000;

type ViolationRow = { card: string; id: string; impact: string; help: string; target: string };

const scan = async (page: Page, label: string, sink: ViolationRow[]) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  if (results.violations.length === 0) {
    console.log(`Scanned "${label}" — clean (0 violations).`);
    return;
  }
  console.log(`\n=== Axe violations on "${label}" ===`);
  for (const v of results.violations) {
    console.log(`[${v.impact}] ${v.id} — ${v.help}`);
    console.log(`  ${v.helpUrl}`);
    for (const node of v.nodes) {
      const target = node.target.join(" ");
      console.log(`  target: ${target}`);
      sink.push({ card: label, id: v.id, impact: v.impact ?? "unknown", help: v.help, target });
    }
  }
};

// Best-effort: answer whatever input is visible so we can advance.
// File uploads and 3rd-party iframes (e.g., Cal.com scheduler) are skipped.
const tryAnswerCurrentCard = async (card: Locator) => {
  try {
    const inputs = card.locator(
      'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'
    );
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible().catch(() => false))) continue;
      const value = await input.inputValue().catch(() => "");
      if (value) continue;
      const type = (await input.getAttribute("type")) ?? "text";
      const fill =
        type === "email"
          ? "test@example.com"
          : type === "number"
            ? "3"
            : type === "tel"
              ? "5551234567"
              : "test";
      await input.fill(fill, { timeout: STEP_TIMEOUT_MS }).catch(() => {});
    }

    // Radios: pick first in each group (covers single-select, rating, NPS, matrix rows)
    const radios = card.locator('input[type="radio"]');
    const radioCount = await radios.count();
    const pickedGroups = new Set<string>();
    for (let i = 0; i < radioCount; i++) {
      const radio = radios.nth(i);
      if (!(await radio.isVisible().catch(() => false))) continue;
      const name = (await radio.getAttribute("name")) ?? `__idx_${i}`;
      if (pickedGroups.has(name)) continue;
      pickedGroups.add(name);
      await radio.check({ force: true, timeout: STEP_TIMEOUT_MS }).catch(() => {});
    }

    // Check every visible checkbox — handles consent (single) + multi-select (multiple)
    const checkboxes = card.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isVisible().catch(() => false))) continue;
      await cb.check({ force: true, timeout: STEP_TIMEOUT_MS }).catch(() => {});
    }

    // Ranking: click each "Add N to ranking" button in order
    const rankingButtons = card.locator('button[aria-label^="Add "]');
    const rankCount = await rankingButtons.count();
    for (let i = 0; i < rankCount; i++) {
      await rankingButtons
        .nth(i)
        .click({ timeout: STEP_TIMEOUT_MS })
        .catch(() => {});
    }

    // Picture select: image choices render as clickable images / labels inside a group
    // Heuristic: any <img> sitting inside a button or label-like wrapper that's not a logo
    const pictureChoices = card.locator(
      'button:has(img):not([aria-label*="Powered"]):not([aria-label*="Scroll"]), label:has(img)'
    );
    const picCount = await pictureChoices.count();
    if (picCount > 0) {
      await pictureChoices
        .first()
        .click({ timeout: STEP_TIMEOUT_MS })
        .catch(() => {});
    }

    // Date / calendar picker: click "Today" if available, else the first enabled day button
    const today = card.getByRole("button", { name: /^Today/ });
    if ((await today.count()) > 0) {
      await today
        .first()
        .click({ timeout: STEP_TIMEOUT_MS })
        .catch(() => {});
    } else {
      const dayButtons = card.getByRole("gridcell").locator("button:not([disabled])");
      if ((await dayButtons.count()) > 0) {
        await dayButtons
          .first()
          .click({ timeout: STEP_TIMEOUT_MS })
          .catch(() => {});
      }
    }
  } catch {
    // best-effort only
  }
};

const walkAndScan = async (page: Page, allViolations: ViolationRow[]) => {
  await page.goto(SURVEY_URL!);
  await page.waitForLoadState("networkidle");
  await page.locator('[id^="questionCard-"]:visible').first().waitFor({ state: "visible", timeout: 15000 });

  let lastCardId = "";
  let stuckCount = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const visibleCard = page.locator('[id^="questionCard-"]:visible').first();
    if (!(await visibleCard.isVisible().catch(() => false))) {
      await scan(page, "end-of-survey state", allViolations);
      break;
    }
    const cardId = (await visibleCard.getAttribute("id")) ?? `step-${step}`;

    if (cardId === lastCardId) {
      stuckCount += 1;
      if (stuckCount >= 2) {
        await scan(page, `${cardId} (stuck/error state)`, allViolations);
        console.log(`Walker can't advance past ${cardId} (likely required field we can't answer). Stopping.`);
        break;
      }
    } else {
      stuckCount = 0;
      await scan(page, cardId, allViolations);
      lastCardId = cardId;
    }

    const finishBtn = visibleCard.getByRole("button", { name: "Finish" });
    const nextBtn = visibleCard.getByRole("button", { name: "Next" });
    const submitBtn = visibleCard.getByRole("button", { name: /^(Submit|Send|Start)$/ });
    const advance =
      (await finishBtn.count()) > 0 ? finishBtn : (await nextBtn.count()) > 0 ? nextBtn : submitBtn;
    if ((await advance.count()) === 0) {
      await scan(page, "end-of-survey state", allViolations);
      break;
    }

    await tryAnswerCurrentCard(visibleCard);
    await advance
      .first()
      .click({ timeout: STEP_TIMEOUT_MS })
      .catch(() => {});
    await page.waitForTimeout(400);
  }
};

const reportAndAssert = (allViolations: ViolationRow[]) => {
  if (allViolations.length > 0) {
    console.log(`\nTotal violations: ${allViolations.length}`);
    console.table(allViolations);
  }
  expect(allViolations, "Accessibility violations found — see console output above").toEqual([]);
};

test.describe("Survey accessibility (axe-core)", () => {
  test.skip(!SURVEY_URL, "Set SURVEY_URL to the published survey link you want to scan.");

  test("desktop: full walk has no axe violations (WCAG 2.1 AA + 2.2 AA + best-practice)", async ({
    page,
  }) => {
    test.setTimeout(1000 * 60 * 3);
    const allViolations: ViolationRow[] = [];
    await walkAndScan(page, allViolations);
    reportAndAssert(allViolations);
  });

  test("desktop: validation error state on first card has no axe violations", async ({ page }) => {
    test.setTimeout(1000 * 60 * 2);
    await page.goto(SURVEY_URL!);
    await page.waitForLoadState("networkidle");
    const firstCard = page.locator('[id^="questionCard-"]:visible').first();
    await firstCard.waitFor({ state: "visible", timeout: 15000 });

    // Click Next without filling anything to trigger required-field error states.
    const allViolations: ViolationRow[] = [];
    const nextBtn = firstCard.getByRole("button", { name: /^(Next|Finish|Submit)$/ });
    if ((await nextBtn.count()) > 0) {
      await nextBtn
        .first()
        .click({ timeout: STEP_TIMEOUT_MS })
        .catch(() => {});
      await page.waitForTimeout(800);
    }
    await scan(page, "first card after empty-submit attempt", allViolations);
    reportAndAssert(allViolations);
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("mobile: full walk has no axe violations", async ({ page }) => {
      test.setTimeout(1000 * 60 * 3);
      const allViolations: ViolationRow[] = [];
      await walkAndScan(page, allViolations);
      reportAndAssert(allViolations);
    });

    test("mobile: validation error state on first card has no axe violations", async ({ page }) => {
      test.setTimeout(1000 * 60 * 2);
      await page.goto(SURVEY_URL!);
      await page.waitForLoadState("networkidle");
      const firstCard = page.locator('[id^="questionCard-"]:visible').first();
      await firstCard.waitFor({ state: "visible", timeout: 15000 });
      const allViolations: ViolationRow[] = [];
      const nextBtn = firstCard.getByRole("button", { name: /^(Next|Finish|Submit)$/ });
      if ((await nextBtn.count()) > 0) {
        await nextBtn
          .first()
          .click({ timeout: STEP_TIMEOUT_MS })
          .catch(() => {});
        await page.waitForTimeout(800);
      }
      await scan(page, "mobile first card after empty-submit attempt", allViolations);
      reportAndAssert(allViolations);
    });
  });

  test.describe("tablet viewport", () => {
    test.use({ viewport: { width: 820, height: 1180 } });

    test("tablet: full walk has no axe violations", async ({ page }) => {
      test.setTimeout(1000 * 60 * 3);
      const allViolations: ViolationRow[] = [];
      await walkAndScan(page, allViolations);
      reportAndAssert(allViolations);
    });
  });

  test("forced-colors (Windows high contrast): full walk has no axe violations", async ({ page }) => {
    test.setTimeout(1000 * 60 * 3);
    await page.emulateMedia({ forcedColors: "active" });
    const allViolations: ViolationRow[] = [];
    await walkAndScan(page, allViolations);
    reportAndAssert(allViolations);
  });

  test("reduced-motion: full walk has no axe violations", async ({ page }) => {
    test.setTimeout(1000 * 60 * 3);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const allViolations: ViolationRow[] = [];
    await walkAndScan(page, allViolations);
    reportAndAssert(allViolations);
  });

  test.describe("dark color scheme", () => {
    test.use({ colorScheme: "dark" });

    test("dark mode: full walk has no axe violations", async ({ page }) => {
      test.setTimeout(1000 * 60 * 3);
      const allViolations: ViolationRow[] = [];
      await walkAndScan(page, allViolations);
      reportAndAssert(allViolations);
    });
  });

  test("back navigation: scan card after going forward then back", async ({ page }) => {
    test.setTimeout(1000 * 60 * 2);
    await page.goto(SURVEY_URL!);
    await page.waitForLoadState("networkidle");
    const firstCard = page.locator('[id^="questionCard-"]:visible').first();
    await firstCard.waitFor({ state: "visible", timeout: 15000 });

    // Answer first card and click Next, then click Back to scan the returned-to state.
    await tryAnswerCurrentCard(firstCard);
    const nextBtn = firstCard.getByRole("button", { name: /^(Next|Finish)$/ });
    if ((await nextBtn.count()) > 0) {
      await nextBtn
        .first()
        .click({ timeout: STEP_TIMEOUT_MS })
        .catch(() => {});
      await page.waitForTimeout(500);
    }
    const backBtn = page.getByRole("button", { name: "Back" }).first();
    if ((await backBtn.count()) > 0) {
      await backBtn.click({ timeout: STEP_TIMEOUT_MS }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const allViolations: ViolationRow[] = [];
    await scan(page, "first card after Next→Back navigation", allViolations);
    reportAndAssert(allViolations);
  });
});
