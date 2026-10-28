import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { mockUsers } from "./utils/mock";

/**
 * The account shell is the only human UI: a person signs up, creates an organization, connects an agent
 * and hands it a credential. Everything else is done by agents through MCP and `/api/v3`. This is the
 * one journey that crosses those pages in the order a new customer meets them; the logic behind each
 * (key presets, member rows, nav items) is unit-tested next to its module.
 *
 * Needs an instance that lets a signed-up user create an organization (multi-organization, enabled by the
 * Enterprise license the E2E job boots with) and where e-mail verification is off, as in the other specs.
 */
test.describe("Account shell journey", () => {
  test.setTimeout(3 * 60 * 1000);

  test("sign up, create an organization, connect an agent, create and revoke an API key", async ({
    page,
    request,
  }) => {
    const stamp = Date.now().toString();
    const name = "Shell Journey User";
    const email = `shell-journey-${stamp}@formbricks.com`;
    const { password } = mockUsers.signup[0];
    const organizationName = `Shell Org ${stamp}`;
    const workspaceName = `Shell Workspace ${stamp}`;
    const keyName = `Journey key ${stamp}`;

    await test.step("sign up and log in", async () => {
      await page.goto("/auth/signup");
      await page.getByTestId("signup-name").fill(name);
      await page.getByTestId("signup-email").fill(email);
      await page.getByTestId("signup-password").fill(password);
      await page.getByTestId("signup-password").press("Enter");

      await page.waitForURL(/\/auth\/signup-without-verification-success.*/);
      await page.getByRole("link", { name: "Log in", exact: true }).click();

      await page.waitForURL(/\/auth\/login/);
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Password", { exact: true }).press("Enter");
    });

    await test.step("create the organization with its first workspace", async () => {
      // A new account has no organization yet, so the landing page sends it to step 1 of onboarding.
      await page.waitForURL(/\/setup\/organization\/create/);
      await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible();

      await page.getByLabel("Organization name").fill(organizationName);
      await page.getByLabel("First workspace").fill(workspaceName);
      await page.getByRole("button", { name: "Create organization" }).click();
    });

    await test.step("land on Connect your agent with the server URL and the agent tabs", async () => {
      await page.waitForURL(/\/organizations\/[^/]+$/);
      await expect(page.getByRole("heading", { level: 1, name: "Connect your agent" })).toBeVisible();
      await expect(page.getByText("No agent connected yet")).toBeVisible();

      const copyServerUrl = page.getByRole("button", { name: /^Copy Server URL / });
      await expect(copyServerUrl).toBeVisible();
      await copyServerUrl.click();
      await expect(page.getByText("Copied to clipboard")).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/api\/mcp$/);

      await expect(page.getByRole("tab", { name: "Claude" })).toHaveAttribute("data-state", "active");
      await page.getByRole("tab", { name: "Codex" }).click();
      await expect(page.getByRole("tab", { name: "Codex" })).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Add the server")).toBeVisible();
    });

    const apiKey = await test.step("create an API key; the secret is shown once", async () => {
      await page
        .getByRole("navigation", { name: "Sections" })
        .getByRole("link", { name: "Agent connections" })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: "Agent connections" })).toBeVisible();
      await expect(page.getByText("No agents connected")).toBeVisible();

      await page.getByRole("button", { name: "Create API key" }).click();
      const createDialog = page.getByRole("dialog", { name: "Create API key" });
      await createDialog.getByLabel("Name", { exact: true }).fill(keyName);
      await createDialog.getByRole("checkbox", { name: workspaceName }).click();
      await createDialog.getByRole("button", { name: "Create API key" }).click();

      const createdDialog = page.getByRole("dialog", { name: "API key created" });
      const secret = await createdDialog.getByLabel("API Key", { exact: true }).inputValue();
      expect(secret.length).toBeGreaterThan(20);

      await createdDialog.getByRole("button", { name: "Done" }).click();
      await expect(createdDialog).toBeHidden();
      return secret;
    });

    await test.step("the key is listed and works against the API", async () => {
      await expect(page.getByRole("row", { name: new RegExp(keyName) })).toBeVisible();

      const workspace = await prisma.workspace.findFirstOrThrow({
        where: { name: workspaceName, organization: { name: organizationName } },
        select: { id: true },
      });
      const response = await request.get(`/api/v3/workspaces/${workspace.id}/custom-css`, {
        headers: { "x-api-key": apiKey },
      });
      expect(response.status()).toBe(200);
    });

    await test.step("revoke the key; it stops working", async () => {
      const row = page.getByRole("row", { name: new RegExp(keyName) });
      await row.getByRole("button", { name: `Revoke ${keyName}` }).click();
      await page
        .getByRole("dialog", { name: `Revoke ${keyName}?` })
        .getByRole("button", { name: "Revoke access" })
        .click();

      await expect(page.getByText("Connection revoked")).toBeVisible();
      await expect(row).toHaveCount(0);

      const workspace = await prisma.workspace.findFirstOrThrow({
        where: { name: workspaceName, organization: { name: organizationName } },
        select: { id: true },
      });
      const response = await request.get(`/api/v3/workspaces/${workspace.id}/custom-css`, {
        headers: { "x-api-key": apiKey },
      });
      expect(response.status()).toBe(401);
    });

    await test.step("the organization's Members page lists the owner", async () => {
      await page
        .getByRole("navigation", { name: "Sections" })
        .getByRole("link", { name: "Organization", exact: true })
        .click();
      await page.waitForURL(/\/organizations\/[^/]+\/members$/);

      const members = page.getByRole("table", { name: "Members" });
      await expect(members).toBeVisible();
      const ownerRow = members.getByRole("row", { name: new RegExp(email) });
      await expect(ownerRow).toContainText("(you)");
      await expect(ownerRow).toContainText("Owner");
    });

    await test.step("the account page loads with the profile", async () => {
      await page
        .getByRole("navigation", { name: "Sections" })
        .getByRole("link", { name: "Account", exact: true })
        .click();
      await page.waitForURL(/\/account$/);

      await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    });
  });
});
