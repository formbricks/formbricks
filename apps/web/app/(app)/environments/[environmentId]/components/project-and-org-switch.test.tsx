import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { ProjectAndOrgSwitch } from "./project-and-org-switch";

// Mock the individual breadcrumb components
vi.mock("@/app/(app)/environments/[environmentId]/components/organization-breadcrumb", () => ({
  OrganizationBreadcrumb: ({
    currentOrganizationId,
    organizations,
    isMultiOrgEnabled,
    currentEnvironmentId,
  }: any) => {
    const currentOrganization = organizations.find((org: any) => org.id === currentOrganizationId);
    return (
      <div data-testid="organization-breadcrumb">
        <div>Organization: {currentOrganization?.name}</div>
        <div>Organizations Count: {organizations.length}</div>
        <div>Multi Org: {isMultiOrgEnabled ? "Enabled" : "Disabled"}</div>
        <div>Environment ID: {currentEnvironmentId}</div>
      </div>
    );
  },
}));

vi.mock("@/app/(app)/environments/[environmentId]/components/project-breadcrumb", () => ({
  ProjectBreadcrumb: ({
    currentProjectId,
    projects,
    isOwnerOrManager,
    organizationProjectsLimit,
    isFormbricksCloud,
    isLicenseActive,
    currentOrganizationId,
    currentEnvironmentId,
    isAccessControlAllowed,
  }: any) => {
    const currentProject = projects.find((project: any) => project.id === currentProjectId);
    return (
      <div data-testid="project-breadcrumb">
        <div>Project: {currentProject?.name}</div>
        <div>Projects Count: {projects.length}</div>
        <div>Owner/Manager: {isOwnerOrManager ? "Yes" : "No"}</div>
        <div>Project Limit: {organizationProjectsLimit}</div>
        <div>Formbricks Cloud: {isFormbricksCloud ? "Yes" : "No"}</div>
        <div>License Active: {isLicenseActive ? "Yes" : "No"}</div>
        <div>Organization ID: {currentOrganizationId}</div>
        <div>Environment ID: {currentEnvironmentId}</div>
        <div>Access Control: {isAccessControlAllowed ? "Allowed" : "Not Allowed"}</div>
      </div>
    );
  },
}));

vi.mock("@/app/(app)/environments/[environmentId]/components/environment-breadcrumb", () => ({
  EnvironmentBreadcrumb: ({ environments, currentEnvironmentId }: any) => {
    const currentEnvironment = environments.find((env: any) => env.id === currentEnvironmentId);
    return (
      <div data-testid="environment-breadcrumb">
        <div>Environment: {currentEnvironment?.type}</div>
        <div>Environments Count: {environments.length}</div>
        <div>Environment ID: {currentEnvironment?.id}</div>
      </div>
    );
  },
}));

// Mock the UI components
vi.mock("@/modules/ui/components/breadcrumb", () => ({
  Breadcrumb: ({ children }: any) => (
    <nav data-testid="breadcrumb" aria-label="breadcrumb">
      {children}
    </nav>
  ),
  BreadcrumbList: ({ children, className }: any) => (
    <ol data-testid="breadcrumb-list" className={className}>
      {children}
    </ol>
  ),
}));

