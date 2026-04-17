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

const expandScheduleCard = async (page: Page) => {
  const scheduleCard = page.getByTestId("survey-schedule-card");
  const scheduleCardTrigger = scheduleCard.getByRole("button", { name: /^Survey schedule/ });

  await scheduleCardTrigger.scrollIntoViewIfNeeded();
  await expect(scheduleCardTrigger).toBeVisible();

  if ((await scheduleCardTrigger.getAttribute("aria-expanded")) !== "true") {
    await scheduleCardTrigger.click();
  }

  return { scheduleCard, scheduleCardTrigger };
};

const createMinimalSurvey = async (page: Page) => {
  await page.getByText("Start from scratch").click();
  await page.getByRole("button", { name: "Create survey", exact: true }).click();
  await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit$/);
};

const pickDate = async (page: Page, dayOffset: number) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);

  const scheduleCard = page.getByTestId("survey-schedule-card");

  await scheduleCard.getByRole("button", { name: "Pick a date" }).first().click();

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

  test("set, persist, and clear publish/pause dates", async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await createMinimalSurvey(page);

    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    const { scheduleCard } = await expandScheduleCard(page);

    await expect(page.getByText("Survey will be published at 00:00 CET on the selected date")).toBeVisible();
    await expect(page.getByText("Survey will be paused at 00:00 CET on the selected date")).toBeVisible();

    const publishDate = await pickDate(page, 2);
    const pauseDate = await pickDate(page, 3);

    await expect(
      scheduleCard.getByRole("button", { name: formatSelectedDate(publishDate), exact: true })
    ).toBeVisible();
    await expect(
      scheduleCard.getByRole("button", { name: formatSelectedDate(pauseDate), exact: true })
    ).toBeVisible();

    const saveSurveyResponse = page.waitForResponse((response) => {
      const { pathname } = new URL(response.url());
      return (
        response.request().method() === "POST" && /\/surveys\/[^/]+\/edit$/.test(pathname) && response.ok()
      );
    });

    await page.getByRole("button", { name: "Save as draft", exact: true }).click({ noWaitAfter: true });
    await saveSurveyResponse;

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator('nav[aria-label="Tabs"]')
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const { scheduleCard: reloadedScheduleCard } = await expandScheduleCard(page);

    await expect(
      reloadedScheduleCard.getByRole("button", { name: formatSelectedDate(publishDate), exact: true })
    ).toBeVisible();
    await expect(
      reloadedScheduleCard.getByRole("button", { name: formatSelectedDate(pauseDate), exact: true })
    ).toBeVisible();

    await page.getByTestId("clear-publish-on-date").click();
    await page.getByTestId("clear-pause-on-date").click();

    await expect(reloadedScheduleCard.getByRole("button", { name: "Pick a date" })).toHaveCount(2);
  });
});
