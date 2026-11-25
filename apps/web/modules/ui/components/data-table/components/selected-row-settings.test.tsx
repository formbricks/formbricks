import type { Table } from "@tanstack/react-table";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SelectedRowSettings } from "./selected-row-settings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const table = {
  getFilteredSelectedRowModel: () => ({ rows: [{ id: "contact-1" }] }),
  toggleAllPageRowsSelected: vi.fn(),
} as unknown as Table<unknown>;

const renderSettings = (deleteDisabledReason?: string) => {
  const deleteAction = vi.fn(async () => undefined);
  render(
    <SelectedRowSettings
      table={table}
      updateRowList={vi.fn()}
      type="contact"
      deleteAction={deleteAction}
      isQuotasAllowed={false}
      deleteDisabledReason={deleteDisabledReason}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  const dialogDelete = screen.getAllByRole("button", { name: "common.delete" }).at(-1)!;
  return { deleteAction, dialogDelete };
};

describe("SelectedRowSettings delete dialog", () => {
  afterEach(cleanup);

  test("shows why the rows can't be deleted, with Delete disabled", () => {
    const { deleteAction, dialogDelete } = renderSettings("Main is shared with other workspaces");

    expect(screen.getByText("Main is shared with other workspaces")).toBeTruthy();
    expect(screen.queryByText("workspace.contacts.delete_contact_confirmation")).toBeNull();
    expect((dialogDelete as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dialogDelete);
    expect(deleteAction).not.toHaveBeenCalled();
  });

  test("asks for confirmation, with Delete enabled, when nothing blocks the delete", () => {
    const { dialogDelete } = renderSettings();

    expect(screen.getByText("workspace.contacts.delete_contact_confirmation")).toBeTruthy();
    expect((dialogDelete as HTMLButtonElement).disabled).toBe(false);
  });
});
