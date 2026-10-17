import { type Page, expect } from "@playwright/test";
import { randomBytes } from "crypto";
import http from "http";
import { type AddressInfo } from "net";

/**
 * The customer-style host page the JS SDK journeys load: the SDK snippet, a per-response CSP nonce, and
 * `formbricks.on()` listeners collecting every lifecycle event into `window.formbricksEvents`.
 */
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
      (t.type = "text/javascript"), (t.async = !0), (t.src = "APP_URL/js/formbricks.umd.cjs");
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
          window.formbricks.setup({workspaceId: "WORKSPACE_ID", appUrl: "APP_URL"});
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
const buildHostCsp = (nonce: string, appUrl: string): string =>
  [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' ${appUrl}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `connect-src ${appUrl}`,
    `img-src ${appUrl}`,
    `font-src ${appUrl}`,
  ].join("; ");

export interface SdkHostPage {
  url: string;
  close: () => Promise<void>;
}

/**
 * Serves the host page for the app at `appUrl` (the Playwright `baseURL`). The workspace is read on every
 * request, so a server started before the test knows its workspace serves the right one. `port` 0 picks
 * a free port, which keeps parallel workers apart.
 */
export const serveSdkHostPage = async ({
  appUrl,
  getWorkspaceId,
  port = 0,
}: {
  appUrl: string;
  getWorkspaceId: () => string;
  port?: number;
}): Promise<SdkHostPage> => {
  const origin = new URL(appUrl).origin;
  const server = http.createServer((_, res) => {
    const nonce = randomBytes(16).toString("base64");
    const htmlContent = HTML_TEMPLATE.replace("WORKSPACE_ID", getWorkspaceId())
      .replaceAll("APP_URL", origin)
      .replaceAll("CSP_NONCE", nonce);
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Security-Policy": buildHostCsp(nonce, origin),
    });
    res.end(htmlContent);
  });

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });

  return {
    url: `http://localhost:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

type TCspViolation = { directive: string; blockedURI: string; sourceFile: string; sample: string };

// Registered before navigation so nothing the page does is missed. Each document starts its own list.
export const collectCspViolations = async (page: Page): Promise<string[]> => {
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

export const expectNoCspViolations = async (page: Page, consoleMessages: string[]): Promise<void> => {
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations?: TCspViolation[] }).__cspViolations ?? []
  );
  expect(
    { violations, consoleMessages },
    `CSP violations on ${page.url()}:\n${JSON.stringify({ violations, consoleMessages }, null, 2)}`
  ).toEqual({ violations: [], consoleMessages: [] });
};
