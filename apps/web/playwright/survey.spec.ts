import { createId } from "@paralleldrive/cuid2";
import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { type Prisma } from "@formbricks/database/prisma";
import { type TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { test } from "./lib/fixtures";
import { mockStorageUploads } from "./utils/storage-mock";

// The respondent runtime's walk through every question type, logic and languages is covered by
// survey-accessibility.spec.ts (kitchen sink, answered states, RTL) and survey-keyboard.spec.ts. This
// spec keeps the one journey they cannot reach: uploads that overlap on a single card.
test.beforeEach(async ({ page }) => {
  await mockStorageUploads(page);
});

// One card with two upload questions and a text question: the race below needs them on the same card.
const seedOverlappingUploadsSurvey = async (workspaceId: string, userId: string) => {
  const ids = { multiUpload: createId(), singleUpload: createId(), text: createId() };
  const block: TSurveyBlock = {
    id: createId(),
    name: "Block 1",
    elements: [
      {
        id: ids.multiUpload,
        type: TSurveyElementTypeEnum.FileUpload,
        headline: { default: "Upload your photos" },
        required: false,
        allowMultipleFiles: true,
      },
      {
        id: ids.singleUpload,
        type: TSurveyElementTypeEnum.FileUpload,
        headline: { default: "Upload your ticket" },
        required: false,
        allowMultipleFiles: false,
      },
      {
        id: ids.text,
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Anything else?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  };
  const endings = [{ id: createId(), type: "endScreen", headline: { default: "Thank you!" } }];

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy: userId,
      name: "Overlapping uploads",
      type: "link",
      status: "inProgress",
      blocks: [block] as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });
  return { surveyId: survey.id, ...ids };
};

const pngFile = (name: string) => ({ name, mimeType: "image/png", buffer: Buffer.from(name) });

test.describe("Overlapping file uploads", () => {
  // ENG-3945: an upload that finished after others wrote back the answers from when it started,
  // dropping the files that had landed since and undoing text typed in the meantime.
  test("keeps every answer when uploads on one card finish out of order", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const { surveyId, multiUpload, singleUpload, text } = await seedOverlappingUploadsSurvey(
      user.workspaceId,
      user.id
    );

    // Holds first.png's upload until the test releases it, so it finishes after the others.
    // Registered after the storage mock in beforeEach, so it runs first and then hands over to it.
    let markFirstUploadHeld = () => {};
    let releaseFirstUpload = () => {};
    const firstUploadHeld = new Promise<void>((resolve) => (markFirstUploadHeld = resolve));
    const firstUploadReleased = new Promise<void>((resolve) => (releaseFirstUpload = resolve));
    await page.route("**/api/v1/client/*/storage", async (route) => {
      const payload = route.request().postDataJSON() as { fileName?: string } | null;
      if (payload?.fileName === "first.png") {
        markFirstUploadHeld();
        await firstUploadReleased;
      }
      await route.fallback();
    });

    const multiUploadQuestion = page.locator(`div[id="${multiUpload}"]`);
    const singleUploadQuestion = page.locator(`div[id="${singleUpload}"]`);
    const textInput = page.getByRole("textbox", { name: "Anything else?" });

    await test.step("start an upload, then answer the rest of the card while it runs", async () => {
      await page.goto(`/s/${surveyId}`);
      await textInput.fill("typed before the uploads");

      await multiUploadQuestion.locator('input[type="file"]').setInputFiles(pngFile("first.png"));
      await firstUploadHeld;

      await singleUploadQuestion.locator('input[type="file"]').setInputFiles(pngFile("second.png"));
      await expect(singleUploadQuestion.getByRole("button", { name: "Delete second.png" })).toBeVisible();
      await multiUploadQuestion.locator('input[type="file"]').setInputFiles(pngFile("third.png"));
      await expect(multiUploadQuestion.getByRole("button", { name: "Delete third.png" })).toBeVisible();

      await textInput.fill("typed during the upload");
    });

    await test.step("the late upload keeps everything answered since it started", async () => {
      releaseFirstUpload();
      await expect(multiUploadQuestion.getByRole("button", { name: "Delete first.png" })).toBeVisible();

      await expect(multiUploadQuestion.getByRole("button", { name: "Delete third.png" })).toBeVisible();
      await expect(singleUploadQuestion.getByRole("button", { name: "Delete second.png" })).toBeVisible();
      await expect(textInput).toHaveValue("typed during the upload");
    });

    await test.step("the saved response has every answer", async () => {
      await page.getByRole("button", { name: "Finish" }).click();
      await expect(page.getByText("Thank you!")).toBeVisible();

      await expect
        .poll(async () => {
          const response = await prisma.response.findFirst({ where: { surveyId }, select: { data: true } });
          return response?.data;
        })
        .toEqual(
          expect.objectContaining({
            [multiUpload]: [expect.stringContaining("third.png"), expect.stringContaining("first.png")],
            [singleUpload]: [expect.stringContaining("second.png")],
            [text]: "typed during the upload",
          })
        );
    });
  });
});
