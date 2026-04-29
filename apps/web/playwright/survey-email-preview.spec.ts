import { expect } from "@playwright/test";
import { type Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  EMBED_SURVEY_PREVIEW_CHOICE_IDS,
  EMBED_SURVEY_PREVIEW_HEADLINE,
  EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER,
  EMBED_SURVEY_PREVIEW_QUESTION_ID,
  createEmbedSurveyPreviewEmailSurvey,
} from "@/modules/email/fixtures/embed-survey-preview-email-fixture";
import { test } from "./lib/fixtures";

/**
 * Manual QA for changes touching the survey email preview:
 * 1. Check the React Email preview at http://localhost:3456/preview/survey/embed-survey-preview-email.
 * 2. Check the in-app summary email preview for the seeded kitchen sink survey.
 * 3. Send one preview email and compare it in new Outlook against the in-app preview.
 */

const getUserContext = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      memberships: {
        take: 1,
        select: {
          organization: {
            select: {
              projects: {
                take: 1,
                select: {
                  environments: {
                    where: {
                      type: "development",
                    },
                    take: 1,
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const environmentId = user?.memberships[0]?.organization.projects[0]?.environments[0]?.id;
  if (!user?.id || !environmentId) {
    throw new Error(`Unable to resolve user context for ${email}`);
  }

  return {
    environmentId,
    userId: user.id,
  };
};

const createSurveySeed = async (
  environmentId: string,
  userId: string,
  name: string,
  type: TSurveyElementTypeEnum = TSurveyElementTypeEnum.MultipleChoiceMulti
) => {
  const surveyFixture = createEmbedSurveyPreviewEmailSurvey(type);
  const blocks = surveyFixture.blocks as unknown as Prisma.InputJsonValue[];
  const endings = surveyFixture.endings as unknown as Prisma.InputJsonValue[];
  const variables = surveyFixture.variables as unknown as Prisma.InputJsonValue[];

  return prisma.survey.create({
    data: {
      environmentId,
      createdBy: userId,
      name,
      status: "inProgress",
      type: "link",
      welcomeCard: surveyFixture.welcomeCard,
      blocks,
      endings,
      hiddenFields: surveyFixture.hiddenFields,
      styling: surveyFixture.styling,
      surveyClosedMessage: surveyFixture.surveyClosedMessage,
      isBackButtonHidden: surveyFixture.isBackButtonHidden,
      isAutoProgressingEnabled: surveyFixture.isAutoProgressingEnabled,
      isCaptureIpEnabled: surveyFixture.isCaptureIpEnabled,
      isVerifyEmailEnabled: surveyFixture.isVerifyEmailEnabled,
      isSingleResponsePerEmailEnabled: surveyFixture.isSingleResponsePerEmailEnabled,
      variables,
    },
  });
};

test.describe("Survey Email Preview", () => {
  test("renders the real summary email preview with styled per-option links", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `survey-email-preview-${timestamp}@example.com`;
    const user = await users.create({
      email,
      name: `survey-email-preview-${timestamp}`,
      projectName: "Email Preview Workspace",
    });

    await user.login();
    await expect(page).toHaveURL(/\/environments\/[^/]+/);

    const { environmentId, userId } = await getUserContext(email);
    const survey = await createSurveySeed(environmentId, userId, `Email Preview Survey ${timestamp}`);

    await page.goto(`/environments/${environmentId}/surveys/${survey.id}/summary`);
    await page.getByRole("button", { name: "Share survey" }).click();
    await page.getByRole("button", { name: "Email embed" }).click();

    const previewShell = page.getByTestId("survey-email-preview-shell");
    const previewFrameElement = page.getByTestId("survey-email-preview-frame");
    const previewFrame = page.frameLocator('[data-testid="survey-email-preview-frame"]');

    await expect(previewShell).toBeVisible();
    await expect(previewFrameElement).toBeVisible();
    await expect(previewFrame.getByText(EMBED_SURVEY_PREVIEW_HEADLINE)).toBeVisible();
    await expect(previewFrame.getByText("Apples", { exact: true })).toBeVisible();
    await expect(previewFrame.getByText("Bananas", { exact: true })).toBeVisible();
    await expect(previewFrame.getByText("Pineapples", { exact: true })).toBeVisible();

    const firstChoiceLink = previewFrame.locator(
      `a[href*="skipPrefilled=true"][href*="${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples)}"]`
    );
    const firstChoiceMarker = firstChoiceLink.locator('span[style*="border"]');

    await expect(previewFrame.locator(`a[href*="${EMBED_SURVEY_PREVIEW_QUESTION_ID}="]`)).toHaveCount(3);
    await expect(firstChoiceLink).toHaveCount(1);
    await expect(firstChoiceMarker).toHaveCount(1);
    await expect(firstChoiceMarker).toHaveCSS("height", "16px");
    await expect(firstChoiceMarker).toHaveCSS("border-top-left-radius", "4px");
    await expect(firstChoiceLink).toContainText("Apples");
    await expect(firstChoiceLink).toHaveCSS("background-color", "rgb(243, 244, 246)");
    await expect(firstChoiceLink).toHaveCSS("border-top-left-radius", "8px");
    await expect(firstChoiceLink).toHaveCSS("font-family", /Inter/);
    await expect(firstChoiceLink).toHaveCSS("padding-top", "16px");
    await expect(firstChoiceLink).toHaveAttribute(
      "href",
      new RegExp(`${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples}`)
    );
    await expect(firstChoiceLink).toHaveAttribute("href", /preview=true/);
    await expect(firstChoiceLink).toHaveAttribute("href", /skipPrefilled=true/);
    await expect(firstChoiceLink).toHaveAttribute("target", "_blank");

    const poweredByLink = previewFrame.getByRole("link", { name: "Powered by Formbricks" });
    await expect(poweredByLink).toHaveAttribute("href", "https://formbricks.com?utm_source=email_branding");
  });

  test("keeps non-option email previews clickable in the summary modal", async ({ page, users }) => {
    const timestamp = Date.now();
    const email = `survey-email-open-text-${timestamp}@example.com`;
    const user = await users.create({
      email,
      name: `survey-email-open-text-${timestamp}`,
      projectName: "Email Preview Workspace",
    });

    await user.login();
    await expect(page).toHaveURL(/\/environments\/[^/]+/);

    const { environmentId, userId } = await getUserContext(email);
    const survey = await createSurveySeed(
      environmentId,
      userId,
      `Email Preview Open Text ${timestamp}`,
      TSurveyElementTypeEnum.OpenText
    );

    await page.goto(`/environments/${environmentId}/surveys/${survey.id}/summary`);
    await page.getByRole("button", { name: "Share survey" }).click();
    await page.getByRole("button", { name: "Email embed" }).click();

    const previewFrame = page.frameLocator('[data-testid="survey-email-preview-frame"]');
    const openTextLink = previewFrame.getByRole("link", { name: EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER });
    const openTextInputShell = openTextLink.locator("xpath=..");

    await expect(previewFrame.getByText(EMBED_SURVEY_PREVIEW_HEADLINE)).toBeVisible();
    await expect(openTextLink).toBeVisible();
    await expect(openTextInputShell).toHaveCSS("background-color", "rgb(243, 244, 246)");
    await expect(openTextInputShell).toHaveCSS("border-top-left-radius", "8px");
    await expect(openTextInputShell).toHaveCSS("padding-top", "8px");
    await expect(openTextInputShell).toHaveCSS("padding-left", "8px");
    await expect(openTextLink).toHaveAttribute("href", /preview=true/);
    await expect(openTextLink).not.toHaveAttribute("href", /skipPrefilled=true/);
    await expect(openTextLink).toHaveAttribute("target", "_blank");
  });
});
