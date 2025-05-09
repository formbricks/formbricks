import { createOrganizationAction } from "@/app/setup/organization/create/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateOrganization } from "./create-organization";

// Mock dependencies
vi.mock("@/app/setup/organization/create/actions", () => ({
  createOrganizationAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockRouter = {
  push: vi.fn(),
};

describe("CreateOrganization", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
    vi.mocked(createOrganizationAction).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the component correctly", () => {
    render(<CreateOrganization />);

    expect(screen.getByText("setup.organization.create.title")).toBeInTheDocument();
    expect(screen.getByText("setup.organization.create.description")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g., Acme Inc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "setup.organization.create.continue" })).toBeInTheDocument();
  });

  test("input field updates organization name and button state", async () => {
    const user = userEvent.setup();
    render(<CreateOrganization />);

    const input = screen.getByPlaceholderText("e.g., Acme Inc");
    const button = screen.getByRole("button", { name: "setup.organization.create.continue" });

    expect(button).toBeDisabled();

    await user.type(input, "Test Organization");
    expect(input).toHaveValue("Test Organization");
    expect(button).toBeEnabled();

    await user.clear(input);
    expect(input).toHaveValue("");
    expect(button).toBeDisabled();

    await user.type(input, "   ");
    expect(input).toHaveValue("   ");
    expect(button).toBeDisabled();
  });

  test("calls createOrganizationAction and redirects on successful submission", async () => {
    const user = userEvent.setup();
    const mockOrganizationId = "org_123test";
    vi.mocked(createOrganizationAction).mockResolvedValue({
      data: { id: mockOrganizationId, name: "Test Org" },
      error: null,
    } as any);

    render(<CreateOrganization />);

    const input = screen.getByPlaceholderText("e.g., Acme Inc");
    const button = screen.getByRole("button", { name: "setup.organization.create.continue" });

    await user.type(input, "Test Organization");
    await user.click(button);

    await waitFor(() => {
      expect(createOrganizationAction).toHaveBeenCalledWith({ organizationName: "Test Organization" });
    });
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(`/setup/organization/${mockOrganizationId}/invite`);
    });
  });

  test("shows an error toast if createOrganizationAction throws an error", async () => {
    const user = userEvent.setup();
    vi.mocked(createOrganizationAction).mockRejectedValue(new Error("Network error"));

    render(<CreateOrganization />);

    const input = screen.getByPlaceholderText("e.g., Acme Inc");
    const button = screen.getByRole("button", { name: "setup.organization.create.continue" });

    await user.type(input, "Test Organization");
    await user.click(button);

    await waitFor(() => {
      expect(createOrganizationAction).toHaveBeenCalledWith({ organizationName: "Test Organization" });
    });
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Some error occurred while creating organization");
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
