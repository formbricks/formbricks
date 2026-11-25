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
  return { deleteAction, deleteButton: screen.getByRole("button", { name: "common.delete" }) };
};

describe("SelectedRowSettings Delete", () => {
  afterEach(cleanup);

  // aria-disabled, not disabled: the button keeps hover and focus, so the reason can show.
  test("shows as disabled, opens nothing, and says why on focus", async () => {
    const { deleteAction, deleteButton } = renderSettings("Main is shared with other workspaces");

    expect(deleteButton.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(deleteButton);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAction).not.toHaveBeenCalled();

    fireEvent.focus(deleteButton);
    expect((await screen.findAllByText("Main is shared with other workspaces")).length).toBeGreaterThan(0);
  });

  test("opens the confirmation when nothing blocks the delete", () => {
    const { deleteButton } = renderSettings();

    expect(deleteButton.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(deleteButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("workspace.contacts.delete_contact_confirmation")).toBeTruthy();
  });
});
