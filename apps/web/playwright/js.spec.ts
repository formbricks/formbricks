import { expect } from "@playwright/test";
import http from "http";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { gotoSurveyList, gotoSurveyTemplates } from "./lib/utils";
import { useSelectedTemplate } from "./utils/helper";

const HTML_TEMPLATE = `<head>
  <script type="text/javascript">
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
          window.formbricks.setup({workspaceId: "WORKSPACE_ID", appUrl: "http://localhost:3000"});
        } else {
          console.error("Formbricks library failed to load properly. The formbricks object is not available.");
        }
      };
      e.parentNode.insertBefore(t, e);
    })();
  </script>
</head>

<body style="background-color: #fff">
  <p>This is my sample page using the Formbricks JS javascript widget</p>
</body>
`;

test.describe("JS Package Test", async () => {
  let server: http.Server;
  let workspaceId: string;

  test.setTimeout(3 * 60 * 1000);
  test.beforeAll(async () => {
    // Create a simple HTTP server
    server = http.createServer((_, res) => {
      const htmlContent = HTML_TEMPLATE.replace("WORKSPACE_ID", workspaceId || "");
      res.writeHead(200, { "Content-Type": "text/html" });
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
      page.getByRole("button", { name: "Publish", exact: true }).click(),
    ]);

    const surveyId = /\/surveys\/([^/]+)\/summary/.exec(page.url())?.[1];
    if (!surveyId) throw new Error(`Unable to parse surveyId from ${page.url()}`);

    await page.goto("http://localhost:3004");
    await expect(page.locator("#formbricks-modal-container")).toHaveCount(1, { timeout: 120000 });
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
    await page.waitForTimeout(5000);

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
  });
});
