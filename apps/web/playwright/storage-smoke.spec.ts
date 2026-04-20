import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { gotoSurveyList } from "./lib/utils";
import { fillRichTextEditor, uploadImageChoicesForPictureSelection } from "./utils/helper";

const firstPictureChoiceAlt = "logo-transparent.png";
const secondPictureChoiceAlt = "android-chrome-192x192.png";

test.describe("Storage Smoke", () => {
  test.setTimeout(1000 * 60 * 3);

  test("uploads picture selection images against real storage", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await gotoSurveyList(page);
    await page.getByText("Start from scratch").click();
    await page.getByRole("button", { name: "Create survey", exact: true }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);

    await fillRichTextEditor(page, "Question*", "Storage smoke question");

    const addBlock = "Add BlockChoose the first question on your Block";
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${addBlock}$`) })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Picture Selection" }).click();
    await fillRichTextEditor(page, "Question*", "Storage smoke picture choice");
    await page.getByRole("button", { name: "Add description" }).click();
    await fillRichTextEditor(page, "Description", "Storage smoke description");

    await uploadImageChoicesForPictureSelection(page);

    await expect(page.getByRole("img", { name: firstPictureChoiceAlt })).toBeVisible();
    await expect(page.getByRole("img", { name: secondPictureChoiceAlt })).toBeVisible();
  });
});
