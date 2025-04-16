import { ApiKeyPermission } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import { ViewPermissionModal } from "./view-permission-modal";

// Mock the translate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Base project setup
const baseProject = {};

// Example project data
const mockProjects: TProject[] = [
  {
    ...baseProject,
    id: "project1",
    name: "Project 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationId: "org1",
    styling: {
      allowStyleOverwrite: true,
      brandColor: { light: "#000000" },
    },
    config: {
      channel: "link" as const,
      industry: "saas" as const,
    },
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
  } as TProject,
];

// Example API key with permissions
const mockApiKey: TApiKeyWithEnvironmentPermission = {
  id: "key1",
  label: "Test Key 1",
  createdAt: new Date(),
  organizationAccess: {
    accessControl: {
      read: true,
      write: false,
    },
  },
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

// API key with additional organization access
const mockApiKeyWithOrgAccess = {
  ...mockApiKey,
  organizationAccess: {
    accessControl: { read: true, write: false },
    otherAccess: { read: false, write: true },
  },
};

// API key with no environment permissions
const apiKeyWithoutPermissions = {
  ...mockApiKey,
  apiKeyEnvironments: [],
};

describe("ViewPermissionModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    open: true,
    setOpen: vi.fn(),
    projects: mockProjects,
    apiKey: mockApiKey,
  };

  test("renders the modal with correct title", () => {
    render(<ViewPermissionModal {...defaultProps} />);
    // Check the localized text for the modal's title
    expect(screen.getByText(mockApiKey.label)).toBeInTheDocument();
  });

  test("renders all permissions for the API key", () => {
    render(<ViewPermissionModal {...defaultProps} />);
    // The same key has two environment permissions
    const projectNames = screen.getAllByText("Project 1");
    expect(projectNames).toHaveLength(2); // once for each permission
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();
  });

  test("displays correct project and environment names", () => {
    render(<ViewPermissionModal {...defaultProps} />);
    // Check for 'Project 1', 'production', 'development'
    const projectNames = screen.getAllByText("Project 1");
    expect(projectNames).toHaveLength(2);
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
  });

  test("displays correct permission levels", () => {
    render(<ViewPermissionModal {...defaultProps} />);
    // Check if permission levels 'read' and 'write' appear
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();
  });

  test("handles API key with no permissions", () => {
    render(<ViewPermissionModal {...defaultProps} apiKey={apiKeyWithoutPermissions} />);
    // Ensure environment/permission section is empty
    expect(screen.queryByText("Project 1")).not.toBeInTheDocument();
    expect(screen.queryByText("production")).not.toBeInTheDocument();
    expect(screen.queryByText("development")).not.toBeInTheDocument();
  });

  test("displays organizationAccess toggles", () => {
    render(<ViewPermissionModal {...defaultProps} apiKey={mockApiKeyWithOrgAccess} />);

    expect(screen.getByTestId("organization-access-accessControl-read")).toBeChecked();
    expect(screen.getByTestId("organization-access-accessControl-read")).toBeDisabled();
    expect(screen.getByTestId("organization-access-accessControl-write")).not.toBeChecked();
    expect(screen.getByTestId("organization-access-accessControl-write")).toBeDisabled();
    expect(screen.getByTestId("organization-access-otherAccess-read")).not.toBeChecked();
    expect(screen.getByTestId("organization-access-otherAccess-write")).toBeChecked();
  });
});
