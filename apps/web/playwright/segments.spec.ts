import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { clickUntilVisible } from "./utils/click-until";

// Exercises the interaction-based segment filter (ENG-1275): adding the "Survey interaction"
// filter, configuring its scope/window, its empty-survey validation, and persisting the segment.
// Requires the enterprise Contacts entitlement (present in CI, same as the contacts API specs).
test.describe("Interaction-based segments", () => {
  test("creates a segment with a survey interaction filter", async ({ page, users }) => {
    const user = await users.create({ workspaceName: "Interaction Segments" });
    await user.login();

    const segmentTitle = `Interaction segment ${Date.now()}`;

    await page.goto(`/workspaces/${user.workspaceId}/segments`, { waitUntil: "domcontentloaded" });

    // Open the create-segment modal. The page is read before it hydrates, so a single click can be dropped.
    const dialog = page.getByRole("dialog");
    await clickUntilVisible(page.getByRole("button", { name: "Create segment" }).first(), dialog);

    await dialog.getByPlaceholder("Ex. Power Users").fill(segmentTitle);

    // Add the survey interaction filter via the Add filter modal.
    await dialog.getByRole("button", { name: "Add filter" }).click();
    await page.getByTestId("filter-btn-survey-interaction").click();

    // The filter row renders pre-filled with the "have seen" interaction.
    const interactionSelect = dialog.getByLabel("Survey interaction");
    await expect(interactionSelect).toBeVisible();
    await expect(interactionSelect).toContainText("have seen");

    // Switch scope to "specific surveys" — this reveals the survey picker and, while empty, an error.
    await dialog.getByLabel("Surveys").click();
    await page.getByRole("option", { name: "specific surveys" }).click();
    await expect(dialog.getByText("Select at least one survey")).toBeVisible();

    // Pick the workspace's seeded survey; the error clears once one is selected.
    await dialog.getByPlaceholder("Select").last().click();
    await page.getByText("E2E Seed Survey").click();
    await expect(dialog.getByText("Select at least one survey")).toBeHidden();

    // Persist the segment and confirm it shows up in the list.
    await dialog.getByRole("button", { name: "Create segment" }).click();
    await expect(page.getByText(segmentTitle)).toBeVisible();
  });
});
