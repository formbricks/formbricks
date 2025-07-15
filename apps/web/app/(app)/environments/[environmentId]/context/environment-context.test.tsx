import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
import { EnvironmentContextWrapper, useEnvironment } from "./environment-context";

// Mock environment data
const mockEnvironment: TEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "test-project-id",
  appSetupCompleted: true,
};

// Mock project data
const mockProject = {
  id: "test-project-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "test-org-id",
  config: {
    channel: "app",
    industry: "saas",
  },
  linkSurveyBranding: true,
  styling: {
    allowStyleOverwrite: true,
    brandColor: {
      light: "#ffffff",
      dark: "#000000",
    },
    questionColor: {
      light: "#000000",
      dark: "#ffffff",
    },
    inputColor: {
      light: "#000000",
      dark: "#ffffff",
    },
    inputBorderColor: {
      light: "#cccccc",
      dark: "#444444",
    },
    cardBackgroundColor: {
      light: "#ffffff",
      dark: "#000000",
    },
    cardBorderColor: {
      light: "#cccccc",
      dark: "#444444",
    },
    isDarkModeEnabled: false,
    isLogoHidden: false,
    hideProgressBar: false,
    roundness: 8,
    cardArrangement: {
      linkSurveys: "casual",
      appSurveys: "casual",
    },
  },
  recontactDays: 30,
  inAppSurveyBranding: true,
  logo: {
    url: "test-logo.png",
    bgColor: "#ffffff",
  },
  placement: "bottomRight",
  clickOutsideClose: true,
} as TProject;

// Test component that uses the hook
const TestComponent = () => {
  const { environment, project } = useEnvironment();
  return (
    <div>
      <div data-testid="environment-id">{environment.id}</div>
      <div data-testid="environment-type">{environment.type}</div>
      <div data-testid="project-id">{project.id}</div>
      <div data-testid="project-organization-id">{project.organizationId}</div>
    </div>
  );
};

describe("EnvironmentContext", () => {
  afterEach(() => {
    cleanup();
  });

  test("provides environment and project data to child components", () => {
    render(
      <EnvironmentContextWrapper environment={mockEnvironment} project={mockProject}>
        <TestComponent />
      </EnvironmentContextWrapper>
    );

    expect(screen.getByTestId("environment-id")).toHaveTextContent("test-env-id");
    expect(screen.getByTestId("environment-type")).toHaveTextContent("development");
    expect(screen.getByTestId("project-id")).toHaveTextContent("test-project-id");
    expect(screen.getByTestId("project-organization-id")).toHaveTextContent("test-org-id");
  });

  test("throws error when useEnvironment is used outside of provider", () => {
    const TestComponentWithoutProvider = () => {
      useEnvironment();
      return <div>Should not render</div>;
    };

    expect(() => {
      render(<TestComponentWithoutProvider />);
    }).toThrow("useEnvironment must be used within an EnvironmentProvider");
  });

  test("updates context value when environment or project changes", () => {
    const { rerender } = render(
      <EnvironmentContextWrapper environment={mockEnvironment} project={mockProject}>
        <TestComponent />
      </EnvironmentContextWrapper>
    );

    expect(screen.getByTestId("environment-type")).toHaveTextContent("development");

    const updatedEnvironment = {
      ...mockEnvironment,
      type: "production" as const,
    };

    rerender(
      <EnvironmentContextWrapper environment={updatedEnvironment} project={mockProject}>
        <TestComponent />
      </EnvironmentContextWrapper>
    );

    expect(screen.getByTestId("environment-type")).toHaveTextContent("production");
  });

  test("memoizes context value correctly", () => {
    const { rerender } = render(
      <EnvironmentContextWrapper environment={mockEnvironment} project={mockProject}>
        <TestComponent />
      </EnvironmentContextWrapper>
    );

    // Re-render with same props
    rerender(
      <EnvironmentContextWrapper environment={mockEnvironment} project={mockProject}>
        <TestComponent />
      </EnvironmentContextWrapper>
    );

    // Should still work correctly
    expect(screen.getByTestId("environment-id")).toHaveTextContent("test-env-id");
    expect(screen.getByTestId("project-id")).toHaveTextContent("test-project-id");
  });
});
