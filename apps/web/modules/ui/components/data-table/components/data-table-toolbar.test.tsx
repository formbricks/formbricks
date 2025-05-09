import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableToolbar } from "./data-table-toolbar";

describe("DataTableToolbar", () => {
  afterEach(() => {
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

    // Find the settings button by class and click it
    const settingsIcon = document.querySelector(".lucide-settings");
    const settingsButton = settingsIcon?.closest("div");

    expect(settingsButton).toBeInTheDocument();
    if (settingsButton) {
      await user.click(settingsButton);
      expect(setIsTableSettingsModalOpen).toHaveBeenCalledWith(true);
    }
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

    // Find the expand button by class and click it
    const expandIcon = document.querySelector(".lucide-move-vertical");
    const expandButton = expandIcon?.closest("div");

    expect(expandButton).toBeInTheDocument();
    if (expandButton) {
      await user.click(expandButton);
      expect(setIsExpanded).toHaveBeenCalledWith(true);
    }
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

    // Find the refresh button by class and click it
    const refreshIcon = document.querySelector(".lucide-refresh-ccw");
    const refreshButton = refreshIcon?.closest("div");

    expect(refreshButton).toBeInTheDocument();
    if (refreshButton) {
      await user.click(refreshButton);
      expect(refreshContacts).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("environments.contacts.contacts_table_refresh_success");
    }
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

    // Find the refresh button by class and click it
    const refreshIcon = document.querySelector(".lucide-refresh-ccw");
    const refreshButton = refreshIcon?.closest("div");

    expect(refreshButton).toBeInTheDocument();
    if (refreshButton) {
      await user.click(refreshButton);
      expect(refreshContacts).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("environments.contacts.contacts_table_refresh_error");
    }
  });
});
