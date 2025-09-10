import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { ProjectBreadcrumb } from "./project-breadcrumb";

// Mock the dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/projects/components/project-limit-modal", () => ({
  ProjectLimitModal: ({ open, setOpen, buttons, projectLimit }: any) =>
    open ? (
      <div data-testid="project-limit-modal">
        <div>Project Limit: {projectLimit}</div>
        <button onClick={() => setOpen(false)}>Close Limit Modal</button>
        {buttons.map((button: any) => (
          <button key={button.text} type="button" onClick={() => button.href && window.open(button.href)}>
            {button.text}
          </button>
        ))}
      </div>
    ) : null,
}));

vi.mock("@/modules/projects/components/create-project-modal", () => ({
  CreateProjectModal: ({ open, setOpen, organizationId, isAccessControlAllowed }: any) =>
    open ? (
      <div data-testid="create-project-modal">
        <div>Organization: {organizationId}</div>
        <div>Access Control: {isAccessControlAllowed ? "Allowed" : "Not Allowed"}</div>
        <button onClick={() => setOpen(false)}>Close Create Modal</button>
      </div>
    ) : null,
}));

// Mock the UI components
vi.mock("@/modules/ui/components/breadcrumb", () => ({
  BreadcrumbItem: ({ children, isActive, ...props }: any) => (
    <li data-testid="breadcrumb-item" data-active={isActive} {...props}>
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

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  FolderOpenIcon: ({ className, strokeWidth }: any) => {
    const isHeader = className?.includes("mr-2");
    return (
      <svg
        data-testid={isHeader ? "folder-open-header-icon" : "folder-open-icon"}
        className={className}
        strokeWidth={strokeWidth}>
        <title>FolderOpen Icon</title>
      </svg>
    );
  },
  ChevronDownIcon: ({ className, strokeWidth }: any) => (
    <svg data-testid="chevron-down-icon" className={className} strokeWidth={strokeWidth}>
      <title>ChevronDown Icon</title>
    </svg>
  ),
  ChevronRightIcon: ({ className, strokeWidth }: any) => (
    <svg data-testid="chevron-right-icon" className={className} strokeWidth={strokeWidth}>
      <title>ChevronRight Icon</title>
    </svg>
  ),
  PlusIcon: ({ className }: any) => (
    <svg data-testid="plus-icon" className={className}>
      <title>Plus Icon</title>
    </svg>
  ),
  Loader2: ({ className }: any) => (
    <svg data-testid="loader-2-icon" className={className}>
      <title>Loader2 Icon</title>
    </svg>
  ),
}));

describe("ProjectBreadcrumb", () => {
  const mockPush = vi.fn();
  const mockRouter = {
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  const mockProject1 = {
    id: "proj-1",
    name: "Test Project 1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    organizationId: "org-1",
    languages: [],
  } as unknown as TProject;

  const mockProject2 = {
    id: "proj-2",
    name: "Test Project 2",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    organizationId: "org-1",
    languages: [],
  } as unknown as TProject;

  const mockProjects = [mockProject1, mockProject2];

  const mockOrganization: TOrganization = {
    id: "org-1",
    name: "Test Organization",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    billing: {
      plan: "free",
      stripeCustomerId: null,
    } as unknown as TOrganizationBilling,
    isAIEnabled: false,
  };

  const defaultProps = {
    currentProjectId: "proj-1",
    currentOrganizationId: "org-1",
    projects: mockProjects,
    isOwnerOrManager: true,
    organizationProjectsLimit: 3,
    isFormbricksCloud: true,
    isLicenseActive: false,
    currentEnvironmentId: "env-123",
    isAccessControlAllowed: true,
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    test("renders project breadcrumb correctly", () => {
      render(<ProjectBreadcrumb {...defaultProps} />);

      expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("folder-open-icon")).toBeInTheDocument();
      expect(screen.getAllByText("Test Project 1")).toHaveLength(2); // trigger + dropdown option
    });

    test("shows chevron icons correctly", () => {
      render(<ProjectBreadcrumb {...defaultProps} />);

      // Should show chevron right when closed
      expect(screen.getByTestId("chevron-right-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("chevron-down-icon")).not.toBeInTheDocument();
    });

    test("shows chevron down when dropdown is open", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      await waitFor(() => {
        expect(screen.getByTestId("chevron-down-icon")).toBeInTheDocument();
      });
    });
  });

  describe("Project Selection", () => {
    test("renders dropdown content with project options", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
      expect(screen.getByText("common.choose_project")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-group")).toBeInTheDocument();
    });

    test("renders all project options in dropdown", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");

      // Find project options (excluding the add new project option)
      const projectOptions = checkboxItems.filter((item) => item.textContent?.includes("Test Project"));
      expect(projectOptions).toHaveLength(2);

      // Check current project is marked as selected
      const currentProjectOption = checkboxItems.find((item) => item.textContent?.includes("Test Project 1"));
      expect(currentProjectOption).toHaveAttribute("data-checked", "true");

      // Check other project is not selected
      const otherProjectOption = checkboxItems.find((item) => item.textContent?.includes("Test Project 2"));
      expect(otherProjectOption).toHaveAttribute("data-checked", "false");
    });

    test("handles project change when clicking dropdown option", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
      const project2Option = checkboxItems.find((item) => item.textContent?.includes("Test Project 2"));

      expect(project2Option).toBeInTheDocument();
      await user.click(project2Option!);

      expect(mockPush).toHaveBeenCalledWith("/projects/proj-2/");
    });
  });

  describe("Add New Project", () => {
    test("shows add new project option when user is owner or manager", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByText("common.add_new_project")).toBeInTheDocument();
      expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
    });

    test("hides add new project option when user is not owner or manager", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} isOwnerOrManager={false} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.queryByText("common.add_new_project")).not.toBeInTheDocument();
    });

    test("opens create project modal when within project limit", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByTestId("create-project-modal")).toBeInTheDocument();
      expect(screen.getByText("Organization: org-1")).toBeInTheDocument();
      expect(screen.getByText("Access Control: Allowed")).toBeInTheDocument();
    });

    test("opens limit modal when exceeding project limit", async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        projects: [mockProject1, mockProject2, { ...mockProject1, id: "proj-3", name: "Project 3" }],
        organizationProjectsLimit: 3,
      };
      render(<ProjectBreadcrumb {...props} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByTestId("project-limit-modal")).toBeInTheDocument();
      expect(screen.getByText("Project Limit: 3")).toBeInTheDocument();
    });
  });

  describe("Project Limit Modal", () => {
    test("shows correct buttons for Formbricks Cloud with non-enterprise plan", async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        projects: [mockProject1, mockProject2, { ...mockProject1, id: "proj-3", name: "Project 3" }],
        organizationProjectsLimit: 3,
        isFormbricksCloud: true,
        currentOrganization: {
          ...mockOrganization,
          billing: { ...mockOrganization.billing, plan: "startup" } as unknown as TOrganizationBilling,
        },
      };
      render(<ProjectBreadcrumb {...props} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByText("environments.settings.billing.upgrade")).toBeInTheDocument();
      expect(screen.getByText("common.cancel")).toBeInTheDocument();
    });

    test("shows correct buttons for self-hosted with active license", async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        projects: [mockProject1, mockProject2, { ...mockProject1, id: "proj-3", name: "Project 3" }],
        organizationProjectsLimit: 3,
        isFormbricksCloud: false,
        isLicenseActive: true,
      };
      render(<ProjectBreadcrumb {...props} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByText("environments.settings.billing.upgrade")).toBeInTheDocument();
      expect(screen.getByText("common.cancel")).toBeInTheDocument();
    });

    test("closes limit modal correctly", async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        projects: [mockProject1, mockProject2, { ...mockProject1, id: "proj-3", name: "Project 3" }],
        organizationProjectsLimit: 3,
      };
      render(<ProjectBreadcrumb {...props} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByTestId("project-limit-modal")).toBeInTheDocument();

      const closeButton = screen.getByText("Close Limit Modal");
      await user.click(closeButton);

      expect(screen.queryByTestId("project-limit-modal")).not.toBeInTheDocument();
    });
  });

  describe("Create Project Modal", () => {
    test("closes create project modal correctly", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByTestId("create-project-modal")).toBeInTheDocument();

      const closeButton = screen.getByText("Close Create Modal");
      await user.click(closeButton);

      expect(screen.queryByTestId("create-project-modal")).not.toBeInTheDocument();
    });

    test("passes correct props to create project modal", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} isAccessControlAllowed={false} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      expect(screen.getByText("Access Control: Not Allowed")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("handles single project scenario", () => {
      render(<ProjectBreadcrumb {...defaultProps} projects={[mockProject1]} />);

      expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
      expect(screen.getAllByText("Test Project 1")).toHaveLength(2); // trigger + dropdown option
    });

    test("sets breadcrumb item as active when dropdown is open", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} />);

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

    test("handles project limit of zero", async () => {
      const user = userEvent.setup();
      render(<ProjectBreadcrumb {...defaultProps} organizationProjectsLimit={0} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      // Should show limit modal even with 0 projects when limit is 0
      expect(screen.getByTestId("project-limit-modal")).toBeInTheDocument();
      expect(screen.getByText("Project Limit: 0")).toBeInTheDocument();
    });

    test("handles enterprise plan on Formbricks Cloud", async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        projects: [mockProject1, mockProject2, { ...mockProject1, id: "proj-3", name: "Project 3" }],
        organizationProjectsLimit: 3,
        currentOrganization: {
          ...mockOrganization,
          billing: { ...mockOrganization.billing, plan: "enterprise" } as unknown as TOrganizationBilling,
        },
      };
      render(<ProjectBreadcrumb {...props} />);

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const addProjectOption = screen.getByText("common.add_new_project");
      await user.click(addProjectOption);

      // Should show self-hosted style buttons for enterprise plan
      expect(screen.getByTestId("project-limit-modal")).toBeInTheDocument();
    });
  });
});
