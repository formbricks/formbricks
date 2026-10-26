import { type Locator, type Page, expect } from "@playwright/test";

// Helpers for the shared table toolbar (gear, search, Filter menu, chips) every list table uses.

/** The row of a toolbar table that holds `text`. */
export const tableRow = (page: Page, tableTestId: string, text: string): Locator =>
  page
    .getByTestId(tableTestId)
    .getByRole("row")
    .filter({ has: page.getByText(text, { exact: true }) });

/** Ticks or unticks one value of a quick filter through the Filter menu, then closes the menu. */
export const toggleQuickFilter = async (page: Page, property: string, value: string) => {
  await page.getByTestId("table-filter-button").click();
  await page.getByRole("menuitem", { name: property }).hover();
  const checkbox = page.getByRole("checkbox", { name: value, exact: true });
  await expect(checkbox).toBeVisible();
  await checkbox.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
};

/** Clears every chip from the bar under the toolbar. */
export const clearAllFilters = async (page: Page) => {
  await page.getByTestId("table-filter-chips").getByRole("button", { name: "Clear all" }).click();
};

export const openTableSettings = async (page: Page) => {
  await page.getByRole("button", { name: "Table settings" }).click();
};

/** Picks a sort order from the gear. */
export const setTableSort = async (page: Page, label: string) => {
  await openTableSettings(page);
  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
};

/** Flips a switch in the gear, such as Show archived. */
export const setTableToggle = async (page: Page, label: string, checked: boolean) => {
  await openTableSettings(page);
  const toggle = page.getByRole("switch", { name: label });
  if ((await toggle.getAttribute("aria-checked")) !== String(checked)) await toggle.click();
  await page.keyboard.press("Escape");
};
