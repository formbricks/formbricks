import { createId } from "@paralleldrive/cuid2";
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { type AddressInfo } from "node:net";
import path from "node:path";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { buildKitchenSinkQuestions } from "./utils/kitchen-sink";
import { buildHostCsp, collectCspViolations, expectNoCspViolations } from "./utils/sdk-host-page";

/**
 * CSP gate for the shipped survey renderer.
 *
 * Customers embed the surveys bundle on pages whose `style-src` has no 'unsafe-inline', so every element
 * the browser parses with a `style` attribute, and every `<style>` without the page's nonce, is a
 * violation on THEIR site (see the CSP section of docs/surveys/website-app-surveys/framework-guides.mdx).
 * Whether markup trips that depends on the DATA: survey text is rich-text HTML from the editor and the
 * API, full of `style` attributes. Lint (`no-restricted-syntax` in the bundle packages) stops new code that
 * parses or injects markup; only a real browser, a real policy and styled content catch the rest.
 *
 * Needs neither login nor database: it renders the BUILT bundle (apps/web/public/js, produced by the same
 * build that starts the app) on a static page, one survey per question type of the accessibility
 * kitchen sink, so a question type added there is covered here without touching this file. Every rich-text
 * field carries styled markup, in the spellings the editor and API produce.
 */

const PUBLIC_DIR = path.resolve(__dirname, "../public");
const SURVEYS_BUNDLE = path.join(PUBLIC_DIR, "js/surveys.umd.cjs");
const WORKSPACE_ID = "csp-gate-workspace";
const MARKER = "Csp gate";

// What the editor saves, and the spellings other writers (API, import) produce for the same attribute.
const styledEditorText = (text: string): string =>
  `<p class="fb-editor-paragraph" dir="ltr" style="text-align: left;"><span style="white-space: pre-wrap;">${text}</span></p>`;
const styledApiText = (text: string): string => `<p\nstyle = 'color: #334155'><b style="">${text}</b></p>`;

const withStyledText = (element: Record<string, unknown>): Record<string, unknown> => {
  const { headline, subheader } = element as {
    headline?: { default?: string };
    subheader?: { default?: string };
  };
  return {
    ...element,
    ...(headline?.default !== undefined && {
      headline: { default: styledEditorText(`${MARKER}: ${headline.default}`) },
    }),
    ...(subheader?.default !== undefined && {
      subheader: { default: styledApiText(`${MARKER}: ${subheader.default}`) },
    }),
  };
};

const i18n = (value: string) => ({ default: value });

const baseSurvey = {
  name: "CSP gate",
  type: "link",
  status: "inProgress",
  questions: [],
  // Widened: the welcome-and-ending survey fills in a headline and subheader.
  welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false } as Record<string, unknown>,
  variables: [],
  styling: { overwriteThemeStyling: false },
  recontactDays: null,
  displayLimit: null,
  displayPercentage: null,
  languages: [
    {
      default: true,
      enabled: true,
      language: {
        id: "csp-gate-language-1234567",
        code: "en",
        alias: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: WORKSPACE_ID,
      },
    },
  ],
  segment: null,
  hiddenFields: { enabled: false, fieldIds: [] },
  workspaceOverwrites: null,
  triggers: [],
  displayOption: "displayOnce",
  showLanguageSwitch: false,
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
};

const endings = [
  {
    id: createId(),
    type: "endScreen",
    headline: i18n(styledEditorText(`${MARKER}: ending`)),
    subheader: i18n(styledApiText(`${MARKER}: ending detail`)),
  },
] as unknown as TSurveyEnding[];

type TSurvey = typeof baseSurvey & { id: string; blocks: unknown[]; endings: TSurveyEnding[] };

/** One survey per question type, so every card is the first card and renders without being answered. */
const buildSurveys = (origin: string): { name: string; survey: TSurvey }[] => {
  const questions = buildKitchenSinkQuestions(origin).map(withStyledText);
  const surveys = questions.map((question) => ({
    name: String(question.type),
    survey: {
      ...baseSurvey,
      id: createId(),
      blocks: transformQuestionsToBlocks(
        [question] as unknown as Parameters<typeof transformQuestionsToBlocks>[0],
        endings
      ),
      endings,
    },
  }));

  // The cards around the questions: welcome card, and the ending reached by submitting an optional question.
  const optional = withStyledText({
    id: createId(),
    type: "openText",
    headline: i18n("optional question"),
    subheader: i18n("optional detail"),
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
  });
  surveys.push({
    name: "welcome and ending",
    survey: {
      ...baseSurvey,
      id: createId(),
      welcomeCard: {
        enabled: true,
        headline: i18n(styledEditorText(`${MARKER}: welcome`)),
        subheader: i18n(styledApiText(`${MARKER}: welcome detail`)),
        timeToFinish: false,
        showResponseCount: false,
      },
      blocks: transformQuestionsToBlocks(
        [optional] as unknown as Parameters<typeof transformQuestionsToBlocks>[0],
        endings
      ),
      endings,
    },
  });
  return surveys;
};

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };

