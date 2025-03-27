import { ApiKeyPermission } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import { ViewPermissionModal } from "./view-permission-modal";

// Mock the translate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

const baseProject = {
  id: "project1",
  name: "Project 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#000000" },
  },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: {
    channel: "link" as const,
    industry: "saas" as const,
  },
  placement: "bottomLeft" as const,
  clickOutsideClose: true,
  darkOverlay: false,
  languages: [],
};

const mockProjects: TProject[] = [
  {
    ...baseProject,
    environments: [
      {
        id: "env1",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
      {
        id: "env2",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
    ],
  },
];

const mockApiKey: TApiKeyWithEnvironmentPermission = {
  id: "key1",
  hashedKey: "hashed1",
  label: "Test Key 1",
  createdAt: new Date(),
  lastUsedAt: null,
  organizationId: "org1",
  createdBy: "user1",
  apiKeyEnvironments: [
    {
      environmentId: "env1",
      permission: ApiKeyPermission.read,
    },
    {
      environmentId: "env2",
      permission: ApiKeyPermission.write,
    },
  ],
};

describe("ViewPermissionModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    open: true,
    setOpen: vi.fn(),
    apiKey: mockApiKey,
    projects: mockProjects,
  };

  it("renders the modal with correct title", () => {
    render(<ViewPermissionModal {...defaultProps} />);

    expect(screen.getByText("environments.project.api_keys.api_key")).toBeInTheDocument();
  });

  it("renders all permissions for the API key", () => {
    render(<ViewPermissionModal {...defaultProps} />);

    // Check if both permissions are rendered
    const projectNames = screen.getAllByText("Project 1");
    expect(projectNames).toHaveLength(2); // Should appear twice, once for each permission
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();
  });

  it("displays correct project and environment names", () => {
    render(<ViewPermissionModal {...defaultProps} />);

    // Check if project name is displayed correctly for each permission
    const projectNames = screen.getAllByText("Project 1");
    expect(projectNames).toHaveLength(2); // Should appear twice, once for each permission

    // Check if environment types are displayed correctly
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
  });

  it("displays correct permission levels", () => {
    render(<ViewPermissionModal {...defaultProps} />);

    // Check if permission levels are displayed correctly
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();
  });

  it("handles API key with no permissions", () => {
    const apiKeyWithoutPermissions = {
      ...mockApiKey,
      apiKeyEnvironments: [],
    };

    render(<ViewPermissionModal {...defaultProps} apiKey={apiKeyWithoutPermissions} />);

    // Check if the permissions section is empty
    expect(screen.queryByText("Project 1")).not.toBeInTheDocument();
    expect(screen.queryByText("production")).not.toBeInTheDocument();
    expect(screen.queryByText("development")).not.toBeInTheDocument();
  });
});
