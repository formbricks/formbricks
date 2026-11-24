import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

// Organization settings › Contact directories (ENG-7497): an owner makes one directory for two
// workspaces, one that already has its own (empty) directory and one that has none yet. The list then
// shows the new directory, and both workspaces' Contacts pages say which directory they share.
test.describe("Contact directories settings", () => {
  test("creates a directory for two workspaces and shows it on their Contacts pages", async ({
    page,
    users,
  }) => {
    const stamp = Date.now();
    const user = await users.create({ workspaceName: `Alpha ${stamp}`, skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("Workspace not seeded for test");
    const workspaceA = { id: user.workspaceId, name: `Alpha ${stamp}` };

    // The users fixture gives every workspace a directory; this one is made the way a new workspace is,
    // without one.
    const workspaceB = await prisma.workspace.create({
      data: { name: `Bravo ${stamp}`, organizationId: user.organizationId },
      select: { id: true, name: true },
    });
    const directoryName = `Northwind ${stamp}`;

    await user.login();
    await page.goto(`/organizations/${user.organizationId}/settings/contact-directories`, {
      waitUntil: "domcontentloaded",
    });

    // The list loads on the client after hydration; Create directory stays disabled until it has.
    const createButton = page.getByRole("button", { name: "Create directory" });
    await expect(createButton).toBeEnabled({ timeout: 30_000 });

    const table = page.getByRole("table", { name: "Contact directories" });
    // The fixture names its directory after the workspace, as the migration does.
    await expect(table.getByRole("row").filter({ hasText: workspaceA.name })).toBeVisible();

    await createButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name").fill(directoryName);
    const picker = dialog.getByPlaceholder("Select workspaces");
    await picker.click();
    await page.getByRole("option", { name: workspaceA.name }).click();
    await page.getByRole("option", { name: workspaceB.name }).click();
    await expect(dialog.getByText("Workspaces in one directory share their contacts.")).toBeVisible();

    await dialog.getByRole("button", { name: "Create directory" }).click();
    await expect(page.getByText("Directory created")).toBeVisible();
    await expect(dialog).toBeHidden();

    // One row: the new directory with both workspaces. Alpha's old, empty directory is gone.
    const row = table.getByRole("row").filter({ hasText: directoryName });
    await expect(row.getByRole("cell").nth(0)).toHaveText(directoryName);
    await expect(row.getByRole("cell").nth(1)).toHaveText("2");
    await expect(row.getByRole("cell").nth(2)).toHaveText("Email");
    await expect(row.getByRole("cell").nth(3)).toHaveText("0");
    await expect(table.getByRole("row").filter({ hasText: workspaceA.name })).toHaveCount(0);

    for (const workspace of [workspaceA, workspaceB]) {
      await page.goto(`/workspaces/${workspace.id}/contacts`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(`${directoryName} directory`)).toBeVisible();
    }
  });
});
