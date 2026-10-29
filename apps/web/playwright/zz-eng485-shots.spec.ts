import { test } from "./lib/fixtures";
import { createSurveyFromScratch } from "./utils/helper";

const OUT = process.env.SHOT_OUT ?? "";

test.use({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, colorScheme: "light" });

test("capture", async ({ page, users }) => {
  const user = await users.create();
  await user.login();
  await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  await createSurveyFromScratch(page);
  await page
    .getByRole("button", { name: /Add question/i })
    .first()
    .click();
  await page.getByText("File Upload", { exact: true }).first().click();
  await page.locator("#maxFileSize").click();
  const input = page.locator("#fileSizeLimit");
  await input.waitFor();
  await input.fill("-5");
  await input.blur();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT, clip: { x: 20, y: 110, width: 820, height: 170 } });
});
