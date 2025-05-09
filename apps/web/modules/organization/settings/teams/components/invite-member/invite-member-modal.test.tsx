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
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ open, children }: any) => (open ? <div data-testid="modal">{children}</div> : null),
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

  test("renders modal and individual tab by default", () => {
    render(<InviteMemberModal {...defaultProps} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByTestId("individual-invite-tab")).toBeInTheDocument();
    expect(screen.getByTestId("tab-toggle")).toBeInTheDocument();
  });

  test("renders correct texts", () => {
    render(<InviteMemberModal {...defaultProps} />);
    expect(screen.getByText("environments.settings.teams.invite_member")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.invite_member_description")).toBeInTheDocument();
  });
});
