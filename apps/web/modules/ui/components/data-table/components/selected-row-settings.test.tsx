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

// Mock toast
vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("SelectedRowSettings", () => {
  const rows = [{ id: "r1" }, { id: "r2" }];
  let table: any;
  let deleteRows: ReturnType<typeof vi.fn>;
  let deleteAction: ReturnType<typeof vi.fn>;
  let downloadRows: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    table = {
      getFilteredSelectedRowModel: () => ({ rows }),
      toggleAllPageRowsSelected: vi.fn(),
    };
    deleteRows = vi.fn();
    deleteAction = vi.fn(() => Promise.resolve());
    downloadRows = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  // cleanup DOM after each testcle
  afterEach(() => cleanup());

  test("renders selected count and handles select all/clear selection", () => {
    render(
      <SelectedRowSettings
        table={table}
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
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
        deleteRows={deleteRows}
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
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
        type="response"
      />
    );
    fireEvent.click(screen.getByText("common.download"));
    fireEvent.click(screen.getByText("environments.surveys.summary.selected_responses_csv"));
    expect(downloadRows).toHaveBeenCalledWith(["r1", "r2"], "csv");

    fireEvent.click(screen.getByText("common.download"));
    fireEvent.click(screen.getByText("environments.surveys.summary.selected_responses_excel"));
    expect(downloadRows).toHaveBeenCalledWith(["r1", "r2"], "xlsx");
  });

  test("deletes rows successfully and shows success toast for contact", async () => {
    deleteAction = vi.fn(() => Promise.resolve());
    render(
      <SelectedRowSettings
        table={table}
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
        type="contact"
      />
    );
    // open delete dialog
    fireEvent.click(screen.getAllByText("common.delete")[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(deleteAction).toHaveBeenCalledTimes(2);
      expect(deleteRows).toHaveBeenCalledWith(["r1", "r2"]);
      expect(toast.success).toHaveBeenCalledWith("common.table_items_deleted_successfully");
    });
  });

  test("handles delete error and shows error toast for response", async () => {
    deleteAction = vi.fn(() => Promise.reject(new Error("fail delete")));
    render(
      <SelectedRowSettings
        table={table}
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
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
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
        type="response"
      />
    );
    // open delete dialog
    fireEvent.click(screen.getAllByText("common.delete")[0]);
    fireEvent.click(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(deleteAction).toHaveBeenCalledTimes(2);
      expect(deleteRows).toHaveBeenCalledWith(["r1", "r2"]);
      expect(toast.success).toHaveBeenCalledWith("common.table_items_deleted_successfully");
    });
  });

  test("handles delete error for non-Error and shows generic error toast", async () => {
    deleteAction = vi.fn(() => Promise.reject(new Error("fail nonerror")));
    render(
      <SelectedRowSettings
        table={table}
        deleteRows={deleteRows}
        deleteAction={deleteAction}
        downloadRows={downloadRows}
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
