import { createId } from "@paralleldrive/cuid2";
import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * The one happy-path journey of the Import & Export feature area: survey list → export → import dialog →
 * review → editor. Seeded through Prisma (the same boundary the `users` fixture writes through), asserted
 * on network responses and visible text, no timing hacks. QSF and document imports extend this spec with
 * their own `test.step` when their lanes ship — they are steps of the same journey, not new specs.
 */

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const i18n = (en: string, de: string) => ({ default: en, "de-DE": de });

/**
 * A two-language link survey with three blocks (single select with an "other" choice, NPS, open text),
 * one jumpToBlock rule to the ending and a recall in the ending headline — every part of the document the
 * export has to carry and the import has to resolve.
 */
const seedSurvey = async ({
  workspaceId,
  userId,
  name,
}: {
  workspaceId: string;
  userId: string;
  name: string;
}) => {
  const [english, german] = await Promise.all(
    (["en-US", "de-DE"] as const).map((code) =>
      prisma.language.upsert({
        where: { workspaceId_code: { workspaceId, code } },
        update: {},
        create: { workspaceId, code, alias: null },
      })
    )
  );

  const endingId = createId();
  const blockIds = [createId(), createId(), createId()];

  return prisma.survey.create({
    data: {
      workspaceId,
      createdBy: userId,
      name,
      type: "link",
      status: "draft",
      welcomeCard: { enabled: false, timeToFinish: true, showResponseCount: false },
      blocks: [
        {
          id: blockIds[0],
          name: "Source",
          elements: [
            {
              id: "heard_about",
              type: "multipleChoiceSingle",
              headline: i18n("How did you hear about us?", "Wie haben Sie von uns erfahren?"),
              required: true,
              choices: [
                { id: "search", label: i18n("Search engine", "Suchmaschine") },
                { id: "friend", label: i18n("A friend", "Ein Freund") },
                { id: "other", label: i18n("Other", "Andere") },
              ],
              otherOptionPlaceholder: i18n("Please specify", "Bitte angeben"),
            },
          ],
        },
        {
          id: blockIds[1],
          name: "Loyalty",
          elements: [
            {
              id: "nps",
              type: "nps",
              headline: i18n("How likely are you to recommend us?", "Wie wahrscheinlich empfehlen Sie uns?"),
              required: true,
              isColorCodingEnabled: false,
            },
          ],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: { type: "element", value: "nps" },
                    operator: "isGreaterThan",
                    rightOperand: { type: "static", value: 8 },
                  },
                ],
              },
              actions: [{ id: createId(), objective: "jumpToBlock", target: endingId }],
            },
          ],
        },
        {
          id: blockIds[2],
          name: "Details",
          elements: [
            {
              id: "improve",
              type: "openText",
              headline: i18n("What should we improve?", "Was sollen wir verbessern?"),
              required: false,
              inputType: "text",
              longAnswer: true,
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      endings: [
        {
          id: endingId,
          type: "endScreen",
          headline: i18n("Thanks, #recall:improve/fallback:#!", "Danke, #recall:improve/fallback:#!"),
        },
      ],
      hiddenFields: { enabled: false },
      variables: [],
      languages: {
        create: [
          { languageId: english.id, default: true, enabled: true },
          { languageId: german.id, default: false, enabled: true },
        ],
      },
    },
  });
};

