import { type Page, type Response, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { type Prisma } from "@formbricks/database/prisma";
import {
  EMBED_SURVEY_PREVIEW_HEADLINE,
  createEmbedSurveyPreviewEmailSurvey,
} from "@/modules/email/fixtures/embed-survey-preview-email-fixture";
import { test } from "./lib/fixtures";
import { collectCspViolations, expectNoCspViolations } from "./utils/sdk-host-page";

/**
 * CSP gate for the app's own pages.
 *
 * Pages run scripts and `<style>` elements only with the nonce `proxy.ts` puts in each response's policy
 * (lib/csp/content-security-policy.ts). Next adds it to its own tags; everything else that creates one
 * (the survey renderer loader, toasts, Radix's scroll lock, charts, the email preview frame) has to pass
 * it on. Only a production build and a real browser show what still lacks it, so each journey asserts the
 * browser reported no violation, and the pages a scanner reaches signed out carry no 'unsafe-inline' and
 * no whole-scheme source.
 */

const directivesOf = (response: Response | null): Map<string, string[]> => {
  const policy = response?.headers()["content-security-policy"] ?? "";
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    })
  );
};

const gotoWithPolicy = async (page: Page, path: string) => {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  return directivesOf(response);
};

test.describe("App CSP", () => {
  test("signed-out pages allow no inline code or whole scheme, and render with the nonce", async ({
    page,
  }) => {
    for (const path of ["/auth/login", "/auth/signup", "/auth/forgot-password"]) {
      await test.step(path, async () => {
        const cspConsoleMessages = await collectCspViolations(page);
        const directives = await gotoWithPolicy(page, path);

        expect(directives.get("script-src")).toEqual(expect.arrayContaining(["'strict-dynamic'"]));
        for (const name of ["script-src", "style-src"]) {
          expect(directives.get(name), name).not.toContain("'unsafe-inline'");
        }
        for (const [name, sources] of directives) {
          expect(sources, name).not.toContain("https:");
        }

        // Hydrated: the page's own scripts ran under the policy.
        await expect(
          page.getByRole("button", { name: /Log in with Email|Continue with Email|Reset/ }).first()
        ).toBeVisible();
        await expectNoCspViolations(page, cspConsoleMessages);
      });
    }
  });

  test("a signed-in journey through a survey's summary, distribute dialog and email preview raises no violation", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const user = await users.create({
      email: `app-csp-${timestamp}@example.com`,
      name: `app-csp-${timestamp}`,
      workspaceName: "CSP Workspace",
    });
    if (!user.workspaceId) throw new Error("Workspace not seeded for test user");

    const fixture = createEmbedSurveyPreviewEmailSurvey();
    const survey = await prisma.survey.create({
      data: {
        workspaceId: user.workspaceId,
        createdBy: user.id,
        name: `CSP Survey ${timestamp}`,
        status: "inProgress",
        type: "link",
        welcomeCard: fixture.welcomeCard,
        blocks: fixture.blocks as unknown as Prisma.InputJsonValue[],
        endings: fixture.endings as unknown as Prisma.InputJsonValue[],
      },
    });

    const cspConsoleMessages = await collectCspViolations(page);
    await user.login();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+/);

    await test.step("the survey summary and its distribute dialog", async () => {
      await page.goto(`/workspaces/${user.workspaceId}/surveys/${survey.id}/summary`);
      await page.getByRole("button", { name: "Distribute" }).click();
      await page.getByRole("button", { name: "Email embed" }).click();

      // A srcDoc frame inherits the page's policy, so its <style> needs the nonce too.
      const previewFrame = page.frameLocator('[data-testid="survey-email-preview-frame"]');
      await expect(previewFrame.getByText("Apples", { exact: true })).toBeVisible();
      await expect(previewFrame.locator("body")).toHaveCSS("margin-top", "0px");
      await expectNoCspViolations(page, cspConsoleMessages);
    });

    await test.step("the survey editor and its live preview", async () => {
      await page.goto(`/workspaces/${user.workspaceId}/surveys/${survey.id}/edit`);
      // The preview renders through the surveys bundle, which the loader runs as an inline script.
      await expect(page.locator("#fbjs").getByText(EMBED_SURVEY_PREVIEW_HEADLINE).first()).toBeVisible({
        timeout: 30_000,
      });
      await expectNoCspViolations(page, cspConsoleMessages);
    });

    await test.step("the link survey a respondent opens", async () => {
      const directives = await gotoWithPolicy(page, `/s/${survey.id}`);
      expect(directives.get("frame-ancestors")).toEqual(["*"]);

      await expect(page.locator("#fbjs").getByText("Apples", { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("#formbricks__css")).toHaveCount(1);
      await expectNoCspViolations(page, cspConsoleMessages);
    });
  });
});
