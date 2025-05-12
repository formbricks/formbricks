import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ColumnSettingsDropdown } from "./column-settings-dropdown";

describe("ColumnSettingsDropdown", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders dropdown trigger button", () => {
    const mockColumn = {
      toggleVisibility: vi.fn(),
    };

    render(<ColumnSettingsDropdown column={mockColumn as any} setIsTableSettingsModalOpen={vi.fn()} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  test("clicking on hide column option calls toggleVisibility", async () => {
    const toggleVisibilityMock = vi.fn();
    const mockColumn = {
      toggleVisibility: toggleVisibilityMock,
    };

    render(<ColumnSettingsDropdown column={mockColumn as any} setIsTableSettingsModalOpen={vi.fn()} />);

    // Open the dropdown
    await userEvent.click(screen.getByRole("button"));

    // Click on the hide column option
    await userEvent.click(screen.getByText("common.hide_column"));

    expect(toggleVisibilityMock).toHaveBeenCalledWith(false);
  });

  test("clicking on table settings option calls setIsTableSettingsModalOpen", async () => {
    const setIsTableSettingsModalOpenMock = vi.fn();
    const mockColumn = {
      toggleVisibility: vi.fn(),
    };

    render(
      <ColumnSettingsDropdown
        column={mockColumn as any}
        setIsTableSettingsModalOpen={setIsTableSettingsModalOpenMock}
      />
    );

    // Open the dropdown
    await userEvent.click(screen.getByRole("button"));

    // Click on the table settings option
    await userEvent.click(screen.getByText("common.table_settings"));

    expect(setIsTableSettingsModalOpenMock).toHaveBeenCalledWith(true);
  });
});
