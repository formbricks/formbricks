import { type Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";

const formatSelectedDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

const formatVisibleMonth = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);

const getDateToggleContainer = (page: Page, title: string) =>
  page.locator("h3", { hasText: title }).locator("xpath=ancestor::div[contains(@class,'px-4 py-2')][1]");

const getDatePickerTrigger = (page: Page, toggleTitle: string) =>
  getDateToggleContainer(page, toggleTitle)
    .locator("xpath=.//div[contains(@class,'mt-4') and contains(@class,'bg-slate-50')]")
    .getByRole("button")
    .first();

const openResponseOptions = async (page: Page) => {
  const publishOnDateLabel = page.getByText("Publish survey on date", { exact: true });

  if (await publishOnDateLabel.isVisible().catch(() => false)) {
    return;
  }

  await page.getByText("Response options", { exact: true }).click();
  await expect(publishOnDateLabel).toBeVisible();
};

const createMinimalSurvey = async (page: Page) => {
  await page.getByText("Start from scratch").click();
  await page.getByRole("button", { name: "Create survey", exact: true }).click();
  await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit$/);
};

const pickDateForToggle = async (page: Page, toggleTitle: string, dayOffset: number) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const datePickerTrigger = getDatePickerTrigger(page, toggleTitle);
  await expect(datePickerTrigger).toBeVisible();
  await datePickerTrigger.click();

  const calendarPopover = page.locator("[data-radix-popper-content-wrapper]").last();
  const calendar = calendarPopover.locator(".react-calendar");
  const targetMonthLabel = formatVisibleMonth(targetDate);

  for (let attempt = 0; attempt < 12; attempt++) {
    const visibleMonthLabel = (
      await calendar.locator(".react-calendar__navigation__label").textContent()
    )?.trim();

    if (visibleMonthLabel?.includes(targetMonthLabel)) {
      break;
    }

    await calendar.locator(".react-calendar__navigation__next-button").click();
  }

  await calendar
    .locator(".react-calendar__month-view__days")
    .locator("button:not([disabled])")
    .filter({ hasText: new RegExp(`^${targetDate.getDate().toString()}$`) })
    .click();

  return targetDate;
};

test.describe("Survey scheduling settings", () => {
  test.setTimeout(1000 * 60 * 3);

  test("saving a draft with publish dates clears the pending schedule", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await createMinimalSurvey(page);

    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    await openResponseOptions(page);
    await expect(page.getByText("Publish survey on date")).toBeVisible();
    await expect(page.getByText("Close survey on date")).toBeVisible();
    await expect(page.getByText("Survey will be published at 00:00 CET on the selected date")).toBeVisible();
    await expect(page.getByText("Survey will be closed at 00:00 CET on the selected date")).toBeVisible();

    await page.getByText("Publish survey on date").click();
    await page.getByText("Close survey on date").click();
    await expect(page.getByRole("button", { name: "Schedule survey", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save without scheduling", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as draft", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).not.toBeVisible();

    const publishDate = await pickDateForToggle(page, "Publish survey on date", 2);
    const closeDate = await pickDateForToggle(page, "Close survey on date", 3);

    const publishDateToggle = getDateToggleContainer(page, "Publish survey on date");
    const closeDateToggle = getDateToggleContainer(page, "Close survey on date");
    await expect(
      publishDateToggle.getByRole("button", { name: formatSelectedDate(publishDate), exact: true })
    ).toBeVisible();
    await expect(
      closeDateToggle.getByRole("button", { name: formatSelectedDate(closeDate), exact: true })
    ).toBeVisible();

    const saveSurveyResponse = page.waitForResponse((response) => {
      const { pathname } = new URL(response.url());
      return (
        response.request().method() === "POST" && /\/surveys\/[^/]+\/edit$/.test(pathname) && response.ok()
      );
    });

    await page.getByRole("button", { name: "Save without scheduling", exact: true }).click({
      noWaitAfter: true,
    });
    await saveSurveyResponse;

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    await openResponseOptions(page);
    await expect(page.getByTestId("clear-publish-on-date")).not.toBeVisible();
    await expect(page.getByTestId("clear-close-on-date")).not.toBeVisible();
  });

  test("schedules survey from draft and shows scheduled success toast", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await createMinimalSurvey(page);

    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    await openResponseOptions(page);
    await page.getByText("Publish survey on date").click();
    await pickDateForToggle(page, "Publish survey on date", 2);
    await page.getByText("Close survey on date").click();
    await pickDateForToggle(page, "Close survey on date", 2);

    await page.getByRole("button", { name: "Schedule survey", exact: true }).click({ noWaitAfter: true });
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary/);

    await expect(page.getByText("Survey scheduled successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary/);
  });
});
