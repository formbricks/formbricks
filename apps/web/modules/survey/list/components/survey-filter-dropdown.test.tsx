import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TFilterOption } from "@formbricks/types/surveys/types";
import { SurveyFilterDropdown } from "./survey-filter-dropdown";

// Mock UI components
vi.mock("@/modules/ui/components/checkbox", () => ({
  Checkbox: ({ checked, className }) => (
    <div data-testid="mock-checkbox" data-checked={checked} className={className} />
  ),
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children, open, onOpenChange }) => (
    <div data-testid="dropdown-menu" data-open={open} onClick={onOpenChange}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children, asChild, className }) => (
    <div data-testid="dropdown-trigger" className={className}>
      {asChild ? children : null}
    </div>
  ),
  DropdownMenuContent: ({ children, align, className }) => (
    <div data-testid="dropdown-content" data-align={align} className={className}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, className, onClick }) => (
    <div data-testid="dropdown-item" className={className} onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronDownIcon: () => <div data-testid="chevron-icon">ChevronDownIcon</div>,
}));

describe("SurveyFilterDropdown", () => {
  const mockOptions: TFilterOption[] = [
    { label: "option1.label", value: "option1" },
    { label: "option2.label", value: "option2" },
    { label: "option3.label", value: "option3" },
  ];

  const mockProps = {
    title: "Test Filter",
    id: "status" as const,
    options: mockOptions,
    selectedOptions: ["option2"],
    setSelectedOptions: vi.fn(),
    isOpen: false,
    toggleDropdown: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders with correct title", () => {
    render(<SurveyFilterDropdown {...mockProps} />);

    expect(screen.getByText("Test Filter")).toBeInTheDocument();
  });

  test("applies correct styling when options are selected", () => {
    render(<SurveyFilterDropdown {...mockProps} />);

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger.className).toContain("bg-slate-900 text-white");
  });

  test("applies correct styling when no options are selected", () => {
    render(<SurveyFilterDropdown {...mockProps} selectedOptions={[]} />);

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger.className).toContain("hover:bg-slate-900");
    expect(trigger.className).not.toContain("bg-slate-900 text-white");
  });

  test("calls toggleDropdown when dropdown opens or closes", async () => {
    const user = userEvent.setup();
    render(<SurveyFilterDropdown {...mockProps} />);

    const dropdown = screen.getByTestId("dropdown-menu");
    await user.click(dropdown);

    expect(mockProps.toggleDropdown).toHaveBeenCalledWith("status");
  });

  test("renders all options in dropdown", () => {
    render(<SurveyFilterDropdown {...mockProps} isOpen={true} />);

    const dropdownContent = screen.getByTestId("dropdown-content");
    expect(dropdownContent).toBeInTheDocument();

    const items = screen.getAllByTestId("dropdown-item");
    expect(items).toHaveLength(mockOptions.length);

    // Check that all option labels are displayed
    expect(screen.getByText("option1.label")).toBeInTheDocument();
    expect(screen.getByText("option2.label")).toBeInTheDocument();
    expect(screen.getByText("option3.label")).toBeInTheDocument();
  });

  test("renders checkboxes with correct checked state", () => {
    render(<SurveyFilterDropdown {...mockProps} isOpen={true} />);

    const checkboxes = screen.getAllByTestId("mock-checkbox");
    expect(checkboxes).toHaveLength(mockOptions.length);

    // The option2 is selected, others are not
    checkboxes.forEach((checkbox, index) => {
      if (mockOptions[index].value === "option2") {
        expect(checkbox).toHaveAttribute("data-checked", "true");
        expect(checkbox.className).toContain("bg-brand-dark border-none");
      } else {
        expect(checkbox).toHaveAttribute("data-checked", "false");
        expect(checkbox.className).not.toContain("bg-brand-dark border-none");
      }
    });
  });

  test("calls setSelectedOptions when an option is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyFilterDropdown {...mockProps} isOpen={true} />);

    const items = screen.getAllByTestId("dropdown-item");
    await user.click(items[0]); // Click on the first option

    expect(mockProps.setSelectedOptions).toHaveBeenCalledWith("option1");
  });

  test("renders dropdown content with correct align property", () => {
    render(<SurveyFilterDropdown {...mockProps} isOpen={true} />);

    const dropdownContent = screen.getByTestId("dropdown-content");
    expect(dropdownContent).toHaveAttribute("data-align", "start");
  });

  test("renders ChevronDownIcon", () => {
    render(<SurveyFilterDropdown {...mockProps} />);

    const chevronIcon = screen.getByTestId("chevron-icon");
    expect(chevronIcon).toBeInTheDocument();
  });
});
