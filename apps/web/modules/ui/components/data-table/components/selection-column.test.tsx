import { Table } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getSelectionColumn } from "./selection-column";

// Mock Tanstack table functions
vi.mock("@tanstack/react-table", async () => {
  return {
    ...(await vi.importActual<typeof import("@tanstack/react-table")>("@tanstack/react-table")),
  };
});

// Mock the checkbox component
vi.mock("@/modules/ui/components/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, "aria-label": ariaLabel }: any) => (
    <div
      data-testid={`checkbox-${ariaLabel?.replace(/\s/g, "-").toLowerCase()}`}
      data-checked={checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}>
      {ariaLabel}
    </div>
  ),
}));

describe("getSelectionColumn", () => {
  afterEach(() => {
    cleanup();
  });

  test("returns the selection column definition", () => {
    const column = getSelectionColumn();
    expect(column.id).toBe("select");
    expect(column.accessorKey).toBe("select");
    expect(column.size).toBe(60);
    expect(column.enableResizing).toBe(false);
  });

  test("header renders checked checkbox when all rows are selected", () => {
    const column = getSelectionColumn();

    // Create mock table object with required functions
    const mockTable = {
      getIsAllPageRowsSelected: vi.fn().mockReturnValue(true),
      toggleAllPageRowsSelected: vi.fn(),
    };

    render(column.header!({ table: mockTable as unknown as Table<object> }));

    const headerCheckbox = screen.getByTestId("checkbox-select-all");
    expect(headerCheckbox).toHaveAttribute("data-checked", "true");
  });

  test("cell renders checked checkbox when row is selected", () => {
    const column = getSelectionColumn();

    // Create mock row object with required functions
    const mockRow = {
      getIsSelected: vi.fn().mockReturnValue(true),
      toggleSelected: vi.fn(),
    };

    render(column.cell!({ row: mockRow as any }));

    const cellCheckbox = screen.getByTestId("checkbox-select-row");
    expect(cellCheckbox).toHaveAttribute("data-checked", "true");
  });
});
