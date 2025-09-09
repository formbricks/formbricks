import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { EnvironmentBreadcrumb } from "./environment-breadcrumb";

// Mock the dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock the UI components
vi.mock("@/modules/ui/components/breadcrumb", () => ({
  BreadcrumbItem: ({ children, isActive, isHighlighted, ...props }: any) => (
    <li data-testid="breadcrumb-item" data-active={isActive} data-highlighted={isHighlighted} {...props}>
      {children}
    </li>
  ),
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children, onOpenChange }: any) => (
    <button
      type="button"
      data-testid="dropdown-menu"
      onClick={() => onOpenChange?.(true)}
      onKeyDown={(e: any) => e.key === "Enter" && onOpenChange?.(true)}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children, ...props }: any) => (
    <div data-testid="dropdown-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuCheckboxItem: ({ children, onClick, checked, ...props }: any) => (
    <div
      data-testid="dropdown-checkbox-item"
      data-checked={checked}
      onClick={onClick}
      onKeyDown={(e: any) => e.key === "Enter" && onClick?.()}
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={0}
      {...props}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <button data-testid="dropdown-trigger" {...props}>
      {children}
    </button>
  ),
  DropdownMenuGroup: ({ children }: any) => <div data-testid="dropdown-group">{children}</div>,
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => (
    <div data-testid="tooltip-trigger" data-as-child={asChild}>
      {children}
    </div>
  ),
  TooltipContent: ({ children, className }: any) => (
    <div data-testid="tooltip-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  Code2Icon: ({ className, strokeWidth }: any) => {
    const isHeader = className?.includes("mr-2");
    return (
      <svg
        data-testid={isHeader ? "code2-header-icon" : "code2-icon"}
        className={className}
        strokeWidth={strokeWidth}>
        <title>Code2 Icon</title>
      </svg>
    );
  },
  ChevronDownIcon: ({ className, strokeWidth }: any) => (
    <svg data-testid="chevron-down-icon" className={className} strokeWidth={strokeWidth}>
      <title>ChevronDown Icon</title>
    </svg>
  ),
  CircleHelpIcon: ({ className }: any) => (
    <svg data-testid="circle-help-icon" className={className}>
      <title>CircleHelp Icon</title>
    </svg>
  ),
  Loader2: ({ className }: any) => (
    <svg data-testid="loader-2-icon" className={className}>
      <title>Loader2 Icon</title>
    </svg>
  ),
}));

describe("EnvironmentBreadcrumb", () => {
  const mockPush = vi.fn();
  const mockRouter = {
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  const mockProductionEnvironment: TEnvironment = {
    id: "env-prod-1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    type: "production",
    projectId: "project-1",
    appSetupCompleted: true,
  };

  const mockDevelopmentEnvironment: TEnvironment = {
    id: "env-dev-1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    type: "development",
    projectId: "project-1",
    appSetupCompleted: true,
  };

  const mockEnvironments: TEnvironment[] = [mockProductionEnvironment, mockDevelopmentEnvironment];

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders environment breadcrumb with production environment", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("code2-icon")).toBeInTheDocument();
    expect(screen.getAllByText("production")).toHaveLength(2); // trigger + dropdown option
  });

  test("renders environment breadcrumb with development environment and shows tooltip", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockDevelopmentEnvironment.id}
      />
    );

    expect(screen.getAllByText("development")).toHaveLength(2); // trigger + dropdown option
    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    expect(screen.getByTestId("circle-help-icon")).toBeInTheDocument();
  });

  test("highlights breadcrumb item for development environment", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockDevelopmentEnvironment.id}
      />
    );

    const breadcrumbItem = screen.getByTestId("breadcrumb-item");
    expect(breadcrumbItem).toHaveAttribute("data-highlighted", "true");
  });

  test("does not highlight breadcrumb item for production environment", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const breadcrumbItem = screen.getByTestId("breadcrumb-item");
    expect(breadcrumbItem).toHaveAttribute("data-highlighted", "false");
  });

  test("shows chevron down icon when dropdown is open", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const dropdownMenu = screen.getByTestId("dropdown-menu");
    await user.click(dropdownMenu);

    await waitFor(() => {
      expect(screen.getAllByTestId("chevron-down-icon")).toHaveLength(1);
    });
  });

  test("renders dropdown content with environment options", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const dropdownMenu = screen.getByTestId("dropdown-menu");
    await user.click(dropdownMenu);

    expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
    expect(screen.getByText("common.choose_environment")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-group")).toBeInTheDocument();
  });

  test("renders all environment options in dropdown", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const dropdownMenu = screen.getByTestId("dropdown-menu");
    await user.click(dropdownMenu);

    const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
    expect(checkboxItems).toHaveLength(2);

    // Check production environment option
    const productionOption = checkboxItems.find((item) => item.textContent?.includes("production"));
    expect(productionOption).toBeInTheDocument();
    expect(productionOption).toHaveAttribute("data-checked", "true");

    // Check development environment option
    const developmentOption = checkboxItems.find((item) => item.textContent?.includes("development"));
    expect(developmentOption).toBeInTheDocument();
    expect(developmentOption).toHaveAttribute("data-checked", "false");
  });

  test("handles environment change when clicking dropdown option", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const dropdownMenu = screen.getByTestId("dropdown-menu");
    await user.click(dropdownMenu);

    const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
    const developmentOption = checkboxItems.find((item) => item.textContent?.includes("development"));

    expect(developmentOption).toBeInTheDocument();
    await user.click(developmentOption!);

    expect(mockPush).toHaveBeenCalledWith("/environments/env-dev-1/");
  });

  test("capitalizes environment type in display", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    const environmentSpans = screen.getAllByText("production");
    const triggerSpan = environmentSpans.find((span) => span.className.includes("capitalize"));
    expect(triggerSpan).toHaveClass("capitalize");
  });

  test("tooltip shows correct content for development environment", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockDevelopmentEnvironment.id}
      />
    );

    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toHaveClass("text-white bg-red-800 border-none mt-2");
    expect(tooltipContent).toHaveTextContent("common.development_environment_banner");
  });

  test("renders without tooltip for production environment", () => {
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    expect(screen.queryByTestId("circle-help-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("sets breadcrumb item as active when dropdown is open", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentBreadcrumb
        environments={mockEnvironments}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    // Initially not active
    let breadcrumbItem = screen.getByTestId("breadcrumb-item");
    expect(breadcrumbItem).toHaveAttribute("data-active", "false");

    // Open dropdown
    const dropdownMenu = screen.getByTestId("dropdown-menu");
    await user.click(dropdownMenu);

    // Should be active when dropdown is open
    breadcrumbItem = screen.getByTestId("breadcrumb-item");
    expect(breadcrumbItem).toHaveAttribute("data-active", "true");
  });

  test("handles single environment scenario", () => {
    const singleEnvironment = [mockProductionEnvironment];

    render(
      <EnvironmentBreadcrumb
        environments={singleEnvironment}
        currentEnvironmentId={mockProductionEnvironment.id}
      />
    );

    expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
    expect(screen.getAllByText("production")).toHaveLength(2); // trigger + dropdown option
  });
});
