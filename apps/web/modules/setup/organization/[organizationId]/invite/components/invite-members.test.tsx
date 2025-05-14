import { inviteOrganizationMemberAction } from "@/modules/setup/organization/[organizationId]/invite/actions";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InviteMembers } from "./invite-members";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock the translation hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the invite action
vi.mock("@/modules/setup/organization/[organizationId]/invite/actions", () => ({
  inviteOrganizationMemberAction: vi.fn(),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock helper
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (result) => result?.error || "Invalid email",
}));

describe("InviteMembers", () => {
  const mockInvitedUserId = "a7z22q8y6o1c3hxgmbwlqod5";

  const mockRouter = {
    push: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the component with initial state", () => {
    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    expect(screen.getByText("setup.invite.invite_your_organization_members")).toBeInTheDocument();
    expect(screen.getByText("setup.invite.life_s_no_fun_alone")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Full Name (optional)")).toBeInTheDocument();
    expect(screen.getByText("setup.invite.add_another_member")).toBeInTheDocument();
    expect(screen.getByText("setup.invite.continue")).toBeInTheDocument();
    expect(screen.getByText("setup.invite.skip")).toBeInTheDocument();
  });

  test("shows SMTP warning when SMTP is not configured", () => {
    render(<InviteMembers IS_SMTP_CONFIGURED={false} organizationId="org-123" />);

    expect(screen.getByText("setup.invite.smtp_not_configured")).toBeInTheDocument();
    expect(screen.getByText("setup.invite.smtp_not_configured_description")).toBeInTheDocument();
  });

  test("adds another member field when clicking add member button", () => {
    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const addButton = screen.getByText("setup.invite.add_another_member");
    fireEvent.click(addButton);

    const emailInputs = screen.getAllByPlaceholderText("user@example.com");
    const nameInputs = screen.getAllByPlaceholderText("Full Name (optional)");

    expect(emailInputs).toHaveLength(2);
    expect(nameInputs).toHaveLength(2);
  });

  test("handles skip button click", () => {
    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const skipButton = screen.getByText("setup.invite.skip");
    fireEvent.click(skipButton);

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  test("handles successful member invitation", async () => {
    vi.mocked(inviteOrganizationMemberAction).mockResolvedValueOnce({ data: mockInvitedUserId });

    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const emailInput = screen.getByPlaceholderText("user@example.com");
    const nameInput = screen.getByPlaceholderText("Full Name (optional)");
    const continueButton = screen.getByText("setup.invite.continue");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(inviteOrganizationMemberAction).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        organizationId: "org-123",
      });
      expect(toast.success).toHaveBeenCalledWith("setup.invite.invitation_sent_to test@example.com!");
      expect(mockRouter.push).toHaveBeenCalledWith("/");
    });
  });

  test("handles failed member invitation", async () => {
    // @ts-expect-error -- Mocking the error response
    vi.mocked(inviteOrganizationMemberAction).mockResolvedValueOnce({ error: "Invalid email" });

    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const emailInput = screen.getByPlaceholderText("user@example.com");
    const nameInput = screen.getByPlaceholderText("Full Name (optional)");
    const continueButton = screen.getByText("setup.invite.continue");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid email");
    });
  });

  test("handles invitation error", async () => {
    vi.mocked(inviteOrganizationMemberAction).mockRejectedValueOnce(new Error("Network error"));

    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const emailInput = screen.getByPlaceholderText("user@example.com");
    const nameInput = screen.getByPlaceholderText("Full Name (optional)");
    const continueButton = screen.getByText("setup.invite.continue");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("setup.invite.failed_to_invite test@example.com.");
    });
  });

  test("validates email format", async () => {
    render(<InviteMembers IS_SMTP_CONFIGURED={true} organizationId="org-123" />);

    const emailInput = screen.getByPlaceholderText("user@example.com");
    const continueButton = screen.getByText("setup.invite.continue");

    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });
});
