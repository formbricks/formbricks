import { type Page, expect } from "@playwright/test";
import { randomBytes } from "crypto";
import http from "http";
import type { AddressInfo } from "net";
import { prisma } from "@formbricks/database";
import { PUBLIC_API_SURVEY_NAME_PLACEHOLDER } from "@formbricks/types/js-constants";
import { test } from "./lib/fixtures";
import { gotoSurveyList, gotoSurveyTemplates } from "./lib/utils";
import { seedAppSurvey } from "./utils/app-survey";
import { activateSurvey, useSelectedTemplate } from "./utils/helper";

const HTML_TEMPLATE = `<head>
  <script type="text/javascript" nonce="CSP_NONCE">
    // An AMD loader stub, kept for the whole page life, so both UMD bundles (the SDK and the lazily
    // loaded survey renderer) must still take their browser-global branch on an AMD page (ENG-3657).
    window.define = function () {};
    window.define.amd = {};
  </script>
  <script type="text/javascript" nonce="CSP_NONCE">
    !(function () {
      var t = document.createElement("script");
      (t.type = "text/javascript"), (t.async = !0), (t.src = "http://localhost:3000/js/formbricks.umd.cjs");
      var e = document.getElementsByTagName("script")[0];
      t.onload = function(){
        if (window.formbricks) {
          // formbricks.on() is the only JS subscription surface (ENG-1814); registered before
          // setup(), which the API promises works. Same names as the GTM dataLayer pushes.
          window.formbricksEvents = [];
          ["formbricks_survey_shown", "formbricks_response_submitted", "formbricks_survey_closed"].forEach(
            function (name) {
              window.formbricks.on(name, function (payload) {
                window.formbricksEvents.push(Object.assign({ event: name }, payload));
              });
            }
          );
          // The host page's CSP has no 'unsafe-inline' for styles, so the renderer's <style> elements
          // only apply because they carry this nonce. Called before setup(), as the docs require.
          window.formbricks.setNonce("CSP_NONCE");
          window.formbricks.setup({workspaceId: "WORKSPACE_ID", appUrl: "http://localhost:3000"});
        } else {
          console.error("Formbricks library failed to load properly. The formbricks object is not available.");
        }
      };
      e.parentNode.insertBefore(t, e);
    })();
  </script>
</head>

<body>
  <p>This is my sample page using the Formbricks JS javascript widget</p>
</body>
`;

// A customer-style policy for the host page, built from what the CSP section of the framework guide
// (docs/surveys/website-app-surveys/framework-guides.mdx) tells customers to allow: the SDK host in
// script-src/connect-src, and a per-response nonce instead of 'unsafe-inline' for styles. Anything the
// SDK or the survey renderer needs beyond this shows up as a violation and fails the journey.
// 'strict-dynamic' and reCAPTCHA are deliberately not covered (ENG-1878).
const buildHostCsp = (nonce: string): string =>
  [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' http://localhost:3000`,
    `style-src 'self' 'nonce-${nonce}'`,
    "connect-src http://localhost:3000",
    "img-src http://localhost:3000",
    "font-src http://localhost:3000",
  ].join("; ");

type TCspViolation = { directive: string; blockedURI: string; sourceFile: string; sample: string };

// Registered before navigation so nothing the page does is missed. Each document starts its own list.
const collectCspViolations = async (page: Page): Promise<string[]> => {
  await page.addInitScript(() => {
    const violations: TCspViolation[] = [];
    (window as unknown as { __cspViolations: TCspViolation[] }).__cspViolations = violations;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => {
        violations.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          sourceFile: event.sourceFile,
          sample: event.sample,
        });
      },
      true
    );
  });

  // The browser's own console report too, in case a violation fires before the listener exists.
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) consoleMessages.push(message.text());
  });
  return consoleMessages;
};

const expectNoCspViolations = async (page: Page, consoleMessages: string[]): Promise<void> => {
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations?: TCspViolation[] }).__cspViolations ?? []
  );
  expect(
    { violations, consoleMessages },
    `CSP violations on ${page.url()}:\n${JSON.stringify({ violations, consoleMessages }, null, 2)}`
  ).toEqual({ violations: [], consoleMessages: [] });
};

