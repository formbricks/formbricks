import { expect } from "@playwright/test";
import http from "http";
import { type AddressInfo } from "net";
import { test } from "./lib/fixtures";
import { seedAppSurvey } from "./utils/app-survey";

/**
 * A corner survey with no overlay must not take anything from the page it sits on.
 *
 * The widget used to arm a full focus trap for every modal survey regardless of
 * overlay (packages/surveys/src/components/wrappers/survey-container.tsx), so a
 * bottom-right survey stole the caret, wiped text selections mid-drag, trapped Tab,
 * claimed Escape and Cmd/Ctrl+Enter document-wide, and told screen readers to ignore
 * the host page. Mouse clicks kept working the whole time, which is what made it hard
 * to spot. These specs pin the non-blocking contract, and the overlay case pins the
 * modal behaviour that must survive it — otherwise someone "simplifies" the gate away.
 */

declare global {
  interface Window {
    formbricks: {
      setup: (config: { workspaceId: string; appUrl: string }) => Promise<void>;
      track: (name: string) => Promise<void>;
    };
    __workspaceId: string;
    __hostEscapeDefaultPrevented: boolean | null;
    __hostChordDefaultPrevented: boolean | null;
  }
}

// Prose long enough that a drag across it selects an unmistakable number of characters.
const HOST_PROSE =
  "The quick brown fox jumps over the lazy dog while the host page stays fully usable underneath.";

// A constant page — the workspace is injected per test with `page.addInitScript` rather
// than templated in, so nothing the test controls is ever interpolated into served HTML.
const HOST_PAGE = `<!doctype html>
<html>
  <head>
    <script type="text/javascript">
      !(function () {
        var t = document.createElement("script");
        (t.type = "text/javascript"), (t.async = !0), (t.src = "http://localhost:3000/js/formbricks.umd.cjs");
        t.onload = function () {
          window.formbricks.setup({ workspaceId: window.__workspaceId, appUrl: "http://localhost:3000" });
        };
        var e = document.getElementsByTagName("script")[0];
        e.parentNode.insertBefore(t, e);
      })();
    </script>
  </head>
  <body style="background-color: #fff; font-family: sans-serif">
    <p id="prose" style="max-width: 480px">${HOST_PROSE}</p>
    <input id="host-input" aria-label="Host input" />
    <textarea id="host-textarea" aria-label="Host textarea"></textarea>
    <button id="host-button" type="button" onclick="window.__hostButtonClicks=(window.__hostButtonClicks||0)+1">
      Host button
    </button>
    <script>
      window.__hostEscapeDefaultPrevented = null;
      window.__hostChordDefaultPrevented = null;
      // Both reads are deferred to the next task. This listener is registered at page load
      // and the survey's on mount, so on the same target in the same phase they fire in
      // registration order — a synchronous read here always sees \`defaultPrevented === false\`
      // no matter what the survey does. The event object outlives dispatch, so a deferred
      // read observes the final state.
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          setTimeout(function () {
            window.__hostEscapeDefaultPrevented = e.defaultPrevented;
          }, 0);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          // Read on the next task, not inline. Both this listener and the survey's live on
          // \`document\` in the bubble phase, and this one was registered first (page load vs
          // survey mount), so listeners fire in registration order and \`defaultPrevented\` is
          // still false at this point in dispatch no matter what the survey does. The event
          // object outlives dispatch, so a deferred read observes the final state.
          setTimeout(function () {
            window.__hostChordDefaultPrevented = e.defaultPrevented;
          }, 0);
        }
      });
    </script>
  </body>
</html>`;

