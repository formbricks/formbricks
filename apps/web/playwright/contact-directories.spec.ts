import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

// Organization settings › Directories (ENG-7497, ADR 0061): an owner makes one directory for two workspaces
// that have none, sees a workspace that already has one greyed out, and removes a workspace again through
// the confirm step. Both workspaces' Contacts pages say which directory they share.
test.describe("Contact directories settings", () => {
  test("creates a directory for two workspaces, then removes one of them", async ({ page, users }) => {
    const stamp = Date.now();
    const user = await users.create({ workspaceName: `Alpha ${stamp}`, skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("Workspace not seeded for test");
    const workspaceA = { id: user.workspaceId, name: `Alpha ${stamp}` };

    // The users fixture gives its workspace a directory; these two are made the way a new workspace is,
    // without one.
    const [workspaceB, workspaceC] = await Promise.all(
      [`Bravo ${stamp}`, `Charlie ${stamp}`].map((name) =>
        prisma.workspace.create({
          data: { name, organizationId: user.organizationId },
          select: { id: true, name: true },
        })
      )
    );
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
    await dialog.getByPlaceholder("Select workspaces").click();
    // A workspace already in a directory can't join another one; it is greyed out with the reason.
    const optionA = page.getByRole("option").filter({ hasText: workspaceA.name });
    await expect(optionA).toHaveAttribute("aria-disabled", "true");
    await expect(optionA).toContainText(`In ${workspaceA.name}`);
    await page.getByRole("option", { name: workspaceB.name }).click();
    await page.getByRole("option", { name: workspaceC.name }).click();
    await expect(dialog.getByText("Workspaces in one directory share their contacts.")).toBeVisible();

    await dialog.getByRole("button", { name: "Create directory" }).click();
    await expect(page.getByText("Directory created")).toBeVisible();
    await expect(dialog).toBeHidden();

    // The new directory with both workspaces; Alpha keeps its own.
    const row = table.getByRole("row").filter({ hasText: directoryName });
    await expect(row.getByRole("cell").nth(0)).toHaveText(directoryName);
    await expect(row.getByRole("cell").nth(1)).toHaveText("2");
    await expect(row.getByRole("cell").nth(2)).toHaveText("Email");
    await expect(row.getByRole("cell").nth(3)).toHaveText("0");
    await expect(table.getByRole("row").filter({ hasText: workspaceA.name })).toHaveCount(1);

    // Removing Charlie goes through the confirm step and only unlinks it.
    await row.getByRole("button", { name: "Manage" }).click();
    await dialog.getByRole("button", { name: `Remove ${workspaceC.name}` }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    const confirm = page.getByRole("dialog", { name: `Remove ${workspaceC.name} from ${directoryName}?` });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Remove workspaces" }).click();
    await expect(page.getByText("Directory updated")).toBeVisible();
    await expect(row.getByRole("cell").nth(1)).toHaveText("1");

    await page.goto(`/workspaces/${workspaceB.id}/contacts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`${directoryName} directory`)).toBeHidden();
    await page.goto(`/workspaces/${workspaceC.id}/contacts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("No contact directory linked")).toBeVisible();
  });
});
