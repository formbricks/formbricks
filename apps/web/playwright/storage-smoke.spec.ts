import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { gotoSurveyList } from "./lib/utils";
import {
  addElement,
  createSurveyFromScratch,
  fillRichTextEditor,
  uploadImageChoicesForPictureSelection,
} from "./utils/helper";

const firstPictureChoiceAltPrefix = "playwright-choice-1--fid--";
const secondPictureChoiceAltPrefix = "playwright-choice-2--fid--";

test.describe("Storage Smoke @storage-smoke", () => {
  test.setTimeout(1000 * 60 * 3);

  test("uploads picture selection images against real storage", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await gotoSurveyList(page);
    await createSurveyFromScratch(page);

    await fillRichTextEditor(page, "Question*", "Storage smoke question");

    await addElement(page, "Picture Selection");
    await fillRichTextEditor(page, "Question*", "Storage smoke picture choice");
    await page.getByRole("button", { name: "Add description" }).click();
    await fillRichTextEditor(page, "Description", "Storage smoke description");

    await uploadImageChoicesForPictureSelection(page);

    await expect(page.locator(`img[alt^="${firstPictureChoiceAltPrefix}"]`)).toHaveCount(1);
    await expect(page.locator(`img[alt^="${secondPictureChoiceAltPrefix}"]`)).toHaveCount(1);
  });
});
