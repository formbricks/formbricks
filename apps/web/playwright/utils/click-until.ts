import { type Locator, expect } from "@playwright/test";

/**
 * How long one attempt waits for the click to take effect before clicking again. Generous on purpose:
 * re-clicking a toggle that was merely slow to open closes it again.
 */
const CHECK_TIMEOUT_MS = 5000;

/**
 * Clicks `trigger` until `isDone`, then proves it with `expectDone`. Server-rendered pages paint before
 * they hydrate, and a click that lands first is dropped, so one click followed by a check can wait on a
 * handler that never ran. `isDone` is read before every click, which keeps a toggle (a collapsible, an
 * accordion) from being closed again. Each click is bounded: one that lands while the previous click's
 * dialog is still opening would otherwise wait on its overlay until the test times out.
 */
export const clickUntil = async (
  trigger: Locator,
  isDone: () => Promise<boolean>,
  expectDone: () => Promise<void>
): Promise<void> => {
  await expect(async () => {
    if (!(await isDone())) await trigger.click({ timeout: 3000 });
    await expectDone();
  }).toPass({ timeout: 30_000 });
};

/** Clicks `trigger` until `target` shows. */
export const clickUntilVisible = (trigger: Locator, target: Locator): Promise<void> =>
  clickUntil(
    trigger,
    () => target.isVisible(),
    () => expect(target).toBeVisible({ timeout: CHECK_TIMEOUT_MS })
  );

/** Clicks `trigger`, which navigates, until the page is at `url`. */
export const clickUntilURL = (trigger: Locator, url: RegExp): Promise<void> => {
  const page = trigger.page();
  return clickUntil(
    trigger,
    async () => url.test(page.url()),
    () => expect(page).toHaveURL(url, { timeout: CHECK_TIMEOUT_MS })
  );
};

/** Clicks `trigger` until `target` reports `aria-expanded="true"` (the trigger itself, for a disclosure). */
export const clickUntilExpanded = (trigger: Locator, target: Locator = trigger): Promise<void> =>
  clickUntil(
    trigger,
    async () => (await target.getAttribute("aria-expanded")) === "true",
    () => expect(target).toHaveAttribute("aria-expanded", "true", { timeout: CHECK_TIMEOUT_MS })
  );