test.describe("JS Package Test", async () => {
  let server: http.Server;
  let workspaceId: string;

  test.setTimeout(3 * 60 * 1000);
  test.beforeAll(async () => {
    // Create a simple HTTP server
    server = http.createServer((_, res) => {
      const nonce = randomBytes(16).toString("base64");
      const htmlContent = HTML_TEMPLATE.replace("WORKSPACE_ID", workspaceId || "").replaceAll(
        "CSP_NONCE",
        nonce
      );
      res.writeHead(200, { "Content-Type": "text/html", "Content-Security-Policy": buildHostCsp(nonce) });
      res.end(htmlContent);
    });

    await new Promise<void>((resolve) => {
      server.listen(3004, () => resolve());
    });
  });

  test.afterAll(async () => {
    // Cleanup: close the server
    await new Promise((resolve) => server.close(resolve));
  });

  test("Create, display and validate PMF survey", async ({ page, users }) => {
    const cspConsoleMessages = await collectCspViolations(page);

    // Create and login user
    const user = await users.create();
    await user.login();

    await gotoSurveyList(page);

    // Get the workspaceId from the fixture (needed for SDK setup)
    workspaceId =
      user.workspaceId ??
      (() => {
        throw new Error("Unable to get workspaceId from user fixture");
      })();

    await gotoSurveyTemplates(page, workspaceId);

    // Create survey from template
    await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).isVisible();
    await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).click();
    await page.getByRole("button", { name: "Use this template" }).isVisible();
    await useSelectedTemplate(page);

    // Configure survey settings
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#howToSendCardTrigger")).toBeVisible();
    await page.locator("#howToSendCardTrigger").click();
    await expect(page.locator("#howToSendCardOption-app")).toBeVisible();
    await page.locator("#howToSendCardOption-app").click();

    await page.locator("#whenToSendCardTrigger").click();
    await page.getByRole("button", { name: "Add action" }).click();

    await page.getByRole("button", { name: "Capture new action" }).click();
    await page.getByPlaceholder("E.g. Clicked Download").click();
    await page.getByPlaceholder("E.g. Clicked Download").fill("New Session");
    await page.getByText("Page View").click();
    await page.getByRole("button", { name: "Create action" }).click();

    await page.locator("#recontactOptionsCardTrigger").click();
    await page.locator('[data-testid="recontact-option-respondMultiple"]').click();
    await page.locator('[data-testid="cooldown-period-option-ignore"]').click();

    await page.getByRole("button", { name: "Save as draft", exact: true }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary/, { timeout: 120000 }),
      activateSurvey(page),
    ]);

    const surveyId = /\/surveys\/([^/]+)\/summary/.exec(page.url())?.[1];
    if (!surveyId) throw new Error(`Unable to parse surveyId from ${page.url()}`);

    // ENG-3552: workspace and survey custom CSS, saved through the same v3 endpoints the editors use, so
    // the processor, storage and cache invalidation are the real ones. Both style the same hook so one
    // assertion proves both arrive and that survey CSS outranks workspace CSS (M2.03).
    await test.step("save workspace and survey custom CSS", async () => {
      const workspaceCss = await page.request.patch(`/api/v3/workspaces/${workspaceId}/custom-css`, {
        data: {
          customCss: {
            light: '[data-fb-part="headline"] { letter-spacing: 3px; color: rgb(10, 20, 30); }',
            dark: null,
          },
        },
      });
      expect(workspaceCss.ok()).toBe(true);

      // Survey CSS is delivered only while the survey uses custom styling (ENG-3723). The v3 survey
      // API has no styling field, so it is set directly, before the PATCH below invalidates the cache.
      const { styling } = await prisma.survey.findUniqueOrThrow({
        where: { id: surveyId },
        select: { styling: true },
      });
      await prisma.survey.update({
        where: { id: surveyId },
        data: { styling: { ...styling, overwriteThemeStyling: true } },
      });

      const surveyCss = await page.request.patch(`/api/v3/surveys/${surveyId}`, {
        data: { customCss: { light: '[data-fb-part="headline"] { color: rgb(40, 50, 60); }', dark: null } },
      });
      expect(surveyCss.ok()).toBe(true);
    });

    const environmentResponse = page.waitForResponse((response) =>
      /\/api\/v1\/client\/[^/]+\/environment/.test(response.url())
    );
    // Only what happens from the host page on counts towards the host-page assertion below.
    cspConsoleMessages.length = 0;
    await page.goto("http://localhost:3004");
    await expect(page.locator("#formbricks-modal-container")).toHaveCount(1, { timeout: 120000 });

    await test.step("the SDK receives compiled custom CSS only, workspace CSS once", async () => {
      // The endpoint wraps the state in its own envelope: `{ data: { data: <state>, expiresAt } }`.
      const { data } = ((await (await environmentResponse).json()) as { data: unknown }).data as {
        data: {
          workspace: { customCss?: Record<string, string> };
          project?: { customCss?: unknown };
          surveys: { id: string; customCss?: Record<string, string> }[];
        };
      };
      const surveyCustomCss = data.surveys.find((survey) => survey.id === surveyId)?.customCss;

      // Compiled `{ light?, dark? }` only — no source, no processor internals — and not repeated in the
      // legacy `project` alias.
      expect(Object.keys(data.workspace.customCss ?? {})).toEqual(["light"]);
      expect(data.workspace.customCss?.light).toContain("fb-workspace");
      expect(Object.keys(surveyCustomCss ?? {})).toEqual(["light"]);
      expect(surveyCustomCss?.light).toContain("fb-survey");
      expect(data.project?.customCss).toBeUndefined();
    });

    await test.step("workspace and survey custom CSS style the app survey", async () => {
      const headline = page.locator('#formbricks-modal-container [data-fb-part="headline"]').first();
      // Workspace CSS applies (letter-spacing), and survey CSS wins where both set a property (color).
      await expect(headline).toHaveCSS("letter-spacing", "3px");
      await expect(headline).toHaveCSS("color", "rgb(40, 50, 60)");
    });

    // The widget reads the survey from the public client API, which substitutes a placeholder for
    // every survey name so names are not exposed over an unauthenticated endpoint. This is the only
    // place the real API, the widget and the dialog are wired together, so it is the only place that
    // can catch the placeholder leaking into what a screen reader announces: the dialog falls back
    // to its generic name instead, and the survey's one h1 carries that same name (ENG-2799). The h1
    // is looked up inside the dialog, because aria-modal hides anything outside it from assistive tech.
    // The placeholder is matched through the shared constant, not a literal, so a change to its text
    // cannot turn this into a matcher that finds nothing and passes vacuously.
    const widget = page.locator("#formbricks-modal-container");
    const dialog = widget.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-label", "Survey Dialog");
    await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Survey Dialog");
    await expect(widget.getByText(PUBLIC_API_SURVEY_NAME_PLACEHOLDER)).toHaveCount(0);

    await expect(
      page.locator("#questionCard-0").getByRole("link", { name: "Powered by Formbricks" })
    ).toBeVisible();

    // Fill the survey
    await page.getByRole("button", { name: "Happy to help!" }).click();
    await page.locator("#questionCard-1 label").filter({ hasText: "Somewhat disappointed" }).click();
    await page.locator("#questionCard-1").getByRole("button", { name: "Next" }).click();
    await page.locator("#questionCard-2 label").filter({ hasText: "Founder" }).click();
    await page.locator("#questionCard-2").getByRole("button", { name: "Next" }).click();
    await page
      .locator("#questionCard-3")
      .getByRole("textbox")
      .fill("People who believe that PMF is necessary");
    await page.locator("#questionCard-3").getByRole("button", { name: "Next" }).click();
    await page.locator("#questionCard-4").getByRole("textbox").fill("Much higher response rates!");
    await page.locator("#questionCard-4").getByRole("button", { name: "Next" }).click();
    await page.locator("#questionCard-5").getByRole("textbox").fill("Make this end to end test pass!");
    await page.locator("#questionCard-5").getByRole("button", { name: "Finish" }).click();

    await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });
    await page.waitForLoadState("networkidle");
    // The last lifecycle event fires only once the ending card auto-closes the modal, so wait for it
    // rather than for a fixed time.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window as unknown as { formbricksEvents?: { event: string }[] }).formbricksEvents?.some(
              ({ event }) => event === "formbricks_survey_closed"
            )
          ),
        { timeout: 15000 }
      )
      .toBe(true);

    // A customer reported CSP breaking the widget on their site after QA had passed it: survey-ui
    // rendered raw `style="..."` attributes, which a nonce-based style-src blocks. Asserted after the
    // survey was shown, answered and closed, so every card, the custom CSS and the ending are covered.
    await test.step("the SDK journey raises no violation under the host page's CSP", async () => {
      await expectNoCspViolations(page, cspConsoleMessages);
    });

    // The `responseId` on the events is the PERSISTED id (ENG-1846). This is the only level that
    // can prove it: the id is minted by the server, so `onResponseCreated`/`onFinished` can only
    // carry it by firing from the response queue's creation ack — and the renderer that passes it
    // lives in a .tsx, which the repo does not unit-test. Asserted against the stored row rather
    // than for self-consistency, so a client-minted or dropped id fails here (ENG-1814: the
    // formbricks.on() surface, registered before setup(), is what captured them).
    await test.step("the journey reaches formbricks.on subscribers with the persisted responseId", async () => {
      const events = await page.evaluate(
        () =>
          (
            window as unknown as {
              formbricksEvents: {
                event: string;
                surveyId: string;
                responseId?: string;
                finished?: boolean;
              }[];
            }
          ).formbricksEvents
      );

      const storedResponse = await prisma.response.findFirst({
        where: { surveyId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      // A hard throw rather than expect().not.toBeNull(): it narrows the type, so the id
      // comparisons below cannot silently compare undefined against undefined.
      if (!storedResponse) throw new Error("No response was persisted for the survey");

      // Shown, first answer, completion, and — after the ending card auto-closes the modal —
      // closed exactly once. One vocabulary, in order.
      expect(events.map((event) => event.event)).toEqual([
        "formbricks_survey_shown",
        "formbricks_response_submitted",
        "formbricks_response_submitted",
        "formbricks_survey_closed",
      ]);
      expect(events.map((event) => event.finished)).toEqual([undefined, false, true, undefined]);
      for (const event of events) {
        expect(event.surveyId).toBe(surveyId);
      }
      expect(events[1].responseId).toBe(storedResponse.id);
      expect(events[2].responseId).toBe(storedResponse.id);
    });

    // Validate displays and response
    cspConsoleMessages.length = 0;
    await page.goto("/");
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.getByRole("link", { name: "product Market Fit (Superhuman)" }).click();
    await page.waitForSelector("text=Responses");
    await page.waitForTimeout(5000);

    const impressionsCount = await page.getByRole("button", { name: "Impressions" }).innerText();
    expect(impressionsCount).toEqual("Impressions\n\n1");

    await expect(page.getByRole("link", { name: "Responses" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completed 100%" })).toBeVisible();
    await expect(page.getByText("1 response", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Somewhat disappointed")).toBeVisible();
    await expect(page.getByText("Founder")).toBeVisible();
    await expect(page.getByText("People who believe that PMF").first()).toBeVisible();
    await expect(page.getByText("Much higher response rates!").first()).toBeVisible();
    await expect(page.getByText("Make this end to end test").first()).toBeVisible();

    // Our own CSP (next.config.mjs) in the browser: next-config-csp.test.ts checks the header text, but
    // only a browser shows what it blocks — like Sentry Replay's blob: worker (ENG-3194), or Zod's eval
    // probe on every app page (ENG-3969).
    await test.step("an app page and a link survey raise no violation under our own CSP", async () => {
      await expectNoCspViolations(page, cspConsoleMessages);

      await prisma.survey.update({ where: { id: surveyId }, data: { type: "link" } });
      cspConsoleMessages.length = 0;
      await page.goto(`/s/${surveyId}`);
      await expect(page.locator("#questionCard-0")).toBeVisible();
      await expectNoCspViolations(page, cspConsoleMessages);
    });
  });
});

// The workspace is injected with `addInitScript`, so the same page can be served at any path and
// a test can walk through several pages of one visit in one tab.
const VISIT_HOST_PAGE = `<!doctype html>
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
  <body style="background-color: #fff">
    <p>A page of a site that runs the Formbricks SDK</p>
  </body>
</html>`;

const trackAction = (key: string) => {
  const sdk = (window as unknown as { formbricks?: { track: (actionKey: string) => Promise<unknown> } })
    .formbricks;
  if (!sdk) throw new Error("Formbricks SDK is not loaded");
  return sdk.track(key);
};

test.describe("Show conditions and the visit (ENG-3926)", () => {
  let server: http.Server;
  let hostUrl: string;

  test.beforeAll(async () => {
    server = http.createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(VISIT_HOST_PAGE);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        hostUrl = `http://localhost:${(server.address() as AddressInfo).port.toString()}`;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("a survey waits for its show conditions, then saves the visit on the response", async ({
    page,
    users,
  }) => {
    const seeded = await seedAppSurvey(users, {
      showConditions: {
        id: "e2erule",
        connector: "and",
        conditions: [
          {
            id: "e2epages",
            leftOperand: { type: "visit", value: "pagesViewed" },
            operator: "isGreaterThanOrEqual",
            rightOperand: { type: "static", value: 2 },
          },
        ],
      },
    });
    await page.addInitScript((workspaceId) => {
      (window as unknown as { __workspaceId: string }).__workspaceId = workspaceId;
    }, seeded.workspaceId);
    const widget = page.locator("#formbricks-modal-container");

    await test.step("on the first page the trigger fires, and the debug panel says why nothing shows", async () => {
      await page.goto(`${hostUrl}/plans?formbricksDebug=true`);
      await page.waitForFunction(
        () => Boolean((window as unknown as { formbricks?: unknown }).formbricks),
        null,
        {
          timeout: 120000,
        }
      );
      await page.evaluate(trackAction, seeded.actionKey);

      // The panel is a separate bundle the SDK loads only with the flag; it renders into an open
      // shadow root, which Playwright locators pierce.
      await expect(page.getByText("Not shown: show conditions not met")).toBeVisible();
      await expect(page.getByText("✗ Pages viewed ≥ 2 — read: 1")).toBeVisible();
      await expect(widget).toHaveCount(0);
    });

    await test.step("on the second page of the same visit, the trigger shows the survey", async () => {
      // No flag in this URL: debug mode stays on for the tab, so the panel explains this page too.
      await page.goto(`${hostUrl}/plans/compare`);
      await page.waitForFunction(
        () => Boolean((window as unknown as { formbricks?: unknown }).formbricks),
        null,
        {
          timeout: 120000,
        }
      );
      await page.evaluate(trackAction, seeded.actionKey);

      await expect(widget.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Show conditions met")).toBeVisible();
    });

    await test.step("the response records the visit as it was when the survey showed", async () => {
      await widget.getByRole("textbox").fill("Comparing plans");
      await widget.getByRole("button", { name: "Finish" }).click();

      await expect
        .poll(
          async () =>
            (
              await prisma.response.findFirst({
                where: { surveyId: seeded.surveyId },
                select: { meta: true },
              })
            )?.meta,
          { timeout: 15000 }
        )
        .toMatchObject({
          visitPagesViewed: 2,
          visitUniquePagesViewed: 2,
          visitUrls: "/plans · /plans/compare",
          visitTimeOnSite: expect.any(Number),
        });
    });
  });
});
