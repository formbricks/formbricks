import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AddVariablesDropdown } from "./add-variables-dropdown";

// Mock UI components
vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div data-testid="dropdown-menu-item">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid="dropdown-menu-trigger">
      <button data-testid="dropdown-trigger-button">{children}</button>
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronDownIcon: () => <div data-testid="chevron-icon">ChevronDown</div>,
}));

describe("AddVariablesDropdown", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders dropdown with variables", () => {
    const addVariable = vi.fn();
    const variables = ["name", "email"];

    render(<AddVariablesDropdown addVariable={addVariable} variables={variables} />);

    // Check for dropdown components
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu-content")).toBeInTheDocument();

    // Check for variable entries
    expect(screen.getByText("{NAME_VARIABLE}")).toBeInTheDocument();
    expect(screen.getByText("{EMAIL_VARIABLE}")).toBeInTheDocument();
  });

  test("renders text editor version when isTextEditor is true", () => {
    const addVariable = vi.fn();
    const variables = ["name"];

    render(<AddVariablesDropdown addVariable={addVariable} variables={variables} isTextEditor={true} />);

    // Check for mobile view
    const mobileView = screen.getByText("+");
    expect(mobileView).toBeInTheDocument();
    expect(mobileView).toHaveClass("block sm:hidden");
  });

  test("renders normal version when isTextEditor is false", () => {
    const addVariable = vi.fn();
    const variables = ["name"];

    // Create a clean render for this test
    const { container, unmount } = render(
      <AddVariablesDropdown addVariable={addVariable} variables={variables} isTextEditor={false} />
    );

    // For non-text editor version, we shouldn't have the mobile "+" version
    // Note: We're only testing this specific render, not any lingering DOM from previous tests
    const mobileElements = container.querySelectorAll(".block.sm\\:hidden");
    expect(mobileElements.length).toBe(0);

    unmount();
  });

  test("calls addVariable with correct format when variable is clicked", async () => {
    const user = userEvent.setup();
    const addVariable = vi.fn();
    const variables = ["user name"];

    render(<AddVariablesDropdown addVariable={addVariable} variables={variables} />);

    // Find and click the button for the variable
    const variableButton = screen.getByText("{USER_NAME_VARIABLE}").closest("button");
    await user.click(variableButton!);

    // Should call addVariable with the correct variable name
    expect(addVariable).toHaveBeenCalledWith("user name_variable");
  });

  test("displays variable info", () => {
    const addVariable = vi.fn();
    const variables = ["name"];

    render(<AddVariablesDropdown addVariable={addVariable} variables={variables} />);

    // Find the variable info by its container rather than text content
    const variableInfoElements = screen.getAllByText(/name_info/);
    expect(variableInfoElements.length).toBeGreaterThan(0);
  });
});