test.describe("App survey widget does not block the host page", () => {
  let server: http.Server;
  let hostUrl = "";

  test.setTimeout(3 * 60 * 1000);

  // The port is ephemeral so parallel workers do not fight over it, and the response is
  // a constant so the server holds no per-test state.
  test.beforeAll(async () => {
    server = http.createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HOST_PAGE);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        hostUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("overlay:none leaves the host page fully usable", async ({ page, users }) => {
    const seeded = await seedAppSurvey(users, { overlay: "none", placement: "bottomRight" });

    await page.addInitScript((workspaceId) => {
      window.__workspaceId = workspaceId;
    }, seeded.workspaceId);
    await page.goto(hostUrl);
    await page.waitForFunction(() => Boolean(window.formbricks), null, { timeout: 120000 });

    // The status region is mounted at SDK setup — long before any survey opens — because screen
    // readers only reliably announce changes to a live region that already existed.
    const liveRegion = page.locator("#formbricks-live-region");
    await expect(liveRegion).toBeAttached({ timeout: 120000 });
    await expect(liveRegion).toHaveAttribute("role", "status");
    await expect(liveRegion).toBeEmpty();

    // Park the caret in a host field first — this is the customer's scenario: a survey
    // firing mid-form must not pull the user out of what they are typing.
    await page.locator("#host-input").fill("BEFORE");

    await page.evaluate((key) => window.formbricks.track(key), seeded.actionKey);

    const dialog = page.locator("#fbjs [role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 120000 });
    // The card fades in over 500ms (survey-container.tsx); opacity 1 marks the survey fully open, by
    // which point any mount-time focus move has had its chance to land.
    await expect(dialog).toHaveCSS("opacity", "1");

    // The survey must not have taken the caret.
    await expect(page.locator("#host-input")).toBeFocused();
    await page.keyboard.type("-AFTER");
    await expect(page.locator("#host-input")).toHaveValue("BEFORE-AFTER");

    // A survey that does not block the page must not claim to be a modal dialog:
    // aria-modal makes assistive tech ignore everything outside it.
    await expect(dialog).not.toHaveAttribute("aria-modal", /.*/);

    // It takes nothing from the page, so the open is announced through the pre-existing status
    // region instead of a focus move — otherwise screen-reader users get no signal it appeared.
    await expect(liveRegion).toHaveText("A survey has opened. Press Tab to reach it.");

    // Text on the host page must stay selectable — the focus trap used to wipe the
    // selection ~17ms into the drag by pulling focus back into the survey.
    const prose = page.locator("#prose");
    const box = await prose.boundingBox();
    if (!box) throw new Error("host prose has no bounding box");
    // Drag corner to corner so the selection covers every line wherever the text wraps. A
    // horizontal drag through the middle samples only the last wrapped line, whose length is
    // a function of the machine's fonts (measured: 30 chars at 16px, 18 at 14px).
    const startY = box.y + 4;
    const endY = box.y + box.height - 4;
    await page.mouse.move(box.x + 2, startY);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) {
      await page.mouse.move(box.x + 2 + ((box.width - 6) * step) / 6, startY + ((endY - startY) * step) / 6, {
        steps: 3,
      });
    }
    await page.mouse.up();
    expect(await page.evaluate(() => String(window.getSelection() ?? ""))).toBe(HOST_PROSE);
    // Pin the mechanism, not just the effect: the trap wiped the selection by pulling focus
    // into the survey mid-drag.
    expect(
      await page.evaluate(() => Boolean(document.getElementById("fbjs")?.contains(document.activeElement)))
    ).toBe(false);

    // Tab must be able to move through the host page instead of cycling in the survey.
    await page.locator("#host-input").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#host-textarea")).toBeFocused();

    // Escape belongs to the host page while focus is on the host page: the survey neither
    // closes on it nor cancels it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__hostEscapeDefaultPrevented)).toBe(false);

    // Same for the Cmd/Ctrl+Enter chord: the survey must neither cancel it nor act on it.
    const surveyInput = page.locator("#fbjs input[type='text'], #fbjs textarea").first();
    await expect(surveyInput).toBeVisible();
    await page.locator("#host-textarea").focus();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect.poll(() => page.evaluate(() => window.__hostChordDefaultPrevented)).toBe(false);
    // And the survey must still be on the question card. Asserting the dialog is visible is
    // not enough: submitting advances to the ending card, which has no text input but still
    // matches [role="dialog"].
    await expect(surveyInput).toBeVisible();

    // The survey itself is still fully usable — it just does not grab anything.
    await surveyInput.click();
    await surveyInput.fill("still works");
    await expect(surveyInput).toHaveValue("still works");

    // Escape closes the survey when focus is inside it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Closing clears the announcement: identical text twice is not a change, so without the clear
    // a later open would stay silent.
    await expect(liveRegion).toBeEmpty();
  });

  test("overlay:dark keeps the modal behaviour", async ({ page, users }) => {
    const seeded = await seedAppSurvey(users, { overlay: "dark", placement: "center" });

    await page.addInitScript((workspaceId) => {
      window.__workspaceId = workspaceId;
    }, seeded.workspaceId);
    await page.goto(hostUrl);
    await page.waitForFunction(() => Boolean(window.formbricks), null, { timeout: 120000 });

    await page.locator("#host-input").fill("BEFORE");
    await page.evaluate((key) => window.formbricks.track(key), seeded.actionKey);

    const dialog = page.locator("#fbjs [role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 120000 });
    // Same observable wait as the no-overlay spec: fully faded in means the trap has armed and focused.
    await expect(dialog).toHaveCSS("opacity", "1");

    // A survey that does block the page is a real modal: it announces itself as one,
    // takes focus, and keeps it.
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      await page.evaluate(() => Boolean(document.getElementById("fbjs")?.contains(document.activeElement)))
    ).toBe(true);

    await page.locator("#host-input").focus();
    const focusStayedInSurvey = await page.evaluate(() =>
      Boolean(document.getElementById("fbjs")?.contains(document.activeElement))
    );
    expect(focusStayedInSurvey).toBe(true);

    // With an overlay the trap's focus move is the announcement — the status region stays silent
    // so screen readers don't hear the open twice.
    await expect(page.locator("#formbricks-live-region")).toBeEmpty();
  });
});
