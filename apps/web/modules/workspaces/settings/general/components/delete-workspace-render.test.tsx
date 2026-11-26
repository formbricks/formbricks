import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TWorkspace } from "@formbricks/types/workspace";
import { DeleteWorkspaceRender } from "./delete-workspace-render";

vi.mock("react-i18next", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/workspaces/settings/lib/api-client", () => ({
  deleteWorkspaceWithConfirmation: vi.fn(),
}));

const workspace = { id: "clworkspace0000000000000000", name: "Acme" } as TWorkspace;

const openDeleteDialog = async (emptiedContactDirectoryName: string | null) => {
  render(
    <DeleteWorkspaceRender
      isDeleteDisabled={false}
      isOwnerOrManager={true}
      currentWorkspace={workspace}
      emptiedContactDirectoryName={emptiedContactDirectoryName}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "common.delete" }));
};

describe("DeleteWorkspaceRender", () => {
  afterEach(() => {
    cleanup();
  });

  test("says the contact directory is left with no workspaces when this is its last one", async () => {
    await openDeleteDialog("Customers");

    expect(
      await screen.findByText(
        'workspace.general.delete_workspace_empties_contact_directory {"directoryName":"Customers"}'
      )
    ).toBeInTheDocument();
  });

  test("says nothing about a contact directory other workspaces still use", async () => {
    await openDeleteDialog(null);

    expect(await screen.findByLabelText(/delete_workspace_confirmation_name/)).toBeInTheDocument();
    expect(screen.queryByText(/delete_workspace_empties_contact_directory/)).toBeNull();
  });
});
