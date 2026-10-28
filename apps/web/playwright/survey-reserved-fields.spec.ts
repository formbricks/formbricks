import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Reserved fields in recall (ENG-1840, ENG-2538).
 *
 * Reserved fields are auto-captured metadata (`url`, `source`, `action`, `language`, …) that every
 * survey can reference without declaring anything. What can only be proven in a browser is the
 * end-to-end resolution in the rendered survey: the renderer reads a prebuilt bundle
 * (`apps/web/public/js/surveys.umd.cjs`), so a recall token that is stored correctly proves nothing about
 * the running survey. These drive the real link survey, seeded with the recall token an agent would write
 * through the survey API.
 */

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

/** Deliberately un-URL-like, so "the fallback rendered" and "a URL leaked" can never be confused. */
const FALLBACK_MARKER = "FALLBACK-HIT";

const seedRecallSurvey = async (
  workspaceId: string,
  createdBy: string,
  headline: string
): Promise<string> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: { default: "Thanks!" } },
  ] as unknown as TSurveyEnding[];
  const questions = [
    {
      id: createId(),
      type: "openText",
      headline: { default: headline },
      required: false,
      inputType: "text",
      placeholder: { default: "Type your answer here..." },
      charLimit: { enabled: false },
    },
  ];

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Reserved field recall",
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

/** The element holding the whole headline: typed text and the resolved token sit side by side in it. */
const headlineContaining = (page: Page, text: string): Locator =>
  page.getByRole("main").getByText(text).first();

test.describe("Reserved fields in recall", () => {
  test("a headline recalling the url renders the real URL mid-survey", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    const workspaceId = user.workspaceId;
    if (!workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedRecallSurvey(
      workspaceId,
      user.id,
      "You came from #recall:url/fallback:somewhere#"
    );

    await page.goto(`/s/${surveyId}`);

    // `url` is the page the survey runs on, so the headline must echo the link just opened — and must
    // not still contain the raw storage token or fall through to its fallback text.
    const headline = headlineContaining(page, "You came from");
    await expect(headline).toBeVisible({ timeout: 30000 });
    await expect(headline).toContainText(page.url().split("?")[0]);
    await expect(headline).not.toContainText("#recall:");
    await expect(headline).not.toContainText("somewhere");
  });

  test("a survey DECLARING `url` renders the author's fallback when the field is empty", async ({
    page,
    users,
  }) => {
    // ENG-2538, bug 1 — the one this whole spec exists to keep fixed, and the only place it is
    // provable. `mergeReservedValues` is a spread, and a spread only wins for keys that EXIST: an
    // optional hidden field the respondent never filled overwrote nothing, so the reserved page URL
    // survived into the headline where the author had written a fallback.
    //
    // Not a preview artefact: a respondent opening `/s/<id>` without the param takes the same path.
    // Supplying the param is what makes it look correct, which is why the happy-path test above
    // misses it — and why this test opens the link BOTH ways.
    const user = await users.create({ skipSurveySeed: true });
    const workspaceId = user.workspaceId;
    if (!workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedRecallSurvey(
      workspaceId,
      user.id,
      `url=#recall:url/fallback:${FALLBACK_MARKER}#`
    );

    await test.step("declare a hidden field named `url`", async () => {
      // Written directly because ENG-1839's guard refuses to CREATE a declared field named `url` —
      // which is the point: surveys in production that already declare it are grandfathered, and they
      // are exactly who this bug hurt. The rows are what the renderer reads (`getSurveyEmbeddedFields`),
      // inlined onto the survey at load.
      const field = await prisma.embeddedData.create({
        data: {
          name: "url",
          source: "ingested",
          dataType: "string",
          workspaceId,
          surveyId,
        },
      });
      await prisma.surveyEmbeddedData.create({
        data: {
          storageKey: "url",
          order: 0,
          surveyId,
          workspaceId,
          embeddedDataId: field.id,
        },
      });
    });

    await test.step("WITHOUT the param, the headline shows the fallback and never a URL", async () => {
      await page.goto(`/s/${surveyId}`);

      const headline = headlineContaining(page, "url=");
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText(`url=${FALLBACK_MARKER}`);
      // The regression itself, asserted on the shape of the leaked value rather than on one URL:
      // the reserved read is the page's own address, so any scheme reaching this headline is the bug.
      await expect(headline).not.toContainText("http");
      await expect(headline).not.toContainText("#recall:");
    });

    await test.step("WITH the param, the respondent's value wins — the grandfather rule", async () => {
      await page.goto(`/s/${surveyId}?url=SUPPLIED-BY-RESPONDENT`);

      const headline = headlineContaining(page, "url=");
      await expect(headline).toBeVisible({ timeout: 30000 });
      await expect(headline).toContainText("url=SUPPLIED-BY-RESPONDENT");
      await expect(headline).not.toContainText(FALLBACK_MARKER);
    });
  });
});
