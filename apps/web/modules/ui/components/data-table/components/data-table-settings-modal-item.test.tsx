import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableSettingsModalItem } from "./data-table-settings-modal-item";

// Mock the Switch component
vi.mock("@/modules/ui/components/switch", () => ({
  Switch: ({ id, checked, onCheckedChange, disabled }: any) => (
    <input
      data-testid={`switch-${id}`}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
    />
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  GripVertical: () => <div data-testid="grip-vertical" />,
}));

// Mock dnd-kit hooks
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    attributes: { "data-testid": "sortable-attributes" },
    listeners: { "data-testid": "sortable-listeners" },
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => "translate3d(0px, 0px, 0px)"),
    },
  },
}));

// Mock @tanstack/react-table
vi.mock("@tanstack/react-table", () => ({
  flexRender: vi.fn((_, context) => `Header: ${context.column.id}`),
}));

describe("DataTableSettingsModalItem", () => {
  afterEach(() => {
    cleanup();
  });

  const createMockColumn = (id: string, isVisible: boolean = true) => ({
    id,
    getIsVisible: vi.fn(() => isVisible),
    toggleVisibility: vi.fn(),
    columnDef: {
      header: `${id} Header`,
    },
  });

  const createMockTable = (columns: any[]) => {
    const headers = columns.map((column) => ({
      column,
      getContext: vi.fn(() => ({ column })),
    }));

    return {
      getHeaderGroups: vi.fn(() => [{ headers }]),
    };
  };

  test("renders column item with grip icon and switch", () => {
    const mockColumn = createMockColumn("firstName");
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    expect(screen.getByTestId("grip-vertical")).toBeInTheDocument();
    expect(screen.getByTestId("switch-firstName")).toBeInTheDocument();
    expect(screen.getByText("Header: firstName")).toBeInTheDocument();
  });

  test("switch reflects column visibility state", () => {
    const mockColumn = createMockColumn("firstName", true);
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    const switchElement = screen.getByTestId("switch-firstName") as HTMLInputElement;
    expect(switchElement.checked).toBe(true);
  });

  test("switch shows unchecked when column is hidden", () => {
    const mockColumn = createMockColumn("firstName", false);
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    const switchElement = screen.getByTestId("switch-firstName") as HTMLInputElement;
    expect(switchElement.checked).toBe(false);
  });

  test("calls toggleVisibility when switch is clicked", async () => {
    const user = userEvent.setup();
    const mockColumn = createMockColumn("firstName", true);
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    const switchElement = screen.getByTestId("switch-firstName");
    await user.click(switchElement);

    expect(mockColumn.toggleVisibility).toHaveBeenCalledWith(false);
  });

  test("renders with correct column id as element id", () => {
    const mockColumn = createMockColumn("lastName");
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    const elementWithId = screen.getByText("Header: lastName").closest("[id='lastName']");
    expect(elementWithId).toBeInTheDocument();
  });

  test("renders reorder button with correct aria-label", () => {
    const mockColumn = createMockColumn("firstName");
    const mockTable = createMockTable([mockColumn]);

    render(<DataTableSettingsModalItem column={mockColumn as any} table={mockTable as any} />);

    const reorderButton = screen.getByRole("button", { name: "Reorder column" });
    expect(reorderButton).toBeInTheDocument();
  });
});
