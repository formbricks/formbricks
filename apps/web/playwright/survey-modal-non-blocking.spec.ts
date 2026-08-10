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
    __hostEscapes: number;
    __hostChordDefaultPrevented: boolean | null;
  }
}

// Prose long enough that a drag across it selects an unmistakable number of characters.
const HOST_PROSE =
  "The quick brown fox jumps over the lazy dog while the host page stays fully usable underneath.";

const hostPage = (workspaceId: string) => `<!doctype html>
<html>
  <head>
    <script type="text/javascript">
      !(function () {
        var t = document.createElement("script");
        (t.type = "text/javascript"), (t.async = !0), (t.src = "http://localhost:3000/js/formbricks.umd.cjs");
        t.onload = function () {
          window.formbricks.setup({ workspaceId: "${workspaceId}", appUrl: "http://localhost:3000" });
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
      window.__hostEscapes = 0;
      window.__hostChordDefaultPrevented = null;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") window.__hostEscapes++;
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          window.__hostChordDefaultPrevented = e.defaultPrevented;
        }
      });
    </script>
  </body>
</html>`;

test.describe("App survey widget does not block the host page", () => {
  let server: http.Server;
  let hostUrl = "";

  test.setTimeout(3 * 60 * 1000);

  // The workspace comes in on the query string so the two tests can share one server
  // without sharing mutable state, and the port is ephemeral so parallel workers do
  // not fight over it.
  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      const workspaceId = new URL(req.url ?? "/", "http://localhost").searchParams.get("workspaceId") ?? "";
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(hostPage(workspaceId));
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

    await page.goto(`${hostUrl}/?workspaceId=${seeded.workspaceId}`);
    await page.waitForFunction(() => Boolean(window.formbricks), null, { timeout: 120000 });

    // Park the caret in a host field first — this is the customer's scenario: a survey
    // firing mid-form must not pull the user out of what they are typing.
    await page.locator("#host-input").fill("BEFORE");

    await page.evaluate((key) => window.formbricks.track(key), seeded.actionKey);

    const dialog = page.locator("#fbjs [role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 120000 });
    // Let the card transition settle so any deferred focus has had its chance to land.
    await page.waitForTimeout(1500);

    // The survey must not have taken the caret.
    await expect(page.locator("#host-input")).toBeFocused();
    await page.keyboard.type("-AFTER");
    await expect(page.locator("#host-input")).toHaveValue("BEFORE-AFTER");

    // A survey that does not block the page must not claim to be a modal dialog:
    // aria-modal makes assistive tech ignore everything outside it.
    await expect(dialog).not.toHaveAttribute("aria-modal", /.*/);

    // Text on the host page must stay selectable — the focus trap used to wipe the
    // selection ~17ms into the drag by pulling focus back into the survey.
    const prose = page.locator("#prose");
    const box = await prose.boundingBox();
    if (!box) throw new Error("host prose has no bounding box");
    const midY = box.y + box.height / 2;
    await page.mouse.move(box.x + 2, midY);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) {
      await page.mouse.move(box.x + 2 + ((box.width - 6) * step) / 6, midY, { steps: 3 });
    }
    await page.mouse.up();
    const selectedLength = await page.evaluate(() => String(window.getSelection() ?? "").length);
    expect(selectedLength).toBeGreaterThan(20);

    // Tab must be able to move through the host page instead of cycling in the survey.
    await page.locator("#host-input").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#host-textarea")).toBeFocused();

    // Escape belongs to the host page while focus is on the host page.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => window.__hostEscapes)).toBeGreaterThan(0);

    // Same for the Cmd/Ctrl+Enter chord: the survey must not swallow it.
    await page.locator("#host-textarea").focus();
    await page.keyboard.press("ControlOrMeta+Enter");
    expect(await page.evaluate(() => window.__hostChordDefaultPrevented)).toBe(false);
    await expect(dialog).toBeVisible();

    // The survey itself is still fully usable — it just does not grab anything.
    const surveyInput = page.locator("#fbjs input[type='text'], #fbjs textarea").first();
    await surveyInput.click();
    await surveyInput.fill("still works");
    await expect(surveyInput).toHaveValue("still works");

    // Escape closes the survey when focus is inside it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("overlay:dark keeps the modal behaviour", async ({ page, users }) => {
    const seeded = await seedAppSurvey(users, { overlay: "dark", placement: "center" });

    await page.goto(`${hostUrl}/?workspaceId=${seeded.workspaceId}`);
    await page.waitForFunction(() => Boolean(window.formbricks), null, { timeout: 120000 });

    await page.locator("#host-input").fill("BEFORE");
    await page.evaluate((key) => window.formbricks.track(key), seeded.actionKey);

    const dialog = page.locator("#fbjs [role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 120000 });
    await page.waitForTimeout(1500);

    // A survey that does block the page is a real modal: it announces itself as one,
    // takes focus, and keeps it.
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#host-input")).not.toBeFocused();

    await page.locator("#host-input").focus();
    const focusStayedInSurvey = await page.evaluate(() =>
      Boolean(document.getElementById("fbjs")?.contains(document.activeElement))
    );
    expect(focusStayedInSurvey).toBe(true);
  });
});
