import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * The API keys settings page end to end: mint a key, use it, rename it, revoke it. Each phase starts from the
 * previous one's result, so it is one journey with `test.step` phases rather than four tests that would each
 * re-seed an organization and log in.
 *
 * Asserted at feature level — what the page shows, what the database holds, and whether the key opens the
 * API — never how the page talks to the server, so the same spec holds before and after the page moved from
 * server actions onto `/api/internal/api-keys` (ENG-3984).
 */

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

test.describe("Organization API keys settings", () => {
  test("mints a working key, renames it and revokes it", async ({ page, users }) => {
    const run = stamp();
    const user = await users.create({
      email: `api-keys-${run}@example.com`,
      name: `api-keys-${run}`,
      workspaceName: `API Keys Workspace ${run}`,
    });
    const { workspaceId } = user;
    if (!workspaceId) throw new Error("Workspace not seeded for the test user");

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/workspaces/${workspaceId}/settings/organization/api-keys`, {
      waitUntil: "domcontentloaded",
    });

    const label = `E2E key ${run}`;
    const renamed = `Renamed ${run}`;
    const rowNamed = (name: string) => page.getByTestId("api-key-row").filter({ hasText: name });
    let apiKey = "";
    let apiKeyId = "";

    await test.step("mint a key with read access to the workspace", async () => {
      await page.getByRole("button", { name: "Add API Key" }).click();
      await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill(label);
      await page.getByTestId("add_permission__button__test").click();
      await page.locator("#workspace-permission-select-0").click();
      await page.getByRole("option", { name: "Read", exact: true }).click();
      await page.getByRole("button", { name: "Add API Key" }).click();

      // The plaintext is shown once, in the new row, and nowhere else.
      const plaintext = rowNamed(label).getByText(/^fbk_/);
      await expect(plaintext).toBeVisible({ timeout: 15000 });
      apiKey = (await plaintext.textContent())?.trim() ?? "";
      expect(apiKey).toMatch(/^fbk_[\w-]+$/);

      const stored = await prisma.apiKey.findFirstOrThrow({
        where: { label },
        include: { apiKeyWorkspaces: true },
      });
      apiKeyId = stored.id;
      expect(stored.apiKeyWorkspaces).toEqual([expect.objectContaining({ workspaceId, permission: "read" })]);
    });

    await test.step("the minted key opens the public API for its workspace", async () => {
      const response = await page.request.get(`/api/v3/surveys?workspaceId=${workspaceId}`, {
        headers: { "x-api-key": apiKey },
      });
      expect(response.status()).toBe(200);
    });

    await test.step("a reload shows the key without its secret", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(rowNamed(label)).toBeVisible({ timeout: 15000 });
      await expect(rowNamed(label)).not.toContainText("fbk_");
    });

    await test.step("rename the key", async () => {
      await rowNamed(label).click();
      const field = page.getByTestId("api-key-label");
      await field.fill(renamed);
      await page.getByRole("button", { name: "Update" }).click();

      await expect(rowNamed(renamed)).toBeVisible({ timeout: 15000 });
      await expect
        .poll(async () => (await prisma.apiKey.findUnique({ where: { id: apiKeyId } }))?.label)
        .toBe(renamed);
    });

    await test.step("revoke the key: it leaves the table, the database and the API", async () => {
      await rowNamed(renamed).getByRole("button", { name: "Delete" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(rowNamed(renamed)).toHaveCount(0, { timeout: 15000 });
      await expect.poll(() => prisma.apiKey.findUnique({ where: { id: apiKeyId } })).toBeNull();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText("You do not have any API keys yet")).toBeVisible({ timeout: 15000 });

      const response = await page.request.get(`/api/v3/surveys?workspaceId=${workspaceId}`, {
        headers: { "x-api-key": apiKey },
      });
      expect(response.status()).toBe(401);
    });
  });
});
