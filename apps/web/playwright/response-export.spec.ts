import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * **Response export columns, end to end (ENG-1847).**
 *
 * The unit suite (apps/web/lib/response/utils.test.ts) pins every rule of the catalog-derived
 * export on its own. This walks the one seam none of them reach — the real download: a browser
 * submits → Postgres → the owner clicks Download → the CSV Playwright catches has the columns.
 *
 * The scenario is the regression that motivated the ticket. The export used to derive its meta
 * columns from the first fetched response (`Object.keys(responses[0].meta)`), and responses are
 * fetched newest-first. So: submit a campaign response first, then a bare one. On the old code the
 * bare (newest) response dictated the header set and the campaign columns vanished from the whole
 * file — silently, rows and all.
 */
type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const QUESTION = "How did you hear about us?";
const ENDING_HEADLINE = "Thanks!";

const UTM_QUERY = "utm_source=newsletter&utm_medium=email";

const seedSurvey = async (workspaceId: string, createdBy: string): Promise<string> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: i18nValue(ENDING_HEADLINE) },
  ] as unknown as TSurveyEnding[];

  const questions = [
    {
      id: createId(),
      type: "openText",
      headline: i18nValue(QUESTION),
      required: true,
      inputType: "text",
      placeholder: i18nValue("Type your answer here..."),
      charLimit: { enabled: false },
    },
  ];

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

  return survey.id;
};

const submitAnswer = async (page: Page, answer: string): Promise<void> => {
  await expect(page.getByText(QUESTION)).toBeVisible();
  await page.getByPlaceholder("Type your answer here...").fill(answer);
  await page.getByRole("button", { name: "Finish" }).click();
  // The ending card only renders once the ingest POST resolves; the first submission of a run can
  // take longer than the default 5s, so wait for the real signal.
  await expect(page.getByText(ENDING_HEADLINE)).toBeVisible({ timeout: 60000 });
};

test.describe("Response export columns @slow", () => {
  test("exports reserved fields as stable, titlecased, redacted columns", async ({ page, users }) => {
    const owner = await users.create({ skipSurveySeed: true });
    if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedSurvey(owner.workspaceId, owner.id);

    // Respondent 1 arrives through a campaign link, so their response carries the utm fields —
    // and a page URL whose query string must NOT survive into the export (`redactQuery`).
    await page.goto(`/s/${surveyId}?${UTM_QUERY}`);
    await submitAnswer(page, "From the newsletter");

    // Respondent 2 uses the bare link. Submitted second, so this response is the NEWEST — the one
    // the old first-response derivation would have taken the header set from, erasing every
    // campaign column. localStorage is cleared so the renderer treats this as a fresh respondent.
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`/s/${surveyId}`);
    await submitAnswer(page, "Found it myself");

    // Both rows are written asynchronously after submit; poll rather than race the second insert.
    await expect
      .poll(async () => prisma.response.count({ where: { surveyId } }), {
        timeout: 20000,
        message: "Both submitted responses should be stored",
      })
      .toBe(2);

    await owner.login();
    await page.goto(`/workspaces/${owner.workspaceId}/surveys/${surveyId}/responses`);

    await page.getByRole("button", { name: "Download" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("fb__custom-filter-download-all-csv").click();
    const download = await downloadPromise;

    const csvPath = await download.path();
    const csv = await readFile(csvPath, "utf-8");
    const [headerLine] = csv.split("\n");

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
    // strips it from the exported Url — so the raw query must appear nowhere in the file.
    expect(csv).not.toContain("utm_source=");

    // Header plus both response rows.
    expect(csv.trim().split("\n")).toHaveLength(3);
  });
});
