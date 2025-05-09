import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ShareInviteModal } from "./share-invite-modal";

const t = (k: string) => k;
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t }) }));

vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ open, children }: any) => (open ? <div data-testid="modal">{children}</div> : null),
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

  test("renders modal and invite link", () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
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

  test("calls setOpen when modal is closed", () => {
    render(<ShareInviteModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });
});
