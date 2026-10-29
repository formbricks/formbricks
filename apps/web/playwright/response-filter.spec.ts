import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";
import { addAdvancedRule, clearAllFilters } from "./utils/table-toolbar";

/**
 * **Filtering responses by a reserved field, end to end (ENG-1848).**
 *
 * The unit suites pin every layer on its own: enumeration and gating (getReservedFilterEntries),
 * the criteria mapping (getFormattedFilters), and the Prisma translation (buildWhereClause). This
 * walks the seam none of them reach — the real page: Advanced filter offers the catalog field, a rule
 * on it narrows the table through the real query, the no-value "is not set" operator inverts it, and
 * the filter follows the URL to Summary and into the filtered download (ENG-3536).
 */
type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const QUESTION = "How did you hear about us?";
const ENDING_HEADLINE = "Thanks!";
const CAMPAIGN_ANSWER = "From the newsletter";
const BARE_ANSWER = "Found it myself";

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
      name: "Response filter survey",
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
  await expect(page.getByText(ENDING_HEADLINE)).toBeVisible({ timeout: 60000 });
};

test.describe("Response filtering by reserved fields @slow", () => {
  test("filters the table by UTM Source, including the no-value Is-set family", async ({
    page,
    users,
  }, testInfo) => {
    const owner = await users.create({ skipSurveySeed: true });
    if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedSurvey(owner.workspaceId, owner.id);

    await page.goto(`/s/${surveyId}?utm_source=newsletter`);
    await submitAnswer(page, CAMPAIGN_ANSWER);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`/s/${surveyId}`);
    await submitAnswer(page, BARE_ANSWER);
    await expect
      .poll(async () => prisma.response.count({ where: { surveyId } }), {
        timeout: 20000,
        message: "Both submitted responses should be stored",
      })
      .toBe(2);

    await owner.login();
    await page.goto(`/workspaces/${owner.workspaceId}/surveys/${surveyId}/responses`);
    // The table renders an answer in more than one span, so assert via first()/count.
    await expect(page.getByText(CAMPAIGN_ANSWER).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(BARE_ANSWER).first()).toBeVisible();

    await test.step("UTM Source is newsletter → only the campaign response remains", async () => {
      await addAdvancedRule(page, { property: "UTM Source", operator: "is", value: "newsletter" });

      // Positive first: once the expected row has re-rendered, the absence check is meaningful
      // (an empty still-loading table would satisfy toHaveCount(0) immediately).
      await expect(page.getByText(CAMPAIGN_ANSWER).first()).toBeVisible();
      await expect(page.getByText(BARE_ANSWER)).toHaveCount(0);
      await expect(page.getByTestId("table-match-count")).toHaveText("1 result");
    });

    await test.step("UTM Source is not set → only the bare response remains", async () => {
      await clearAllFilters(page);
      await addAdvancedRule(page, { property: "UTM Source", operator: "is not set" });

      await expect(page.getByText(BARE_ANSWER).first()).toBeVisible();
      await expect(page.getByText(CAMPAIGN_ANSWER)).toHaveCount(0);
    });

    await test.step("the filter follows to Summary and into the filtered download", async () => {
      await page.getByRole("link", { name: "Summary" }).click();
      await expect(page).toHaveURL(/\/summary\?filter%5Bmeta\.utmSource%5D%5BisNotSet%5D=true/);
      await expect(page.getByTestId("table-match-count")).toHaveText("1 result");

      await page.getByRole("button", { name: "Download" }).click();
      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("fb__custom-filter-download-filtered-csv").click();
      const download = await downloadPromise;
      const csvPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(csvPath);
      const csv = await readFile(csvPath, "utf8");
      expect(csv).toContain(BARE_ANSWER);
      expect(csv).not.toContain(CAMPAIGN_ANSWER);
    });
  });
});
