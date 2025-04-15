import { ApiKeyPermission } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, it, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { createApiKeyAction, deleteApiKeyAction, updateApiKeyAction } from "../actions";
import { TApiKeyWithEnvironmentPermission } from "../types/api-keys";
import { EditAPIKeys } from "./edit-api-keys";

// Mock the actions
vi.mock("../actions", () => ({
  createApiKeyAction: vi.fn(),
  updateApiKeyAction: vi.fn(),
  deleteApiKeyAction: vi.fn(),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the translate hook from @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key, // simply return the key
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

// Example API keys
const mockApiKeys: TApiKeyWithEnvironmentPermission[] = [
  {
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
    ],
  },
  {
    id: "key2",
    label: "Test Key 2",
    createdAt: new Date(),
    organizationAccess: {
      accessControl: {
        read: true,
        write: false,
      },
    },
    apiKeyEnvironments: [
      {
        environmentId: "env2",
        permission: ApiKeyPermission.read,
      },
    ],
  },
];

describe("EditAPIKeys", () => {
  // Reset environment after each test
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
    const deleteButtons = screen.getAllByRole("button", { name: "" }); // Trash icons

    // Click delete button for first API key
    await userEvent.click(deleteButtons[0]);
    const confirmDeleteButton = screen.getByRole("button", { name: "common.delete" });
    await userEvent.click(confirmDeleteButton);

    expect(deleteApiKeyAction).toHaveBeenCalledWith({ id: "key1" });
    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_deleted");
  });

  test("handles API key updation", async () => {
    const updatedApiKey: TApiKeyWithEnvironmentPermission = {
      id: "key1",
      label: "Updated Key",
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
      ],
    };
    (updateApiKeyAction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: updatedApiKey });
    render(<EditAPIKeys {...defaultProps} />);

    // Open view permission modal
    const apiKeyRows = screen.getAllByTestId("api-key-row");

    // click on the first row
    await userEvent.click(apiKeyRows[0]);

    const labelInput = screen.getByTestId("api-key-label");
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, "Updated Key");

    const submitButton = screen.getByRole("button", { name: "common.update" });
    await userEvent.click(submitButton);

    expect(updateApiKeyAction).toHaveBeenCalledWith({
      apiKeyId: "key1",
      apiKeyData: {
        label: "Updated Key",
      },
    });

    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_updated");
  });

  it("handles API key creation", async () => {
    const newApiKey: TApiKeyWithEnvironmentPermission = {
      id: "key3",
      label: "New Key",
      createdAt: new Date(),
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
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

    // Optionally toggle the read switch
    const readSwitch = screen.getByTestId("organization-access-accessControl-read"); // first is read, second is write
    await userEvent.click(readSwitch); // toggle 'read' to true

    // Submit form
    const submitButton = screen.getByRole("button", { name: "environments.project.api_keys.add_api_key" });
    await userEvent.click(submitButton);

    expect(createApiKeyAction).toHaveBeenCalledWith({
      organizationId: "org1",
      apiKeyData: {
        label: "New Key",
        environmentPermissions: [],
        organizationAccess: {
          accessControl: { read: true, write: false },
        },
      },
    });

    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_created");
  });

  it("handles copy to clipboard", async () => {
    // Mock the clipboard writeText method
    const writeText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    // Provide an API key that has an actualKey
    const apiKeyWithActual = {
      ...mockApiKeys[0],
      actualKey: "test-api-key-123",
    } as TApiKeyWithEnvironmentPermission & { actualKey: string };

    render(<EditAPIKeys {...defaultProps} apiKeys={[apiKeyWithActual]} />);

    // Find the copy icon button by testid
    const copyButton = screen.getByTestId("copy-button");
    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("test-api-key-123");
    expect(toast.success).toHaveBeenCalledWith("environments.project.api_keys.api_key_copied_to_clipboard");
  });
});
