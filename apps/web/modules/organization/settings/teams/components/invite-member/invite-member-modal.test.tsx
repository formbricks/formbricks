import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { InviteMemberModal } from "./invite-member-modal";

const t = (k: string) => k;
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t }) }));

vi.mock("./bulk-invite-tab", () => ({
  BulkInviteTab: () => <div data-testid="bulk-invite-tab">BulkInviteTab</div>,
}));
vi.mock("./individual-invite-tab", () => ({
  IndividualInviteTab: () => <div data-testid="individual-invite-tab">IndividualInviteTab</div>,
}));

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/tab-toggle", () => ({
  TabToggle: ({ options, onChange, defaultSelected }: any) => (
    <select data-testid="tab-toggle" value={defaultSelected} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

const defaultProps = {
  open: true,
  setOpen: vi.fn(),
  onSubmit: vi.fn(),
  teams: [],
  canDoRoleManagement: true,
  isFormbricksCloud: true,
  environmentId: "env-1",
  membershipRole: "owner" as TOrganizationRole,
};

describe("InviteMemberModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders dialog and individual tab by default", () => {
    render(<InviteMemberModal {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();
    expect(screen.getByTestId("individual-invite-tab")).toBeInTheDocument();
    expect(screen.getByTestId("tab-toggle")).toBeInTheDocument();
  });

  test("renders correct texts", () => {
    render(<InviteMemberModal {...defaultProps} />);
    expect(screen.getByText("environments.settings.teams.invite_member")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.invite_member_description")).toBeInTheDocument();
  });
});
