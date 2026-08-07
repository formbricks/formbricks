import { expect, test } from "@playwright/test";

// THROWAWAY: deliberately failing browser test used once to verify that service-mode
// runs still produce video/screenshot artifacts after the local `playwright install`
// was dropped. Not for merge.
test("video-probe deliberate failure", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.locator("body")).toContainText("this string is definitely not present");
});
