import { createId } from "@paralleldrive/cuid2";
import { expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Page } from "playwright";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { tableRow } from "./utils/table-toolbar";

/**
 * Survey import and export (ENG-6844), as one journey: a survey leaves workspace A as a Formbricks file,
 * lands in workspace B as a new draft, and the same file, edited, comes back to A as an Update of the
 * survey it was exported from. Each phase starts from the previous one's file, so they share one test;
 * the phases are `test.step`s so a failure names the phase.
 *
 * The file's rules (envelope, references, matching, conflicts) are unit- and integration-tested next to
 * the code. This proves the parts that only exist once the browser, the routes and the database are
 * wired together: the download is a real file, the dialog reads it back, and the two commits land where
 * they should.
 */

// Unique per run and per worker, so parallel runs never share a user or a survey name.
const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

type TI18n = { default: string; [languageCode: string]: string };

/**
 * The English and German headline of every element. The database keys the default language's text as
 * `default`; the Formbricks file, like the v3 survey document it wraps, keys it by its code.
 */
const headlinesOf = (blocks: unknown, englishKey: "default" | "en-US" = "default") =>
  (blocks as { elements: { id: string; headline: TI18n }[] }[]).flatMap((block) =>
    block.elements.map(({ id, headline }) => ({ id, en: headline[englishKey], de: headline["de-DE"] }))
  );

/** Opens Import survey from the New survey menu and hands it a file. */
const importFile = async (page: Page, filePath: string) => {
  await page.getByRole("button", { name: "New Survey" }).click();
  await page.getByTestId("import-survey-menu-item").click();
  const dialog = page.getByRole("dialog", { name: "Import a survey" });
  await dialog.getByLabel(/Drop a file here or click to choose one/).setInputFiles(filePath);
  return dialog;
};

