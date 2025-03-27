import { ApiKeyPermission } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { createApiKeyAction, deleteApiKeyAction } from "../actions";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import { EditAPIKeys } from "./edit-api-keys";

// Mock the actions
vi.mock("../actions", () => ({
  createApiKeyAction: vi.fn(),
  deleteApiKeyAction: vi.fn(),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

const mockApiKeys: TApiKeyWithEnvironmentPermission[] = [
  {
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
    ],
  },
  {
    id: "key2",
    hashedKey: "hashed2",
    label: "Test Key 2",
    createdAt: new Date(),
    lastUsedAt: null,
    organizationId: "org1",
    createdBy: "user1",
    apiKeyEnvironments: [
      {
        environmentId: "env2",
        permission: ApiKeyPermission.read,
      },
    ],
  },
];

describe("EditAPIKeys", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    organizationId: "org1",
    apiKeys: mockApiKeys,
    locale: "en-US" as const,
    isReadOnly: false,
    projects: mockProjects,
  };

  it("renders the API keys list", () => {
    render(<EditAPIKeys {...defaultProps} />);

    expect(screen.getByText("common.label")).toBeInTheDocument();
    expect(screen.getByText("Test Key 1")).toBeInTheDocument();
    expect(screen.getByText("Test Key 2")).toBeInTheDocument();
  });

  it("renders empty state when no API keys", () => {
    render(<EditAPIKeys {...defaultProps} apiKeys={[]} />);

    expect(screen.getByText("environments.project.api_keys.no_api_keys_yet")).toBeInTheDocument();
  });

  it("shows add API key button when not readonly", () => {
    render(<EditAPIKeys {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "environments.settings.api_keys.add_api_key" })
    ).toBeInTheDocument();
  });

  it("hides add API key button when readonly", () => {
    render(<EditAPIKeys {...defaultProps} isReadOnly={true} />);

    expect(
      screen.queryByRole("button", { name: "environments.settings.api_keys.add_api_key" })
    ).not.toBeInTheDocument();
  });

  it("opens add API key modal when clicking add button", async () => {
    render(<EditAPIKeys {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: "environments.settings.api_keys.add_api_key" });
    await userEvent.click(addButton);

    // Look for the modal title specifically
    const modalTitle = screen.getByText("environments.project.api_keys.add_api_key", {
      selector: "div.text-xl",
    });
    expect(modalTitle).toBeInTheDocument();
  });

  it("handles API key deletion", async () => {
    (deleteApiKeyAction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true });

    render(<EditAPIKeys {...defaultProps} />);

    // Click delete button for first API key
    const deleteButtons = screen.getAllByRole("button", { name: "" }); // Trash icons
    await userEvent.click(deleteButtons[0]);

    // Confirm deletion in modal
    const confirmDeleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(confirmDeleteButton);

    expect(deleteApiKeyAction).toHaveBeenCalledWith({ id: "key1" });
    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_deleted");
  });

  it("handles API key creation", async () => {
    const newApiKey: TApiKeyWithEnvironmentPermission = {
      id: "key3",
      hashedKey: "hashed3",
      label: "New Key",
      createdAt: new Date(),
      lastUsedAt: null,
      organizationId: "org1",
      createdBy: "user1",
      apiKeyEnvironments: [
        {
          environmentId: "env2",
          permission: ApiKeyPermission.read,
        },
      ],
    };

    (createApiKeyAction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: newApiKey });

    render(<EditAPIKeys {...defaultProps} />);

    // Open add modal
    const addButton = screen.getByRole("button", { name: "environments.settings.api_keys.add_api_key" });
    await userEvent.click(addButton);

    // Fill in form
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack");
    await userEvent.type(labelInput, "New Key");

    // Submit form
    const submitButton = screen.getByRole("button", {
      name: "environments.project.api_keys.add_api_key",
    });
    await userEvent.click(submitButton);

    expect(createApiKeyAction).toHaveBeenCalledWith({
      organizationId: "org1",
      apiKeyData: {
        label: "New Key",
        environmentPermissions: [{ environmentId: "env2", permission: ApiKeyPermission.read }],
      },
    });
    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_created");
  });

  it("handles copy to clipboard", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    const apiKeyWithActual = {
      ...mockApiKeys[0],
      actualKey: "test-api-key-123",
    } as TApiKeyWithEnvironmentPermission & { actualKey: string };

    render(<EditAPIKeys {...defaultProps} apiKeys={[apiKeyWithActual]} />);

    // Find the copy icon button within the Files icon container
    const copyButton = screen.getByTestId("copy-button");
    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("test-api-key-123");
    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_copied_to_clipboard");
  });
});
