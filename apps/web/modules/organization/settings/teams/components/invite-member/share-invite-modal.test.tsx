import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ShareInviteModal } from "./share-invite-modal";

const t = (k: string) => k;
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t }) }));

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-title" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

const defaultProps = {
  inviteToken: "test-token",
  open: true,
  setOpen: vi.fn(),
};

describe("ShareInviteModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders dialog and invite link", () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();

    expect(
      screen.getByText("environments.settings.general.organization_invite_link_ready")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "environments.settings.general.share_this_link_to_let_your_organization_member_join_your_organization"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("common.copy_link")).toBeInTheDocument();
  });

  test("calls setOpen when dialog is closed", () => {
    render(<ShareInviteModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });
});