test.describe("Survey import and export", () => {
  test("exports a survey as a Formbricks file, imports it into another workspace, and updates the original from an edited copy", async ({
    page,
    users,
  }) => {
    const run = stamp();
    const surveyName = `Import Export ${run}`;
    const headline = "What should we build next?";
    const germanHeadline = "Was sollen wir als Nächstes bauen?";
    const editedHeadline = "What should we build after that?";

    const user = await users.create({
      email: `import-export-${run}@example.com`,
      name: `import-export-${run}`,
      workspaceName: `Source ${run}`,
      skipSurveySeed: true,
    });
    const { workspaceId: sourceWorkspaceId, organizationId } = user;
    if (!sourceWorkspaceId || !organizationId) {
      throw new Error("Workspace not seeded for the test user");
    }

    // Workspace B, in the same organization, so the owner can open it. It holds one survey so its list
    // shows the table and the New survey menu rather than the first-survey templates.
    const targetWorkspace = await prisma.workspace.create({
      data: {
        name: `Target ${run}`,
        organizationId,
        surveys: {
          create: { name: `Placeholder ${run}`, createdBy: user.id, status: "draft", type: "link" },
        },
      },
    });

    // A draft (a live survey can only be saved as new, not updated) with one question in English and
    // German. The German language does not exist in workspace B yet, so the import has to create it.
    const survey = await prisma.survey.create({
      data: {
        workspaceId: sourceWorkspaceId,
        createdBy: user.id,
        name: surveyName,
        status: "draft",
        type: "link",
        blocks: [
          {
            id: createId(),
            name: "Block 1",
            elements: [
              {
                id: createId(),
                type: "openText",
                headline: { default: headline, "de-DE": germanHeadline },
                required: true,
                inputType: "text",
                charLimit: { enabled: false },
              },
            ],
          },
        ],
        endings: [
          {
            id: createId(),
            type: "endScreen",
            headline: { default: "Thank you!", "de-DE": "Danke!" },
          },
        ],
        languages: {
          create: [
            {
              default: true,
              enabled: true,
              language: { create: { code: "en-US", workspaceId: sourceWorkspaceId } },
            },
            {
              default: false,
              enabled: true,
              language: { create: { code: "de-DE", workspaceId: sourceWorkspaceId } },
            },
          ],
        },
      },
    });
    const sourceHeadlines = headlinesOf(survey.blocks);

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/workspaces/${sourceWorkspaceId}/surveys`);

    const exportedFile =
      await test.step("the card menu downloads the survey as a Formbricks file", async () => {
        await tableRow(page, "survey-list-table", surveyName).getByTestId("survey-dropdown-trigger").click();
        // By keyboard: the submenu opens to the left of the menu, and a pointer jumping straight across to
        // it can leave Radix's hover grace area and close it.
        await page.getByTestId("survey-export-submenu").focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.getByTestId("export-formbricks-file")).toBeFocused();
        const downloadEvent = page.waitForEvent("download");
        await page.keyboard.press("Enter");
        const download = await downloadEvent;

        expect(download.suggestedFilename()).toBe(`${surveyName}.formbricks.json`);
        const filePath = test.info().outputPath("exported", download.suggestedFilename());
        await download.saveAs(filePath);

        const file = JSON.parse(await readFile(filePath, "utf8"));
        expect(file.formbricks.source.surveyId).toBe(survey.id);
        expect(file.survey.name).toBe(surveyName);
        expect(headlinesOf(file.survey.blocks, "en-US")).toEqual(sourceHeadlines);
        return { filePath, file };
      });

    await test.step("another workspace imports the file as a new draft", async () => {
      await page.goto(`/workspaces/${targetWorkspace.id}/surveys`);
      const dialog = await importFile(page, exportedFile.filePath);

      // The survey's id belongs to workspace A, so nothing here matches it: no Update is offered.
      await expect(dialog.getByText(headline, { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(dialog.getByTestId("survey-import-match")).toHaveCount(0);
      await dialog.getByTestId("survey-import-save").click();
      await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit/, { timeout: 60000 });

      const imported = await prisma.survey.findFirstOrThrow({
        where: { workspaceId: targetWorkspace.id, name: `${surveyName} (imported)` },
        include: { languages: { include: { language: true } } },
      });
      expect(page.url()).toContain(`/workspaces/${targetWorkspace.id}/surveys/${imported.id}/edit`);
      expect(imported.id).not.toBe(survey.id);
      expect(imported.status).toBe("draft");
      expect(headlinesOf(imported.blocks)).toEqual(sourceHeadlines);
      expect(
        imported.languages.map(({ language, default: isDefault }) => ({ code: language.code, isDefault }))
      ).toEqual(
        expect.arrayContaining([
          { code: "en-US", isDefault: true },
          { code: "de-DE", isDefault: false },
        ])
      );
    });

    await test.step("the edited file updates the survey it was exported from", async () => {
      // A person editing the file by hand: the first question gets a new headline.
      const edited = structuredClone(exportedFile.file);
      edited.survey.blocks[0].elements[0].headline["en-US"] = editedHeadline;
      const editedPath = test.info().outputPath("edited", `${surveyName}.formbricks.json`);
      await mkdir(path.dirname(editedPath), { recursive: true });
      await writeFile(editedPath, JSON.stringify(edited, null, 2));

      await page.goto(`/workspaces/${sourceWorkspaceId}/surveys`);
      const dialog = await importFile(page, editedPath);

      // The file names this survey and it has not changed since the export, so Update is the default.
      const match = dialog.getByTestId("survey-import-match-choice");
      await expect(match).toBeVisible({ timeout: 30000 });
      await expect(match.getByRole("radio", { name: "Update", exact: true })).toBeChecked();
      await expect(dialog.getByTestId("survey-import-stale")).toHaveCount(0);
      await expect(dialog.getByText(editedHeadline, { exact: true })).toBeVisible();
      await dialog.getByTestId("survey-import-update").click();
      await page.waitForURL(`**/workspaces/${sourceWorkspaceId}/surveys/${survey.id}/edit`, {
        timeout: 60000,
      });

      const updated = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } });
      expect(updated.name).toBe(surveyName);
      expect(headlinesOf(updated.blocks)).toEqual([
        { ...sourceHeadlines[0], en: editedHeadline },
        ...sourceHeadlines.slice(1),
      ]);
      // Updated in place: workspace A still holds just the one survey.
      expect(await prisma.survey.count({ where: { workspaceId: sourceWorkspaceId } })).toBe(1);
    });
  });
});