describe("ProjectAndOrgSwitch", () => {
  const mockOrganization1 = {
    id: "org-1",
    name: "Test Organization 1",
  };

  const mockOrganization2 = {
    id: "org-2",
    name: "Test Organization 2",
  };

  const mockProject1 = {
    id: "proj-1",
    name: "Test Project 1",
  };

  const mockProject2 = {
    id: "proj-2",
    name: "Test Project 2",
  };

  const mockEnvironment1: TEnvironment = {
    id: "env-1",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    type: "development",
    projectId: "proj-1",
    appSetupCompleted: true,
  };

  const mockEnvironment2: TEnvironment = {
    id: "env-2",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    type: "development",
    projectId: "proj-1",
    appSetupCompleted: true,
  };

  const defaultProps = {
    currentOrganizationId: "org-1",
    organizations: [mockOrganization1, mockOrganization2],
    currentProjectId: "proj-1",
    projects: [mockProject1, mockProject2],
    currentEnvironmentId: "env-1",
    environments: [mockEnvironment1, mockEnvironment2],
    isMultiOrgEnabled: true,
    organizationProjectsLimit: 5,
    isFormbricksCloud: true,
    isLicenseActive: false,
    isOwnerOrManager: true,
    isAccessControlAllowed: true,
    isMember: true,
  };

  afterEach(() => {
    cleanup();
  });

  describe("Basic Rendering", () => {
    test("renders main breadcrumb structure", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumb-list")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumb")).toHaveAttribute("aria-label", "breadcrumb");
    });

    test("applies correct CSS classes to breadcrumb list", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      const breadcrumbList = screen.getByTestId("breadcrumb-list");
      expect(breadcrumbList).toHaveClass("gap-0");
    });

    test("renders all three breadcrumb components", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      expect(screen.getByTestId("organization-breadcrumb")).toBeInTheDocument();
      expect(screen.getByTestId("project-breadcrumb")).toBeInTheDocument();
    });
  });

  describe("Organization Breadcrumb Integration", () => {
    test("passes correct props to organization breadcrumb", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      const orgBreadcrumb = screen.getByTestId("organization-breadcrumb");
      expect(orgBreadcrumb).toHaveTextContent("Organization: Test Organization 1");
      expect(orgBreadcrumb).toHaveTextContent("Organizations Count: 2");
      expect(orgBreadcrumb).toHaveTextContent("Multi Org: Enabled");
      expect(orgBreadcrumb).toHaveTextContent("Environment ID: env-1");
    });

    test("handles single organization setup", () => {
      render(
        <ProjectAndOrgSwitch
          {...defaultProps}
          organizations={[mockOrganization1]}
          isMultiOrgEnabled={false}
        />
      );

      const orgBreadcrumb = screen.getByTestId("organization-breadcrumb");
      expect(orgBreadcrumb).toHaveTextContent("Organizations Count: 1");
      expect(orgBreadcrumb).toHaveTextContent("Multi Org: Disabled");
    });
  });

  describe("Project Breadcrumb Integration", () => {
    test("passes correct props to project breadcrumb", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Project: Test Project 1");
      expect(projectBreadcrumb).toHaveTextContent("Projects Count: 2");
      expect(projectBreadcrumb).toHaveTextContent("Owner/Manager: Yes");
      expect(projectBreadcrumb).toHaveTextContent("Project Limit: 5");
      expect(projectBreadcrumb).toHaveTextContent("Formbricks Cloud: Yes");
      expect(projectBreadcrumb).toHaveTextContent("License Active: No");
      expect(projectBreadcrumb).toHaveTextContent("Organization ID: org-1");
      expect(projectBreadcrumb).toHaveTextContent("Environment ID: env-1");
      expect(projectBreadcrumb).toHaveTextContent("Access Control: Allowed");
    });

    test("handles non-owner/manager user", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} isOwnerOrManager={false} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Owner/Manager: No");
    });

    test("handles self-hosted setup", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} isFormbricksCloud={false} isLicenseActive={true} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Formbricks Cloud: No");
      expect(projectBreadcrumb).toHaveTextContent("License Active: Yes");
    });

    test("handles access control restrictions", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} isAccessControlAllowed={false} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Access Control: Not Allowed");
    });
  });

  describe("Environment Breadcrumb Integration", () => {
    test("passes correct props to environment breadcrumb", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      const envBreadcrumb = screen.getByTestId("environment-breadcrumb");
      expect(envBreadcrumb).toHaveTextContent("Environments Count: 2");
    });

    test("handles single environment", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} environments={[mockEnvironment1]} />);

      const envBreadcrumb = screen.getByTestId("environment-breadcrumb");
      expect(envBreadcrumb).toHaveTextContent("Environments Count: 1");
    });
  });

  describe("Props Propagation", () => {
    test("correctly propagates organization limits", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} organizationProjectsLimit={10} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Project Limit: 10");
    });

    test("correctly propagates current organization to project breadcrumb", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} currentOrganizationId="org-2" />);

      const orgBreadcrumb = screen.getByTestId("organization-breadcrumb");
      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");

      expect(orgBreadcrumb).toHaveTextContent("Organization: Test Organization 2");
      expect(projectBreadcrumb).toHaveTextContent("Organization ID: org-2");
    });
  });

  describe("Edge Cases", () => {
    test("handles zero project limit", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} organizationProjectsLimit={0} />);

      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");
      expect(projectBreadcrumb).toHaveTextContent("Project Limit: 0");
    });

    test("handles all boolean props as false", () => {
      render(
        <ProjectAndOrgSwitch
          {...defaultProps}
          isMultiOrgEnabled={false}
          isFormbricksCloud={false}
          isLicenseActive={false}
          isOwnerOrManager={false}
          isAccessControlAllowed={false}
        />
      );

      const orgBreadcrumb = screen.getByTestId("organization-breadcrumb");
      const projectBreadcrumb = screen.getByTestId("project-breadcrumb");

      expect(orgBreadcrumb).toHaveTextContent("Multi Org: Disabled");
      expect(projectBreadcrumb).toHaveTextContent("Owner/Manager: No");
      expect(projectBreadcrumb).toHaveTextContent("Formbricks Cloud: No");
      expect(projectBreadcrumb).toHaveTextContent("License Active: No");
      expect(projectBreadcrumb).toHaveTextContent("Access Control: Not Allowed");
    });

    test("maintains component order in DOM", () => {
      render(<ProjectAndOrgSwitch {...defaultProps} />);

      const breadcrumbList = screen.getByTestId("breadcrumb-list");
      const children = Array.from(breadcrumbList.children);

      expect(children[0]).toHaveAttribute("data-testid", "organization-breadcrumb");
      expect(children[1]).toHaveAttribute("data-testid", "project-breadcrumb");
      expect(children[2]).toHaveAttribute("data-testid", "environment-breadcrumb");
    });
  });

  describe("TypeScript Props Interface", () => {
    test("accepts all required props without error", () => {
      // This test ensures the component accepts the full interface
      expect(() => {
        render(<ProjectAndOrgSwitch {...defaultProps} />);
      }).not.toThrow();
    });

    test("works with minimal valid props", () => {
      const minimalProps = {
        currentOrganizationId: "org-1",
        organizations: [mockOrganization1],
        currentProjectId: "proj-1",
        projects: [mockProject1],
        currentEnvironmentId: "env-1",
        environments: [mockEnvironment1],
        isMultiOrgEnabled: false,
        organizationProjectsLimit: 1,
        isFormbricksCloud: false,
        isLicenseActive: false,
        isOwnerOrManager: false,
        isAccessControlAllowed: false,
        isMember: true,
      };

      expect(() => {
        render(<ProjectAndOrgSwitch {...minimalProps} />);
      }).not.toThrow();

      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    });
  });
});
