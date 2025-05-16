import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SelectedRowSettings } from "./selected-row-settings";

// Mock translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

// Mock DeleteDialog to reveal confirm button when open
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, onDelete }: any) =>
    open ? <button onClick={() => onDelete()}>Confirm Delete</button> : null,
}));

// Mock dropdown-menu components to render their children
vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <>{children}</>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

// Mock Button
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe("SelectedRowSettings", () => {
  const rows = [{ id: "r1" }, { id: "r2" }];
  let table: any;
  let deleteRowsAction: ReturnType<typeof vi.fn>;
  let deleteAction: ReturnType<typeof vi.fn>;
  let downloadRowsAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    table = {
      getFilteredSelectedRowModel: () => ({ rows }),
      toggleAllPageRowsSelected: vi.fn(),
    };
    deleteRowsAction = vi.fn();
    deleteAction = vi.fn(() => Promise.resolve());
    downloadRowsAction = vi.fn();

    // Reset all toast mocks before each test
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders selected count and handles select all/clear selection", () => {
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="contact"
      />
    );
    expect(screen.getByText("2 common.contacts common.selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.select_all"));
    expect(table.toggleAllPageRowsSelected).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("common.clear_selection"));
    expect(table.toggleAllPageRowsSelected).toHaveBeenCalledWith(false);
  });

  test("does not render download when downloadRows prop is undefined", () => {
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        type="response"
      />
    );
    expect(screen.queryByText("common.download")).toBeNull();
  });

  test("invokes downloadRows with correct formats", () => {
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="response"
      />
    );
    fireEvent.click(screen.getByText("common.download"));
    fireEvent.click(screen.getByText("environments.surveys.summary.selected_responses_csv"));
    expect(downloadRowsAction).toHaveBeenCalledWith(["r1", "r2"], "csv");

    fireEvent.click(screen.getByText("common.download"));
    fireEvent.click(screen.getByText("environments.surveys.summary.selected_responses_excel"));
    expect(downloadRowsAction).toHaveBeenCalledWith(["r1", "r2"], "xlsx");
  });

  test("deletes rows successfully and shows success toast for contact", async () => {
    deleteAction = vi.fn(() => Promise.resolve());
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="contact"
      />
    );
    // open delete dialog
    fireEvent.click(screen.getAllByText("common.delete")[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(deleteAction).toHaveBeenCalledTimes(2);
      expect(deleteRowsAction).toHaveBeenCalledWith(["r1", "r2"]);
      expect(toast.success).toHaveBeenCalledWith("common.table_items_deleted_successfully");
    });
  });

  test("handles delete error and shows error toast for response", async () => {
    deleteAction = vi.fn(() => Promise.reject(new Error("fail delete")));
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="response"
      />
    );
    // open delete menu (trigger button)
    const deleteTriggers = screen.getAllByText("common.delete");
    fireEvent.click(deleteTriggers[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("fail delete");
    });
  });

  test("deletes rows successfully and shows success toast for response", async () => {
    deleteAction = vi.fn(() => Promise.resolve());
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="response"
      />
    );
    // open delete dialog
    fireEvent.click(screen.getAllByText("common.delete")[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(deleteAction).toHaveBeenCalledTimes(2);
      expect(deleteRowsAction).toHaveBeenCalledWith(["r1", "r2"]);
      expect(toast.success).toHaveBeenCalledWith("common.table_items_deleted_successfully");
    });
  });

  test("handles delete error for non-Error and shows generic error toast", async () => {
    deleteAction = vi.fn(() => Promise.reject("fail nonerror")); // Changed from Error to string
    render(
      <SelectedRowSettings
        table={table}
        deleteRowsAction={deleteRowsAction}
        deleteAction={deleteAction}
        downloadRowsAction={downloadRowsAction}
        type="contact"
      />
    );
    // open delete menu (trigger button)
    const deleteTriggers = screen.getAllByText("common.delete");
    fireEvent.click(deleteTriggers[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("common.an_unknown_error_occurred_while_deleting_table_items");
    });
  });
});