test.describe("Survey import & export", () => {
  test("exports a survey, imports the file and lands in the editor", async ({ page, users }) => {
    const run = stamp();
    const surveyName = `Round trip ${run}`;
    const user = await users.create({
      email: `import-export-${run}@example.com`,
      name: `import-export-${run}`,
      workspaceName: `Import Export ${run}`,
      skipSurveySeed: true,
    });
    const { workspaceId } = user;
    if (!workspaceId) {
      throw new Error("Workspace not seeded for the test user");
    }

    const survey = await seedSurvey({ workspaceId, userId: user.id, name: surveyName });

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    let exportFile = "";
    await test.step("export", async () => {
      // The session cookie set by login is shared with the request context, so this is the same call
      // the "Export as JSON" menu item makes.
      const response = await page.request.get(`/api/v3/surveys/${survey.id}/export`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data: { formbricks: { exportFormat: number }; survey: { languages: unknown[]; blocks: unknown[] } };
      };
      expect(body.data.formbricks.exportFormat).toBe(1);
      expect(body.data.survey.languages).toHaveLength(2);
      expect(body.data.survey.blocks).toHaveLength(3);
      exportFile = JSON.stringify(body.data);
    });

    await test.step("import", async () => {
      await page.goto(`/workspaces/${workspaceId}/surveys`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "New Survey" }).click();
      await page.getByTestId("import-survey-menu-item").click();

      await expect(page.getByRole("dialog")).toContainText("Import survey");
      // Selecting a valid file is the submit: the dialog reads it, dry-runs it and lands in review.
      const dryRun = page.waitForResponse(
        (response) =>
          response.url().includes("/api/v3/surveys/import") && response.request().method() === "POST"
      );
      await page.locator("#import-survey-file").setInputFiles({
        name: "round-trip.formbricks.json",
        mimeType: "application/json",
        buffer: Buffer.from(exportFile),
      });
      expect((await dryRun).status()).toBe(200);

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("3 questions", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(dialog.getByText("EN · DE", { exact: true })).toBeVisible();
      // The settings note is an info line; nothing should have been changed on the way in.
      await expect(dialog.getByText(/warning/)).toHaveCount(0);
      await expect(dialog.getByLabel("Survey name")).toHaveValue(`${surveyName} (imported)`);

      const create = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v3/surveys/import") &&
          response.request().method() === "POST" &&
          response.status() === 201
      );
      await dialog.getByRole("button", { name: "Open in editor" }).click();
      await create;
    });

    await test.step("editor", async () => {
      await page.waitForURL(new RegExp(`/workspaces/${workspaceId}/surveys/(?!${survey.id})[^/]+/edit`), {
        timeout: 30000,
      });
      const importedId = /\/surveys\/([^/]+)\/edit/.exec(page.url())?.[1];
      expect(importedId).toBeTruthy();
      expect(importedId).not.toBe(survey.id);

      const imported = await prisma.survey.findUniqueOrThrow({
        where: { id: importedId! },
        include: { languages: true },
      });
      expect(imported.name).toBe(`${surveyName} (imported)`);
      expect(imported.status).toBe("draft");
      expect(imported.languages).toHaveLength(2);
      expect((imported.blocks as unknown[]).length).toBe(3);

      await page.goto(`/workspaces/${workspaceId}/surveys`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(surveyName, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(`${surveyName} (imported)`, { exact: true })).toBeVisible();
    });

    await test.step("import qsf", async () => {
      // The structured lane: a Qualtrics export goes through the multipart convert endpoint.
      const qsf = readFileSync(join(__dirname, "../modules/survey/import/lanes/qsf/__fixtures__/simple.qsf"));
      await page.getByRole("button", { name: "New Survey" }).click();
      await page.getByTestId("import-survey-menu-item").click();

      const convert = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v3/surveys/import/convert") && response.request().method() === "POST"
      );
      await page.locator("#import-survey-file").setInputFiles({
        name: "simple.qsf",
        mimeType: "application/octet-stream",
        buffer: qsf,
      });
      expect((await convert).status()).toBe(200);

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("5 questions", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(dialog.getByText("Qualtrics QSF", { exact: true })).toBeVisible();
      await expect(dialog.getByLabel("Survey name")).toHaveValue("Customer feedback (imported)");

      const create = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v3/surveys/import") &&
          response.request().method() === "POST" &&
          response.status() === 201
      );
      await dialog.getByRole("button", { name: "Open in editor" }).click();
      await create;
      await page.waitForURL(/\/surveys\/[^/]+\/edit/, { timeout: 30000 });
    });
  });
});
