import { cleanup, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { type Mock, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EditMembershipRole } from "./edit-membership-role";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../actions", () => ({
  updateMembershipAction: vi.fn(),
  updateInviteAction: vi.fn(),
}));

describe("EditMembershipRole Component", () => {
  const mockRouter = {
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    memberRole: "member" as const,
    organizationId: "org-123",
    currentUserRole: "owner" as const,
    memberId: "member-123",
    userId: "user-456",
    memberAccepted: true,
    inviteId: undefined,
    doesOrgHaveMoreThanOneOwner: true,
    isFormbricksCloud: true,
  };

  describe("Rendering", () => {
    test("renders a dropdown when user is owner", () => {
      render(<EditMembershipRole {...defaultProps} />);

      const button = screen.queryByRole("button-role");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Member");
    });

    test("renders a badge when user is not owner or manager", () => {
      render(<EditMembershipRole {...defaultProps} currentUserRole="member" />);

      const badge = screen.queryByRole("badge-role");
      expect(badge).toBeInTheDocument();
      const button = screen.queryByRole("button-role");
      expect(button).not.toBeInTheDocument();
    });

    test("disables the dropdown when editing own role", () => {
      render(<EditMembershipRole {...defaultProps} memberId="user-456" userId="user-456" />);

      const button = screen.getByRole("button-role");
      expect(button).toBeDisabled();
    });

    test("disables the dropdown when the user is the only owner", () => {
      render(<EditMembershipRole {...defaultProps} memberRole="owner" doesOrgHaveMoreThanOneOwner={false} />);

      const button = screen.getByRole("button-role");
      expect(button).toBeDisabled();
    });

    test("disables the dropdown when a manager tries to edit an owner", () => {
      render(<EditMembershipRole {...defaultProps} currentUserRole="manager" memberRole="owner" />);

      const button = screen.getByRole("button-role");
      expect(button).toBeDisabled();
    });
  });
});