// A customer's page: the policy the docs tell customers to use, the bundle and its public assets, nothing else.
const serveHostPage = async (): Promise<{ origin: string; close: () => Promise<void> }> => {
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");

    if (pathname === "/") {
      const nonce = randomBytes(16).toString("base64");
      const origin = `http://${request.headers.host}`;
      response.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Security-Policy": buildHostCsp(nonce, origin),
      });
      response.end(
        `<!doctype html><html><head><title>CSP gate</title></head><body>` +
          `<script nonce="${nonce}">window.__nonce = ${JSON.stringify(nonce)};</script>` +
          `<script nonce="${nonce}" src="${origin}/surveys.umd.cjs"></script></body></html>`
      );
      return;
    }

    const file = pathname === "/surveys.umd.cjs" ? SURVEYS_BUNDLE : path.join(PUBLIC_DIR, pathname);
    // Static assets only, and never outside the public directory.
    if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "text/javascript" });
    fs.createReadStream(file).pipe(response);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  return {
    origin: `http://localhost:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

test.describe("Survey renderer under a customer-style CSP", () => {
  let host: Awaited<ReturnType<typeof serveHostPage>>;

  test.beforeAll(async () => {
    expect(fs.existsSync(SURVEYS_BUNDLE), `${SURVEYS_BUNDLE} is missing: build the app first`).toBe(true);
    host = await serveHostPage();
  });

  test.afterAll(async () => {
    await host.close();
  });

  test("every question type, with styled rich text in every field, raises no violation", async ({ page }) => {
    const consoleMessages = await collectCspViolations(page);
    await page.goto(host.origin);
    await page.waitForFunction(() =>
      Boolean((window as unknown as { formbricksSurveys?: unknown }).formbricksSurveys)
    );

    await test.step("the policy is enforced, so a clean run means something", async () => {
      // Probe in the page itself: an inline style attribute must be reported, or the gate proves nothing.
      await page.evaluate(() => {
        document.body.setAttribute("style", "color: red");
        document.body.removeAttribute("style");
      });
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as { __cspViolations: { directive: string }[] }).__cspViolations.map(
              (v) => v.directive
            )
          )
        )
        .toContain("style-src-attr");
      // The probe's own report is not a finding.
      await page.evaluate(() => {
        (window as unknown as { __cspViolations: unknown[] }).__cspViolations.length = 0;
      });
      consoleMessages.length = 0;
    });

    const surveys = buildSurveys(host.origin);

    await test.step("render each survey and interact once", async () => {
      await page.evaluate(
        ([entries, origin]) => {
          const w = window as unknown as {
            __nonce: string;
            formbricksSurveys: {
              setNonce: (nonce: string) => void;
              renderSurveyInline: (props: unknown) => void;
            };
          };
          w.formbricksSurveys.setNonce(w.__nonce);
          entries.forEach(({ survey }, index) => {
            const container = document.createElement("div");
            container.id = `survey-${index}`;
            document.body.appendChild(container);
            w.formbricksSurveys.renderSurveyInline({
              survey,
              styling: {},
              isBrandingEnabled: false,
              languageCode: "default",
              containerId: container.id,
              isPreviewMode: true,
              appUrl: origin,
              workspaceId: "csp-gate-workspace",
              onResponse: () => undefined,
              onClose: () => undefined,
              onDisplay: async () => undefined,
              onFinished: () => undefined,
            });
          });
        },
        [surveys, host.origin] as const
      );

      for (const [index, { name }] of surveys.entries()) {
        const container = page.locator(`#survey-${index}`);
        // Positive proof that the card drew: a renderer that threw would also be "violation free".
        await expect(container, `${name} card rendered`).toContainText(MARKER, { timeout: 15_000 });
        // Choices re-render the card on every click, which is where the reported violation repeated.
        const control = container
          .locator('[role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]')
          .first();
        // The native inputs are visually hidden (sr-only), so click the element itself.
        if (await control.count()) await control.evaluate((element) => (element as HTMLElement).click());
      }
    });

    await test.step("welcome card to ending card", async () => {
      const container = page.locator(`#survey-${surveys.length - 1}`);
      // `data-fb-part` is the renderer's stable hook (the one customer CSS targets), not a label or type.
      const primary = container.locator('[data-fb-part="button-primary"]');
      await primary.click(); // Start
      await expect(container).toContainText("optional question");
      await primary.click(); // Finish
      await expect(container).toContainText(`${MARKER}: ending`);
    });

    await expectNoCspViolations(page, consoleMessages);
  });
});
