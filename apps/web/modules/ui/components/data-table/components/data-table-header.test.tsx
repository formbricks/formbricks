import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableHeader } from "./data-table-header";

describe("DataTableHeader", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders header content correctly", () => {
    const mockHeader = {
      id: "test-column",
      column: {
        id: "test-column",
        columnDef: {
          header: "Test Column",
        },
        getContext: () => ({}),
        getIsLastColumn: () => false,
        getIsFirstColumn: () => false,
        getSize: () => 150,
        getIsResizing: () => false,
        getCanResize: () => true,
        resetSize: vi.fn(),
        getResizeHandler: () => vi.fn(),
      },
      colSpan: 1,
      isPlaceholder: false,
      getContext: () => ({}),
      getResizeHandler: () => vi.fn(),
    };

    render(
      <table>
        <thead>
          <tr>
            <DataTableHeader header={mockHeader as any} setIsTableSettingsModalOpen={vi.fn()} />
          </tr>
        </thead>
      </table>
    );

    expect(screen.getByText("Test Column")).toBeInTheDocument();
  });

  test("doesn't render content for placeholder header", () => {
    const mockHeader = {
      id: "test-column",
      column: {
        id: "test-column",
        columnDef: {
          header: "Test Column",
        },
        getContext: () => ({}),
        getIsLastColumn: () => false,
        getIsFirstColumn: () => false,
        getSize: () => 150,
        getIsResizing: () => false,
        getCanResize: () => true,
        resetSize: vi.fn(),
        getResizeHandler: () => vi.fn(),
      },
      colSpan: 1,
      isPlaceholder: true,
      getContext: () => ({}),
      getResizeHandler: () => vi.fn(),
    };

    render(
      <table>
        <thead>
          <tr>
            <DataTableHeader header={mockHeader as any} setIsTableSettingsModalOpen={vi.fn()} />
          </tr>
        </thead>
      </table>
    );

    // The header text should not be present for placeholder
    expect(screen.queryByText("Test Column")).not.toBeInTheDocument();
  });

  test("doesn't show column settings for 'select' and 'createdAt' columns", () => {
    const mockHeader = {
      id: "select",
      column: {
        id: "select",
        columnDef: {
          header: "Select",
        },
        getContext: () => ({}),
        getIsLastColumn: () => false,
        getIsFirstColumn: () => false,
        getSize: () => 60,
        getIsResizing: () => false,
        getCanResize: () => false,
        getStart: vi.fn().mockReturnValue(60), // Add this mock for getStart
        resetSize: vi.fn(),
        getResizeHandler: () => vi.fn(),
      },
      colSpan: 1,
      isPlaceholder: false,
      getContext: () => ({}),
      getResizeHandler: () => vi.fn(),
    };

    render(
      <table>
        <thead>
          <tr>
            <DataTableHeader header={mockHeader as any} setIsTableSettingsModalOpen={vi.fn()} />
          </tr>
        </thead>
      </table>
    );

    // The column settings button (EllipsisVerticalIcon) should not be present for select column
    expect(document.querySelector(".lucide-ellipsis-vertical")).not.toBeInTheDocument();
  });

  test("renders resize handle that calls resize handler", async () => {
    const user = userEvent.setup();
    const resizeHandlerMock = vi.fn();
    const mockHeader = {
      id: "test-column",
      column: {
        id: "test-column",
        columnDef: {
          header: "Test Column",
        },
        getContext: () => ({}),
        getIsLastColumn: () => false,
        getIsFirstColumn: () => false,
        getSize: () => 150,
        getIsResizing: () => false,
        getCanResize: () => true,
        resetSize: vi.fn(),
        getResizeHandler: () => resizeHandlerMock,
      },
      colSpan: 1,
      isPlaceholder: false,
      getContext: () => ({}),
      getResizeHandler: resizeHandlerMock,
    };

    render(
      <table>
        <thead>
          <tr>
            <DataTableHeader header={mockHeader as any} setIsTableSettingsModalOpen={vi.fn()} />
          </tr>
        </thead>
      </table>
    );

    // Find the resize handle
    const resizeHandle = screen.getByText("Test Column").parentElement?.parentElement?.lastElementChild;
    expect(resizeHandle).toBeInTheDocument();

    // Trigger mouse down on resize handle
    if (resizeHandle) {
      await user.pointer({ keys: "[MouseLeft>]", target: resizeHandle });
      expect(resizeHandlerMock).toHaveBeenCalled();
    }
  });
});
