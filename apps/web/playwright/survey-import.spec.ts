import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

// CI has no AI provider, so the import's stream is answered in the browser with a recorded one: the
// draft and report the pipeline builds for this file from its recorded plan. The spec covers the
// dialog, the review and the real create; the reader, the AI plan and the assembly stay with their
// unit tests. The instance only has to count as AI-configured (e2e.yml sets a provider nothing calls),
// and the organization's AI switch is turned on below.
const QSF_FILE = resolve(
  process.cwd(),
  "apps/web/modules/survey/import/qsf/__fixtures__/matrix-slider-ranking.qsf"
);
const RECORDED_DONE = JSON.parse(
  readFileSync(resolve(process.cwd(), "apps/web/playwright/fixtures/qsf-import-done.json"), "utf8")
) as { payload: { name: string; workspaceId: string }; report: unknown };

/** The NDJSON the import route streams, with the draft placed in this test's workspace. */
const recordedStream = (workspaceId: string) =>
  [
    { type: "start", requestId: "e2e-import" },
    { type: "progress", stage: "reading" },
    { type: "progress", stage: "ai" },
    { type: "progress", stage: "assembling" },
    { type: "done", payload: { ...RECORDED_DONE.payload, workspaceId }, report: RECORDED_DONE.report },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n") + "\n";

test.describe("Survey import", () => {
  test("imports a Qualtrics file, shows the draft and its report, and opens it in the editor", async ({
    page,
    users,
  }) => {
    const timestamp = Date.now();
    const email = `import-${timestamp}@example.com`;
    const user = await users.create({
      email,
      name: `import-${timestamp}`,
      workspaceName: "Import Workspace",
    });
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    const workspaceId =
      /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to determine workspace id from surveys URL");
      })();

    let recordedStreamCalls = 0;

    await test.step("seed: AI on for the organization, and a survey so the list shows its menu", async () => {
      const workspace = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { organizationId: true },
      });
      await prisma.organization.update({
        where: { id: workspace.organizationId },
        data: { isAISmartToolsEnabled: true },
      });
      const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
      await prisma.survey.create({
        data: {
          workspaceId,
          createdBy: userId,
          name: `Existing ${timestamp}`,
          status: "draft",
          type: "link",
        },
      });
      await page.route("**/api/internal/surveys/import/stream", (route) => {
        recordedStreamCalls += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/x-ndjson; charset=utf-8",
          body: recordedStream(workspaceId),
        });
      });
      await page.reload();
    });

    const dialog = page.getByRole("dialog");

    await test.step("choose a .qsf in the import dialog", async () => {
      await page.getByRole("button", { name: "New Survey" }).click();
      await page.getByTestId("import-survey-menu-item").click();
      await expect(dialog.getByText("Import a Qualtrics survey")).toBeVisible();
      await dialog.locator('input[type="file"]').setInputFiles(QSF_FILE);
    });

    await test.step("review the draft and the report of what was left out", async () => {
      await expect(dialog.getByText("Rate our service")).toBeVisible({ timeout: 15000 });
      await expect(dialog.getByText("Rank these priorities")).toBeVisible();
      // The report opens by itself when it holds warnings, naming the Qualtrics type it could not bring.
      await expect(
        dialog.getByText("Q10: Question skipped: Formbricks has no Constant sum question.")
      ).toBeVisible();
      // The recorded answer, not a model: nothing in this run reaches an AI provider.
      expect(recordedStreamCalls).toBe(1);
    });

    await test.step("save the draft and open it in the editor", async () => {
      const createRequest = page.waitForRequest(
        (request) =>
          request.method() === "POST" && request.url().includes("/api/v3/surveys?createdFrom=import")
      );
      await dialog.getByRole("button", { name: "Save and continue" }).click();
      await createRequest;
      await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit(\?.*)?$/);
      await expect(page.getByText("Rate our service").first()).toBeVisible({ timeout: 15000 });

      const imported = await prisma.survey.findFirst({
        where: { workspaceId, name: RECORDED_DONE.payload.name },
        select: { status: true },
      });
      expect(imported?.status).toBe("draft");
    });
  });
});
