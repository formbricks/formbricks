import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import { OrganizationBreadcrumb } from "./organization-breadcrumb";

// Mock the dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/organization/components/CreateOrganizationModal", () => ({
  CreateOrganizationModal: ({ open, setOpen }: any) =>
    open ? (
      <div data-testid="create-organization-modal">
        <button type="button" onClick={() => setOpen(false)}>
          Close Modal
        </button>
        Create Organization Modal
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
    <div
      data-testid="dropdown-menu"
      onClick={() => onOpenChange?.(true)}
      onKeyDown={(e: any) => e.key === "Enter" && onOpenChange?.(true)}
      role="button"
      tabIndex={0}>
      {children}
    </div>
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
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  BuildingIcon: ({ className, strokeWidth }: any) => {
    const isHeader = className?.includes("mr-2");
    return (
      <svg
        data-testid={isHeader ? "building-header-icon" : "building-icon"}
        className={className}
        strokeWidth={strokeWidth}>
        <title>Building Icon</title>
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
  SettingsIcon: ({ className }: any) => (
    <svg data-testid="settings-icon" className={className}>
      <title>Settings Icon</title>
    </svg>
  ),
  Loader2: ({ className }: any) => (
    <svg data-testid="loader-2-icon" className={className}>
      <title>Loader2 Icon</title>
    </svg>
  ),
}));

describe("OrganizationBreadcrumb", () => {
  const mockPush = vi.fn();
  const mockRouter = {
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  const mockOrganization1: TOrganization = {
    id: "org-1",
    name: "Test Organization 1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    billing: {
      plan: "free",
      stripeCustomerId: null,
    } as unknown as TOrganizationBilling,
    isAIEnabled: false,
  };

  const mockOrganization2: TOrganization = {
    id: "org-2",
    name: "Test Organization 2",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    billing: {
      plan: "startup",
      stripeCustomerId: null,
    } as unknown as TOrganizationBilling,
    isAIEnabled: true,
  };

  const mockOrganizations = [mockOrganization1, mockOrganization2];
  const currentEnvironmentId = "env-123";

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
    vi.mocked(usePathname).mockReturnValue("/environments/env-123/");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Single Organization Setup", () => {
    test("renders organization breadcrumb without dropdown for single org", () => {
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={[mockOrganization1]}
          isMultiOrgEnabled={false}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("building-icon")).toBeInTheDocument();
      expect(screen.getByText("Test Organization 1")).toBeInTheDocument();
    });

    test("shows organization settings without organization switcher", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={[mockOrganization1]}
          isMultiOrgEnabled={false}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
      expect(screen.getByText("common.organization_settings")).toBeInTheDocument();
      expect(screen.queryByText("common.choose_organization")).not.toBeInTheDocument();
    });
  });

  describe("Multi Organization Setup", () => {
    test("renders organization breadcrumb with dropdown for multi org", () => {
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      expect(screen.getByTestId("breadcrumb-item")).toBeInTheDocument();
      expect(screen.getByTestId("building-icon")).toBeInTheDocument();
      expect(screen.getAllByText("Test Organization 1")).toHaveLength(2); // trigger + dropdown option
    });

    test("shows chevron icons correctly", () => {
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      // Should show chevron right when closed
      expect(screen.getByTestId("chevron-right-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("chevron-down-icon")).not.toBeInTheDocument();
    });

    test("shows chevron down when dropdown is open", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      await waitFor(() => {
        expect(screen.getByTestId("chevron-down-icon")).toBeInTheDocument();
      });
    });

    test("renders organization selector in dropdown", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByText("common.choose_organization")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-group")).toBeInTheDocument();

      const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
      expect(checkboxItems.length).toBeGreaterThanOrEqual(2); // Organizations + create new option + settings
    });

    test("handles organization change when clicking dropdown option", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
      const org2Option = checkboxItems.find((item) => item.textContent?.includes("Test Organization 2"));

      expect(org2Option).toBeInTheDocument();
      await user.click(org2Option!);

      expect(mockPush).toHaveBeenCalledWith("/organizations/org-2/");
    });

    test("shows create new organization option when multi org is enabled", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const createOrgOption = screen.getByText("common.create_new_organization");
      expect(createOrgOption).toBeInTheDocument();
      expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
    });

    test("opens create organization modal when clicking create new option", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const createOrgOption = screen.getByText("common.create_new_organization");
      await user.click(createOrgOption);

      expect(screen.getByTestId("create-organization-modal")).toBeInTheDocument();
    });

    test("hides create new organization option when multi org is disabled", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={false}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.queryByText("common.create_new_organization")).not.toBeInTheDocument();
    });
  });

  describe("Organization Settings", () => {
    test("renders all organization settings options", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          isFormbricksCloud={true}
          isMember={false}
          currentEnvironmentId={currentEnvironmentId}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByText("common.organization_settings")).toBeInTheDocument();
      expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
      expect(screen.getByText("common.general")).toBeInTheDocument();
      expect(screen.getByText("common.teams")).toBeInTheDocument();
      expect(screen.getByText("common.api_keys")).toBeInTheDocument();
      expect(screen.getByText("common.billing")).toBeInTheDocument();
    });

    test("handles navigation to organization settings", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const generalOption = screen.getByText("common.general");
      await user.click(generalOption);

      expect(mockPush).toHaveBeenCalledWith(`/environments/${currentEnvironmentId}/settings/general`);
    });

    test("marks current settings page as checked", async () => {
      vi.mocked(usePathname).mockReturnValue("/environments/env-123/settings/teams");

      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const checkboxItems = screen.getAllByTestId("dropdown-checkbox-item");
      const teamsOption = checkboxItems.find((item) => item.textContent?.includes("common.teams"));

      expect(teamsOption).toBeInTheDocument();
      expect(teamsOption).toHaveAttribute("data-checked", "true");
    });
  });

  describe("Edge Cases", () => {
    test("handles single organization with multi org enabled", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={[mockOrganization1]}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      // Should still show organization selector since multi org is enabled
      expect(screen.getByText("common.choose_organization")).toBeInTheDocument();
      expect(screen.getByText("common.create_new_organization")).toBeInTheDocument();
    });

    test("shows separator between organization switcher and settings", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      expect(screen.getByTestId("dropdown-separator")).toBeInTheDocument();
    });

    test("sets breadcrumb item as active when dropdown is open", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
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

    test("closes create organization modal correctly", async () => {
      const user = userEvent.setup();
      render(
        <OrganizationBreadcrumb
          currentOrganizationId={mockOrganization1.id}
          organizations={mockOrganizations}
          isMultiOrgEnabled={true}
          currentEnvironmentId={currentEnvironmentId}
          isFormbricksCloud={true}
          isMember={false}
          isOwnerOrManager={true}
        />
      );

      const dropdownMenu = screen.getByTestId("dropdown-menu");
      await user.click(dropdownMenu);

      const createOrgOption = screen.getByText("common.create_new_organization");
      await user.click(createOrgOption);

      expect(screen.getByTestId("create-organization-modal")).toBeInTheDocument();

      const closeButton = screen.getByText("Close Modal");
      await user.click(closeButton);

      expect(screen.queryByTestId("create-organization-modal")).not.toBeInTheDocument();
    });
  });
});
