import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as xlsx from "xlsx";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { readZip } from "@/lib/analysis-export/__fixtures__/read-zip";
import { test } from "./lib/fixtures";

/**
 * **Response export, end to end (ENG-1847, ENG-6794).**
 *
 * The unit suites pin every rule on its own (the catalog-derived Standard columns, the option matcher,
 * the datamap, the file writers, the published lock). This walks the one seam none of them reach: a
 * browser submits through the survey bundle → Postgres → the owner exports from the Export modal → the
 * files Playwright catches say what the rules promise.
 *
 * One journey, one survey that was coded by the default fill (`q1`, `q2`, answer codes 1…3):
 *  1. Standard export (modal defaults): a BOM-free CSV whose columns come from the catalog. This is the
 *     regression that motivated ENG-1847: the export used to take its meta columns from the first
 *     fetched response, and responses are fetched newest-first, so a bare newest response erased the
 *     campaign columns from the whole file.
 *  2. Analysis export to Excel: codes, a datamap, and the answer that matches no option listed.
 *  3. A response marked Low quality on its card is left out of the next Analysis export, and the modal
 *     says so.
 *  4. The survey is published, so the server refuses to change an answer code.
 */
type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const QUESTION = "How did you hear about us?";
const COLOUR_QUESTION = "Which colour do you prefer?";
const ENDING_HEADLINE = "Thanks!";
const SPAM_ANSWER = "Spam spam spam";

const UTM_QUERY = "utm_source=newsletter&utm_medium=email";

const BOM = "﻿";

type TSeededSurvey = { id: string; openTextId: string; colourId: string };

const seedSurvey = async (workspaceId: string, createdBy: string): Promise<TSeededSurvey> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: i18nValue(ENDING_HEADLINE) },
  ] as unknown as TSurveyEnding[];

  const openTextId = createId();
  const colourId = createId();
  const questions = [
    {
      id: openTextId,
      type: "openText",
      headline: i18nValue(QUESTION),
      required: true,
      inputType: "text",
      placeholder: i18nValue("Type your answer here..."),
      charLimit: { enabled: false },
    },
    {
      id: colourId,
      type: "multipleChoiceSingle",
      headline: i18nValue(COLOUR_QUESTION),
      required: true,
      shuffleOption: "none",
      choices: [
        { id: createId(), label: i18nValue("Red") },
        { id: createId(), label: i18nValue("Blue") },
        { id: createId(), label: i18nValue("Green") },
      ],
    },
  ];

  // `transformQuestionsToBlocks` runs the default fill, so the survey is coded exactly as one saved in
  // the editor would be: question codes q1, q2 and answer codes 1, 2, 3.
  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Response export survey",
      type: "link",
      status: "inProgress",
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: transformQuestionsToBlocks(
        questions as unknown as TLegacyQuestions,
        endings
      ) as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });

  return { id: survey.id, openTextId, colourId };
};

