import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableToolbar } from "./data-table-toolbar";

describe("DataTableToolbar", () => {
  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  test("renders selection settings when rows are selected", () => {
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [{ id: "row1" }, { id: "row2" }],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={vi.fn()}
        setIsExpanded={vi.fn()}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="response"
        deleteAction={vi.fn()}
      />
    );

    // Check for the number of selected items instead of translation keys
    const selectionInfo = screen.getByText(/2/);
    expect(selectionInfo).toBeInTheDocument();

    // Look for the exact text that appears in the component (which is the translation key)
    expect(screen.getByText("common.select_all")).toBeInTheDocument();
    expect(screen.getByText("common.clear_selection")).toBeInTheDocument();
  });

  test("renders settings and expand buttons", () => {
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={vi.fn()}
        setIsExpanded={vi.fn()}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="response"
        deleteAction={vi.fn()}
      />
    );

    // Look for SVG elements by their class names instead of role
    const settingsIcon = document.querySelector(".lucide-settings");
    const expandIcon = document.querySelector(".lucide-move-vertical");

    expect(settingsIcon).toBeInTheDocument();
    expect(expandIcon).toBeInTheDocument();
  });

  test("calls setIsTableSettingsModalOpen when settings button is clicked", async () => {
    const user = userEvent.setup();
    const setIsTableSettingsModalOpen = vi.fn();
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
        setIsExpanded={vi.fn()}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="response"
        deleteAction={vi.fn()}
      />
    );

    // Find the settings button (second button in the toolbar)
    const buttons = screen.getAllByRole("button");
    // The settings button is always present, but the refresh button is only present for type="contact"
    // So for type="response", settings is the first button
    const settingsButton = buttons[0];
    expect(settingsButton).toBeInTheDocument();
    await user.click(settingsButton);
    expect(setIsTableSettingsModalOpen).toHaveBeenCalledWith(true);
  });

  test("calls setIsExpanded when expand button is clicked", async () => {
    const user = userEvent.setup();
    const setIsExpanded = vi.fn();
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={vi.fn()}
        setIsExpanded={setIsExpanded}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="response"
        deleteAction={vi.fn()}
      />
    );

    // Find the expand button (second button in the toolbar for type="response")
    const buttons = screen.getAllByRole("button");
    // For type="response", expand is the second button
    const expandButton = buttons[1];
    expect(expandButton).toBeInTheDocument();
    await user.click(expandButton);
    expect(setIsExpanded).toHaveBeenCalledWith(true);
  });

  test("shows refresh button and calls refreshContacts when type is contact", async () => {
    const user = userEvent.setup();
    const refreshContacts = vi.fn().mockResolvedValue(undefined);
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={vi.fn()}
        setIsExpanded={vi.fn()}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="contact"
        deleteAction={vi.fn()}
        refreshContacts={refreshContacts}
      />
    );

    // For type="contact", the first button is refresh, second is settings, third is expand
    const buttons = screen.getAllByRole("button");
    const refreshButton = buttons[0];
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);
    expect(refreshContacts).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("environments.contacts.contacts_table_refresh_success");
  });

  test("shows error toast when refreshContacts fails", async () => {
    const user = userEvent.setup();
    const refreshContacts = vi.fn().mockRejectedValue(new Error("Failed to refresh"));
    const mockTable = {
      getFilteredSelectedRowModel: vi.fn().mockReturnValue({
        rows: [],
      }),
    };

    render(
      <DataTableToolbar
        setIsTableSettingsModalOpen={vi.fn()}
        setIsExpanded={vi.fn()}
        isExpanded={false}
        table={mockTable as any}
        deleteRows={vi.fn()}
        type="contact"
        deleteAction={vi.fn()}
        refreshContacts={refreshContacts}
      />
    );

    // For type="contact", the first button is refresh
    const buttons = screen.getAllByRole("button");
    const refreshButton = buttons[0];
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);
    expect(refreshContacts).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("environments.contacts.contacts_table_refresh_error");
  });
});
