import { type Page, expect } from "@playwright/test";
import { surveys } from "@/playwright/utils/mock";
import { test } from "./lib/fixtures";
import { createSurvey } from "./utils/helper";

const formatSelectedDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

const pickDate = async (page: Page, dayOffset: number, pickerIndex: number) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);

  await page.getByRole("button", { name: "Pick a date" }).nth(pickerIndex).click();
  await page
    .locator("[data-radix-popper-content-wrapper]")
    .last()
    .getByRole("button", { name: new RegExp(`^${targetDate.getDate().toString()}$`) })
    .click();

  return targetDate;
};

test.describe("Survey scheduling settings", () => {
  test.setTimeout(1000 * 60 * 3);

  test("set, persist, and clear publish/pause dates", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await createSurvey(page, surveys.createAndSubmit);

    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    const scheduleCardTrigger = page.getByRole("button", { name: /^Survey schedule/ });
    await scheduleCardTrigger.scrollIntoViewIfNeeded();
    await expect(scheduleCardTrigger).toBeVisible();
    await scheduleCardTrigger.click();

    await expect(page.getByText("Survey will be published at 00:00 CET on the selected date")).toBeVisible();
    await expect(page.getByText("Survey will be paused at 00:00 CET on the selected date")).toBeVisible();

    const publishDate = await pickDate(page, 1, 0);
    const pauseDate = await pickDate(page, 2, 1);

    await expect(page.getByRole("button", { name: formatSelectedDate(publishDate) })).toBeVisible();
    await expect(page.getByRole("button", { name: formatSelectedDate(pauseDate) })).toBeVisible();

    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();

    await page.reload();
    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await scheduleCardTrigger.scrollIntoViewIfNeeded();
    await scheduleCardTrigger.click();

    await expect(page.getByRole("button", { name: formatSelectedDate(publishDate) })).toBeVisible();
    await expect(page.getByRole("button", { name: formatSelectedDate(pauseDate) })).toBeVisible();

    await page.getByTestId("clear-publish-on-date").click();
    await page.getByTestId("clear-pause-on-date").click();

    await expect(page.getByRole("button", { name: "Pick a date" })).toHaveCount(2);
  });
});