const submitAnswer = async (page: Page, answer: string, colour: string): Promise<void> => {
  await expect(page.getByText(QUESTION)).toBeVisible();
  await page.getByPlaceholder("Type your answer here...").fill(answer);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText(colour, { exact: true }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  // The ending card only renders once the ingest POST resolves; the first submission of a run can
  // take longer than the default 5s, so wait for the real signal.
  await expect(page.getByText(ENDING_HEADLINE)).toBeVisible({ timeout: 60000 });
};

/** Picks an option of one of the modal's selects. */
const pick = async (page: Page, select: "format" | "display-questions" | "display-answers", name: string) => {
  await page.locator(`#export-${select}`).click();
  await page.getByRole("option", { name, exact: true }).click();
};

/** Opens the Export modal on the Responses page, ticks what `choose` ticks, and returns the download. */
const exportFile = async (
  page: Page,
  choose: (modal: ReturnType<Page["getByTestId"]>) => Promise<void> = async () => undefined
) => {
  await page.getByTestId("fb__custom-filter-export").click();
  const modal = page.getByTestId("export-modal");
  await expect(modal).toBeVisible();
  await choose(modal);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-submit").click();
  return downloadPromise;
};

test.describe("Response export @slow", () => {
  test("exports the Standard CSV and the Analysis files, leaving Low quality out", async ({
    page,
    users,
  }, testInfo) => {
    const owner = await users.create({ skipSurveySeed: true });
    if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const survey = await seedSurvey(owner.workspaceId, owner.id);
    const surveyId = survey.id;

    await test.step("two respondents answer through the survey link, two more are seeded", async () => {
      // Respondent 1 arrives through a campaign link, so their response carries the utm fields, and a
      // page URL whose query string must NOT survive into the export (`redactQuery`).
      await page.goto(`/s/${surveyId}?${UTM_QUERY}`);
      await submitAnswer(page, "From the newsletter", "Red");

      // Respondent 2 uses the bare link. Submitted second, so this response is the NEWEST of the two:
      // the one the old first-response derivation would have taken the header set from.
      // localStorage is cleared so the renderer treats this as a fresh respondent.
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(`/s/${surveyId}`);
      await submitAnswer(page, "Found it myself", "Blue");

      // Both rows are written asynchronously after submit; poll rather than race the second insert.
      await expect
        .poll(async () => prisma.response.count({ where: { surveyId } }), {
          timeout: 20000,
          message: "Both submitted responses should be stored",
        })
        .toBe(2);

      // Seeded straight into Postgres: an answer that matches no option ("Purple", say, typed into a
      // legacy import) and the response a reviewer will mark Low quality.
      await prisma.response.createMany({
        data: [
          {
            surveyId,
            finished: true,
            language: "default",
            data: { [survey.openTextId]: "Imported", [survey.colourId]: "Purple" },
          },
          {
            surveyId,
            finished: true,
            language: "default",
            data: { [survey.openTextId]: SPAM_ANSWER, [survey.colourId]: "Green" },
          },
        ],
      });
    });

    await owner.login();
    await page.goto(`/workspaces/${owner.workspaceId}/surveys/${surveyId}/responses`);

    await test.step("the modal's defaults download the Standard CSV", async () => {
      const download = await exportFile(page);

      // saveAs into the test's output dir keeps the file beside the failure artifacts.
      const csvPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(csvPath);
      expect(csvPath).toMatch(/\.csv$/);
      const csv = await readFile(csvPath, "utf-8");
      const [headerLine] = csv.split("\n");

      // Standard stays byte-compatible with what it always was: no BOM.
      expect(csv.startsWith(BOM)).toBe(false);

      // Stability: the campaign columns are there even though the newest response never had them,
      // and they carry the catalog's titlecased names, not raw meta keys.
      expect(headerLine).toContain("Utm Source");
      expect(headerLine).toContain("Utm Medium");
      expect(headerLine).toContain("Browser");
      expect(headerLine).not.toContain("userAgent - browser");

      // Typed catalog columns that raw response meta never carried.
      expect(headerLine).toContain("Duration Seconds");
      expect(headerLine).toContain("Finished At");

      // Dedupe: the export's basic "Timestamp" column already covers startedAt, so the catalog copy
      // must not re-appear beside it.
      expect(headerLine).not.toContain("Started At");

      // The campaign row's value made it into a cell of its own. Quoted, because the answer text
      // "From the newsletter" would otherwise match too.
      expect(csv).toContain('"newsletter"');

      // Redaction: the survey was answered at a URL carrying the query string, and `redactQuery`
      // strips it from the exported Url, so the raw query must appear nowhere in the file.
      expect(csv).not.toContain("utm_source=");

      // Header plus the four responses.
      expect(csv.trim().split("\n")).toHaveLength(5);
    });

    await test.step("Excel with codes, a datamap and unmapped values", async () => {
      const download = await exportFile(page, async (modal) => {
        await pick(page, "format", ".xlsx");
        await pick(page, "display-questions", "Code only");
        await pick(page, "display-answers", "Code only");
        await modal.getByLabel("Add datamap").click();
        await modal.getByLabel("Add unmapped values").click();
        await expect(page.getByTestId("export-count-line")).toContainText("Include 4 responses");
      });
      const xlsxPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(xlsxPath);
      expect(xlsxPath).toMatch(/\.xlsx$/);

      const workbook = xlsx.read(await readFile(xlsxPath), { type: "buffer" });
      expect(workbook.SheetNames).toEqual(["Codes", "Datamap", "Unmapped values"]);

      const codes = xlsx.utils.sheet_to_json<string[]>(workbook.Sheets.Codes, { header: 1 });
      const [header, ...rows] = codes;
      expect(header).toEqual(expect.arrayContaining(["response_id", "outcome", "q1", "q2"]));
      expect(rows).toHaveLength(4);
      // The colour answers became answer codes; "Purple" matches no option and says so in the cell.
      const colours = rows.map((row) => String(row[header.indexOf("q2")]));
      expect(colours.sort()).toEqual(["1", "2", "3", "UNMAPPED:Purple"]);

      const datamap = xlsx.utils.sheet_to_json<string[]>(workbook.Sheets.Datamap, { header: 1 });
      expect(datamap.map((row) => row.slice(0, 6).join("|"))).toContain(
        `q2|${survey.colourId}|${COLOUR_QUESTION}|single select . code|2|Blue`
      );

      const unmapped = xlsx.utils.sheet_to_json<string[]>(workbook.Sheets["Unmapped values"], { header: 1 });
      expect(unmapped.flat()).toContain("Purple");
    });

    await test.step("Compress into .zip downloads a single CSV as a zip", async () => {
      const download = await exportFile(page, async (modal) => {
        await pick(page, "display-answers", "Code only");
        await modal.getByLabel("Compress into .zip").click();
      });
      const zipPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(zipPath);
      expect(zipPath).toMatch(/\.zip$/);
      // "PK": the signature every zip file starts with.
      expect((await readFile(zipPath)).subarray(0, 2).toString()).toBe("PK");
    });

    await test.step("a response marked Low quality on its card is left out by default", async () => {
      await page.getByText(SPAM_ANSWER).first().click();
      await page.getByRole("button", { name: "Mark as low quality" }).click();
      await expect
        .poll(async () => prisma.response.count({ where: { surveyId, outcome: "lowQuality" } }))
        .toBe(1);
      await expect(page.getByRole("button", { name: "Restore as complete" })).toBeVisible({ timeout: 30000 });
      await page.keyboard.press("Escape");

      const download = await exportFile(page, async (modal) => {
        await pick(page, "display-questions", "Code only");
        await pick(page, "display-answers", "Code only");
        await modal.getByLabel("Add datamap").click();
        await expect(page.getByTestId("export-count-line")).toContainText("Include 3 responses");
        await expect(page.getByTestId("export-count-line")).toContainText("1 Low quality left out");
      });
      const zipPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(zipPath);
      expect(zipPath).toMatch(/\.zip$/);

      const entries = readZip(await readFile(zipPath));
      expect(entries.map((entry) => entry.name).sort()).toEqual(["data.csv", "datamap.csv"]);
      const dataCsv = entries.find((entry) => entry.name === "data.csv")?.data.toString("utf-8") ?? "";
      // The Analysis CSV opens cleanly in Excel: BOM first.
      expect(dataCsv.startsWith(BOM)).toBe(true);
      // Header plus the three that stayed in; the marked response's answer is nowhere.
      expect(dataCsv.trim().split(/\r?\n/)).toHaveLength(4);
      expect(dataCsv).not.toContain(SPAM_ANSWER);
    });

    await test.step("the published survey refuses to change an answer code", async () => {
      const url = `/api/v3/surveys/${surveyId}`;
      const current = await page.request.get(url);
      expect(current.ok()).toBe(true);
      const document = (await current.json()) as {
        data: { blocks: { elements: { type: string; choices?: { code: string }[] }[] }[]; updatedAt: string };
      };
      const blocks = structuredClone(document.data.blocks);
      const choices = blocks.flatMap((block) => block.elements).find((e) => e.choices)?.choices;
      if (!choices) throw new Error("The seeded survey lost its choices");
      choices[0].code = "9";

      const refused = await page.request.patch(url, { data: { blocks } });
      expect(refused.status()).toBe(422);
      const problem = (await refused.json()) as { invalid_params?: { code?: string }[] };
      expect(problem.invalid_params?.map((param) => param.code)).toContain("immutable_answer_code");
    });
  });
});
